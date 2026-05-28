#!/usr/bin/env python3
"""
PicklePlay Dummy Data Generator
Reads raw_users.json from randomuser.me and generates all entity data as JSON files.
"""

import json
import random
import os
import uuid
from datetime import datetime, timedelta

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(SCRIPT_DIR, "raw_users.json")) as f:
    raw = json.load(f)

raw_users = raw["results"]
random.seed(42)

# ─── Helpers ──────────────────────────────────────────────

def gen_id():
    return str(uuid.uuid4())[:8]

def pick(lst):
    return random.choice(lst)

def picks(n, lst):
    return random.sample(lst, min(n, len(lst)))

def weighted_bool(true_pct):
    return random.random() < true_pct

def rand_date(start, end):
    delta = end - start
    return start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))

def slugify(s):
    return s.lower().replace(" ", "-").replace("'", "").replace(".", "").replace(",", "")

# ─── Skill levels ─────────────────────────────────────────
SKILL_LEVELS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]
SKILL_LABELS = {
    1.0: "Beginner", 1.5: "Beginner+", 2.0: "Advanced Beginner",
    2.5: "Advanced Beginner+", 3.0: "Intermediate", 3.5: "Intermediate+",
    4.0: "Advanced", 4.5: "Advanced+", 5.0: "Pro"
}
ACCESS_TYPES = ["public", "private", "partner"]
SURFACE_TYPES = ["Hard Court", "Soft Court", "Acrylic", "Concrete", "Asphalt", "Modular Tile", "Cushioned"]
AMENITIES = ["Lights", "Restrooms", "Parking", "Water", "Pro Shop", "Lessons", "Food & Drink", "Wheelchair Accessible", "Shaded Area", "Seating", "Locker Room", "Equipment Rental"]
PLAY_TYPES = ["Open Play", "Private Game", "League Match", "Round Robin", "Tournament"]
EVENT_TYPES = ["Open Play", "Private Game", "League Match", "Round Robin", "Tournament", "Clinic", "Social"]
GAME_STATUSES = ["upcoming", "ongoing", "completed", "cancelled"]
BOOKING_STATUSES = ["confirmed", "checked_in", "completed", "cancelled", "no_show"]

# ─── Philippine-inspired venue data ───────────────────────

VENUES_DATA = [
    {"name": "Sunset Shuffle Courts", "city": "San Diego, California", "lat": 32.7157, "lng": -117.1611},
    {"name": "Manila Metro Pickleball Hub", "city": "Makati, Metro Manila", "lat": 14.5547, "lng": 121.0244},
    {"name": "Pacific Paddle Park", "city": "Long Beach, California", "lat": 33.7701, "lng": -118.1937},
    {"name": "Laguna Lakeside Courts", "city": "Laguna, Philippines", "lat": 14.2731, "lng": 121.4393},
    {"name": "Golden Gate Pickleball Club", "city": "San Francisco, California", "lat": 37.7749, "lng": -122.4194},
    {"name": "Cebu City Sports Complex", "city": "Cebu City, Philippines", "lat": 10.3157, "lng": 123.8854},
    {"name": "Desert Dink Arena", "city": "Phoenix, Arizona", "lat": 33.4484, "lng": -112.0740},
    {"name": "BGC Active Lifestyle Center", "city": "Taguig, Metro Manila", "lat": 14.5563, "lng": 121.0495},
    {"name": "Mountain View Volley Grounds", "city": "Denver, Colorado", "lat": 39.7392, "lng": -104.9903},
    {"name": "Davao Open Court Park", "city": "Davao City, Philippines", "lat": 7.1907, "lng": 125.4553},
    {"name": "Lone Star Pickleball Ranch", "city": "Austin, Texas", "lat": 30.2672, "lng": -97.7431},
    {"name": "Pearl of the Orient Courts", "city": "Manila, Philippines", "lat": 14.5995, "lng": 120.9842},
    {"name": "Windy City Paddle House", "city": "Chicago, Illinois", "lat": 41.8781, "lng": -87.6298},
    {"name": "Ilocos Norte Seaside Courts", "city": "Laoag, Ilocos Norte", "lat": 18.1961, "lng": 120.5936},
    {"name": "Empire State Pickleball Center", "city": "New York, New York", "lat": 40.7128, "lng": -74.0060},
]

PHILIPPINE_CITIES = [
    "Makati, Metro Manila", "Taguig, Metro Manila", "Quezon City, Metro Manila",
    "Mandaluyong, Metro Manila", "Muntinlupa, Metro Manila", "Pasig, Metro Manila",
    "Cebu City, Philippines", "Davao City, Philippines", "Laguna, Philippines",
    "Batangas, Philippines", "Iloilo City, Philippines", "Baguio, Philippines"
]

US_CITIES = [
    "San Diego, California", "Long Beach, California", "San Francisco, California",
    "Phoenix, Arizona", "Denver, Colorado", "Austin, Texas", "Chicago, Illinois",
    "New York, New York", "Portland, Oregon", "Seattle, Washington", "Miami, Florida"
]

