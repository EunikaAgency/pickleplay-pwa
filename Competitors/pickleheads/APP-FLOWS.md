# PicklePlay App Flows

This flow map summarizes how the screens in the screenshot set appear to connect. It is based on visible navigation and CTAs only.

## Primary App Structure

Bottom navigation:

1. Home
2. Nearby
3. Games
4. Groups
5. Stats

Global top-bar shortcuts seen on major tabs:

1. Account / Settings
2. Add / Create
3. Notifications / Invites
4. Active Chats

## High-Level Site/App Map

### Public / pre-auth pages

- Not present in the screenshot set.
- Likely exists but `needs verification`:
  - Login
  - Registration
  - Forgot password
  - App intro / landing

### Home / discovery pages

- Home dashboard
- Home onboarding checklist
- Home find-games filter sheet

### Search / discovery pages

- Nearby courts map view
- Nearby courts list view
- Nearby venue filter sheets
- Nearby games filter sheets

### Venue / facility pages

- Court details
- Court schedule tab `not captured`
- Court groups tab `not captured`
- Court chat tab `not captured`
- Create Court flow `not captured`

### Event / session pages

- Games landing
- Pending invites
- Play Pickleball mode chooser
- Quick game creation form
- Round-robin format chooser
- Advanced competitive / round-robin creation form
- Session created confirmation
- Session invite/add-player menu
- Session details
- Session players tab `not captured`
- Session chat tab `not captured`

### User account pages

- Account settings hub
- Profile settings
- Contact info
- Location settings
- Notification settings
- Permissions
- Subscription / plan
- Payments
- Ratings

### Group / community pages

- My Groups
- My Lists
- Group creation wizard
- Group creation confirmation
- Add player to group `needs verification`
- Group chat
- Create List modal
- List created / add players prompt
- Nearby groups `tab exists, page not captured`

### Stats / progress pages

- My Stats
- My Matches `tab exists, page not captured`
- Ratings / external rating integrations

### Booking / payment-related pages

- Payment setup
- Session collect-payment section inside game creation
- Stripe connection
- Preferred currency
- Payment history
- Third-party payment handles
- No end-user checkout flow captured

### Messaging / notification pages

- Active Chats inbox
- Notification preferences
- Pending invites
- Reminder email template

### Admin / owner pages

- No explicit owner/admin backend screens in the screenshot set.
- Possible light admin capabilities in consumer UI:
  - Suggest edits to court
  - Create court
  - Manage groups
  - Session organizer controls

## Flow Diagrams

### A. Core Home Flow

`Home dashboard` -> `Find Games filters` -> `Game feed / game card` -> `Session details`

`Home dashboard` -> `Account icon` -> `Account settings hub` -> any settings subpage

`Home dashboard` -> `Chat icon` -> `Active Chats`

`Home dashboard` -> `Bell / invites summary` -> `Pending Invites` `needs verification on exact entry`

### B. Onboarding / first-run flow

`Post-registration Home checklist` -> `Add skill level` -> `Ratings`

`Post-registration Home checklist` -> `Add profile image` -> `Profile settings`

`Post-registration Home checklist` -> `Follow your first court` -> `Nearby court search` -> `Court details` -> `Follow this court`

`Post-registration Home checklist` -> `Enable push notifications` -> `Permissions` or `Notification settings`

### C. Court discovery flow

`Nearby map view` <-> `Nearby list view`

`Nearby map/list` -> `Court filters`

`Nearby map/list` -> `Court details`

`Court details` -> `Follow this court`

`Court details` -> `Get Directions` / `Copy Address`

`Court details` -> `Schedule / Groups / Chat tabs` `not captured`

### D. Game creation flow

`Games landing` -> `Create a new session`

`Games landing` -> `Play Pickleball mode chooser`

`Mode chooser` -> `Quick game creation form`

`Quick game creation form` -> `Session created confirmation`

`Session created confirmation` -> `Add players / invite options`

`Add players / invite options` -> one of:

- `Text an invite link`
- `Scan a QR code`
- `Invite players`
- `Invite groups`
- `Invite lists`
- `Add confirmed players`

`Maybe later` -> `Session details`

### E. Session participation flow

`Home game card` or `Games landing` -> `Session details`

If organizer:

- `Session details` -> `Invite`
- `Session details` -> `Edit`
- `Session details` -> `Cancel`

If participant:

- `Session details` -> `Add a guest`
- `Session details` -> `Leave`

If outsider on private session:

- `Session details` -> `Request to Join`

### F. Group flow

`Groups tab / My Groups` -> `Create Group`

`Create Group step 1` -> `step 2` -> `step 3` -> `step 4` -> `Confirmation`

`Confirmation` -> `Invite Players`

`My Groups` -> `Details` `not captured`

`My Groups` -> `Chat` -> `Group chat`

`Group chat` -> `Sessions tab` `not captured`

`Groups tab` -> `My Lists`

`My Lists` -> `Create a List`

`Create a List` -> `Your list is ready`

`Your list is ready` -> one of:

- `Search Pickleheads`
- `From my contacts`
- `By email or phone`

### G. Advanced competitive play flow

`Play Pickleball mode chooser` -> `Round Robin`

`Round Robin` -> `Select a format`

`Select a format` -> choose rotating or fixed partner mode

`Selected format` -> `Create a round robin`

`Create a round robin` -> `Create Session`

### H. Notification and messaging flow

`Top-bar chat icon` -> `Active Chats` -> specific chat thread

`Top-bar bell` or `Games > Invites` -> `Pending Invites`

`Account settings hub` -> `Notifications` -> notification preferences

`Notification engine` -> reminder email sent 4 hours before play

### I. Stats / rating flow

`Stats tab` -> `My Stats`

`My Stats` -> `My Matches` `not captured`

`Account settings hub` -> `Rating`

`Rating page` -> `Connect your DUPR ID`

`Rating page` -> `Display this rating on my profile`

### J. Billing / premium flow

`Account settings hub` -> `My Plan / Subscription`

`Subscription page` -> plan upgrade

`Account settings hub` -> `Payments`

`Payments` -> `Connect Stripe`

`Quick game creation form` -> `Collect payment`

`Quick game creation form` -> `Plus-power this session`

`Mode chooser` -> `Weekly Game PRO`

## Inferred Role/State Variants

### Unauthenticated vs authenticated

- Only authenticated mobile screens are present.
- Public marketing/auth flows are not visible.

### New user vs returning user

- New users see an onboarding checklist on Home.
- Returning users likely see a simplified Home dashboard and game feed.

### Free vs paid subscriber

- `PLUS`, `PRO`, and `ULTRA` tiers appear.
- Premium gating appears in:
  - Weekly Game
  - Some court filters
  - Enhanced stats
  - Session enhancements
  - Membership/group requirements

### Organizer vs participant vs outsider

- Session details changes based on role:
  - Organizer gets invite/edit/cancel
  - Participant gets add guest/leave
  - Outsider gets request to join for private sessions

## Missing But Likely Existing Flows

- Authentication
- Password reset
- Court schedule
- Court-group linking pages
- Session player list
- Session chat
- My Matches
- Create/edit list
- List member management after creation
- Create/edit court
- Payment checkout or reservation payment
- Lesson booking
- Learn-to-play content

## Recommended Next Documentation Steps

1. Confirm each missing tab target in the running app.
2. Separate consumer features from organizer/admin capabilities.
3. Capture login/register and any web-only screens if they exist outside this mobile flow.
4. Turn these flows into sequence diagrams once actual routes/screens are confirmed.
