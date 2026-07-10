#!/usr/bin/env bash
# End-to-end proof for the owner-block guard.
#   1. Maintenance (court-scoped)  -> availability free=0, player booking 409
#   2. Maintenance (venue-wide)    -> every court free=0, player booking 409
#   3. Priced override ₱350        -> still bookable, still ₱350 (no regression)
#   4. Manual reservation + cancel -> 'Reserved' override cleaned up, slot reopens
set -uo pipefail
API=http://localhost:9002/api/v1
# Slug, not ObjectId — resolveVenueId accepts either, and the slug survives a reseed.
VENUE=${VENUE:-the-3rd-shot-homecourt}
DATE=${DATE:-2027-03-16}     # far future: no real bookings to trip over
PASS=${PASS:-password123}
OWNER_EMAIL=${OWNER_EMAIL:-ccdfa3b7.walker@example.com}
PLAYER_EMAIL=${PLAYER_EMAIL:-0418f540.king@example.com}

j() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1" 2>/dev/null; }
ok=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "  PASS  $1 ($2)"; ok=$((ok+1)); else echo "  FAIL  $1 — expected '$3', got '$2'"; fail=$((fail+1)); fi; }

login() { curl -s -m 10 -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$PASS\"}" | j "d['data']['accessToken']"; }

OWNER=$(login "$OWNER_EMAIL")
PLAYER=$(login "$PLAYER_EMAIL")
[ -z "$OWNER" ] && { echo "owner login failed"; exit 1; }
[ -z "$PLAYER" ] && { echo "player login failed"; exit 1; }

# Resolve the venue once. Venue-scoped routes accept the slug, but POST /bookings
# takes venueId in the body and casts it to an ObjectId, so we need the real id.
# Two courts, because venue-wide vs court-scoped is the whole point of the test.
DETAIL=$(curl -s -m 10 "$API/venues/$VENUE")
VENUE=$(echo "$DETAIL" | j "d['data']['id']")
COURTS=$(echo "$DETAIL" | python3 -c "import sys,json;print(' '.join(c['id'] for c in json.load(sys.stdin)['data'].get('courts',[])[:2]))" 2>/dev/null)
COURT=$(echo "$COURTS" | cut -d' ' -f1)
COURT2=$(echo "$COURTS" | cut -d' ' -f2)
[ -z "${VENUE:-}" ] && { echo "venue not found"; exit 1; }
{ [ -z "${COURT:-}" ] || [ -z "${COURT2:-}" ]; } && { echo "need a venue with >=2 courts (got: '$COURTS')"; exit 1; }

wipe() {
  curl -s -m 10 "$API/venues/$VENUE/slot-overrides?date=$DATE" -H "Authorization: Bearer $OWNER" \
    | python3 -c "import sys,json;[print(o['id']) for o in json.load(sys.stdin).get('data',[])]" 2>/dev/null \
    | while read -r id; do curl -s -m 10 -X DELETE "$API/venues/slot-overrides/$id" -H "Authorization: Bearer $OWNER" >/dev/null; done
}

mkoverride() { # courtId(or empty) price note
  local court_json=""; [ -n "$1" ] && court_json="\"courtId\":\"$1\","
  local note_json=""; [ -n "$3" ] && note_json=",\"note\":\"$3\""
  curl -s -m 10 -X POST "$API/venues/$VENUE/slot-overrides" -H "Authorization: Bearer $OWNER" \
    -H 'Content-Type: application/json' \
    -d "{${court_json}\"date\":\"$DATE\",\"startTime\":\"09:00\",\"endTime\":\"10:00\",\"price\":$2${note_json}}" >/dev/null
}

free_at9() { # courtId(or empty)
  local q="date=$DATE"; [ -n "$1" ] && q="$q&courtId=$1"
  curl -s -m 10 "$API/venues/$VENUE/availability?$q" | j "[h['free'] for h in d['data']['hours'] if h['hour']==9][0]"
}