COURT_NAMES = ["Crown", "Ace", "Smash", "Volley", "Dink", "Lob", "Drop", "Drive", "Flick", "Slam",
               "Sizzle", "Blitz", "Flash", "Bounce", "Spike", "Rally", "Baseline", "Center", "Side", "Service"]

COACH_SPECIALTIES = ["Beginner Fundamentals", "Advanced Technique", "Doubles Strategy", "Dinking & Volleys",
                     "Serve & Return", "Court Positioning", "Mental Game", "Fitness for Pickleball"]

NEWS_HEADLINES = [
    "Pickleball Participation Hits All-Time High in 2026",
    "New Court Complex Opening in Downtown This Summer",
    "Local Teen Wins Regional Pickleball Championship",
    "Pickleball Clinic for Beginners Drawing Record Attendance",
    "City Parks Department Adds 12 New Pickleball Courts",
    "Pro Pickleball League Expands to 16 Teams",
    "Study Finds Pickleball Improves Cardiovascular Health",
    "Annual Charity Tournament Raises Over $50,000",
    "Pickleball Equipment Innovations to Watch This Year",
    "Senior Centers Embrace Pickleball for Active Aging",
    "Mixed Doubles Tournament Sees Record Registration",
    "How Pickleball Became America's Fastest-Growing Sport",
    "New Pickleball App Helps Players Find Games Instantly",
    "Local Club Hosts Free Beginner Workshop Weekend",
    "Olympic Committee Considers Pickleball for Future Games"
]

NEWS_SNIPPETS = [
    "The sport continues its explosive growth with millions of new players picking up paddles this year alone.",
    "A state-of-the-art facility featuring 20 courts is set to open its doors, featuring pro shop and training center.",
    "At just 16 years old, she dominated the competition, winning three gold medals across singles and doubles.",
    "Players of all skill levels gathered for a weekend of learning, drills, and friendly competition.",
    "The expansion brings much-needed court availability to one of the fastest-growing neighborhoods in the city.",
    "The professional circuit continues to gain traction with increased prize money and broadcast coverage.",
    "Researchers found that regular pickleball play improves heart health, coordination, and social well-being.",
    "The community came together for a weekend of competitive play, raising funds for local youth programs.",
    "From paddle technology to smart court sensors, the equipment landscape is evolving rapidly.",
    "Retirement communities across the country are adding courts and seeing resident engagement soar.",
    "The tournament drew competitors from five states, making it the largest mixed doubles event in the region.",
    "Industry experts cite the sport's low barrier to entry and strong social component as key growth drivers.",
    "Technology is making it easier than ever for players to connect, organize games, and track their progress.",
    "The workshop covered grip techniques, footwork, and basic rules for those new to the sport.",
    "An official announcement could come as early as next year, signaling the sport's arrival on the world stage."
]

# ─── Generate Users (transform randomuser.me) ─────────────

def generate_users(raw_users):
    users = []
    for i, ru in enumerate(raw_users):
        skill = pick(SKILL_LEVELS)
        role = "admin" if i < 2 else ("venue_owner" if i < 5 else "user")
        verified = weighted_bool(0.7)
        users.append({
            "id": f"usr_{gen_id()}",
            "email": ru["email"],
            "firstName": ru["name"]["first"].capitalize(),
            "lastName": ru["name"]["last"].capitalize(),
            "avatar": ru["picture"]["large"],
            "skillLevel": skill,
            "skillLabel": SKILL_LABELS[skill],
            "skillSource": "self_reported",
            "role": role,
            "location": f"{ru['location']['city']}, {ru['location']['state']}",
            "lat": float(ru["location"]["coordinates"]["latitude"]),
            "lng": float(ru["location"]["coordinates"]["longitude"]),
            "bio": f"Pickleball enthusiast. {SKILL_LABELS[skill]} level player.",
            "phone": ru["phone"],
            "verified": verified,
            "badges": [],
            "gamesPlayed": random.randint(0, 200),
            "winRate": round(random.uniform(0.3, 0.9), 2),
            "clubsJoined": random.randint(0, 5),
            "ratingConnected": weighted_bool(0.3),
            "ratingType": pick(["dupr", "utr"]) if weighted_bool(0.3) else None,
            "ratingValue": round(random.uniform(2.0, 5.5), 1) if weighted_bool(0.3) else None,
            "onboardingComplete": True,
            "createdAt": (datetime.now() - timedelta(days=random.randint(1, 365))).isoformat(),
        })
    # Add badges based on stats
    for u in users:
        badges = []
        if u["verified"]:
            badges.append("Verified Player")
        if u["role"] == "admin":
            badges.append("Admin")
        if u["role"] == "venue_owner":
            badges.append("Venue Owner")
        if u["gamesPlayed"] > 100:
            badges.append("Court Veteran")
        if u["gamesPlayed"] > 50:
            badges.append("Regular Player")
        if u["winRate"] > 0.7:
            badges.append("Top Competitor")
        if u["clubsJoined"] >= 3:
            badges.append("Club Hopper")
        if u["skillLevel"] <= 2.0:
            badges.append("Beginner Friendly")
        if u["ratingConnected"] and u.get("ratingType"):
            badges.append(f"{u['ratingType'].upper()} Linked")
        u["badges"] = badges
    return users

