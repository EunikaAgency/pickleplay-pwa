#!/usr/bin/env bash
# End-to-end proof of the global PickleFeed: text posts, likes, comments,
# game/open-play/club share cards, reposts, and author-only edit/delete.
# Self-cleaning + re-runnable (every post it creates is deleted at the end).
set -uo pipefail
API=http://localhost:9002/api/v1
A_EMAIL='johnkenneth.tan.dev+player@gmail.com'      # author
B_EMAIL='christianian.i.alcazar@gmail.com'          # the other player
PW=password123

jqp() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)" 2>/dev/null; }
login() { curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$PW\"}" | jqp 'd["data"]["accessToken"]'; }
# code <token> <method> <path> [json]
code() {
  local tok="$1" method="$2" path="$3" data="${4:-}"
  if [ -n "$data" ]; then
    curl -s -o /tmp/feed_body.json -w '%{http_code}' -X "$method" "$API$path" -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' -d "$data"
  else
    curl -s -o /tmp/feed_body.json -w '%{http_code}' -X "$method" "$API$path" -H "Authorization: Bearer $tok"
  fi
}
bget() { python3 -c "import sys,json;d=json.load(open('/tmp/feed_body.json'));print($1)" 2>/dev/null; }

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "  ✅ $1 ($2)"; pass=$((pass+1)); else echo "  ❌ $1 — got '$2', want '$3'"; fail=$((fail+1)); fi; }

T=$(login "$A_EMAIL"); B=$(login "$B_EMAIL")
[ -z "$T" ] && { echo "author login failed"; exit 1; }
[ -z "$B" ] && { echo "other login failed"; exit 1; }
echo "logged in both accounts"

GAME=$(curl -s "$API/games?pageSize=1" | jqp 'd["data"][0]["id"]')
CLUB=$(curl -s "$API/clubs?pageSize=1" | jqp 'd["data"][0]["id"]')
OPENPLAY=$(curl -s "$API/open-play?pageSize=1" | jqp 'd["data"][0]["id"]')
echo "share targets: game=$GAME club=$CLUB openplay=$OPENPLAY"

echo "── 1. create a text post ──────────────────────────────────"
STATUS=$(code "$T" POST /feed/posts '{"body":"PickleFeed e2e — hello court!"}')
check "create text post → 201" "$STATUS" "201"
POST=$(bget 'd["data"]["id"]')
[ -z "$POST" ] && { echo "no post id, aborting"; exit 1; }

echo "── 2. it appears in the global feed ──────────────────────"
FOUND=$(curl -s "$API/feed?pageSize=50" | python3 -c "import sys,json;d=json.load(sys.stdin);print('yes' if any(p['id']=='$POST' for p in d['data']) else 'no')")
check "post in feed" "$FOUND" "yes"

echo "── 3. like / unlike (by the OTHER user) ───────────────────"
STATUS=$(code "$B" POST "/feed/posts/$POST/react")
check "like → 200" "$STATUS" "200"
check "reactionCount = 1" "$(bget 'd["data"]["reactionCount"]')" "1"
STATUS=$(code "$B" POST "/feed/posts/$POST/react")   # idempotent
check "double-like stays 1" "$(bget 'd["data"]["reactionCount"]')" "1"
# viewerReacted reflects per-viewer
VR=$(curl -s "$API/feed/posts/$POST" -H "Authorization: Bearer $B" | jqp 'd["data"]["post"]["viewerReacted"]')
check "B sees viewerReacted true" "$VR" "True"
STATUS=$(code "$B" DELETE "/feed/posts/$POST/react")
check "unlike → reactionCount 0" "$(bget 'd["data"]["reactionCount"]')" "0"

echo "── 4. comment (reply) ────────────────────────────────────"
STATUS=$(code "$B" POST /feed/posts "{\"body\":\"nice one!\",\"parentPostId\":\"$POST\"}")
check "comment → 201" "$STATUS" "201"
CMT=$(bget 'd["data"]["id"]')
RC=$(curl -s "$API/feed/posts/$POST" | jqp 'd["data"]["post"]["replyCount"]')
check "replyCount = 1" "$RC" "1"
INREPLIES=$(curl -s "$API/feed/posts/$POST/replies" | python3 -c "import sys,json;d=json.load(sys.stdin);print('yes' if any(p['id']=='$CMT' for p in d['data']) else 'no')")
check "comment in replies" "$INREPLIES" "yes"

