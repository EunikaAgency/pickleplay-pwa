#!/usr/bin/env bash
# End-to-end proof of the coach subscription + booking chain.
set -uo pipefail
API=http://localhost:9002/api/v1
PLAYER='johnkenneth.tan.dev+player@gmail.com'   # will become the COACH
BOOKER='christianian.i.alcazar@gmail.com'   # the booking PLAYER
PW=password123

jqp() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)" 2>/dev/null; }
login() { curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$PW\"}" | jqp 'd["data"]["accessToken"]'; }
code() { curl -s -o /tmp/body.json -w '%{http_code}' "$@"; }
ecode() { python3 -c 'import json;print(json.load(open("/tmp/body.json")).get("error",{}).get("code","-"))' 2>/dev/null; }

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "  ✅ $1 ($2)"; pass=$((pass+1)); else echo "  ❌ $1 — got '$2', want '$3'"; fail=$((fail+1)); fi; }

T=$(login "$PLAYER"); B=$(login "$BOOKER")
[ -z "$T" ] && { echo "coach login failed"; exit 1; }
[ -z "$B" ] && { echo "booker login failed"; exit 1; }
echo "logged in both accounts"

# Clean slate
mongosh --quiet pickleballers --eval '
  const u = db.users.findOne({email:"'"$PLAYER"'"});
  db.partnersubscriptions.deleteMany({userId:u._id});
  db.userroles.deleteMany({userId:u._id, role:"coach", scopeType:null});
  db.coachbookings.deleteMany({});
  db.coaches.deleteMany({userId:u._id});
  db.users.updateOne({_id:u._id},{$unset:{coachId:""}});
  db.payments.deleteMany({purpose:"partner_subscription"});
' >/dev/null

echo; echo "1) Subscribe is BLOCKED while the address is incomplete"
mongosh --quiet pickleballers --eval 'db.users.updateOne({email:"'"$PLAYER"'"},{$unset:{address1:"",city:"",province:"",zipcode:""}})' >/dev/null
s=$(code -X POST $API/partner-subscriptions -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"plan":"coach"}')
check "POST /partner-subscriptions -> 400" "$s" "400"
check "  error code" "$(ecode)" "ADDRESS_REQUIRED"
python3 -c 'import json;print("  missing:",json.load(open("/tmp/body.json"))["error"]["missingAddressFields"])'

echo; echo "2) /me reports the address gap"
curl -s $API/partner-subscriptions/me -H "Authorization: Bearer $T" \
 | python3 -c 'import sys,json;d=json.load(sys.stdin)["data"];print("  addressComplete:",d["addressComplete"],"| coach:",d["coach"],"| price:",d["pricing"]["coach"])'

echo; echo "3) Creating a coach profile is BLOCKED without a subscription (402)"
s=$(code -X POST $API/coaches -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"displayName":"Test Coach"}')
check "POST /coaches -> 402" "$s" "402"
check "  error code" "$(ecode)" "SUBSCRIPTION_REQUIRED"

echo; echo "4) Applying to a venue is BLOCKED without a subscription (402)"
VSLUG=$(curl -s "$API/venues?pageSize=1" | jqp 'd["data"][0]["slug"]')
s=$(code -X POST $API/coach-applications -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d "{\"venueId\":\"$VSLUG\"}")
check "POST /coach-applications -> 402" "$s" "402"
check "  error code" "$(ecode)" "SUBSCRIPTION_REQUIRED"

echo; echo "5) Fill the address, then subscribe succeeds"
curl -s -X PATCH $API/auth/me -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"address1":"123 Antero Soriano Hwy","city":"Tanza","province":"Cavite","zipcode":"4108"}' >/dev/null
s=$(code -X POST $API/partner-subscriptions -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"plan":"coach"}')
check "POST /partner-subscriptions -> 201" "$s" "201"
SUB_ID=$(python3 -c 'import json;print(json.load(open("/tmp/body.json"))["data"]["id"])')
python3 -c 'import json;d=json.load(open("/tmp/body.json"))["data"];print("  plan:",d["plan"],"| ₱",d["priceAmount"],"| active:",d["isActive"],"| expires:",d["expiresAt"][:10])'