# ─── Generate Venues & Courts ─────────────────────────────

def generate_venues():
    venues = []
    all_courts = []
    for i, vd in enumerate(VENUES_DATA):
        vid = f"ven_{gen_id()}"
        court_count = random.randint(3, 8)
        access = pick(ACCESS_TYPES)
        surface = pick(SURFACE_TYPES)

        venue_amenities = picks(random.randint(3, 8), AMENITIES)
        if "Lights" not in venue_amenities and weighted_bool(0.6):
            venue_amenities.append("Lights")
        if "Parking" not in venue_amenities:
            venue_amenities.append("Parking")

        venues.append({
            "id": vid,
            "name": vd["name"],
            "slug": slugify(vd["name"]),
            "address": f"{random.randint(100, 9999)} {pick(['Main St', 'Park Ave', 'Court Blvd', 'Sports Dr', 'Paddle Ln', 'Dink Way', 'Volley Rd'])}",
            "city": vd["city"],
            "lat": vd["lat"] + random.uniform(-0.05, 0.05),
            "lng": vd["lng"] + random.uniform(-0.05, 0.05),
            "courtCount": court_count,
            "surface": surface,
            "accessType": access,
            "amenities": venue_amenities,
            "description": f"{vd['name']} is a premier pickleball destination featuring {court_count} {'indoor' if weighted_bool(0.4) else 'outdoor'} {surface.lower()} courts. {'Open to the public' if access == 'public' else 'Private member access' if access == 'private' else 'Partner facility with exclusive access'} offering {' and '.join(venue_amenities[:3])}.",
            "hours": {
                "weekday": f"{random.randint(6, 8):02d}:00 - {random.randint(20, 22):02d}:00",
                "weekend": f"{random.randint(7, 9):02d}:00 - {random.randint(18, 20):02d}:00"
            },
            "phone": f"+1 ({random.randint(200, 999)}) {random.randint(100, 999)}-{random.randint(1000, 9999)}",
            "email": f"info@{slugify(vd['name'])}.com",
            "website": f"https://{slugify(vd['name'])}.com",
            "heroImage": f"https://loremflickr.com/1200/600/pickleball-court?random={slugify(vd['name'])}",
            "rating": round(random.uniform(3.5, 5.0), 1),
            "reviewCount": random.randint(5, 80),
            "isPartner": access == "partner",
            "isClaimed": weighted_bool(0.5),
            "isIndoor": weighted_bool(0.4),
            "pricePerHour": random.randint(5, 25),
            "status": "active",
            "createdAt": (datetime.now() - timedelta(days=random.randint(30, 600))).isoformat(),
        })

        # Generate courts for this venue
        court_names_used = []
        for j in range(court_count):
            cn = pick([c for c in COURT_NAMES if c not in court_names_used] + [f"Court {j+1}"])
            court_names_used.append(cn)
            all_courts.append({
                "id": f"crt_{gen_id()}",
                "venueId": vid,
                "name": f"{cn} Court",
                "number": j + 1,
                "surface": surface,
                "isIndoor": venues[-1]["isIndoor"],
                "pricePerHour": venues[-1]["pricePerHour"] + random.randint(-3, 3),
                "status": pick(["active", "active", "active", "active", "maintenance"]),
                "description": f"{'Indoor' if venues[-1]['isIndoor'] else 'Outdoor'} {surface.lower()} court.",
            })

    return venues, all_courts


# ─── Generate Clubs ───────────────────────────────────────

