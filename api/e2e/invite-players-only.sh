#!/usr/bin/env bash
# Game invites only ever target PLAYERS.
#
# The rule is directional: an owner may invite a player, but a player may not
# invite an owner. That collapses to "invitees are players" — so it needs no
# inviter-role branching, and it also rules out organizer/staff/admin accounts.
# Coaches keep roleDefault 'player' (coach is a granted role), so they stay
# invitable.
#
# Covers both layers:
#   1. the search that feeds the invite sheet hides non-player accounts
#   2. the POST /games/:id/invite gate a hand-crafted request hits
# and asserts plain people-search (new DM, owner "add member") is NOT narrowed.
#
# Prereqs: API on :9002 with seeded data. Run: bash e2e/invite-players-only.sh
set -uo pipefail

API=http://localhost:9002
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✘ $1"; echo "      got: $2"; }
check(){ [ "$2" = "$3" ] && ok "$1" || bad "$1" "$2 (expected $3)"; }

mq() { mongosh pickleballers --quiet --eval "$1" 2>/dev/null | tr -d '[:space:]'; }
# Same, but keeps inner spaces — display names have them ("Whitney Kent").
mqs() { mongosh pickleballers --quiet --eval "$1" 2>/dev/null | head -1 | sed 's/[[:space:]]*$//'; }

# ── Fixtures: a player-hosted open-play game + one account of each role ────────
GAME=$(mq 'db.games.findOne({gameType:"open", status:"published"})._id.toString()')
HOST_EMAIL=$(mq 'const g=db.games.findOne({gameType:"open",status:"published"}); db.users.findOne({_id:g.creatorId}).email')
PLAYER=$(mq 'db.users.findOne({roleDefault:"player"})._id.toString()')
OWNER=$(mq 'db.users.findOne({roleDefault:"owner"})._id.toString()')
ORGANIZER=$(mq 'db.users.findOne({roleDefault:"organizer"})._id.toString()')
OWNER_NAME=$(mqs 'db.users.findOne({roleDefault:"owner"}).displayName')

echo "game=$GAME host=$HOST_EMAIL"
[ -n "$GAME" ] && [ -n "$OWNER" ] || { echo "FATAL: fixtures missing (seed the DB)"; exit 1; }

TOKEN=$(curl -s -X POST "$API/api/v1/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$HOST_EMAIL\",\"password\":\"password123\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin).get("data",{}).get("accessToken",""))')
[ -n "$TOKEN" ] || { echo "FATAL: could not log in as the game host"; exit 1; }

AUTH="Authorization: Bearer $TOKEN"
JSON='Content-Type: application/json'

# Restore the game's invite list at exit — this script writes to a real game.
BEFORE=$(mq "JSON.stringify(db.games.findOne({_id:ObjectId(\"$GAME\")}).invitedUserIds||[])")
cleanup() {
  mongosh pickleballers --quiet --eval "
    db.games.updateOne({_id:ObjectId(\"$GAME\")}, {\$pull:{invitedUserIds:{user:ObjectId(\"$PLAYER\")}}});
    db.notifications.deleteMany({userId:ObjectId(\"$PLAYER\"), createdAt:{\$gte:new Date(Date.now()-10*60*1000)}});
  " >/dev/null 2>&1
}
trap cleanup EXIT

# ── 1. Search: the invite list hides owner-side accounts ───────────────────────
echo "── search ──"
n=$(curl -s "$API/api/v1/search?q=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$OWNER_NAME")&type=players&invitable=1" \
  -H "$AUTH" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["data"]["players"]))')
check "invitable=1 hides the owner account" "$n" "0"

n=$(curl -s "$API/api/v1/search?q=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$OWNER_NAME")&type=players" \
  -H "$AUTH" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["data"]["players"]))')
[ "$n" -ge 1 ] && ok "plain people-search (DM / add-member) still finds the owner" \
                || bad "plain people-search still finds the owner" "$n results"

n=$(curl -s "$API/api/v1/search?q=a&type=players&invitable=1" -H "$AUTH" \
  | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["data"]["players"]))')
[ "$n" -ge 1 ] && ok "invitable=1 still returns real players" || bad "invitable=1 still returns real players" "$n results"

# ── 2. Gate: POST /invite refuses non-player targets ───────────────────────────
echo "── invite gate ──"
code() { curl -s -o /tmp/inv.json -w '%{http_code}' -X POST "$API/api/v1/games/$GAME/invite" \
  -H "$AUTH" -H "$JSON" -d "{\"userIds\":[$1]}"; }

check "player → owner is refused"     "$(code "\"$OWNER\"")" "403"
check "  … with code NOT_INVITABLE"   "$(python3 -c 'import json;print(json.load(open("/tmp/inv.json"))["error"]["code"])')" "NOT_INVITABLE"
check "player → organizer is refused" "$(code "\"$ORGANIZER\"")" "403"
check "mixed player+owner is refused" "$(code "\"$PLAYER\",\"$OWNER\"")" "403"

# The mixed batch must be all-or-nothing — the player half must not slip through.
n=$(mq "String((db.games.findOne({_id:ObjectId(\"$GAME\")}).invitedUserIds||[]).filter(e=>String(e.user||e)==\"$PLAYER\").length)")
check "  … and records nothing (all-or-nothing)" "$n" "0"

check "player → player succeeds" "$(code "\"$PLAYER\"")" "200"
n=$(mq "String((db.games.findOne({_id:ObjectId(\"$GAME\")}).invitedUserIds||[]).filter(e=>String(e.user||e)==\"$PLAYER\").length)")
check "  … and is recorded on the game" "$n" "1"

# ── 3. No owner-side account is left invited anywhere ─────────────────────────
echo "── data ──"
n=$(mq '
let bad = 0;
db.games.find({invitedUserIds:{$exists:true,$ne:[]}}).forEach(g => {
  (g.invitedUserIds||[]).forEach(e => {
    const u = db.users.findOne({_id: e.user || e}, {roleDefault:1});
    if (u && u.roleDefault !== "player") bad++;
  });
});
String(bad)')
check "no non-player is invited to any game" "$n" "0"

echo
echo "passed: $PASS   failed: $FAIL"
[ "$FAIL" -eq 0 ]
