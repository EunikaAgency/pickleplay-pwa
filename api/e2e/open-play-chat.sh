#!/usr/bin/env bash
# Open Play group chat, end to end.
#
# Covers BOTH kinds of Open Play:
#   1. player-hosted  — a Game with gameType 'open' (roster = interestedUserIds)
#   2. organizer-run  — an OpenPlaySession (roster = organizer + registrations)
# and the gate that matters: a player who has NOT joined must be locked out.
#
# Self-seeding + re-runnable. Usage: bash e2e/open-play-chat.sh
set -uo pipefail

API=${API:-http://localhost:9002}
HOST_EMAIL=${HOST_EMAIL:-christianian.i.alcazar@gmail.com}
JOINER_EMAIL=${JOINER_EMAIL:-johnkenneth.tan.dev+player@gmail.com}
OUTSIDER_EMAIL=${OUTSIDER_EMAIL:-0418f540.king@example.com}
PASS=${PASS:-password123}

pass=0; fail=0
ok()   { echo "  ✅ $1"; pass=$((pass+1)); }
bad()  { echo "  ❌ $1"; echo "     got: $2"; fail=$((fail+1)); }
check(){ [ "$2" = "$3" ] && ok "$1" || bad "$1" "expected '$3', got '$2'"; }

login() {
  curl -s "$API/api/v1/auth/login" -H 'content-type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$PASS\"}" |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(j.data?.accessToken??j.accessToken??"")}catch{process.stdout.write("")}})'
}

# HTTP status of a call
status() { # method url token [body]
  local m=$1 u=$2 t=$3 b=${4:-}
  if [ -n "$b" ]; then
    curl -s -o /dev/null -w '%{http_code}' -X "$m" "$API$u" -H "authorization: Bearer $t" -H 'content-type: application/json' -d "$b"
  else
    curl -s -o /dev/null -w '%{http_code}' -X "$m" "$API$u" -H "authorization: Bearer $t"
  fi
}

jget() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const p=process.argv[1].split(".");let v=j;for(const k of p)v=v?.[k];process.stdout.write(String(v??""))}catch{process.stdout.write("")}})' "$1"; }

echo "── Logging in ─────────────────────────────────────────"
HOST_T=$(login "$HOST_EMAIL")
JOIN_T=$(login "$JOINER_EMAIL")
OUT_T=$(login "$OUTSIDER_EMAIL")
[ -n "$HOST_T" ] && ok "host logged in"     || { bad "host login" "$HOST_EMAIL"; exit 1; }
[ -n "$JOIN_T" ] && ok "joiner logged in"   || { bad "joiner login" "$JOINER_EMAIL"; exit 1; }
[ -n "$OUT_T" ]  && ok "outsider logged in" || { bad "outsider login" "$OUTSIDER_EMAIL"; exit 1; }

echo
echo "── 1. Player-hosted Open Play (Game, gameType 'open') ─"
GAME=$(curl -s "$API/api/v1/games" -H "authorization: Bearer $HOST_T" -H 'content-type: application/json' \
  -d '{"title":"E2E Open Play chat","gameType":"open","venueName":"E2E Courts","whenLabel":"Tomorrow","timeLabel":"6:30 PM","targetPlayers":8}')
GID=$(echo "$GAME" | jget 'data.id')
[ -n "$GID" ] && ok "open play game created ($GID)" || { bad "create open play game" "$GAME"; exit 1; }

# The host is on the roster from creation.
check "host can read the chat" "$(status GET "/api/v1/games/$GID/messages" "$HOST_T")" "200"

# The joiner has NOT joined yet → locked out. This is the security gate.
check "not-joined player is BLOCKED from reading" "$(status GET "/api/v1/games/$GID/messages" "$JOIN_T")" "403"
check "not-joined player is BLOCKED from posting" "$(status POST "/api/v1/games/$GID/messages" "$JOIN_T" '{"body":"let me in"}')" "403"