def generate_clubs(users):
    club_names = [
        "Manila Pickleball Society", "West Coast Dinkers", "Laguna Paddle Club",
        "Bay Area Pickleball Association", "Cebu Racquet Collective", "Desert Rally Club",
        "BGC Kitchen Crew", "Mountain Volley Club", "Davao Smash Society",
        "Lone Star Pickleball Club", "Windy City Dink Union", "Empire Paddle Club",
        "Sunset Beach Pickleball", "Ilocos Norte Net Club", "Pacific Coast Picklers"
    ]
    clubs = []
    for i in range(12):
        cid = f"clb_{gen_id()}"
        admin = pick(users)
        members = picks(random.randint(8, 30), [u for u in users if u["id"] != admin["id"]])
        visibility = pick(["public", "public", "public", "private"])
        skill_min = pick(SKILL_LEVELS[:6])
        skill_max = pick([s for s in SKILL_LEVELS if s >= skill_min])
        club = {
            "id": cid,
            "name": club_names[i],
            "slug": slugify(club_names[i]),
            "description": f"A vibrant pickleball community dedicated to fun, fitness, and friendly competition. {'Open to all skill levels.' if visibility == 'public' else 'An exclusive club for dedicated players.'}",
            "visibility": visibility,
            "skillMin": skill_min,
            "skillMax": skill_max,
            "memberCount": len(members) + 1,
            "photoUrl": f"https://loremflickr.com/800/400/pickleball-court?random={slugify(club_names[i])}",
            "avatarUrl": f"https://loremflickr.com/200/200/pickleball-logo?random=avatar_{slugify(club_names[i])}",
            "rules": "1. Respect other players. 2. Wait your turn. 3. Have fun! 4. Keep the courts clean. 5. Invite new players.",
            "tags": picks(random.randint(2, 4), ["Competitive", "Social", "Beginner-friendly", "Tournament", "Weekend", "Evening", "Senior", "Family", "LGBTQ+ Friendly", "Professional"]),
            "createdBy": admin["id"],
            "admins": [admin["id"]] + picks(1, [m["id"] for m in members[:5]]) if members else [admin["id"]],
            "memberIds": [m["id"] for m in members],
            "createdAt": (datetime.now() - timedelta(days=random.randint(30, 500))).isoformat(),
        }
        clubs.append(club)
    return clubs


# ─── Generate Games ───────────────────────────────────────

def generate_games(users, venues):
    games = []
    now = datetime.now()
    for i in range(30):
        gid = f"gme_{gen_id()}"
        venue = pick(venues)
        organizer = pick(users)
        participants = picks(random.randint(2, 8), [u for u in users if u["id"] != organizer["id"]])
        skill_min = pick(SKILL_LEVELS[:6])
        skill_max = pick([s for s in SKILL_LEVELS if s >= skill_min and s <= skill_min + 2.0])
        player_limit = pick([4, 6, 8, 12, 16])

        # Mix of upcoming, ongoing, completed
        if i < 15:
            game_date = now + timedelta(days=random.randint(1, 30), hours=random.randint(8, 12))
            status = "upcoming"
        elif i < 20:
            game_date = now - timedelta(hours=random.randint(0, 3))
            status = "ongoing"
        else:
            game_date = now - timedelta(days=random.randint(1, 60))
            status = "completed"

        event_type = pick(EVENT_TYPES)

        games.append({
            "id": gid,
            "title": f"{pick(['Friday', 'Saturday', 'Sunday', 'Weekend', 'Morning', 'Evening', 'Afternoon'])} {event_type}",
            "eventType": event_type,
            "format": pick(["singles", "doubles", "open_play"]),
            "venueId": venue["id"],
            "venueName": venue["name"],
            "organizerId": organizer["id"],
            "organizerName": f"{organizer['firstName']} {organizer['lastName']}",
            "organizerAvatar": organizer["avatar"],
            "skillMin": skill_min,
            "skillMax": skill_max,
            "playerLimit": player_limit,
            "participantCount": len(participants) + 1,
            "participantIds": [organizer["id"]] + [p["id"] for p in participants],
            "gameDate": game_date.strftime("%Y-%m-%d"),
            "startTime": f"{random.randint(6, 19):02d}:00",
            "endTime": f"{random.randint(7, 20):02d}:00",
            "visibility": pick(["public", "public", "public", "private"]),
            "description": f"A fun {event_type.lower()} for players of all levels. Come join us!",
            "isRecurring": weighted_bool(0.2),
            "beginnerFriendly": weighted_bool(0.4),
            "status": status,
            "fee": random.randint(0, 15) if weighted_bool(0.3) else None,
            "createdAt": (now - timedelta(days=random.randint(1, 60))).isoformat(),
        })
    return games


# ─── Generate Bookings ────────────────────────────────────

def generate_bookings(users, venues, all_courts):
    bookings = []
    now = datetime.now()
    for i in range(25):
        venue = pick(venues)
        venue_courts = [c for c in all_courts if c["venueId"] == venue["id"]]
        if not venue_courts:
            continue
        court = pick(venue_courts)
        user = pick(users)
        days_offset = random.randint(-10, 14)
        if days_offset < 0:
            status = "completed"
        elif days_offset == 0:
            status = pick(["confirmed", "checked_in"])
        else:
            status = pick(["confirmed", "confirmed", "confirmed", "pending"])

        booking_date = now + timedelta(days=days_offset)
        start_hour = random.randint(8, 18)

        bookings.append({
            "id": f"bkg_{gen_id()}",
            "userId": user["id"],
            "userName": f"{user['firstName']} {user['lastName']}",
            "userAvatar": user["avatar"],
            "venueId": venue["id"],
            "venueName": venue["name"],
            "courtId": court["id"],
            "courtName": court["name"],
            "date": booking_date.strftime("%Y-%m-%d"),
            "startTime": f"{start_hour:02d}:00",
            "endTime": f"{start_hour + 1:02d}:00",
            "durationHours": 1,
            "price": venue["pricePerHour"],
            "status": status,
            "guestCount": random.randint(0, 3),
            "cancellationPolicy": "Free cancellation up to 24 hours before booking.",
            "createdAt": (now - timedelta(days=random.randint(1, 20))).isoformat(),
        })
    return bookings


