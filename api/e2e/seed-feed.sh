#!/usr/bin/env bash
# Seed the PickleFeed with 2-3 posts each for 10 random players.
set -uo pipefail
API=http://localhost:9002/api/v1
PW=password123

login() {
  curl -s -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$PW\"}" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['accessToken'])" 2>/dev/null
}

post() {
  local tok="$1" body="$2"
  local json_body
  json_body=$(python3 -c "import sys,json;print(json.dumps(sys.argv[1]))" "$body")
  local resp
  resp=$(curl -s -X POST "$API/feed/posts" \
    -H "Authorization: Bearer $tok" \
    -H 'Content-Type: application/json' \
    -d "{\"body\":$json_body}" 2>/dev/null)
  local id preview
  id=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('data',{}).get('id','FAIL'))" 2>/dev/null)
  preview=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin);print((d.get('data',{}).get('body','') or '')[:60])" 2>/dev/null)
  if [ "$id" = "FAIL" ]; then
    local err
    err=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('error',{}).get('message','unknown'))" 2>/dev/null)
    echo "  ❌ FAIL — $err"
  else
    echo "  ✅ $id — $preview"
  fi
}

posts_for_player() {
  local email="$1" name="$2"; shift 2
  echo ""
  echo "--- $name ($email) ---"
  local TOK
  TOK=$(login "$email")
  if [ -z "$TOK" ] || [ "$TOK" = "null" ]; then
    echo "  ❌ login failed, skipping"
    return
  fi
  local i=1
  for body in "$@"; do
    echo -n "  post${i}: "; post "$TOK" "$body"
    i=$((i+1))
  done
}

echo "=== PickleFeed Seeder: 10 players × 2-3 posts ==="

posts_for_player "christianian.i.alcazar@gmail.com" "Christian" \
  "Who's down for some doubles this Saturday? Need 2 more! 🔥" \
  "Just had the best rally of my life. PickleBall is life." \
  "Game on! Join us this weekend — bring your A-game!"

posts_for_player "dodiaramburo@gmail.com" "Gina" \
  "First time playing outdoors — ang saya! Sun + pickleball = perfect Sunday ☀️" \
  "Shoutout to everyone at the morning session. Great vibes and great people!"

posts_for_player "billyarceo@gmail.com" "Billy Jo" \
  "3-0 today. Undefeated streak continues. 🏆" \
  "Anyone tried the new Selkirk paddle? Thoughts?"

posts_for_player "cebadion@gmail.com" "Darren" \
  "Tip of the day: kitchen footwork matters more than power. Stay light on your toes! 🥋" \
  "Coached 3 beginners today — nothing beats seeing them land their first dink shot." \
  "Drills > Games when you're learning. Spend 30 min on dinking before playing!"

posts_for_player "barrientos_pao@yahoo.com" "Pao" \
  "I came. I saw. I got pickled. 🤪" \
  "PickleBall > gym. Change my mind."

posts_for_player "mbolanosjr@gmail.com" "Manny" \
  "Week 12 at the courts and I'm finally consistent with my serve. Progress feels good!" \
  "Who else is playing tonight? Courts are lit and ready! 🔦🎾"

posts_for_player "giselle@pickleball.ph" "Giselle" \
  "We just hit 50 members at our weekly round-robin! The community is growing so fast 🙌" \
  "Beginner clinic this Sunday 8am — bring a friend, first session free! 🎾"

posts_for_player "johnnoel.cano@gmail.com" "John Noel" \
  "New paddle day! The upgrade feels amazing 😍" \
  "Any recommendations for court shoes? My knees are asking for better support 😅"

posts_for_player "paulcarrasco08@gmail.com" "Paul" \
  "Midnight dinking session hits different. 🌙🎾" \
  "Anyone else play better at night? Something about the cooler air and quiet courts." \
  "Late night crew where you at? Drop your favorite 24hr court!"

posts_for_player "jamescastaneda93@gmail.com" "James" \
  "Day 7 of learning PickleBall — finally understand why they call it the kitchen! 😂" \
  "Won my first game today! Beginner's luck or skill? I'll take either. 🏅"

echo ""
echo "═══════════════════════════════════════"
echo "  Done! Check http://localhost:9002/api/v1/feed"
echo "═══════════════════════════════════════"
