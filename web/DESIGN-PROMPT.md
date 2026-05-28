# PicklePlay Website — Complete AI Design Generator Prompt

Copy the entire prompt below into your AI design generator (Claude, Figma AI, etc.) to generate page designs for all 50+ pages.

---

```
You are designing a responsive website called PicklePlay — a pickleball discovery, booking, community, and competition platform. The brand is "Playful Modernism": high-energy neon accents (Neon Lime) against a clean, card-based layout with Electric Blue as the brand anchor.

## Key Entity Relationships

### Venue vs Court (CRITICAL — Do NOT conflate these)

- **VENUE** = the building/facility (e.g., "Sunset Community Center", "Maplewood Park", "Pickleball Zone"). A venue has an address, hours, amenities, photos, and contains one or more courts.
- **COURT** = a specific playing surface inside a venue (e.g., "Court 1", "Court 2", "Court A"). A court has a surface type, indoor/outdoor designation, and price per hour.

**When designing pages:**
- Users search for **venues** (not courts) on the venue finder.
- The venue detail page lists **courts within the venue** as a section.
- The booking flow selects a **venue first** → then a **specific court** → then a **time slot**.
- Never show a court without showing which venue it belongs to.
- Never list courts directly in search results — always list venues, then show courts inside.

### Third-Party Rating Systems: DUPR & UTR (Do NOT build these)

**DUPR** (Dynamic Universal Pickleball Rating) is a third-party service that calculates pickleball player skill ratings (2.0–8.0 scale). It's the most widely recognized rating system in pickleball — like ELO for chess or handicap for golf.

**UTR** (Universal Tennis Rating) is a similar cross-sport rating system that expanded into pickleball (UTR-P). Also third-party, also widely used.

**CRITICAL — What the website does WITH these:**
- Lets players **link** their existing DUPR/UTR profile to their PicklePlay profile (display name, rating number, link out to the official DUPR/UTR profile page)
- Shows the rating on the player's public profile as a reference badge
- Lets event organizers tag events as "DUPR-rated" or "UTR-P rated" to attract competitive players
- Shows a "Connected" badge if a player has linked their rating

**CRITICAL — What the website does NOT do:**
- Does NOT calculate its own player ratings
- Does NOT replace DUPR or UTR
- Does NOT build a rating engine or algorithm
- DUPR/UTR integration is purely display + profile linking via API

Design the rating display as a **badge/reference** on player profiles and event cards — not as a core product feature. Keep it simple: an icon + rating number + "Verified" or "Linked" label.

## Design System Reference

### Brand Colors
- Primary (Electric Blue): #0040E0 — branding, active states, primary iconography, section headers
- Primary Container: #2E5BFF — hover states, desktop hero panels
- Secondary Container (Neon Lime): #C1F100 — primary CTAs, FAB, active tabs, "Join" actions, chips
- On Secondary Container: #546B00 — dark text on lime buttons (accessibility contrast)
- Tertiary (Coral): #CF3000 — urgent notifications, error badges, tertiary accents
- Surface: #F8F9FC — app background (cool-tinted off-white)
- Surface Container Lowest: #FFFFFF — cards, elevated panels
- Surface Variant: #E1E2E5 — borders, dividers
- On Surface: #191C1E — primary body text
- On Surface Variant: #434656 — secondary/muted text

### Typography
- Headings: Fredoka (700 Bold), system-ui sans-serif fallback
- Body: Nunito Sans (400 Regular, 600 SemiBold), system-ui sans-serif fallback
- Scale: headline-xl (36px/42px), headline-lg (28px/34px), headline-md (21px/28px), body-lg (16px/24px), body-md (14px/21px), label-sm (11px/14px UPPERCASE bold)
- Sentence case default. Uppercase only for label-sm items.

### Shapes
- Buttons & Chips: pill-shaped (rounded-full)
- Cards: 12px border radius, white background, tinted blue shadow (0 4px 20px -2px rgba(0, 64, 224, 0.10))
- Inputs: 12px radius ("squircle"), 48px height, icon gutter
- Avatars: strictly circular

### Page Layout (Desktop)
```
┌──────────────────────────────────────────────────┐
│  Header (sticky, h-16): Logo | Nav | Search | Auth │
├──────────────────────────────────────────────────┤
│  max-w-7xl mx-auto px-5 content                  │
├──────────────────────────────────────────────────┤
│  Footer: Links | App Download | Legal            │
└──────────────────────────────────────────────────┘
```

### Responsive Breakpoints
- Mobile: <768px (single column, px-5 padding)
- Tablet: 768px-1023px (2-column grids)
- Desktop: ≥1024px (max-w-7xl centered, side panels)

### Navigation Structure (Desktop Nav)
- Primary nav links: Venues | Games | Clubs | Players | Leagues | Pricing | Community | Learn
- Right side: Search icon, Download button (App Store/Google Play badges), Login/Register or User avatar dropdown
- Mobile: Hamburger menu → slide-out drawer with all links + auth

### Color Usage Rules
- Electric Blue (#0040E0): branding, active states, primary iconography — NOT every button
- Neon Lime (#C1F100): primary CTAs, FAB, active tabs, chips — NOT for background fills or large text
- Coral (#CF3000): urgent notifications, error badges — NOT for primary navigation
- White (#FFFFFF): cards, elevated panels — NOT for page backgrounds (use #F8F9FC)

---

## SITE MAP — Generate ALL pages below

### PUBLIC PAGES (no authentication required)

1. HOME (/)

A responsive landing page with:
- Full-width hero section with brand tagline "Enter the Kitchen." and "Ready to play?" greeting. Background: subtle gradient or pattern using Electric Blue tones. CTA button (Neon Lime pill) "Find a Court" or "Get Started".
- Featured Venues section — horizontal scroll or 3-column grid of venue cards (photo, name, location, court count, distance). Section header with "View All" link.
- Featured Games section — 3-4 game cards showing title, date, time, skill range, player count, venue name. "View All Games" link.
- Featured Clubs section — 3-4 club cards (club avatar/photo, name, member count, location badge).
- Quick Stats strip — 4 stat boxes: "X Venues", "X Active Players", "X Games This Week", "X Clubs".
- Download App section — "Play on the Go" with App Store and Google Play badge buttons (large, prominent).
- Footer with navigation links, app download badges, social icons, copyright.

2. VENUE FINDER (/venues)

Full-page venue discovery with:
- Map view (left 60%) + List view (right 40%) on desktop; toggle on mobile
- Map: Leaflet map with venue pin markers. Click pin → popup with venue name, photo thumbnail, court count.
- List: scrollable list of VenueCards (photo, name, address, court count, surface types, amenities icons, distance, rating). Sortable by distance/name.
- Filters bar (collapsible on mobile): Indoor/Outdoor toggle, Surface type chips (Hard Court, Clay, Grass, Carpet), Amenities checkboxes (Lights, Restrooms, Parking, Water, Pro Shop), Access type (Public/Private/Partner), Price range slider. "Clear All" + "Apply" buttons.
- Search bar at top with autocomplete.
- "Missing a venue?" CTA link.

3. VENUE DETAIL (/venues/:slug)

A venue profile page with:
- Hero image (large, 16:9 ratio, object-cover) with venue name overlay.
- Quick info bar: address, distance, court count, surface type, access type (Public/Private/Partner badge), rating stars.
- Action buttons row: "Book a Court" (Neon Lime, primary), "Get Directions", "Follow/Unfollow" toggle, "Share".
- Details tab section:
  - About: description text, hours of operation table (day by day), contact info (phone, email, website links).
  - Amenities grid: icons with labels (Lights, Restrooms, Parking, Water, Pro Shop, Lessons, Food & Drink, Wheelchair Accessible).
  - Courts list: table or card list of each court (Court name/number, surface, indoor/outdoor, available for booking indicator).
  - Photos gallery: grid of venue photos with lightbox view.
  - Reviews section: user reviews with rating, text, author avatar, date. "Write a Review" button. Star rating summary.
- Sidebar (desktop): "Book a Court" mini widget showing today's availability, quick date picker, "Book Now" button.
- "Games at this venue" section: list of upcoming games at this venue with links to game details.
- Weather widget: simple current weather + forecast (icon, temp, condition).
- Related venues nearby.

4. COURT BOOKING (/venues/:slug/book)

A booking flow page:
- Step 1: Select Date — inline calendar widget (month view, highlighted available dates, greyed past dates).
- Step 2: Select Court — grid of courts at this venue, each as a selectable card with court name, surface icon, price per hour. Selected state has Neon Lime border.
- Step 3: Select Time — time slot grid showing available slots in 30-min or 60-min increments. Green = available, Grey = booked, Yellow = limited availability. Click to select start time, then click end time to set duration.
- Step 4: Booking Summary sidebar/card — shows selected court name, date, time range, duration, price breakdown (x hours × rate, any fees), total. "Guest count" stepper.
- Step 5: "Proceed to Checkout" button.
- Cancellation policy note below.
- Also show: venue info mini-card (photo, name, address), "Back to Venue" link.

5. CHECKOUT (/checkout)

A payment checkout page:
- Two-column layout: Order Summary (left) + Payment Form (right).
- Order Summary card: venue name, court name, date, time, duration, guest count, price breakdown (subtotal, fees, total).
- Payment Form:
  - "Pay with" section — card payment form fields (card number, expiry, CVC, cardholder name).
  - OR saved payment methods radio list (if user has any).
  - Billing address fields (name, address, city, state, zip).
  - Promo/coupon code input + "Apply" button.
  - "Agree to cancellation policy" checkbox with link to policy.
  - "Complete Booking" button (Neon Lime, full width).
  - Security badges: "SSL Secure", "Powered by Stripe".
- On mobile: stacked layout (summary top, form bottom).

6. GAME FINDER (/games)

Discover open play sessions and games:
- Filter bar: Date chips (Today, Tomorrow, This Week, Custom date), Skill range slider (1.0-5.0), Play type chips (Open Play, Private Game, League, Tournament, Round Robin), Distance filter, Day of week chips.
- Results grid: list of GameCards showing title, date, time, venue name, skill range (min-max), current players vs capacity (e.g. "6/12"), format badge, organizer avatar + name, "Join" / "View Details" button.
- "Create Game" FAB or button (Neon Lime).
- Empty state illustration + "No games match your filters" + "Create the first one!" CTA.
- Sort: by date, by distance, by skill level.

7. GAME DETAIL (/games/:id)

A game/event detail page:
- Header: game title, event type badge (Open Play, Private, League, Tournament, Round Robin).
- Info cards row: date, time, duration, venue name (linked to venue detail), address, skill range.
- Organizer card: avatar, name, "Message" button.
- Players section: "Who's Playing?" — avatar grid of confirmed players (stacked with +X overflow), "Join" / "Leave" / "Request to Join" button (context-dependent). Player count: "X of Y spots filled". Waitlist indicator if full.
- Venue card: mini venue profile with photo, name, address, link to full venue detail.
- Status badges: Public/Private, Beginner-Friendly tag if enabled, Recurring if weekly.
- Chat tab (if user is participant or organizer): message list with bubbles (own messages right-aligned, others left-aligned), avatar + name + time, composer input at bottom.
- Actions: "Invite Players" button, "Share Link" button, "Add to Calendar" link.
- For organizer: "Edit Game", "Cancel Game", "Manage Players" (approve/decline requests).
- Weather forecast for game date/location.
- Directions button (opens in Google Maps/Apple Maps).

8. CREATE GAME (/games/create)

A multi-field form page:
- Title input (text, required).
- Event type selector: chips or dropdown (Open Play, Private Game, League Match, Round Robin, Tournament).
- Venue search/select: autocomplete input searching venues, show selected venue as card below.
- Date picker (calendar widget).
- Start time + End time selectors (dropdown or time picker).
- Skill range: min/max dropdowns or slider (1.0-5.0 in 0.5 increments).
- Player limit: stepper control (2-48, step 2).
- Visibility toggle: Public / Private pill toggle. If Private, show invite-only messaging.
- Play type chips: Singles, Doubles, Open Play.
- Description textarea (optional).
- Beginner Friendly toggle switch.
- Recurring options: "Repeat weekly" toggle, select day of week, end date.
- Payment note field (optional, e.g. "$5 court fee").
- Co-host: search and add another user as co-host.
- "Create Game" button (Neon Lime, full width) + "Cancel" link.
- Form validation shown inline.

9. INVITE PLAYERS (/games/:id/invite)

An invite management page:
- Share invite link: pre-generated URL in a read-only input field with "Copy Link" button. "Share via..." option (opens native share sheet on mobile).
- Invite by player search: user search input with autocomplete results, click to add to invite list.
- Invite by friends: list of user's friends with checkboxes, "Invite Selected" button.
- Invite by group: dropdown of user's groups to invite entire group.
- Recent invitees: list of recently invited players with status (Pending, Accepted, Declined).
- QR code placeholder (for check-in at venue).
- "Done" button.

10. CLUB FINDER (/clubs)

Discover pickleball clubs:
- Search bar with autocomplete.
- Filter chips: Skill level, Privacy (Public/Private), Location/Distance.
- Results grid: ClubCards showing club avatar/photo, name, member count, privacy badge (Public/Private), skill range, tags (Competitive, Social, Beginner-friendly), location. "Join" / "View" button.
- Featured clubs section at top (admin promoted).
- "Create a Club" button.
- Empty state with illustration.

11. CLUB DETAIL (/clubs/:slug)

A club profile page with tabs:
- Header: cover photo, club avatar, name, privacy badge, member count, skill range.
- Action row: "Join Club" / "Leave Club" / "Request to Join" button, "Share" button, "Message" button (for members).
- Tab bar: About | Members | Events | Chat | Library
- About tab: description text, rules/guidelines, created date, location, tags.
- Members tab: grid of member avatars + names, role badge (Admin, Member). Search members input. Member count.
- Events tab: list of club events (past and upcoming) as event cards. "Create Event" button (for admins).
- Chat tab (for members): group chat with message bubbles, composer input, member online indicator.
- Library tab (for members): uploaded documents, links, resources as a list with title, description, file type icon, download/visit link.

12. CREATE CLUB (/clubs/create)

A multi-step wizard form:
- Step 1: Name + Description (name input, description textarea, tags input).
- Step 2: Choose Courts (search and select courts associated with the club).
- Step 3: Visibility + Skill (Public/Private toggle, skill range min/max).
- Step 4: Photo (upload club avatar/cover image with preview, drag-and-drop zone).
- Step 5: Rules textarea (optional guidelines for members).
- Step progress indicator at top (4 steps).
- "Create Club" button on final step. "Back" and "Skip" navigation.
- Success modal: "Club created!" → "Invite Members" or "Go to Club".

13. CLUB MEMBERSHIP (/clubs/:slug/membership)

Membership plans and signup page:
- Plans comparison: side-by-side plan cards (Free, Monthly, Annual) with price, feature list, "Choose Plan" button. Free plan highlighted if default. Annual shows "Save X%" badge.
- Current plan indicator if user is already a member.
- Feature differences: member pricing, event access, priority booking, guest passes, etc.
- "Sign Up" flow: plan selected → payment form → confirmation.
- Member pricing table (if applicable for court bookings).
- "Already a member?" → Login prompt.

14. PLAYER DIRECTORY (/players)

Browse players:
- Search by name input.
- Filter chips: Skill level (1.0-5.0), Location, Sort by (name, games played, rating).
- Results grid: PlayerCards showing avatar, name, skill level badge, location, games played count, rating badge (if linked DUPR/UTR).
- Click → navigate to player profile.
- Empty state.

15. PLAYER PROFILE (/players/:id)

Public player profile page:
- Profile header: large avatar, name, skill level display with confidence badge, location. "Message" button, "Share Profile" button.
- Quick stats row: Games Played, Win Rate, Clubs joined, Rating (DUPR/UTR linked).
- Badges section: row of achievement badges (Verified Player, Organizer, Club Member, Consistent Player, Beginner Friendly, etc.).
- Match History tab: list of recent games/matches with date, venue, partner (if doubles), opponent, result (W/L), score. Filterable by type.
- Ratings tab: DUPR/UTR rating reference display with linked profile, rating trend chart (mock data), event rating tags.
- Favorites: venues they follow, clubs they've joined.
- If own profile: "Edit Profile" button.

16. PRICING (/pricing)

Subscription and membership plans page:
- Header: "Find the Perfect Plan" with subtitle.
- Plan cards (3 columns on desktop): Free (S0/month), Plus ($X/month), Pro ($Y/month). Each card has plan name, price, feature checklist with checkmarks/X's, "Get Started" / "Current Plan" button.
- Annual vs Monthly toggle — annual shows discounted price + "Save 20%" badge.
- Feature comparison table below cards: rows = features, columns = plans, checkmarks in cells.
- FAQ section: accordion of common pricing questions.
- "Compare Plans" sticky note for mobile scroll.

17. LEAGUES (/leagues)

Leagues, ladders, and standings hub:
- Tab bar: Leagues | Ladders | Standings
- Leagues tab: list of active/upcoming leagues (name, sport, season dates, team count, registration status, skill division). "View Details" link. "Create League" button (for organizers).
- Ladders tab: list of active ladders (name, type - Challenge/Ranking, player count, current leader), "View Ladder" link.
- Standings tab: filter by league/ladder dropdown, table of rankings (rank, player/team name, points/wins/losses, win %, streak, last result).
- City/division filter chips.

18. LEAGUE DETAIL (/leagues/:id)

A league's dedicated page:
- Header: league name, season, division/skill level, dates.
- Quick stats: teams/players count, matches played, current leader.
- Tab bar: Standings | Schedule | Results | Teams
- Standings tab: sortable table (rank, team/player, GP, W, L, Pct, GB, Streak, Last 10).
- Schedule tab: list of upcoming matches by date/week. Click for match detail.
- Results tab: list of completed matches with scores.
- Teams tab: list of teams/players in the league.
- Registration section: "Register Team" button if registration open, fee display, rules document link.

19. TOURNAMENTS (/tournaments)

Tournament listing page:
- Filter chips: Status (Upcoming, In Progress, Completed), Type (Singles, Doubles, Mixed), Skill level, Date range.
- Results grid: tournament cards (name, date range, venue, type, skill level, registration status, player count, registration deadline badge). "View Details" / "Register" button.
- "Create Tournament" button (for organizers, Phase 2).

20. TOURNAMENT DETAIL (/tournaments/:id)

Tournament page:
- Header: tournament name, dates, venue, type, skill division.
- Info section: format (Single Elimination, Double Elimination, Pool Play, Round Robin), registration status (Open/Closed/Filled), fee, contact.
- Registration section: "Register Now" button if open, registration form (player/team name, partner name if doubles, division selection, fee payment).
- Brackets tab: interactive bracket visualization (matchups advancing through rounds). Show winners progressing. Byes indicated. Completed matches show scores.
- Results tab: final standings, match results list, champion/runner-up display.
- Schedule: match times per round.
- Players/Teams tab: list of registered participants.

21. SEARCH (/search)

Global search overlay or page:
- Prominent search input at top with placeholder "Search venues, games, clubs, players...".
- Tabbed results: All | Venues | Games | Clubs | Players
- Each result type rendered with appropriate card style (VenueCard, GameCard, ClubCard, PlayerCard).
- Recent searches section (when input empty, if logged in).
- Search suggestions as user types.
- "No results" empty state with suggestion to adjust query.
- Keyboard shortcut: "/" to focus.

22. LEARN (/learn)

Pickleball education hub:
- Header: "Learn Pickleball" with subtitle "From first serve to tournament play".
- Sections:
  - "New to Pickleball?" — beginner cards: "Rules of the Game", "How to Keep Score", "The Kitchen Explained", "Equipment Guide", "First Game Checklist".
  - "Skill Development" — cards: "Drills for Beginners", "Improving Your Serve", "Doubles Strategy", "Dinking 101", "Court Positioning".
  - "City Guides" — grid of city cards linking to /learn/:city-guide pages.
  - "Common Questions" — FAQ accordion.
- Each card: icon, title, short description, "Read More" link. Card has tinted top border in brand colors.

23. CITY GUIDE (/learn/:city-guide)

A city-specific pickleball guide:
- Hero: city name + "Pickleball Guide" overlay on city skyline photo.
- Section 1: "Top Venues" — list of top-rated venues in the city with VenueCards.
- Section 2: "Active Clubs" — club cards.
- Section 3: "Weekly Games" — recurring game schedule for the city.
- Section 4: "Local Leagues & Tournaments" — upcoming competitions.
- Section 5: "Beginner Resources" — local coaches, clinics, starter events.
- SEO-optimized content block with city pickleball overview.

24. COMMUNITY (/community)

Groups and community hub:
- Header: "PicklePlay Community".
- Tab bar: My Groups | Discover Groups
- My Groups tab (if logged in): list of groups user belongs to with unread message count badge.
- Discover tab: search/browse all public groups. Filter by category (Local, Competitive, Social, Club, League).
- Group cards: group avatar, name, member count, category tag, description snippet, "Join" button.
- "Create Group" button.
- Empty state if no groups joined: illustration + "Join a group to connect with players" + browse link.

25. COMMUNITY DETAIL (/community/:id)

Group detail page:
- Header: cover image, group avatar, name, member count, category, privacy badge.
- Action row: "Join Group" / "Leave Group" button, "Share" button, "Report" link.
- Tab bar: Discussion | Members | Events | About
- Discussion tab: feed of posts from members. Each post: author avatar + name + time, text content, optional image, like/reply count, "Reply" button. New post composer at top.
- Members tab: member grid, role badges (Admin, Moderator, Member), search members.
- Events tab: group events list.
- About tab: description, created date, rules.

26. COACHES (/coaches)

Coach directory:
- Search by name or location.
- Filter chips: Skill level taught, Lesson type (Private, Group, Clinic), Price range, Location.
- Results grid: CoachCards showing avatar or photo, name, credentials badge, rating stars, lesson types, price range, location, "View Profile" / "Book Lesson" button.
- "Are you a coach?" → "List Your Services" link.

27. NEWS (/news)

Pickleball news and articles:
- Featured article (large card with hero image, headline, summary, date, author).
- Article grid: cards with thumbnail image, headline, date, category tag (Pro, Tips, Local, Gear), read time.
- Category filter chips.
- Pagination or "Load More" button.
- Article detail page (linked): full article with images, author bio, share buttons, related articles.

28. ABOUT (/about)

Company/info page:
- Mission statement section.
- Brand story: "Why we built PicklePlay".
- Features overview grid: icons + short descriptions of key platform features.
- Team section (placeholder avatars + names).
- Contact form: name, email, subject, message, "Send" button.
- FAQ accordion: common questions about the platform.
- App download section with store badges.

29. DOWNLOAD (/download)

Mobile app download page:
- Hero: "Take PicklePlay Anywhere" with app screenshot mockups (phone frame showing app screens).
- Two prominent download buttons: App Store badge (white on black) and Google Play badge (green/black). Each is a large, tappable button that links to respective store. These are the PRIMARY CTAs.
- QR codes section (SECONDARY): smaller, below buttons — scan-to-download QR for iOS and Android.
- Feature highlights grid: syncs with app, features available on mobile (on-the-go booking, notifications, chat, check-in), each with icon + text.
- App preview screenshots: horizontal scroll of 3-4 app screen mockups.
- "Already have an account? Log in" link.
- Rating/testimonial: "4.8 ★ on App Store" with quote.

30. LOGIN (/login)

Authentication page:
- Centered card (max-w-md) on desktop, full screen on mobile.
- "Welcome Back" heading, "Ready to hit the courts?" subtitle.
- Email input + Password input with show/hide toggle, both with proper labels and placeholders.
- "Sign In" button (Neon Lime, full width, pill).
- "Forgot Password?" link below.
- OR divider: "or continue with".
- Social buttons row: Google (red/white icon), Apple (black/white icon) as circular outline buttons.
- "Don't have an account? Sign Up" link at bottom.
- Brand logo at top of card.
- Error state: inline error message on invalid credentials.

31. REGISTER (/register)

Registration page:
- Matches login layout style.
- "Join PicklePlay" heading, "Start finding games near you" subtitle.
- Full name input (first + last).
- Email input.
- Password input + Confirm password input, both with show/hide toggle. Password strength indicator.
- Skill level selector: dropdown or quick-select chips (Beginner, Intermediate, Advanced, prefer not to say).
- Location input: "Set your home court" with search/autocomplete or "Use current location" button.
- "Create Account" button (Neon Lime, full width, pill).
- "Already have an account? Sign In" link.
- "By signing up, you agree to our Terms of Service and Privacy Policy" disclaimer text.
- Social sign-up buttons (Google, Apple).

32. CITY SEO LANDING (/city/:slug)

Programmatic city landing page for search engine optimization:
- Hero: "Pickleball in [City Name]" with city image, quick stats (venues, players, games this week).
- "Top Venues in [City]" — 3-5 venue cards.
- "Upcoming Games in [City]" — game cards.
- "Pickleball Clubs in [City]" — club cards.
- "Beginner's Guide to Pickleball in [City]" — content section with local tips.
- "Latest News from [City]" — local news/article links.
- FAQ: "Where can I play pickleball in [City]?", "Are there pickleball leagues in [City]?", etc. with answers.
- App download section with store badges.
- SEO metadata: structured schema.org markup for SportsActivityLocation.

### USER DASHBOARD (/my/* — requires login)

33. MY BOOKINGS (/my/bookings)

User's court booking management:
- Tabs: Upcoming | Past | Cancelled
- Upcoming tab: list of upcoming bookings (venue name, court name, date, time, status, price, QR code placeholder for check-in). "Cancel Booking" button with confirmation dialog. "Reschedule" link.
- Past tab: completed bookings with same layout. "Book Again" button to rebook same court.
- Cancelled tab: list of cancelled bookings with refund status.
- Empty states for each tab.

34. MY GAMES (/my/games)

User's game/event management:
- Tabs: My Games (hosting) | Joined | Pending Invites | Completed
- Each game as GameCard variant showing title, date, status, player count, current RSVP count. Host view shows manage buttons (Edit, Cancel, Message Players). Player view shows Leave button.
- Pending Invites tab: list of games user is invited to with Confirm/Decline buttons.
- Badge counts on tabs (e.g., "Pending (3)").

35. MY EVENTS (/my/events)

User's event registrations:
- List of registered events (tournaments, clinics, leagues).
- Each event card: name, type, date, venue, registration status (Confirmed, Waitlisted, Cancelled), fee paid.
- "View Details", "Cancel Registration", "Get Reminder" buttons.

36. MY PAYMENTS (/my/payments)

Payment history and receipts:
- List of past transactions: date, description (booking, event, membership), amount, status (Paid, Refunded, Pending), receipt link.
- Filter by type or date range.
- "Download Receipt" link for each.
- Payment methods section: saved cards (masked number + expiry, card brand icon), "Add Payment Method" button, "Remove" link.

37. MY MEMBERSHIP (/my/membership)

Subscription/membership management:
- Current plan card: plan name, status (Active/Expired/Cancelled), renewal date, price, features.
- "Change Plan" button → plan comparison view.
- "Cancel Subscription" link with confirmation flow.
- Payment history for membership fees.
- Member benefits reminder: "As a [Plan] member, you get X, Y, Z".

38. MY WAITLISTS (/my/waitlists)

Events the user is waitlisted for:
- List: event name, date, position in waitlist, estimated chance of getting in (High/Medium/Low).
- "Leave Waitlist" button.
- "Find Similar Games" button.

39. MY FAVORITES (/my/favorites)

User's saved items:
- Tabs: Venues | Clubs | Players
- Each tab shows saved items with unfavorited ("Remove") button.
- Venues: VenueCards.
- Clubs: ClubCards.
- Players: PlayerCards.

40. MY GROUPS (/my/groups)

User's communities:
- List of groups user belongs to, each with group avatar, name, member count, unread message count, last activity timestamp.
- "View" / "Open Chat" button.
- "Leave Group" link.
- "Discover More Groups" link.

41. EDIT PROFILE (/my/profile)

Edit user profile form:
- Avatar upload: current avatar preview + "Change Photo" button (click to upload, drag-and-drop zone).
- First Name + Last Name inputs.
- Bio/About textarea.
- Skill Level: dropdown or slider (1.0-5.0).
- Home Location: search/autocomplete input.
- Contact email display (verified? badge).
- Social links: optional Instagram, Facebook, etc.
- "Save Changes" button (Neon Lime) + "Cancel" link.
- Success toast on save.

42. SETTINGS (/my/settings)

User settings page:
- Sections with cards:
  - Account: email (verified badge), change password form (current + new + confirm), "Delete Account" danger button with confirmation modal.
  - Notifications: toggle switches for each notification type (game invites, booking reminders, chat messages, event updates, promotional emails, waitlist updates).
  - Privacy: profile visibility (Public/Private), show skill level on profile toggle, show game history toggle.
  - Location: saved home location display, "Update Location" button.
  - Payment Methods: saved cards list, "Add Card" button.
  - App: theme (light/dark/system toggle — placeholder), language selector.
  - Help: "FAQs", "Contact Support", "Report a Problem" links.
  - Legal: Terms of Service, Privacy Policy, Cookie Policy links.
  - Logout: red button with confirmation.

### ADMIN DASHBOARD (/admin/* — requires admin role) — LAYOUT: sidebar navigation + main content area

43. ADMIN VENUES (/admin/venues)

Venue management:
- Data table: columns = Name, Address, Court Count, Status (Published/Draft/Hidden), Partner badge, Actions (Edit, Hide, Delete).
- Search + filter bar.
- "Add Venue" button.
- Pagination.
- Click row → detail/edit view.
- Add Venue form: name, address, lat/lng, description, contact info, hours, photos upload.

44. ADMIN VENUE COURTS (/admin/venues/:id/courts)

Manage courts within a venue:
- List: court name/number, surface, indoor/outdoor, price per hour, status (Active/Maintenance/Closed), Actions.
- "Add Court" button.
- Add/Edit court form: name, surface dropdown, indoor/outdoor toggle, price input, status dropdown, description.
- Bulk actions: "Set All Courts Available", "Close All Courts for Maintenance".

45. ADMIN VENUE BOOKINGS (/admin/venues/:id/bookings)

Booking management for a venue:
- Calendar view (month/week/day toggle) showing all bookings as blocks on the grid.
- List view: data table of bookings (user name, court, date, time, status, amount paid).
- Click booking → detail drawer: user info, court, time, amount, payment status, cancellation option with refund.
- "Create Booking" button (manual booking over phone).
- Filter by date, court, status.

46. ADMIN USERS (/admin/users)

User management:
- Data table: avatar, name, email, role (User/Admin), status (Active/Suspended/Banned), signup date, last active, games played.
- Search + filter by role/status.
- Click row → user detail panel: profile info, activity log, game history, payment history, reports against them.
- Actions: "Suspend User", "Ban User", "Make Admin", "Send Message" buttons.
- Confirmation dialog on destructive actions.

47. ADMIN GAMES (/admin/games)

Game/event management:
- Data table: title, organizer, venue, date, status (Upcoming/Ongoing/Cancelled/Completed), player count, visibility, Actions.
- Filter by status, date range, venue.
- Click row → game detail: all game info, participant list, chat log. "Cancel Game", "Edit Game", "Feature on Homepage" actions.

48. ADMIN CLUBS (/admin/clubs)

Club management:
- Data table: name, admin/creator, member count, privacy, status (Active/Inactive/Reported), Actions.
- Click row → club detail: members list, events, content moderation. "Verify Club" badge toggle, "Flag for Review", "Remove Club".

49. ADMIN CONTENT (/admin/content)

Content moderation queue:
- Tabs: Reviews | Photos | Discussions | Reports
- Reviews tab: list of user-submitted venue reviews needing moderation. Columns: venue, author, rating, text preview, date, status (Pending/Approved/Rejected). Approve/Reject buttons.
- Photos tab: user-submitted venue photos for approval. Thumbnail grid, approve/reject on hover.
- Discussions tab: reported messages or posts from community chat. Show context, "Remove", "Warn User", "Dismiss" actions.
- Reports tab: user-flagged content (venue, game, profile, message). Type, reason, reporter, date, "Review" button → detail modal.

50. ADMIN REPORTS (/admin/reports)

User reports and flags:
- Data table: reporter, reported user/item, type (Spam, Inappropriate, Fake, Other), description, date, status (Open/Investigating/Resolved/Dismissed).
- Actions: "View Context", "Message Reporter", "Take Action" (warn user, remove content, ban user), "Resolve", "Dismiss".
- Filter by status and type.

51. ADMIN ANALYTICS (/admin/analytics)

Business analytics dashboard:
- Top stats cards row: Total Users, Active Users (30d), Total Bookings (30d), Revenue (30d), Total Venues, Total Games.
- Line chart: User Growth over time (last 30 days / 6 months / 1 year toggle).
- Line/bar chart: Revenue over time with same toggles.
- Bar chart: Bookings per venue (top 10).
- Pie/donut chart: User skill level distribution.
- Table: Top Cities by user count, venue count, booking count.
- Geographic map: user/venue density markers.
- Date range picker at top.
- "Export Data" button (CSV/PDF).
- All charts are placeholder/mock data, clean card containers with chart area labeled.

---

## DESIGN TEMPLATES & PATTERNS TO APPLY CONSISTENTLY

### Card Pattern (used everywhere)
All list items are cards with: white background, 12px radius, tinted blue shadow, p-6 padding. Cards contain a title, optional subtitle/subtext, metadata row (icons + labels), and primary action button/link.

### Empty State Pattern (used on every list/filter page)
Every empty list shows: centered illustration (simple geometric/vector), friendly title (e.g., "No games yet"), helpful description (e.g., "Be the first to create one!"), one clear CTA button.

### Filter/Sheet Pattern (used on finder pages)
Filters appear as: horizontal chip row on desktop, bottom sheet on mobile. Categorized sections with toggles/chips/dropdowns/sliders. "Clear All" + "Apply" or "View N Results" footer.

### Form Pattern (used on create/edit pages)
Forms use: full-width inputs with labels, 12px radius, 48px height, icon gutter on left. Validation shown inline below fields. Primary submit button (Neon Lime, pill, full width). Secondary "Cancel" link. Optional step indicator for multi-step forms (Create Club).

### Detail Screen Pattern (used on venue/game/club/league/tournament)
Hero image or header area. Quick info bar below. Tabbed content section for deeper info. Sticky or clearly positioned action buttons. Related items section at bottom.

### Navigation Responsive Behavior
- Desktop (≥1024px): horizontal nav bar with all links visible.
- Tablet (768-1023px): condense nav, keep search icon + user menu visible.
- Mobile (<768px): hamburger menu replaces nav links. Full-screen slide-out drawer with all links + auth buttons.

### Admin Layout
- Left sidebar (w-64 on desktop, collapsible on tablet, drawer on mobile): admin logo, nav links with icons (Dashboard, Venues, Users, Games, Clubs, Content, Reports, Analytics), active state highlighted with Electric Blue left border.
- Main content area: header with page title + breadcrumbs, scrollable content below.

### User Dashboard Layout
- Left sidebar (w-72): user avatar + name, nav links (Bookings, Games, Events, Payments, Membership, Waitlists, Favorites, Groups, Profile, Settings).
- Or: simpler top tab bar on mobile.
- Content area: page content with consistent card styling.

---

## CRITICAL: What NOT to include

- DO NOT design physical product/merchandise pages (no gear shop, no paddle store, no apparel).
- DO NOT design a full POS system or hardware integration UI.
- DO NOT design a DUPR/UTR backend — only display and linking.
- DO NOT design real payment gateway backends — only UI for the checkout/payment flow.

## OUTPUT REQUIREMENTS

Generate page designs covering ALL 51 pages listed above. For each page, provide:
1. Page name and URL path
2. Purpose (1 sentence)
3. Full layout description including all sections, components, and their positions
4. Color/design token usage for key elements
5. Responsive behavior notes (how it adapts mobile → desktop)
6. State considerations (loading, empty, error, success where applicable)
7. Accessibility notes (focus states, aria labels, contrast)
```