# ─── Generate Competition Data ─────────────────────────────

def generate_competition(users, venues):
    now = datetime.now()

    leagues = []
    for i in range(4):
        lid = f"lge_{gen_id()}"
        teams = []
        team_names = ["Smash Brothers", "The Dinkers", "Net Ninjas", "Kitchen Kings", "Volley Vandals",
                      "Paddle Power", "Baseline Blasters", "Drop Shot Crew", "Lob Stars", "Ace Makers"]
        for j in range(random.randint(4, 8)):
            team_members = picks(random.randint(2, 4), users)
            teams.append({
                "id": f"t_{gen_id()}",
                "name": team_names[j],
                "memberIds": [m["id"] for m in team_members],
                "wins": random.randint(0, 10),
                "losses": random.randint(0, 10),
                "points": random.randint(10, 100),
            })

        # Calculate standings from wins/losses
        teams.sort(key=lambda t: t["wins"], reverse=True)
        for rank, team in enumerate(teams, 1):
            team["rank"] = rank
            team["winPct"] = round(team["wins"] / max(team["wins"] + team["losses"], 1), 3)
            team["streak"] = random.choice(["W1", "W2", "W3", "L1", "L2", "W1", "W4", "L1"])

        leagues.append({
            "id": lid,
            "name": pick(["Summer Slam League", "Spring Classic League", "Fall Championship", "Winter Indoor League"]),
            "season": f"Season {random.randint(1, 5)}",
            "division": pick(["Open", "Intermediate", "Advanced", "Recreational"]),
            "skillMin": 2.0 if i > 1 else 3.0,
            "skillMax": 4.0 if i > 1 else 5.0,
            "teamCount": len(teams),
            "teams": teams,
            "startDate": (now - timedelta(days=30)).strftime("%Y-%m-%d"),
            "endDate": (now + timedelta(days=30)).strftime("%Y-%m-%d"),
            "status": pick(["registration", "in_progress", "completed"]),
            "registrationFee": random.randint(20, 100) if weighted_bool(0.6) else 0,
            "venueId": pick(venues)["id"],
            "createdAt": (now - timedelta(days=60)).isoformat(),
        })

    tournaments = []
    for i in range(3):
        tid = f"trn_{gen_id()}"
        venue = pick(venues)
        registrants = picks(random.randint(8, 20), users)
        tournaments.append({
            "id": tid,
            "name": pick(["City Championship", "Open Invitational", "Summer Smash", "Dink & Drink Classic", "Pro-Am Challenge"]),
            "venueId": venue["id"],
            "venueName": venue["name"],
            "type": pick(["Singles", "Doubles", "Mixed Doubles"]),
            "format": pick(["Single Elimination", "Double Elimination", "Pool Play + Bracket"]),
            "skillMin": pick(SKILL_LEVELS[:4]),
            "skillMax": pick(SKILL_LEVELS[4:]),
            "startDate": (now + timedelta(days=random.randint(10, 60))).strftime("%Y-%m-%d"),
            "endDate": (now + timedelta(days=random.randint(12, 63))).strftime("%Y-%m-%d"),
            "registrationDeadline": (now + timedelta(days=random.randint(1, 20))).strftime("%Y-%m-%d"),
            "registrationFee": random.randint(25, 75),
            "status": pick(["registration", "registration", "upcoming"]),
            "registrantCount": len(registrants),
            "maxRegistrants": random.randint(16, 32),
            "registrantIds": [r["id"] for r in registrants],
            "prize": pick(["Trophy + $500", "Medals + Gift Cards", "Championship Belts", "Prize Pool $1000", None]),
            "description": f"Annual {pick(['competitive', 'friendly', 'intense', 'community'])} tournament for pickleball enthusiasts.",
        })

    # Ladders
    ladders = []
    ladder_names = ["City Challenge Ladder", "Weekend Warrior Ladder", "Club Rankings Ladder"]
    for ln in ladder_names:
        ladder_players = picks(random.randint(6, 15), users)
        ranked = []
        for rank, p in enumerate(ladder_players, 1):
            ranked.append({
                "rank": rank,
                "playerId": p["id"],
                "playerName": f"{p['firstName']} {p['lastName']}",
                "playerAvatar": p["avatar"],
                "points": random.randint(50, 200) - (rank * 5),
                "wins": random.randint(0, 15),
                "losses": random.randint(0, 15),
                "streak": random.choice(["W1", "W2", "L1", "W3", "L2", "W5", "L1", "W1"]),
            })
        ranked.sort(key=lambda x: x["points"], reverse=True)
        for rank, p in enumerate(ranked, 1):
            p["rank"] = rank

        ladders.append({
            "id": f"lad_{gen_id()}",
            "name": ln,
            "type": pick(["challenge", "ranking"]),
            "players": ranked,
            "playerCount": len(ranked),
            "currentLeader": ranked[0]["playerName"] if ranked else None,
        })

    return {"leagues": leagues, "tournaments": tournaments, "ladders": ladders}


