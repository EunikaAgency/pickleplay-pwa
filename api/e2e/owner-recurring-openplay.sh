#!/usr/bin/env bash
# Recurring Open Play for venue OWNERS (§5.3 of the 8 July minutes), plus the three
# edit scopes the meeting asked for: this occurrence / this-and-future / whole series.
#
# Re-runnable: every series it creates is cancelled at the end.
#
# Run: bash e2e/owner-recurring-openplay.sh
set -uo pipefail
API=${API:-http://localhost:9002/api/v1}
PASS_PW=${PASS_PW:-password123}
ok=0; fail=0
chk() { if [ "$2" = "$3" ]; then echo "  ✅ $1"; ok=$((ok+1)); else echo "  ❌ $1 — expected [$3], got [$2]"; fail=$((fail+1)); fi; }
# Dot-path lookup. (A quoted-key eval breaks: the inner quotes collide with the
# shell's, and every lookup silently returns empty.)
jget() { python3 -c "
import json,sys
d = json.load(sys.stdin)
for k in '$1'.split('.'):
    if not isinstance(d, dict) or k not in d: d = None; break
    d = d[k]
print('' if d is None else d)" 2>/dev/null; }
login() { curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$PASS_PW\"}" | jget "data.accessToken"; }

# A seeded owner whose password we know, and one of THEIR venues. (Picking any
# owner from the venues collection finds accounts with unknown passwords.)
OWNER_EMAIL=${OWNER_EMAIL:-ccdfa3b7.walker@example.com}
PLAYER_EMAIL=${PLAYER_EMAIL:-christianian.i.alcazar@gmail.com}
VENUE_ID=$(mongosh pickleballers --quiet --eval "
  const u = db.users.findOne({email: '$OWNER_EMAIL'}, {_id:1});
  const v = u && db.venues.findOne({ownerUserId: u._id}, {_id:1});
  print(v ? v._id.toString() : '');" 2>/dev/null)
[ -z "$VENUE_ID" ] && { echo "no venue owned by $OWNER_EMAIL"; exit 1; }

OWNER=$(login "$OWNER_EMAIL"); PLAYER=$(login "$PLAYER_EMAIL")
[ -z "$OWNER" ] && { echo "owner login failed ($OWNER_EMAIL)"; exit 1; }
[ -z "$PLAYER" ] && { echo "player login failed"; exit 1; }
echo "owner=$OWNER_EMAIL venue=$VENUE_ID"

echo
echo "── An owner can run a recurring series on their OWN venue ──"
BODY='{"title":"E2E Owner Weekly Open Play","venueId":"'$VENUE_ID'","daysOfWeek":[2,4],"startTime":"18:00","endTime":"20:00","price":250,"capacity":12,"weeksAhead":3}'
RES=$(curl -s -X POST "$API/open-play" -H "Authorization: Bearer $OWNER" -H 'Content-Type: application/json' -d "$BODY")
SERIES=$(echo "$RES" | jget "data.series.id")
COUNT=$(echo "$RES" | jget "data.instanceCount")
chk "owner creates a series (was organizer-only)" "$([ -n "$SERIES" ] && echo yes || echo no)" "yes"
# Not a magic number: the generator walks today..today+21d INCLUSIVE, so two weekdays
# over three weeks is 6 or 7 depending on what day it is today. The invariant that
# actually matters is that the count it reports is the count it really created.
LIVE=$(curl -s "$API/open-play?pageSize=500" | python3 -c "
import json,sys
print(len([s for s in json.load(sys.stdin)['data'] if str(s.get('seriesId'))=='$SERIES']))")
chk "the count it reports is the count it created" "$LIVE" "$COUNT"
chk "it generated a sane number of occurrences" "$([ "$COUNT" -ge 6 ] && [ "$COUNT" -le 7 ] && echo yes || echo no)" "yes"

echo
echo "── A player still cannot — the gate widened, it did not open ──"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/open-play" -H "Authorization: Bearer $PLAYER" \
  -H 'Content-Type: application/json' -d "$BODY")
chk "player creating a series is refused" "$CODE" "403"

echo
echo "── An owner cannot run one at someone ELSE'S venue ──"
OTHER=$(mongosh pickleballers --quiet --eval "
  const u = db.users.findOne({email: '$OWNER_EMAIL'}, {_id:1});
  const v = db.venues.findOne({ownerUserId: {\$nin: [u._id, null]}}, {_id:1});
  print(v ? v._id.toString() : '');" 2>/dev/null)
if [ -n "$OTHER" ]; then
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/open-play" -H "Authorization: Bearer $OWNER" \
    -H 'Content-Type: application/json' -d "{\"title\":\"Nope\",\"venueId\":\"$OTHER\",\"daysOfWeek\":[1],\"startTime\":\"09:00\"}")
  chk "owner at another owner's venue is refused" "$CODE" "403"
fi

# The occurrences, oldest first.
SESSIONS=$(curl -s "$API/open-play?pageSize=500" | python3 -c "
import json,sys
d=json.load(sys.stdin)['data']
rows=[s for s in d if str(s.get('seriesId'))=='$SERIES']
rows.sort(key=lambda s: s['date'])
print(' '.join(s['id'] for s in rows))")
FIRST=$(echo "$SESSIONS" | cut -d' ' -f1)

echo
echo "── Edit ONE occurrence: 'just this week' ──"
curl -s -X PATCH "$API/open-play/$FIRST" -H "Authorization: Bearer $OWNER" \
  -H 'Content-Type: application/json' -d '{"startTime":"19:30","price":400}' > /dev/null
ONE=$(curl -s "$API/open-play/$FIRST" | jget "data.startTime")
chk "the chosen occurrence moved to 19:30" "$ONE" "19:30"
SECOND=$(echo "$SESSIONS" | cut -d' ' -f2)
UNTOUCHED=$(curl -s "$API/open-play/$SECOND" | jget "data.startTime")
chk "the NEXT occurrence is untouched (still 18:00)" "$UNTOUCHED" "18:00"

echo
echo "── Edit the SERIES, scope=future ──"
RES=$(curl -s -X PATCH "$API/open-play/series/$SERIES?scope=future" -H "Authorization: Bearer $OWNER" \
  -H 'Content-Type: application/json' -d '{"price":300,"capacity":16}')
UPD=$(echo "$RES" | jget "data.updatedSessions")
SCOPE=$(echo "$RES" | jget "data.scope")
chk "scope defaults/echoes as 'future'" "$SCOPE" "future"
chk "it rewrote every upcoming occurrence" "$UPD" "$COUNT"
P2=$(curl -s "$API/open-play/$SECOND" | jget "data.price")
chk "an occurrence took the new price" "$P2" "300"
# The single-occurrence edit is deliberately overwritten by a series edit — the
# series is the template, and 'this and future' means exactly that.
P1=$(curl -s "$API/open-play/$FIRST" | jget "data.price")
chk "the series edit also rewrote the one-off (template wins)" "$P1" "300"

echo
echo "── A player cannot edit the series ──"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$API/open-play/series/$SERIES" -H "Authorization: Bearer $PLAYER" \
  -H 'Content-Type: application/json' -d '{"price":0}')
chk "player editing the series is refused" "$CODE" "403"

echo
echo "── Cancel the series (cleanup) ──"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$API/open-play/series/$SERIES/cancel" -H "Authorization: Bearer $OWNER")
chk "owner can cancel their own series" "$CODE" "200"
GONE=$(curl -s "$API/open-play?pageSize=500" | python3 -c "
import json,sys
print(len([s for s in json.load(sys.stdin)['data'] if str(s.get('seriesId'))=='$SERIES']))")
chk "its future occurrences left the public feed" "$GONE" "0"

echo
echo "── A cancelled occurrence cannot be edited ──"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$API/open-play/$FIRST" -H "Authorization: Bearer $OWNER" \
  -H 'Content-Type: application/json' -d '{"price":1}')
chk "editing a cancelled occurrence 409s" "$CODE" "409"

echo
echo "════ $ok passed, $fail failed ════"
[ "$fail" -eq 0 ]