# Join via the interest toggle — this is what "joined" means for Open Play.
curl -s -o /dev/null -X POST "$API/api/v1/games/$GID/interest" -H "authorization: Bearer $JOIN_T" -H 'content-type: application/json' -d '{}'
ok "joiner tapped join (interest)"

# THE regression this feature fixes: an interested player must now reach the chat.
check "joined player can now READ the chat" "$(status GET "/api/v1/games/$GID/messages" "$JOIN_T")" "200"
check "joined player can now POST" "$(status POST "/api/v1/games/$GID/messages" "$JOIN_T" '{"body":"hi from the joiner"}')" "201"

# Host sees the joiner's message (many-to-many, not a DM).
HOSTVIEW=$(curl -s "$API/api/v1/games/$GID/messages" -H "authorization: Bearer $HOST_T")
echo "$HOSTVIEW" | grep -q "hi from the joiner" && ok "host sees the joiner's message" || bad "host sees joiner msg" "$HOSTVIEW"

# Leaving revokes chat access again.
curl -s -o /dev/null -X POST "$API/api/v1/games/$GID/interest" -H "authorization: Bearer $JOIN_T" -H 'content-type: application/json' -d '{}'
check "after leaving, access is revoked" "$(status GET "/api/v1/games/$GID/messages" "$JOIN_T")" "403"

curl -s -o /dev/null -X DELETE "$API/api/v1/games/$GID" -H "authorization: Bearer $HOST_T"

echo
echo "── 2. Organizer-run Open Play (OpenPlaySession) ───────"
SESS=$(curl -s "$API/api/v1/open-play?pageSize=1" | jget '0.id')
if [ -z "$SESS" ]; then
  SESS=$(curl -s "$API/api/v1/open-play?pageSize=1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(String(j.data?.[0]?.id??""))}catch{process.stdout.write("")}})')
fi
if [ -z "$SESS" ]; then
  echo "  ⚠️  no open-play session in the DB — skipping section 2"
else
  ok "using session $SESS"
  # Outsider (not joined, not the organizer) must be blocked.
  check "not-joined player is BLOCKED from session chat" "$(status GET "/api/v1/open-play/$SESS/messages" "$OUT_T")" "403"

  curl -s -o /dev/null -X POST "$API/api/v1/open-play/$SESS/join" -H "authorization: Bearer $JOIN_T" -H 'content-type: application/json' -d '{}'
  ok "joiner joined the session"

  check "joined player can READ session chat" "$(status GET "/api/v1/open-play/$SESS/messages" "$JOIN_T")" "200"
  check "joined player can POST to session chat" "$(status POST "/api/v1/open-play/$SESS/messages" "$JOIN_T" '{"body":"hello session"}')" "201"

  MSGS=$(curl -s "$API/api/v1/open-play/$SESS/messages" -H "authorization: Bearer $JOIN_T")
  echo "$MSGS" | grep -q "hello session" && ok "message persisted + read back" || bad "session msg persisted" "$MSGS"

  # viewerIsOrganizer must be present so the app can show the organizer's entry.
  DET=$(curl -s "$API/api/v1/open-play/$SESS" -H "authorization: Bearer $JOIN_T")
  echo "$DET" | grep -q 'viewerIsOrganizer' && ok "detail exposes viewerIsOrganizer" || bad "viewerIsOrganizer on detail" "$(echo "$DET" | head -c 200)"

  curl -s -o /dev/null -X POST "$API/api/v1/open-play/$SESS/leave" -H "authorization: Bearer $JOIN_T" -H 'content-type: application/json' -d '{}'
  check "after leaving, session chat is revoked" "$(status GET "/api/v1/open-play/$SESS/messages" "$JOIN_T")" "403"
fi

echo
echo "── 3. Unauthenticated ────────────────────────────────"
check "no token → 401 on session chat" "$(curl -s -o /dev/null -w '%{http_code}' "$API/api/v1/open-play/000000000000000000000000/messages")" "401"

echo
echo "═══════════════════════════════════════════════════════"
echo "  passed: $pass   failed: $fail"
[ "$fail" -eq 0 ] || exit 1