# ─── Generate Pricing Plans ───────────────────────────────

def generate_pricing():
    return {
        "plans": [
            {
                "id": "plan_free",
                "name": "Free",
                "price": 0,
                "interval": "month",
                "description": "Perfect for casual players",
                "features": [
                    "Browse venues and courts",
                    "Join public games",
                    "Basic player profile",
                    "Community access",
                    "Game notifications"
                ],
                "highlight": False,
                "cta": "Get Started",
            },
            {
                "id": "plan_plus",
                "name": "Plus",
                "price": 9.99,
                "interval": "month",
                "description": "For regular players",
                "features": [
                    "Everything in Free",
                    "Unlimited court bookings",
                    "Create games & events",
                    "Advanced player stats",
                    "Priority support",
                    "Ad-free experience"
                ],
                "highlight": True,
                "cta": "Subscribe",
                "popular": True,
            },
            {
                "id": "plan_pro",
                "name": "Pro",
                "price": 19.99,
                "interval": "month",
                "description": "For organizers and enthusiasts",
                "features": [
                    "Everything in Plus",
                    "Create & manage clubs",
                    "Organize tournaments",
                    "Member management tools",
                    "Revenue analytics",
                    "Priority listing for venues",
                    "API access"
                ],
                "highlight": False,
                "cta": "Subscribe",
            },
            {
                "id": "plan_annual",
                "name": "Pro Annual",
                "price": 199.99,
                "interval": "year",
                "description": "Best value for dedicated players",
                "features": [
                    "Everything in Pro",
                    "2 months free",
                    "Exclusive event access",
                    "Early bird tournament registration",
                    "Featured player profile"
                ],
                "highlight": False,
                "cta": "Subscribe",
                "badge": "Save 17%",
            }
        ],
        "addOns": [
            {"name": "Extra Guest Pass", "price": 4.99, "description": "Add one additional guest to any booking"},
            {"name": "Court Insurance", "price": 1.99, "description": "Cancel any booking with full refund up to 1 hour before"},
            {"name": "Premium Profile Badge", "price": 2.99, "description": "Stand out with a verified premium badge on your profile"},
        ]
    }


# ─── Generate Coaches ─────────────────────────────────────

def generate_coaches(users):
    coach_users = users[:10]  # First 10 users as coaches
    coaches = []
    for i, u in enumerate(coach_users):
        hourly = pick([25, 30, 35, 40, 45, 50, 60, 75])
        coaches.append({
            "id": f"coh_{gen_id()}",
            "userId": u["id"],
            "name": f"{u['firstName']} {u['lastName']}",
            "avatar": u["avatar"],
            "bio": f"Certified pickleball coach with {random.randint(2, 10)} years of experience. Specializing in {pick(COACH_SPECIALTIES).lower()}.",
            "credentials": pick(["IPTPA Certified", "PPR Certified", "USAPA Certified", "Professional Player", "Level 2 Instructor"]),
            "specialties": picks(random.randint(2, 5), COACH_SPECIALTIES),
            "hourlyRate": hourly,
            "lessonTypes": picks(random.randint(1, 3), ["Private", "Group", "Clinic"]),
            "location": u["location"],
            "rating": round(random.uniform(4.0, 5.0), 1),
            "reviewCount": random.randint(3, 40),
            "availability": ["Monday", "Wednesday", "Friday", "Saturday"] if weighted_bool(0.5) else ["Tuesday", "Thursday", "Sunday"],
            "yearsExperience": random.randint(2, 12),
        })
    return coaches


# ─── Generate Groups ──────────────────────────────────────

def generate_groups(users):
    group_data = [
        ("Early Bird Picklers", "Morning players group", "Social"),
        ("Weekend Warriors", "Weekend competitive play", "Competitive"),
        ("Beginner Friendly Circle", "Learn and play together", "Social"),
        ("Advanced Tactical Training", "Strategy and technique", "Competitive"),
        ("South Bay Pickleball", "Local south bay players", "Local"),
        ("Senior Smash Society", "Active seniors group", "Social"),
        ("Mixed Doubles Matchmakers", "Find your doubles partner", "Social"),
        ("Tournament Prep Team", "Train for tournaments", "Competitive"),
    ]
    groups = []
    for name, desc, cat in group_data:
        gid = f"grp_{gen_id()}"
        admin = pick(users)
        members = picks(random.randint(5, 20), [u for u in users if u["id"] != admin["id"]])
        groups.append({
            "id": gid,
            "name": name,
            "slug": slugify(name),
            "description": desc,
            "category": cat,
            "avatarUrl": f"https://loremflickr.com/200/200/pickleball-logo?random=group_{slugify(name)}",
            "coverUrl": f"https://loremflickr.com/800/400/pickleball-group?random=cover_{slugify(name)}",
            "memberCount": len(members) + 1,
            "adminId": admin["id"],
            "memberIds": [admin["id"]] + [m["id"] for m in members],
            "visibility": pick(["public", "public", "public", "private"]),
            "createdAt": (datetime.now() - timedelta(days=random.randint(10, 300))).isoformat(),
        })
    return groups