book() { # returns http status
  curl -s -m 10 -o /tmp/_book.json -w '%{http_code}' -X POST "$API/bookings" -H "Authorization: Bearer $PLAYER" \
    -H 'Content-Type: application/json' \
    -d "{\"venueId\":\"$VENUE\",\"courtId\":\"$COURT\",\"date\":\"$DATE\",\"startTime\":\"09:00\",\"endTime\":\"10:00\",\"amount\":$1,\"partySize\":2}"
}

echo "── 1. Maintenance, court-scoped ─────────────────"
wipe; mkoverride "" 350 ""; mkoverride "$COURT" 0 "Maintenance"
check "court free@9"        "$(free_at9 $COURT)"  "0"
check "other court free@9"  "$(free_at9 $COURT2)" "1"
check "player booking"      "$(book 350)"         "409"

echo "── 2. Maintenance, venue-wide ───────────────────"
wipe; mkoverride "" 350 ""; mkoverride "" 0 "Maintenance"
check "court free@9"        "$(free_at9 $COURT)"  "0"
check "other court free@9"  "$(free_at9 $COURT2)" "0"
check "player booking"      "$(book 350)"         "409"

echo "── 3. Priced override — no regression ───────────"
wipe; mkoverride "$COURT" 350 ""
check "court free@9"   "$(free_at9 $COURT)" "1"
st=$(book 350); check "player booking @350" "$st" "201"
BID=$(python3 -c "import json;print(json.load(open('/tmp/_book.json'))['data']['id'])" 2>/dev/null)
check "amount charged" "$(python3 -c "import json;print(json.load(open('/tmp/_book.json'))['data']['amount'])" 2>/dev/null)" "350"
[ -n "$BID" ] && curl -s -m 10 -X PATCH "$API/venues/$VENUE/bookings/$BID" -H "Authorization: Bearer $OWNER" \
  -H 'Content-Type: application/json' -d '{"status":"cancelled"}' >/dev/null

echo "── 4. Manual reservation, then cancel ───────────"
wipe; mkoverride "" 350 ""
MB=$(curl -s -m 10 -X POST "$API/venues/$VENUE/bookings" -H "Authorization: Bearer $OWNER" -H 'Content-Type: application/json' \
  -d "{\"courtId\":\"$COURT\",\"date\":\"$DATE\",\"startTime\":\"09:00\",\"endTime\":\"10:00\",\"bookingType\":\"manual\",\"customerName\":\"Walk-in\",\"amount\":350}")
MBID=$(echo "$MB" | j "d['data']['id']")
mkoverride "$COURT" 0 "Reserved"
check "reserved: court free@9" "$(free_at9 $COURT)" "0"
check "reserved: player booking" "$(book 350)" "409"

curl -s -m 10 -X PATCH "$API/venues/$VENUE/bookings/$MBID" -H "Authorization: Bearer $OWNER" \
  -H 'Content-Type: application/json' -d '{"status":"cancelled"}' >/dev/null
LEFT=$(curl -s -m 10 "$API/venues/$VENUE/slot-overrides?date=$DATE" -H "Authorization: Bearer $OWNER" \
  | python3 -c "import sys,json;print(sum(1 for o in json.load(sys.stdin).get('data',[]) if o.get('note')=='Reserved'))" 2>/dev/null)
check "Reserved override cleaned up" "$LEFT" "0"
check "after cancel: court free@9"   "$(free_at9 $COURT)" "1"
st=$(book 350); check "after cancel: booking @350" "$st" "201"
BID2=$(python3 -c "import json;print(json.load(open('/tmp/_book.json'))['data']['id'])" 2>/dev/null)
check "after cancel: amount"         "$(python3 -c "import json;print(json.load(open('/tmp/_book.json'))['data']['amount'])" 2>/dev/null)" "350"
[ -n "$BID2" ] && curl -s -m 10 -X PATCH "$API/venues/$VENUE/bookings/$BID2" -H "Authorization: Bearer $OWNER" \
  -H 'Content-Type: application/json' -d '{"status":"cancelled"}' >/dev/null

wipe
echo
echo "passed=$ok failed=$fail"
[ "$fail" -eq 0 ]