echo "── 5. share a GAME as a card ─────────────────────────────"
STATUS=$(code "$T" POST /feed/posts "{\"body\":\"join us\",\"attachment\":{\"type\":\"game\",\"refId\":\"$GAME\"}}")
check "share game → 201" "$STATUS" "201"
GPOST=$(bget 'd["data"]["id"]')
check "card type game" "$(bget 'd["data"]["attachments"][0]["type"]')" "game"
check "card refId matches" "$(bget 'd["data"]["attachments"][0]["refId"]')" "$GAME"
HASTITLE=$(bget 'bool(d["data"]["attachments"][0]["title"])')
check "card enriched (has title)" "$HASTITLE" "True"

echo "── 6. share an OPEN PLAY session ─────────────────────────"
STATUS=$(code "$T" POST /feed/posts "{\"attachment\":{\"type\":\"open_play\",\"refId\":\"$OPENPLAY\"}}")
check "share open_play → 201" "$STATUS" "201"
OPOST=$(bget 'd["data"]["id"]')
check "card type open_play" "$(bget 'd["data"]["attachments"][0]["type"]')" "open_play"

echo "── 7. share a CLUB ──────────────────────────────────────"
STATUS=$(code "$T" POST /feed/posts "{\"attachment\":{\"type\":\"club\",\"refId\":\"$CLUB\"}}")
check "share club → 201" "$STATUS" "201"
CPOST=$(bget 'd["data"]["id"]')
check "card type club" "$(bget 'd["data"]["attachments"][0]["type"]')" "club"
HASMEMBERS=$(bget 'd["data"]["attachments"][0]["memberCount"] is not None')
check "club card has memberCount" "$HASMEMBERS" "True"

echo "── 8. repost (share ng post ng iba) ──────────────────────"
STATUS=$(code "$B" POST /feed/posts "{\"body\":\"look at this\",\"sharedPostId\":\"$POST\"}")
check "repost → 201" "$STATUS" "201"
RPOST=$(bget 'd["data"]["id"]')
check "sharedPost snapshot present" "$(bget 'bool(d["data"]["sharedPost"])')" "True"
check "sharedPost id matches" "$(bget 'd["data"]["sharedPost"]["id"]')" "$POST"

echo "── 9. author-only edit / delete ──────────────────────────"
STATUS=$(code "$B" PATCH "/feed/posts/$POST" '{"body":"hijack"}')
check "non-author edit → 403" "$STATUS" "403"
STATUS=$(code "$T" PATCH "/feed/posts/$POST" '{"body":"edited by author"}')
check "author edit → 200" "$STATUS" "200"
check "body updated" "$(bget 'd["data"]["body"]')" "edited by author"
STATUS=$(code "$B" DELETE "/feed/posts/$POST")
check "non-author delete → 403" "$STATUS" "403"

echo "── 10. bad share target → 404 ────────────────────────────"
STATUS=$(code "$T" POST /feed/posts '{"attachment":{"type":"game","refId":"000000000000000000000000"}}')
check "share missing game → 404" "$STATUS" "404"

echo "── 11. unauth create → 401 ───────────────────────────────"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/feed/posts" -H 'Content-Type: application/json' -d '{"body":"x"}')
check "no-auth post → 401" "$STATUS" "401"

echo "── cleanup (soft-delete every created post) ──────────────"
for id in "$POST" "$CMT" "$GPOST" "$OPOST" "$CPOST"; do [ -n "$id" ] && code "$T" DELETE "/feed/posts/$id" >/dev/null; done
[ -n "$RPOST" ] && code "$B" DELETE "/feed/posts/$RPOST" >/dev/null
echo "  cleaned up"

echo
echo "═══════════════════════════════════════════════════════════"
echo "  PASS: $pass   FAIL: $fail"
[ "$fail" -eq 0 ] && echo "  ✅ all green" || echo "  ❌ failures above"
exit $([ "$fail" -eq 0 ] && echo 0 || echo 1)