# ─── Generate News ────────────────────────────────────────

def generate_news(users):
    news = []
    for i in range(12):
        author = pick(users)
        news.append({
            "id": f"nws_{gen_id()}",
            "title": NEWS_HEADLINES[i],
            "slug": slugify(NEWS_HEADLINES[i]),
            "snippet": NEWS_SNIPPETS[i],
            "content": f"{NEWS_SNIPPETS[i]}\n\nThis is a longer article about {NEWS_HEADLINES[i].lower()}. The pickleball community continues to grow and evolve, bringing new opportunities for players of all skill levels to connect, compete, and enjoy the sport. Local venues are reporting increased participation, and new facilities are being built to meet the demand.\n\nIndustry experts attribute this growth to the sport's unique combination of social interaction, physical activity, and accessibility. Unlike many other sports, pickleball has a low barrier to entry while still offering depth for competitive play.\n\nStay tuned for more updates and developments in the world of pickleball.",
            "imageUrl": f"https://loremflickr.com/800/400/pickleball-news?random=news_{i}",
            "category": pick(["Pro", "Tips", "Local", "Gear", "Events", "Health"]),
            "authorId": author["id"],
            "authorName": f"{author['firstName']} {author['lastName']}",
            "authorAvatar": author["avatar"],
            "readTime": f"{random.randint(3, 8)} min read",
            "publishedAt": (datetime.now() - timedelta(days=random.randint(0, 60))).isoformat(),
            "tags": picks(2, ["pickleball", "sports", "community", "health", "fitness", "tournament", "tips", "beginner"]),
        })
    return news


# ─── Generate Reviews ─────────────────────────────────────

def generate_reviews(users, venues):
    reviews = []
    for _ in range(40):
        user = pick(users)
        venue = pick(venues)
        rating = random.randint(3, 5)
        review_texts = {
            5: ["Best courts in town! Well maintained and great atmosphere.", "Absolutely love this place. The amenities are top-notch.", "Fantastic facility with friendly staff and great courts."],
            4: ["Great courts, clean and well-lit. Would recommend!", "Good venue with solid amenities. Parking can be tight.", "Nice place to play. Courts are in good condition."],
            3: ["Decent courts but could use some maintenance.", "Average facility. Gets crowded on weekends.", "Okay courts but nothing special. Adequate for casual play."],
        }
        reviews.append({
            "id": f"rvw_{gen_id()}",
            "venueId": venue["id"],
            "userId": user["id"],
            "userName": f"{user['firstName']} {user['lastName']}",
            "userAvatar": user["avatar"],
            "rating": rating,
            "text": pick(review_texts[rating]),
            "createdAt": (datetime.now() - timedelta(days=random.randint(1, 180))).isoformat(),
        })
    return reviews


# ─── Generate Cities / SEO Data ───────────────────────────

def generate_cities(venues):
    city_map = {}
    for v in venues:
        city = v["city"]
        if city not in city_map:
            city_map[city] = {
                "name": city.split(",")[0].strip(),
                "state": city.split(",")[1].strip() if "," in city else "",
                "slug": slugify(city),
                "venueCount": 0,
            }
        city_map[city]["venueCount"] += 1
    return list(city_map.values())


# ─── Generate Payment History ─────────────────────────────

def generate_payments(users):
    payments = []
    now = datetime.now()
    for _ in range(30):
        user = pick(users)
        payments.append({
            "id": f"pay_{gen_id()}",
            "userId": user["id"],
            "description": pick(["Court Booking", "Event Registration", "Membership Fee", "Tournament Fee", "Clinic Registration"]),
            "amount": round(random.uniform(5, 100), 2),
            "status": pick(["paid", "paid", "paid", "refunded", "pending"]),
            "method": pick(["Visa •••• 4242", "Mastercard •••• 8888", "Amex •••• 9000", "PayPal"]),
            "createdAt": (now - timedelta(days=random.randint(1, 90))).isoformat(),
        })
    return payments


# ─── Generate Messages ────────────────────────────────────