echo; echo "6) A Payment row was recorded with purpose=partner_subscription"
mongosh --quiet pickleballers --eval '
  const p = db.payments.findOne({purpose:"partner_subscription"},{_id:0,purpose:1,amount:1,status:1,provider:1});
  print("  " + JSON.stringify(p));'

echo; echo "7) The global coach role was granted"
mongosh --quiet pickleballers --eval '
  const u = db.users.findOne({email:"'"$PLAYER"'"});
  const n = db.userroles.countDocuments({userId:u._id, role:"coach", scopeType:null});
  print("  global coach UserRole rows: " + n);'

echo; echo "8) Double-subscribe is rejected (409)"
s=$(code -X POST $API/partner-subscriptions -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"plan":"coach"}')
check "POST /partner-subscriptions again -> 409" "$s" "409"
check "  error code" "$(ecode)" "ALREADY_SUBSCRIBED"

echo; echo "9) NOW the coach profile can be created (re-login to pick up the new role)"
T=$(login "$PLAYER")
s=$(code -X POST $API/coaches -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"displayName":"Coach Mari","specialty":"Dinks","pricePrivatePerHour":800}')
check "POST /coaches -> 201" "$s" "201"
COACH_ID=$(python3 -c 'import json;print(json.load(open("/tmp/body.json"))["data"]["id"])' 2>/dev/null)
echo "  coachId: $COACH_ID"

echo; echo "10) Find Coach (?subscribed=true) — coach is hidden while unlisted, shown once listed"
n=$(curl -s "$API/coaches?subscribed=true" | jqp 'len(d["data"])')
echo "  subscribed+listed coaches before listing: $n"
mongosh --quiet pickleballers --eval 'db.coaches.updateOne({_id:ObjectId("'"$COACH_ID"'")},{$set:{isListed:true}})' >/dev/null
n=$(curl -s "$API/coaches?subscribed=true" | jqp 'len(d["data"])')
check "after isListed=true, subscribed list has 1" "$n" "1"
tot=$(curl -s "$API/coaches" | jqp 'len(d["data"])')
echo "  unfiltered /coaches still returns: $tot (directory intact)"

echo; echo "11) A player books the coach"
TODAY=$(date -d '+3 days' +%F)
s=$(code -X POST $API/coach-bookings -H "Authorization: Bearer $B" -H 'Content-Type: application/json' \
  -d "{\"coachId\":\"$COACH_ID\",\"date\":\"$TODAY\",\"startTime\":\"09:00\",\"notes\":\"Work on my third shot\"}")
check "POST /coach-bookings -> 201" "$s" "201"
BK=$(python3 -c 'import json;print(json.load(open("/tmp/body.json"))["data"]["id"])' 2>/dev/null)
python3 -c 'import json;d=json.load(open("/tmp/body.json"))["data"];print("  status:",d["status"],"| ₱",d["amount"],"(server-derived from the coach rate)")'

echo; echo "12) Same slot again -> 409 SLOT_TAKEN"
s=$(code -X POST $API/coach-bookings -H "Authorization: Bearer $B" -H 'Content-Type: application/json' \
  -d "{\"coachId\":\"$COACH_ID\",\"date\":\"$TODAY\",\"startTime\":\"09:00\"}")
check "duplicate slot -> 409" "$s" "409"
check "  error code" "$(ecode)" "SLOT_TAKEN"

echo; echo "13) Coach cannot book themselves"
s=$(code -X POST $API/coach-bookings -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d "{\"coachId\":\"$COACH_ID\",\"date\":\"$TODAY\",\"startTime\":\"14:00\"}")
check "self-booking -> 400" "$s" "400"
check "  error code" "$(ecode)" "SELF_BOOKING"

echo; echo "14) It lands in both inboxes"
echo -n "  player /coach-bookings/mine: "; curl -s $API/coach-bookings/mine -H "Authorization: Bearer $B" | jqp 'len(d["data"])'
echo -n "  coach  /coach-bookings/coach: "; curl -s $API/coach-bookings/coach -H "Authorization: Bearer $T" | jqp 'len(d["data"])'

