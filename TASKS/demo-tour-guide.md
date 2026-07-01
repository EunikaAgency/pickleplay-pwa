# PickleBallers — Demo Tour Guide (Owner + Player)
## Para sa client demo — step-by-step walkthrough ng bawat feature

---

# PART 1: OWNER DEMO FLOW

## 1. Owner Login & Dashboard
**CSV Row(s):** #37 (Dashboard — revenue, occupancy), #38 (Operator/staff view), #39 (Role-based views)

**Tour Path:**
```
Open app → Login → info@eunika.agency / password → Owner Home
```

**Ano ipapakita:**
- **Stats row** — Total revenue, Occupancy rate, Bookings today, Pending approvals (4 stat cards sa taas)
- **Sparkline charts** — Revenue trend at occupancy trend per venue
- **Pending bookings inbox** — Approve/Decline buttons per booking row
- **Quick Actions** — "My Venues", "Front Desk" (manual booking), "Create Venue", "Settlements"
- **Venue list** — bawat venue may glance card (today's bookings, pending, occupancy %)

**Sasabihin sa client:**
> "Ito yung owner dashboard — pagka-login mo, kita mo agad yung revenue, occupancy, at pending bookings across all your venues. One-screen overview ng buong business."

---

## 2. Multiple Venues Per Owner
**CSV Row(s):** #27 (Multiple venues per owner)

**Tour Path:**
```
Owner Home → "My Venues" button → Owner Venues list
```

**Ano ipapakita:**
- List ng lahat ng venues ng owner na ito
- Bawat venue card may: photo, name, city, court count, booking count
- **"+ Create Venue"** button sa baba
- **"Claim"** button (kung may existing directory listing na gustong i-claim)

**Sasabihin sa client:**
> "Pwede kang mag-manage ng kahit ilang venues sa iisang account. Dito mo sila lahat makikita — tap mo lang yung venue para ma-edit."

---

## 3. Create a Venue (Simple Flow)
**CSV Row(s):** #26 (Address autocomplete + geocoding), #32 (Profile completion prompts)

**Tour Path:**
```
Owner Home → "Create Venue" → Fill form → "Create venue"
```

**Ano ipapakita:**
1. **Name** — type venue name
2. **Search address** — type-ahead autocomplete (e.g. "SM Mall of Asia") → suggestions dropdown → pick one → auto-fills Address line 1, City, Postcode, AND drops map pin
3. **City** — free-text, auto-filled from address pick
4. **Contact** — phone, email, website (separate from booking link)
5. **Latitude / Longitude** — auto-set ng map, editable if may exact coordinates
6. Tap "Create venue" → lands on the venue editor (Courts/Pricing na sunod)

**Sasabihin sa client:**
> "Creating a venue takes under 60 seconds. Type the address, pick from suggestions — map, city, postcode auto-fill. The rest like courts and pricing, sa editor mo na ise-setup after."

---

## 4. Venue Editor — 12 Tabs Overview
**CSV Row(s):** #28-#33, #35

**Tour Path:**
```
Owner Home → Venues → pick venue → Venue Editor (12 tabs, URL-tracked so reload-safe)
```

**Yung 12 tabs (in order):**
| Tab | Para sa | Permission |
|---|---|---|
| **Overview** | Booking link + share, revenue KPIs, completeness meter | — |
| **Insights** | Analytics: Revenue, Bookings, Usage, Courts, Demand, Leakage | `owner.analytics.view` |
| **Bookings** | Booking inbox: All / Needs Action / Confirmed / Cancelled | `owner.bookings.manage` |
| **Membership** | Members list, invite, Manage Subscription plans | `owner.bookings.manage` |
| **Listing** | Venue identity, contact, booking policy, pricing defaults, amenities | `owner.venues.manage` |
| **Location** | Map pin, address autocomplete, Address line 1/2, City, Postcode | `owner.venues.manage` |
| **Courts** | Add/edit courts, per-court rate, surface, sport, photos, hours | `owner.venues.manage` |
| **Slot Pricing** | Manual surge/discount per day×hour, auto dynamic pricing toggle | `owner.bookings.manage` |
| **Closures** | Holiday/maintenance closure dates | `owner.venues.manage` |
| **FAQs** | Q&A pairs (public-facing sa court detail page) | `owner.venues.manage` |
| **Photos** | Hero image + gallery upload | `owner.venues.manage` |
| **Staff** | Add manager/front-desk staff, assign role | `owner.staff.manage` |

> **Note:** Front-desk staff see only Overview, Insights, Bookings (the "structural edit" tabs are hidden for them).

---

## 5. Courts Tab — Per-Court Setup
**CSV Row(s):** #28 (Multiple courts per venue), #29 (Court details: surface, photos, thumbnail, description), #30 (Operating hours per court), #35 (Multi-sport type field)

**Tour Path:**
```
Owner Home → Venues → pick venue → Courts tab
```

**Ano ipapakita:**

**Add Court form:**
- Court name, rate (PHP/hr), surface (hardwood/acrylic/concrete/etc.)
- **Sport picker** — 6 sports: Pickleball, Badminton, Tennis, Padel, Basketball, Volleyball
- Indoor/outdoor toggle
- Features: aircon, high ceiling, refreshment stand
- Floor type: Wood / Professional
- Ball type: Indoor / Outdoor
- Space around court (generous/standard/tight)
- **Booking approval override** — per-court: Venue default / Instant / Approve
- **Turnover gap** — buffer minutes between bookings

**Each court card (accordion, expandable):**
- **Court Info sub-tab** — thumbnail upload, name, rate, surface, description, active toggle, features, sport, splittable-into-half-courts config with per-unit rates, booking approval override, turnover gap
- **Gallery sub-tab** — up to 8 photos per court, upload + remove + lightbox preview
- **Hours sub-tab** — per-court operating hours (separate from venue-wide hours! WeeklyHoursEditor)

**Sasabihin sa client:**
> "Dito mo sinesetup yung courts mo. Ilan ba courts niyo? (client answers). Each court may sariling name, surface type, sport, photos, operating hours, at higit sa lahat, sariling pricing. Pwede ring i-set per-court kung kailangan ng approval o instant booking. May turnover gap para may buffer between bookings. At pwede i-split into half-courts with separate pricing."

---

## 6. Court Hour Pricing (Multi-Layer Priority System)
**CSV Row(s):** #3 (Base court price), #4 (Time-based pricing), #5 (Day-based pricing), #6 (Member pricing), #7 (Court-specific price overrides), #8 (Manual surge adjustment), #9 (Suggested dynamic pricing), #10 (Automated dynamic pricing opt-in), #11 (Currency/VAT), #14 (Half-court pricing)

**Tour Path — Listing tab (defaults):**
```
Owner Home → Venues → pick venue → Listing tab → "Hourly rate" section
```

**Tour Path — Per-court rates:**
```
Owner Home → Venues → pick venue → Courts tab → expand court → Court Info sub-tab → Rate field
```

**Tour Path — Slot overrides + Auto pricing:**
```
Owner Home → Venues → pick venue → Slot Pricing tab
```

**Ano ipapakita — Pricing priority chain (highest wins):**

```
Slot Price Override  (specific date + time window, manual surge/discount)
       ↓
Per-Court Rate       (each court's own hourly rate)
       ↓
Weekend / Holiday    (Sat/Sun override, specific holiday dates)
       ↓
Venue Default Rate   (fallback "priceFrom" sa Listing tab)
```

**Listing tab pricing fields:**
- **Default hourly rate** (`priceFrom`) — venue-wide fallback
- **Weekend rate** — Sat/Sun override
- **Holiday rate** + holiday date picker
- **Member discount %** — auto-applied for venue members
- **Per-player fee** + threshold — e.g. +₱100 per extra player beyond 4
- **Equipment rental** — paddle rental add-on price
- **Open play price** — per-session rate
- **Payment options** (when approval is OFF): Pay in full / Deposit % / Pay at venue
- **Cancellation policy**: Cancel window (hours before), refund %, no-show fee
- **Currency** — PHP, VAT-inclusive (12%), displayed price is final

**Courts tab per-court pricing:**
- Each court gets its own hourly rate (overrides venue default)
- **Half-court / split-court** — toggle "splittable into half courts" + per-unit rates
- **Per-court booking approval** override — Venue default / Instant / Approve
- **Per-court operating hours** — separate from venue-wide hours

**Slot Pricing tab:**
- **Pricing Suggestions card** — AI-suggested adjustments per day×hour with confidence levels (Low/Medium/High) + "Bulk Apply" button
- **Auto Dynamic Pricing toggle** — opt-in; nightly 3am cron auto-adjusts based on demand. Owner sets: min confidence threshold + max adjustment cap (5%–50%). OFF by default.
- **Set a slot rate** form — manual surge/discount: pick date, court (All or specific), start/end time, rate (PHP/hr), note
- **Active slot rates** list — upcoming overrides with delete button
- **Past slot rates** summary

**Sasabihin sa client:**
> "Ito yung pricing engine — multi-layer siya. May venue-wide default, per-court override, weekend/holiday override, at specific day×hour manual surge. Sa pinaka-ibabaw may AI suggestions at auto-pricing. The system picks the highest-priority rate na applicable. Naka-off yung auto-pricing by default; ikaw mag-o-on kung gusto mo."

---

## 7. Booking Approval Flow (Request-to-Book) — Per-Venue + Per-Court
**CSV Row(s):** #19 (Manual vs automatic approval), #22 (Cancellation & refund rules), #12 (Deposit vs full payment vs pay-at-venue)

**Tour Path — Venue-wide policy:**
```
Owner Home → Venues → pick venue → Listing tab → "Booking policy" section
→ toggle "Require my approval for bookings" ON
→ select pay window (1h / 12h / 24h / 48h / 72h)
```

**Tour Path — Per-court override:**
```
Owner Home → Venues → pick venue → Courts tab → expand court → Court Info sub-tab
→ "Booking approval" picker: Venue default / Instant / Approve
```

**Tour Path — Approval action:**
```
Owner Home → pending booking row → "Approve" → player gets notified → player pays → booking confirmed
```

**Ano ipapakita:**
- Toggle per-venue (pwede iba-iba: Venue A requires approval, Venue B auto-confirm)
- **Per-court override** — each court can independently set: Venue default (inherit), Instant (auto-confirm), or Approve (manual). So Court 1 can be instant while Court 2 requires approval.
- Kapag naka-ON sa venue: lahat ng booking requests dadaan sa owner for approval
- Owner sees: player name, date/time, court, amount, saved card (masked last 4)
- **Approve** → status becomes "Awaiting Payment", player has X hours to pay with countdown deadline
- **Decline** → player notified, slot freed
- **Payment options** (when approval is OFF): Pay in full / Deposit (%) / Pay at venue

**Sasabihin sa client:**
> "Ito yung isa sa pinaka-importanteng feature. Pwede mong i-require na lahat ng booking dumaan muna sa approval mo — per-venue, at per-court pa! So kung may premium court ka na gusto mong controlled, naka-approve mode. Yung regular court, pwedeng instant booking. Flexible."

---

## 8. Booking Inbox & Front Desk (Manual Booking)
**CSV Row(s):** #17 (Manual booking for phone/Messenger/IG/walk-ins), #38 (Operator/staff view)

**Tour Path:**
```
Owner Home → "Front Desk" button → pick venue → fill player details → pick court/date/time → "Create booking"
```

OR from venue:
```
Owner Home → Venues → pick venue → Bookings tab → "+" (manual booking)
```

**Ano ipapakita:**
- **Bookings tab** — lahat ng bookings ng venue na ito (confirmed, pending, cancelled, completed)
- **Front Desk form** — owner/staff enters: player name, phone, court, date, start/end time
- **Outside channel blocking** — staff can block a slot para sa Messenger/IG/walk-in booking
- **Booking detail sheet** — full booking info, status actions (Confirm/Decline/Cancel/Refund)
- Operator/staff view: same dashboard pero limited permissions (cannot edit pricing, cannot delete venue)

**Sasabihin sa client:**
> "Kahit may nag-message lang sa inyo sa Facebook or dumaan sa front desk, pwede niyong i-block yung slot dito. Hindi niyo kailangan ng dalawang sistema — lahat ng bookings, online man o walk-in, dito naka-log."

---

## 9. Booking Link (Auto-Generated + Custom Slug)
**CSV Row(s):** #18 (Auto-generated booking link), #31 (Separate venue website vs platform booking link)

**Tour Path:**
```
Owner Home → Venues → pick venue → Overview tab → "Booking link" card (top)
```

OR:
```
Owner Home → Venues → pick venue → Listing tab → Contact & booking section
```

**Ano ipapakita:**
- Auto-generated link: `pickleballer-pwa.eunika.xyz/venues/<venue-slug>`
- **Copy** button — copy to clipboard
- **Share** button — native share sheet (or clipboard fallback)
- **Custom slug** input — type your own (e.g. `/venues/my-venue-name`), live availability check (green "Available" / red "Already taken")
- Separate **Website** field — for the venue's own website (iba sa booking link)

**Sasabihin sa client:**
> "Every venue may sariling booking link na automatic ginagawa ng system. Pwede mong i-customize yung slug para mas madaling tandaan. Send mo lang sa players mo — tap, book, bayad. Hindi na sila magme-Messenger sa inyo."

---

## 10. Staff Management (Multi-User Per Venue)
**CSV Row(s):** #44 (Multi-user/staff accounts per venue with permissions), #39 (Role-based views)

**Tour Path:**
```
Owner Home → Venues → pick venue → Staff tab
```

**Ano ipapakita:**
- List ng staff members with: avatar, name, role badge (Manager / Front desk)
- **"+ Add staff"** — debounced player search → pick player → assign role (Manager or Front desk) → add
- **Remove** button per staff row
- **Role distinction:**
  - **Manager** — can manage bookings, view insights, edit listing/courts/pricing
  - **Front desk** — limited: only Overview, Insights, Bookings tabs (structural edit tabs hidden)

**Sasabihin sa client:**
> "Pwede kang magdagdag ng staff — manager or front desk. Yung front desk, limited lang ang access: kita nila yung bookings at insights, pero hindi nila pwedeng baguhin yung pricing o courts. Yung manager, full access except delete venue."

---

## 11. Closures, FAQs, Photos — Complementary Tabs

### Closures Tab
**Tour Path:** `Venue Editor → Closures tab`
- Set closure dates: pick date + reason (holiday, maintenance)
- List of upcoming closures with delete
- Players see "Closed" sa availability for those dates

### FAQs Tab
**Tour Path:** `Venue Editor → FAQs tab`
- Add/edit/delete Q&A pairs
- Public-facing — lumalabas sa court detail page ng player
- Examples: "May parking ba?", "Pwede bang mag-walk-in?", "May paddle rental ba?"

### Photos Tab
**Tour Path:** `Venue Editor → Photos tab`
- Upload hero image + gallery photos
- File picker → `uploadVenueMedia`
- Photos appear on: venue cards (Nearby browse), court detail hero + gallery strip

---

## 12. Insights & Analytics
**CSV Row(s):** #40 (Busiest hours / underused slots / revenue by court), #41 (MVP analytics), #42 (Demand data capture)

**Tour Path:**
```
Owner Home → Venues → pick venue → Insights tab
```

**Ano ipapakita — 6 sections:**
1. **Revenue** — total, this month, by court, trend chart
2. **Bookings** — total, confirmed rate, cancellation rate, average booking value
3. **Usage** — 7×24 peak hours heatmap (busiest hours in green, dead hours in gray)
4. **Courts** — revenue per court, occupancy per court comparison
5. **Demand** — searches, views, booking attempts, completions funnel (Demand tab)
6. **Leakage** — empty slots, viewed-but-not-booked, started-checkout-but-abandoned (Leakage tab)

**Sasabihin sa client:**
> "Ito yung analytics. Per-venue, kita mo kung kelan peak hours mo — so alam mo kung kelan ka dapat magtaas ng presyo. Kita mo rin kung ilan yung nag-view ng venue mo pero hindi nag-book — ibig sabihin may something sa listing na hindi nakaka-convert."

---

## 13. Dynamic Pricing (AI-Suggested)
**CSV Row(s):** #9 (Suggested dynamic pricing), #10 (Automated dynamic pricing)

**Tour Path:**
```
Owner Home → Venues → pick venue → Insights tab → scroll to "Pricing Suggestions" card
```

OR sa Pricing/Slot Pricing tab mismo:
```
Owner Home → Venues → pick venue → Pricing/Slot Pricing tab → PricingSuggestionsCard
```

**Ano ipapakita:**
- Per-day×hour suggestions: "₱500 → ₱600 (High confidence, +20%)"
- Color-coded confidence: Green (high) / Yellow (medium) / Red (low)
- **Bulk Apply** button — apply all high-confidence suggestions at once
- **Auto Dynamic Pricing toggle** — kapag naka-ON, nightly 3am cron auto-applies high-confidence suggestions
- Owner sets: min confidence threshold (Low/Medium/High) + max adjustment cap (5%–50%)
- OFF by default — owner stays in control

**Sasabihin sa client:**
> "May AI-assisted pricing suggestions based on demand. Hindi automatic — ikaw pa rin magde-decide kung ia-apply mo. Pero kung gusto mong i-auto, may toggle para mag-adjust ang presyo gabi-gabi based sa data ng bookings mo."

---

## 14. Multi-Sport Support
**CSV Row(s):** #35 (Court sport/type field), #36 (Multi-sport UI visibility)

**Tour Path:**
```
Owner Home → Venues → pick venue → Courts tab → Add/Edit court → "Sport" dropdown
```

**Ano ipapakita:**
- 6-sport picker: Pickleball, Badminton, Tennis, Table Tennis, Volleyball, Basketball
- Default: Pickleball
- Data model supports multi-sport (ready for future UI)
- Player-facing visibility still TBD (hindi pa naka-display sa browse)

**Sasabihin sa client:**
> "Yung court model natin ready na for multi-sport. Pwede Pickleball, Badminton, Tennis, etc. Sa ngayon pickleball muna yung UI, pero yung data layer handa na — so pag ready na tayong mag-expand sa ibang sports, walang migration na kailangan."

---

## 15. Member/Subscription Plans
**CSV Row(s):** #6 (Member pricing — special rate for venue members)

**Tour Path:**
```
Owner Home → Venues → pick venue → Members tab → "Manage Subscription" button → Subscription Plans screen
```

**Ano ipapakita:**
- **Subscription Plans screen** — list ng plans with: name, price, billing cycle (Weekly/Monthly/Quarterly/Semi-Annual/Annual/Custom), member count, status (Active/Draft/Disabled)
- **Create Plan** — BottomSheet form: name, description, price, billing cycle, benefits list (+Add/remove), max members, free trial days, auto-renew toggle
- **Edit** — editing a live plan's price/billing/benefits auto-versions (existing subscribers stay on old version)
- **Duplicate, Enable/Disable, Delete** per plan
- **Members tab** — shows actual members (joined via subscription), each row: name, plan/tier, "member since" date, Remove button
- **"Add member"** — opens picker of past players to manually grant membership

**Sasabihin sa client:**
> "Pwede kang gumawa ng subscription plans — monthly, quarterly, annual, kahit custom. May versioning — pag nagbago ka ng presyo, existing members hindi maaapektuhan hanggang renewal. Yung new members, yung bagong presyo na."

---

## 16. Venue Claim Flow
**CSV Row(s):** #34 (Venue claim flow), #45 (Owner identity verification)

**Tour Path:**
```
Owner Home → Venues → "Claim" button → search unclaimed venue → pick venue → fill proof form → submit
```

**Ano ipapakita:**
- Debounced search ng UNCLAIMED venues only
- Pick from list → pre-fills venue info
- **Proof form** — legal name, role at venue, description (≥10 chars), optional links (max 5), file upload
- Submit → "Claim submitted, pending review" success state
- Admin approves → venue becomes claimed, owner linked

**Sasabihin sa client:**
> "Kung yung venue mo nasa directory na namin (hindi mo pa na-claim), hindi mo kailangang gumawa ng bago. Search mo, claim mo, submit proof — once approved, sa'yo na yung listing."

---

# PART 2: PLAYER DEMO FLOW

## 17. Browse Venues ("Nearby" Tab)
**CSV Row(s):** #33 (Amenities/facilities filterable)

**Tour Path:**
```
Open app → Login as player → Nearby tab (second tab sa baba)
```

**Ano ipapakita:**
- Map view with venue pins
- "Near me" — requests location, sorts by distance (km), marks "you are here"
- List sheet below map — venue cards with: photo, name, city, distance, price range (₱min–₱max/hr), rating
- **Filter chips** — Indoor, Free, Lighted, Games here
- **Filter sheet** — court type, price (Any/Free/Paid), open play, distance cap (1–50 km), amenities
- **Search** — type venue name
- **Load more** — paginated (20 per page)

**Sasabihin sa client:**
> "Ito yung player browse experience. Nakikita nila yung lahat ng courts malapit sa kanila, with distance, presyo, at photos. Pwede nilang i-filter — indoor lang, may lighting, libre, etc."

---

## 18. Court/Venue Detail + Book Flow
**CSV Row(s):** #12 (Deposit vs full payment), #13 (7% service fee), #21 (Double-booking collision handling)

**Tour Path:**
```
Nearby tab → tap venue card → Court Detail → "Book this court" button → BookCourtScreen
```

**Ano ipapakita sa Court Detail:**
- **Hero image + gallery** (photos strip)
- **Open today availability strip** — free hour chips (e.g. "10AM", "11AM", "2PM"), "Closed today" or "Fully booked"
- **Price range** — ₱500–₱750/hr (if courts differ)
- **Per-court breakdown** — number, name, surface, rate, photo
- **Booking policy** — if requires approval: "Owner approves first — pay within 24h", CTA becomes "Request to book"
- **Weekly hours** — collapsible, today highlighted
- **Rating + review count + Verified chip**
- **Location** — mini Leaflet map with pin + distance from you
- **Amenities** — parking, showers, aircon, lighting, indoor/outdoor badge
- **Contact** — phone (tel: link), website
- **Games here** — live list of open games at this venue
- **Share + Save** buttons

**Book Flow (4 steps):**
1. **Pick court** — select from available courts
2. **Pick date** — calendar with full-day dots (coral = fully booked, visible agad)
3. **Pick time** — hour grid, booked hours show as "Booked" (gray, strikethrough, coral tag)
4. **Review + Pay** — summary: venue, court, date, time, hours × rate = subtotal, 7% service fee, total
   - **Test mode** — pre-filled 4242 card, TEST banner
   - **Live mode** — card form (PayMongo)
   - If owner approval required: instead of "Pay", button says "Request booking" (card saved but not charged)
5. **Confirmation** — "Booked!" / "Request sent! Awaiting owner approval"

**Sasabihin sa client:**
> "Ito yung booking flow ng player. Simple lang — pili ng court, pili ng oras, bayad. Kung naka-approval yung venue, request muna, then pag in-approve ng owner, saka pa lang magbabayad. Walang double-booking kasi real-time yung availability."

---

## 19. My Bookings (Player)
**CSV Row(s):** #23 (Booking modification — reschedule, change court)

**Tour Path:**
```
Profile tab → "My Bookings" → list of bookings → tap booking → detail
```

**Ano ipapakita:**
- List of upcoming + past bookings
- Status chips: Confirmed, Awaiting Payment (with "Pay by [deadline]" + "Pay ₱X" button), Pending Approval, Completed, Cancelled
- Tap booking → full detail + Cancel button (if upcoming)
- **Awaiting Payment booking** → Pay button → checkout → confirmed
- **Cancel** → confirmation → cancelled

**Sasabihin sa client:**
> "Dito nakikita ng player lahat ng bookings niya. Kung may "awaiting payment" siya — ibig sabihin in-approve na ng owner, kailangan na niyang magbayad within the deadline."

---

## 20. "Game On" — Host a Game Lobby on a Booked Court
**CSV Row(s):** #15 (Open-play / per-session pricing vs whole-court block), #20 (Recurring bookings)

**Tour Path:**
```
Home tab → "Game On" button (bottom center, or FAB) → "Host a lobby" → pick a booked court → Create Game form
```

**Ano ipapakita:**
1. **Create Choice Sheet** — "Join a game" (→ Games browse) OR "Host a lobby" (→ pick booking)
2. **Pick a booked court** — loads player's upcoming confirmed bookings that aren't already hosting a game
3. **Create Game form** — your booked court shown as read-only card (venue, date, time locked)
   - Title, skill level, max players, description
   - No payment — already paid via booking
4. **Game Lobby** — roster, chat, share link, host controls (kick, edit, delete lobby)

**Sasabihin sa client:**
> "Yung 'Game On' feature — pagka-book ng player ng court, pwede siyang mag-host ng game lobby. So yung court booking niya nagiging social — iniimbita niya yung ibang players, may chat, may roster. Yung booking niya yung nagiging venue ng laro."

---

## 21. Clubs (Social Feature)
**CSV Row(s):** #50 (In-app messaging - owner to player)

**Tour Path:**
```
Clubs tab → Discover clubs → tap club → "Join" → now in My Clubs → Feed tab → post/comment/photo
```

**Ano ipapakita:**
- **Discover** — searchable, paginated list of public + nearby clubs
- **Create Club** — name, description, cover photo, visibility (public/private), member limit
- **Club Detail** — Feed tab (posts with photos, comments, likes, live SSE updates), About tab, Members tab
- **Host controls** — Edit club, Delete club, approve/deny join requests (private clubs), remove members, edit/delete posts
- **Share invite** — native share sheet with club link

**Sasabihin sa client:**
> "May social layer din — clubs. Parang Facebook group for pickleball. Pwedeng public o private, may feed, photos, comments. Yung feed live-updating via SSE — realtime."

---

## 22. Messages (Owner ↔ Player)
**CSV Row(s):** #50 (In-app messaging)

**Tour Path:**
```
Messages tab (envelope icon sa tab bar) → Conversations list → tap conversation → Chat
```

**Ano ipapakita:**
- Conversations list — bawat convo shows last message preview, unread count, timestamp
- Chat screen — real-time messages, send button
- Owner ↔ player direct messaging
- Replaces Messenger/IG coordination

**Sasabihin sa client:**
> "May built-in messaging. Hindi na kailangan lumabas ng app para mag-usap yung owner at player — lahat ng coordination, dito na."

---

## 23. Push Notifications
**CSV Row(s):** #49 (Push notifications — FCM + VAPID)

**Tour Path:**
```
Any screen → receive push notification → tap → deep-links to relevant screen
```

**Ano ipapakita:**
- Booking confirmation push: "Your booking at [venue] is confirmed for [date] at [time]"
- Approval push: "Your booking request at [venue] was approved — pay within 24h"
- Chat message push: "[Name]: Hey, see you at the court!"
- Game invite push: "[Name] invited you to a game at [venue]"
- Dual-channel: FCM (Android) + VAPID Web Push (all browsers)
- Service worker handles background delivery + click deep-linking
- Auto-pruning ng dead subscription tokens

**Sasabihin sa client:**
> "Lahat ng importanteng events may push notification — booking confirmed, chat message, game invite. Kahit naka-close yung app, makakarating. Android via FCM, lahat ng browser via Web Push."

---

## 24. Profile & Settings
**CSV Row(s):** #44 (Multi-user/staff accounts with permissions), #45 (Owner identity verification)

**Tour Path:**
```
Profile tab → avatar/name → settings/preferences
```

**Ano ipapakita:**
- **Profile** — name, avatar, skill tier (DUPR), bio, stats (games, wins, streak)
- **Edit Profile** — name, bio, skill level (for players only — hidden for owners/organizers)
- **Settings** — notifications toggle (game reminders, chat, announcements), search radius (5/10/25/50 km), distance units (km/mi), privacy (public/friends/private), appearance (light/dark/system)
- **Payment History** — total spent, monthly spend bar chart (6 months), receipt list
- **My Bookings** — upcoming + past bookings
- **My Games** — games you're in

**Sasabihin sa client:**
> "Standard profile settings. Every user may sariling preferences — notifications, privacy, distance units. Yung skill level para sa players lang (hindi lumalabas sa owners)."

---

## 25. Organizer Toolkit (for Tournament Organizers)
**CSV Row(s):** Referenced in organizer toolkit memory

**Tour Path (Organizer role):**
```
Login as organizer → Profile → Organizer Console → Tournaments → Create/Manage
```

**Ano ipapakita:**
- **Tournaments** — create, manage brackets, registrations, announcements
- **Recurring open play** — schedule recurring sessions
- **Rosters** — manage player lists, attendance
- **Waitlist + approval** — waitlist management, approve/reject
- **Payment tracking** — who paid, who hasn't

**Sasabihin sa client:**
> "May separate organizer toolkit para sa mga tournament directors at event organizers. Full tournament management — registration, brackets, announcements, payment tracking."

---

# PART 3: PAYMENTS & OPERATIONS

## 26. Payments & Payouts
**CSV Row(s):** #46 (Payout schedule & reconciliation), #47 (BIR-compliant receipts), #48 (Cash booking leakage mitigation)

**Tour Path:**
```
Owner Home → Settlements card → Payout schedule view
```

**Ano ipapakita:**
- **Settlements** — per-venue payout schedule, reconciliation status
- **Test mode** — PayMongo test keys, 4242 card (no real charges)
- **Live mode** — real PayMongo integration
- **Receipts** — auto-generated OR numbers (OR-{venueCode}-YY-{seq}), VAT breakdown (12%), payor TIN fields
- **Leakage tab** — analytics on empty slots, viewed-but-not-booked, abandoned checkouts (measures leakage, doesn't prevent it yet)

**Sasabihin sa client:**
> "Payment infrastructure: PayMongo integration, test mode muna for demos. May BIR-compliant receipt generation. Yung settlement reconciliation — kita ng owner kung magkano at kelan siya mababayaran."

---

## 27. Dynamic Pricing Automation
**CSV Row(s):** #10 (Automated dynamic pricing)

**Tour Path:**
```
Owner Home → Venues → pick venue → Pricing tab → toggle "Auto Dynamic Pricing" ON
→ set min confidence (Low/Medium/High) + max adjustment (5%-50%)
```

**Ano ipapakita:**
- Toggle OFF by default (opt-in lang)
- Confidence threshold picker
- Max adjustment cap slider (5%–50%)
- Once ON: nightly 3am cron scores demand (occupancy% + waitlists + empty slots) per day×hour
- Auto-applies high-confidence SlotPriceOverrides
- Owner can always manually override any auto-set price

**Sasabihin sa client:**
> "Para sa mga ayaw nang manual mag-adjust ng presyo araw-araw — i-on mo lang to, set mo yung maximum adjustment (e.g. 20%), at every 3am automatic nang mag-aadjust based sa demand data. Pero ikaw pa rin ang boss — pwede mong i-override kahit kelan."

---

# PART 4: QUICK REFERENCE — LAHAT NG NAVIGATION PATHS

## Owner Flows

| Feature | Navigation Path |
|---|---|
| Owner Dashboard | Login → Owner Home (tab) |
| My Venues list | Owner Home → "My Venues" |
| Create Venue | Owner Home → "Create Venue" → fill name/address/contact → Create |
| Claim Venue | Owner Home → Venues → "Claim" → search → pick → proof → submit |
| Venue Editor (12 tabs) | Owner Venues → tap venue → URL-tracked tabs |

### All 12 Venue Editor Tabs

| Tab | Path from Venue Editor | Key actions |
|---|---|---|
| **Overview** | Tab 1 | Booking link + Share, revenue KPIs, completeness meter, setup shortcuts |
| **Insights** | Tab 2 | Revenue/Bookings/Usage/Courts/Demand/Leakage analytics |
| **Bookings** | Tab 3 | Filter: All/Needs Action/Confirmed/Cancelled → tap → detail sheet → Approve/Decline |
| **Membership** | Tab 4 | Members list, invite, "Manage Subscription" → Subscription Plans screen |
| **Listing** | Tab 5 | Name, description, contact, booking policy toggle + pay window, pricing defaults, weekend/holiday rates, member discount, amenities, cancellation policy, delete venue |
| **Location** | Tab 6 | Map pin, address autocomplete, Address line 1/2, City (free-text), Postcode, Lat/Lng |
| **Courts** | Tab 7 | Add/edit courts, per-court rate/surface/sport, photos gallery, per-court hours, half-court split, per-court approval override, turnover gap |
| **Slot Pricing** | Tab 8 | Manual surge/discount per date×hour×court, auto dynamic pricing toggle + settings, pricing suggestions card |
| **Closures** | Tab 9 | Holiday/maintenance closure dates |
| **FAQs** | Tab 10 | Q&A pairs (shown on public court detail) |
| **Photos** | Tab 11 | Hero image + gallery upload |
| **Staff** | Tab 12 | Add Manager/Front-desk, assign role, remove |

### Other Owner Screens

| Screen | Path |
|---|---|
| Front Desk (Manual Book) | Owner Home → "Front Desk" → pick venue → today's schedule, manual entry, block slots |
| All-Venues Bookings | Owner Home → "Bookings" → filter/sort across all venues |
| Settlements | Owner Home → "Settlements" → payout reports |
| Cross-Venue Insights | Owner Home → "Insights" → combined analytics |
| Subscription Plans | Venue Editor → Members tab → "Manage Subscription" |

## Player Flows

| Feature | Path |
|---|---|
| Browse Venues (Nearby) | Nearby tab → map + list, filter, search, "Near me" |
| Court Detail + Book | Nearby → tap venue → "Book this court" → pick court/date/time → review → pay/request |
| My Bookings | Profile → "My Bookings" → pay (if awaiting_payment), cancel |
| Game On → Host Lobby | Home → "Game On" → "Host a lobby" → pick booked court → create game form |
| Game On → Join Game | Home → "Game On" → "Join a game" → Games browse |
| Messages | Messages tab → conversations → chat |
| Clubs | Clubs tab → Discover/My Clubs → Feed/About/Members |
| Notifications | Bell icon (top right) |
| Profile Settings | Profile → Settings → notifications, search radius, units, privacy, appearance |
| Edit Profile | Profile → Edit → name, bio, skill level (players only) |
| Payment History | Profile → "Payment History" → spend chart + receipts |
| Organizer Console | Profile → "Organizer Console" → tournaments, open plays, rosters, payments |

## Pricing Priority Chain (highest wins)

```
1. Slot Price Override  ← specific date + time window (manual surge/discount)
2. Per-Court Rate       ← each court's own hourly rate
3. Weekend / Holiday    ← Sat/Sun override, holiday dates
4. Venue Default Rate   ← fallback "priceFrom" sa Listing tab
```

---

*Generated 2026-06-30 for client demo. Based on TASKS CSV (53 feature rows) + current app state (12 venue editor tabs, per-court approval, multi-layer pricing).*