def generate_messages(users):
    message_texts = [
        "Hey, looking forward to the game!",
        "Can we start at 6 instead of 5?",
        "I'm bringing a friend, is that okay?",
        "Great game yesterday! Let's play again soon.",
        "Anyone need a partner for the tournament?",
        "The court is booked for Saturday at 10am.",
        "I can't make it today, sorry!",
        "Does anyone have an extra paddle?",
        "Great rally on that last point!",
        "Who's in for next week?",
        "Don't forget to bring water, it's going to be hot.",
        "I'll bring the snacks!",
    ]
    messages = []
    now = datetime.now()
    for _ in range(50):
        sender = pick(users)
        messages.append({
            "id": f"msg_{gen_id()}",
            "senderId": sender["id"],
            "senderName": f"{sender['firstName']} {sender['lastName']}",
            "senderAvatar": sender["avatar"],
            "body": pick(message_texts),
            "createdAt": (now - timedelta(hours=random.randint(0, 168))).isoformat(),
        })
    return messages


# ─── Generate Notifications ───────────────────────────────

def generate_notifications(users):
    types = ["game_invite", "booking_confirmed", "booking_reminder", "waitlist_update", "chat_message", "event_update", "membership_expiring"]
    titles = {
        "game_invite": "You're invited to a game!",
        "booking_confirmed": "Booking confirmed",
        "booking_reminder": "Your booking is tomorrow",
        "waitlist_update": "You moved up the waitlist",
        "chat_message": "New message in group chat",
        "event_update": "Event details updated",
        "membership_expiring": "Your membership is expiring",
    }
    notifs = []
    now = datetime.now()
    for _ in range(30):
        user = pick(users)
        nt = pick(types)
        notifs.append({
            "id": f"ntf_{gen_id()}",
            "userId": user["id"],
            "type": nt,
            "title": titles[nt],
            "body": f"This is a notification about {nt.replace('_', ' ')} for {user['firstName']}.",
            "isRead": weighted_bool(0.5),
            "createdAt": (now - timedelta(hours=random.randint(0, 168))).isoformat(),
        })
    return notifs


# ─── Generate User Favorites ──────────────────────────────

def generate_favorites(users, venues, clubs):
    favs = []
    for user in users[:20]:  # 20 users have favorites
        if weighted_bool(0.7):
            for v in picks(random.randint(1, 5), venues):
                favs.append({
                    "userId": user["id"],
                    "itemId": v["id"],
                    "itemType": "venue",
                    "itemName": v["name"],
                })
        if weighted_bool(0.5):
            for c in picks(random.randint(1, 3), clubs):
                favs.append({
                    "userId": user["id"],
                    "itemId": c["id"],
                    "itemType": "club",
                    "itemName": c["name"],
                })
    return favs


# ─── Main Generation ──────────────────────────────────────

def main():
    print("Generating dummy data...")

    users = generate_users(raw_users)
    print(f"  ✓ {len(users)} users")

    venues, all_courts = generate_venues()
    print(f"  ✓ {len(venues)} venues, {len(all_courts)} courts")

    clubs = generate_clubs(users)
    print(f"  ✓ {len(clubs)} clubs")

    games = generate_games(users, venues)
    print(f"  ✓ {len(games)} games")

    bookings = generate_bookings(users, venues, all_courts)
    print(f"  ✓ {len(bookings)} bookings")

    competition = generate_competition(users, venues)
    print(f"  ✓ {len(competition['leagues'])} leagues, {len(competition['tournaments'])} tournaments, {len(competition['ladders'])} ladders")

    pricing = generate_pricing()
    print(f"  ✓ {len(pricing['plans'])} pricing plans")

    coaches = generate_coaches(users)
    print(f"  ✓ {len(coaches)} coaches")

    groups = generate_groups(users)
    print(f"  ✓ {len(groups)} groups")

    news = generate_news(users)
    print(f"  ✓ {len(news)} news articles")

    reviews = generate_reviews(users, venues)
    print(f"  ✓ {len(reviews)} reviews")

    cities = generate_cities(venues)
    print(f"  ✓ {len(cities)} cities")

    payments = generate_payments(users)
    print(f"  ✓ {len(payments)} payments")

    messages = generate_messages(users)
    print(f"  ✓ {len(messages)} messages")

    notifications = generate_notifications(users)
    print(f"  ✓ {len(notifications)} notifications")

    favorites = generate_favorites(users, venues, clubs)
    print(f"  ✓ {len(favorites)} favorites")

    # Write all files
    output = {
        "users.json": users,
        "venues.json": venues,
        "courts.json": all_courts,
        "clubs.json": clubs,
        "games.json": games,
        "bookings.json": bookings,
        "competition.json": competition,
        "pricing.json": pricing,
        "coaches.json": coaches,
        "groups.json": groups,
        "news.json": news,
        "reviews.json": reviews,
        "cities.json": cities,
        "payments.json": payments,
        "messages.json": messages,
        "notifications.json": notifications,
        "favorites.json": favorites,
    }

    for filename, data in output.items():
        filepath = os.path.join(SCRIPT_DIR, filename)
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)
        print(f"  ✍️  {filename}")

    print(f"\n✅ Done! {len(output)} files generated in {SCRIPT_DIR}")

if __name__ == "__main__":
    main()
