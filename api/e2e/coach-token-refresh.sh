#!/usr/bin/env bash
# Reproduces the "Coach profile management permission required" bug and proves
# the fix: the token minted at login predates the coach subscription, so it
# lacks coach.profile.manage; the token POST /partner-subscriptions hands back
# carries it. The app now stores that pair.
set -uo pipefail
API=http://localhost:9002/api/v1
EMAIL="tokrefresh.$$@e2e.invalid"
PASS='Testpass123!'
pass=0; fail=0
ok(){ if [ "$1" = "$2" ]; then echo "  PASS  $3 ($2)"; pass=$((pass+1)); else echo "  FAIL  $3 (want $1, got $2)"; fail=$((fail+1)); fi; }

echo "1. register"
REG=$(curl -s -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"displayName\":\"Token Refresh E2E\"}")
STALE=$(echo "$REG" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log((j.data||j).accessToken||"")})')
[ -n "$STALE" ] || { echo "no token: $REG"; exit 1; }

echo "2. address (subscribing requires one)"
curl -s -o /dev/null -X PATCH "$API/auth/me" -H "Authorization: Bearer $STALE" -H 'Content-Type: application/json' \
  -d '{"address1":"1 Test St","city":"Tanza","province":"Cavite","zipcode":"4108"}'

echo "3. the bug: pre-subscription token cannot create a coach profile"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/coaches" -H "Authorization: Bearer $STALE" \
  -H 'Content-Type: application/json' -d '{"displayName":"Token Refresh E2E"}')
ok 403 "$CODE" "stale token -> FORBIDDEN"

echo "4. subscribe (test mode, demo card)"
SUB=$(curl -s -X POST "$API/partner-subscriptions" -H "Authorization: Bearer $STALE" -H 'Content-Type: application/json' \
  -d '{"plan":"coach","card":{"number":"4242424242424242","expiry":"12/34","cvc":"123"}}')
FRESH=$(echo "$SUB" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log((j.data||{}).accessToken||"")})')
[ -n "$FRESH" ] && ok yes yes "subscribe response carries a re-signed accessToken" || ok yes no "subscribe response carries a re-signed accessToken"

echo "5. the stale token STILL fails after paying (this is what the user hit)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/coaches" -H "Authorization: Bearer $STALE" \
  -H 'Content-Type: application/json' -d '{"displayName":"Token Refresh E2E"}')
ok 403 "$CODE" "stale token after paying -> still FORBIDDEN"

echo "6. the token the app now stores works immediately"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/coaches" -H "Authorization: Bearer $FRESH" \
  -H 'Content-Type: application/json' -d '{"displayName":"Token Refresh E2E"}')
ok 201 "$CODE" "fresh token -> coach profile created"

echo "7. and can save rates (the exact call that 403'd on /coach/information)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$API/coaches/me" -H "Authorization: Bearer $FRESH" \
  -H 'Content-Type: application/json' -d '{"pricePrivatePerHour":1200,"priceGroupPerPlayer":400}')
ok 200 "$CODE" "fresh token -> PATCH /coaches/me saves"

echo
echo "$pass passed, $fail failed"
echo "TEST_EMAIL=$EMAIL"
exit $fail
