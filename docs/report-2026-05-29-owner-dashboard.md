# PickleBallers — Owner Dashboard Progress

**Date:** May 29, 2026
**Focus:** The new Venue Owner Dashboard (website) and the behind-the-scenes
work that powers it.
**Note:** This report is written in plain language for non-technical readers.
Coach-related work is intentionally left out.

---

## The big picture

Today we built the **Venue Owner Dashboard** — a single place where a venue
owner can sign in and manage their own pickleball facilities. Until now, owners
had nowhere to go; this is their new home base on the website.

---

## ✅ What got done today

### Setting up the dashboard (the foundation)

- [x] **A dedicated owner area.** Sign in as a venue owner and you land on your
  own dashboard instead of a "page not found" error.
- [x] **Owner sidebar + venue switcher.** A sidebar lets owners jump between all
  the facilities they manage.
- [x] **"My venues" summary screen.** A home screen shows every venue you own at
  a glance, with quick stats (how many are claimed, verified, and total courts).

### The venue management screens (8 tabs per venue)

Each venue now opens into its own set of tabs:

- [x] **Overview tab** — a completeness meter and key counts so owners can see
  what still needs filling in.
- [x] **Listing tab** — edit the name, contact info, pricing, amenities, and
  highlights from one simple form.
- [x] **Location tab** — drag a pin on a map to mark exactly where the venue is.
- [x] **Hours tab** — set a 7-day weekly schedule and mark holiday closures.
- [x] **Courts tab** — add, edit, and remove the individual courts at a venue.
- [x] **FAQs tab** — add and edit common questions and answers.
- [x] **Reviews tab** — read your reviews and post one reply per review.
- [x] **Photos tab** — view the venue's photo gallery and upload new images.

### Extra screens & smart touches

- [x] **"Add a new venue" page.** Owners can create a facility from scratch; it
  goes live immediately and is tied to them as the owner. (Claiming an
  already-listed venue still works too.)
- [x] **In-map address search.** A Google-Maps-style search box sits inside the
  Location map: type an address, hit Search, and the pin flies to the spot.
  Owners can drag to fine-tune before saving (it never saves automatically — they
  stay in control).
- [x] **Court count fills in by itself.** Owners no longer type a court number by
  hand (which could be wrong). It updates automatically from the actual courts
  they've added, so it always matches reality.
- [x] **Player ↔ owner cross-links.** Easy links to hop between the player area
  and the owner area.

### Getting people to the right place

- [x] **Smart sign-in routing.** After logging in, people are sent to the area
  meant for them — owners go to the owner dashboard, admins go to the admin area,
  and players go to their player area. If someone tries to open a page that isn't
  meant for their role, they're redirected or shown a clear "no access" message
  instead of a broken screen.

### Permissions (who can see and do what)

- [x] **A single, clear set of rules for access.** We replaced scattered,
  one-off checks with one central rulebook that decides what each type of
  account (owner, admin, player, organizer) is allowed to see and do. This makes
  the whole site more secure and easier to keep consistent.
- [x] **New "organizer" account type.** Organizers can manage games and events
  without getting full access to everything else.

### Admin view of owners

- [x] **Admins can now see all venue owners.** A new "Owners" page in the admin
  area lists every owner alongside the venue(s) they own, and shows how many
  venues each one has.

---

## 🔒 Behind the scenes (the engine that powers all of the above)

These are invisible to users but make the dashboard work correctly and safely:

- [x] **Owners only ever see their own venues** — fixed a bug where an owner
  might only see some of their venues (or none) depending on alphabetical order.
  Now an owner with 5 venues reliably sees all 5.
- [x] **Creating venues and saving hours** is now properly supported.
- [x] **Address search** is handled safely on our own servers (with short-term
  caching so repeat searches are fast).
- [x] **Tighter security** — sensitive actions now require a real, verified login,
  and we added extra protection around the login screen against abuse.
- [x] **Verified end-to-end** — we tested the full owner journey: log in → see my
  venues → create a venue → edit it → and confirmed that someone who *doesn't*
  own a venue is correctly blocked from editing it.

---

## ⏳ Still to come (owner dashboard)

- [ ] **Editable street address & main/gallery photos** — these are currently
  view-only for owners until the supporting back-end work is finished.
- [ ] Uploaded images currently land in the media library only (not yet attached
  directly as the venue's headline photo).

---

*Source: `web/DONE.md` (web changes) and today's API updates.*
