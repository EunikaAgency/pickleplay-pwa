# Sitemap

```
PicklePlay PWA
│
├── Public (pre-auth)
│   ├── Login
│   ├── Register
│   └── Forgot Password
│
├── Onboarding (post-registration)
│   ├── Location permission
│   ├── Skill level picker
│   ├── Profile photo upload
│   └── Notifications permission
│
├── Home (tab 1)
│   ├── Quick action cards
│   ├── Onboarding checklist (new users)
│   ├── Invites counter
│   ├── Messages counter
│   └── Find Games feed
│       ├── Date chips
│       ├── Type chips
│       └── Game cards → Game Details
│
├── Nearby (tab 2)
│   ├── Map view
│   │   ├── Court pins → Court Details
│   │   └── Location button
│   ├── List view
│   │   ├── Court cards → Court Details
│   │   └── "Missing a court?" CTA
│   ├── Courts/Games toggle
│   ├── Court filters (bottom sheet)
│   └── Game filters (bottom sheet)
│
├── Court Details
│   ├── Details tab
│   │   ├── Hero image
│   │   ├── Address + directions
│   │   ├── Court count + surface + amenities
│   │   ├── Weather
│   │   └── Follow/Unfollow
│   ├── Schedule tab (placeholder Phase 1)
│   ├── Groups tab (placeholder Phase 1)
│   └── Chat tab (placeholder Phase 1)
│
├── Games (tab 3)
│   ├── My Games / Upcoming / Completed tabs
│   ├── Date chips
│   ├── Game cards → Game Details
│   ├── Game filters (bottom sheet)
│   └── Create button → Create Game
│
├── Game Details
│   ├── Details tab
│   │   ├── Title, date/time, player count
│   │   ├── Skill range, location
│   │   ├── Format, player limit
│   │   ├── Venue card
│   │   ├── Organizer card
│   │   ├── Directions + Copy Address
│   │   ├── Weather
│   │   └── Join/Leave/Request actions
│   ├── Players tab
│   └── Chat tab
│
├── Create Game
│   ├── Name, Location fields
│   ├── Player limit stepper
│   ├── Date/time pickers
│   ├── Public/Private toggle
│   ├── Skill range
│   ├── Description & Images
│   ├── Optional: repeats, co-host, payment note
│   └── Create Session button
│
├── Game Created → Invite Players
│   ├── Text invite link
│   ├── QR code (placeholder)
│   ├── Invite players
│   ├── Invite groups
│   ├── Invite lists (Phase 2)
│   └── Add confirmed players
│
├── Clubs (tab 4)
│   ├── My Clubs / Discover tabs
│   ├── Search
│   ├── Club cards → Club Details
│   └── Create Club button
│
├── Club Details
│   ├── About / Members / Events / Chat tabs
│   ├── Header (photo, name, privacy, skill)
│   ├── Join/Leave button
│   └── Member count
│
├── Create Club (wizard)
│   ├── Step 1: Name + Description
│   ├── Step 2: Choose Courts
│   ├── Step 3: Public/Private + Skill
│   ├── Step 4: Photo
│   └── Confirmation → Invite
│
├── Club Chat
│   ├── Message list
│   ├── Composer
│   └── Member count + online
│
├── Profile (tab 5)
│   ├── Avatar, name, skill
│   ├── Quick stats (games played, clubs)
│   ├── Edit Profile button
│   └── Settings button
│
├── Edit Profile
│   ├── Avatar upload
│   ├── First/Last name
│   ├── Skill level
│   ├── Home location
│   └── Save
│
├── Settings
│   ├── Profile
│   ├── Notifications
│   ├── Location
│   ├── Payments (placeholder)
│   ├── Help
│   ├── Privacy / Terms
│   └── Logout
│
├── Search (overlay)
│   ├── Search bar
│   └── Results by type: Courts, Games, Players, Clubs
│
├── Notifications
│   ├── Notification list (invites, messages, activity)
│   └── Empty state
│
└── Game Chat
    ├── Message list
    └── Composer
```