echo; echo "15) Coach accepts; a stranger cannot"
s=$(code -X PATCH $API/coach-bookings/$BK/accept -H "Authorization: Bearer $B")
check "player accepting own request -> 403" "$s" "403"
s=$(code -X PATCH $API/coach-bookings/$BK/accept -H "Authorization: Bearer $T")
check "coach accepts -> 200" "$s" "200"
python3 -c 'import json;print("  status now:",json.load(open("/tmp/body.json"))["data"]["status"])'
s=$(code -X PATCH $API/coach-bookings/$BK/accept -H "Authorization: Bearer $T")
check "accepting twice -> 409" "$s" "409"

echo; echo "16) Player was notified"
mongosh --quiet pickleballers --eval '
  const u=db.users.findOne({email:"'"$BOOKER"'"});
  db.notifications.find({userId:u._id,type:/coach_booking/}).sort({createdAt:-1}).limit(2).forEach(n=>print("  "+n.type+": "+n.title));'

echo; echo "17) Public profile shows the Coach badge"
PUID=$(mongosh --quiet pickleballers --eval 'print(db.users.findOne({email:"'"$PLAYER"'"})._id.toString())')
curl -s $API/users/$PUID | python3 -c 'import sys,json;d=json.load(sys.stdin)["data"];print("  ",d["displayName"],"| isCoach:",d["isCoach"],"| isOrganizer:",d["isOrganizer"],"| roles:",d["roles"],"| city:",d["city"])'
echo "  leak check (must all be absent):"
curl -s $API/users/$PUID | python3 -c 'import sys,json;d=json.load(sys.stdin)["data"];[print("   ",k,"leaked!") for k in ("email","phone","address1","zipcode","gcashNumber") if k in d] or print("    none")'

echo; echo "18) Cancel the subscription -> coach vanishes from Find Coach + role revoked"
s=$(code -X DELETE $API/partner-subscriptions/$SUB_ID -H "Authorization: Bearer $T")
check "DELETE /partner-subscriptions/:id -> 200" "$s" "200"
n=$(curl -s "$API/coaches?subscribed=true" | jqp 'len(d["data"])')
check "subscribed coach list now empty" "$n" "0"
mongosh --quiet pickleballers --eval '
  const u = db.users.findOne({email:"'"$PLAYER"'"});
  print("  global coach UserRole rows: " + db.userroles.countDocuments({userId:u._id,role:"coach",scopeType:null}));'
curl -s $API/users/$PUID | python3 -c 'import sys,json;print("  public profile isCoach now:",json.load(sys.stdin)["data"]["isCoach"])'

echo; echo "19) A lapsed coach is no longer bookable"
s=$(code -X POST $API/coach-bookings -H "Authorization: Bearer $B" -H 'Content-Type: application/json' \
  -d "{\"coachId\":\"$COACH_ID\",\"date\":\"$TODAY\",\"startTime\":\"16:00\"}")
check "book a lapsed coach -> 409" "$s" "409"
check "  error code" "$(ecode)" "COACH_NOT_SUBSCRIBED"

echo; echo "20) Lazy expiry: a past expiresAt flips active -> expired on read"
mongosh --quiet pickleballers --eval '
  const u=db.users.findOne({email:"'"$PLAYER"'"});
  db.partnersubscriptions.insertOne({userId:u._id,plan:"coach",status:"active",priceAmount:499,currency:"PHP",startedAt:new Date(Date.now()-9e8),expiresAt:new Date(Date.now()-8.64e7),autoRenew:false,createdAt:new Date(),updatedAt:new Date()});' >/dev/null
curl -s $API/partner-subscriptions/me -H "Authorization: Bearer $T" | jqp 'd["data"]["coach"]' >/dev/null
st=$(mongosh --quiet pickleballers --eval 'const u=db.users.findOne({email:"'"$PLAYER"'"});print(db.partnersubscriptions.findOne({userId:u._id,expiresAt:{$lt:new Date()}}).status)')
check "stale active row swept to expired" "$st" "expired"

echo
echo "════════════════════════════════"
echo "  passed: $pass   failed: $fail"
echo "════════════════════════════════"
[ "$fail" -eq 0 ]
