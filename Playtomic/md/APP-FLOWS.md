# App Flows

High-level navigation and data flow inferred from the screenshots.

## Top-Level App Map

```text
Login / Sign Up
  -> Home
     -> Book a court
        -> Search location
        -> Filter courts
           -> Sport selector
           -> Date selector
           -> Time selector
        -> Map view
        -> Venue/time selection
        -> Booking checkout/payment (missing)
     -> Learn / Classes
        -> Class search/list
        -> Class detail/checkout (missing)
     -> Compete / Matches
        -> Sport step
        -> Level step
        -> Place/distance step
        -> Results
           -> Join match (missing detail)
           -> Start a match (missing creation flow)
     -> Suggested clubs and recommendations
     -> Premium plan
  -> Community
     -> Feed
        -> Search players
        -> View/create posts
     -> Groups
        -> Empty groups
        -> New group step 1: sport/privacy
        -> New group step 2: group information
        -> Add members
        -> Group detail
        -> Group chat
  -> Profile
     -> Edit profile
     -> Player preferences
     -> Level progression
     -> Premium plan
     -> Menu
        -> Settings
           -> Privacy
           -> Notifications
           -> Security (missing)
           -> Delete account/data (missing confirmation)
        -> Your Activity
           -> Bookings
           -> Classes
           -> Other programs
           -> Groups
           -> Favorite clubs
```

## Public Pages

- `Login.jpg`: only public/unauthenticated screen captured.
- Legal links from login: `Terms of Use`, `Privacy Policy`; actual legal pages are not captured.
- No public marketing website, venue public page, SEO/search page, or web desktop screen appears in this screenshot set.

## Search And Discovery

- Home quick actions drive to booking, lessons, and matches.
- Court search and match search both share location, sport, favorites, and filters patterns.
- Venue discovery supports list and map modes.
- Location search uses geocoding/autocomplete plus `Around me`.
- Search filters appear result-count aware (`See 7 results`) and may disable unavailable choices.

## Venue / Facility Flow

```text
Home -> Book a court -> Court results list
Court results list -> Map view
Court results list -> Location picker
Court results list -> Filter panels
Court results list -> Venue card or time slot -> Venue detail / booking detail (missing)
```

Captured venue data requirements:

- name, image gallery/hero image, distance, city/area, sport, court availability, time slots, duration, price, favorite state, indoor/outdoor/roofed type, features, court size, coordinates.

## Booking And Payment Flow

Captured:

- Search/filter/select initial time slots.
- Premium plan purchase/trial screen.

Missing:

- Court reservation detail page.
- Participant selection.
- Payment method.
- Coupon/commission/fee display.
- Confirmation, cancellation, reschedule, refund flows.

Inferred backend requirements:

- Availability API by venue/court/date/time/duration.
- Booking hold/lock to prevent double booking.
- Payment/subscription integration.
- User bookings history, visible from `Your Activity`.

## Event / Lesson / Class Flow

```text
Home -> Learn -> Class listings -> Class detail / enrollment (missing)
Home scrolled -> Improve your level card -> Course/lesson detail (missing)
```

Captured data requirements:

- class/course title, venue, date/time range, duration, gender/level constraints, participant count, price, recurrence or package duration, sport.

Missing:

- detail page, instructor information, enrollment checkout, cancellation policy.

## Match / Competition Flow

```text
Home -> Compete / Find a match
  -> Select sport
  -> Select level
  -> Select places / distance
  -> Results
     -> Empty state
     -> Flexible suggested matches
     -> Start a match (missing)
     -> Join available slot (missing)
```

Captured data requirements:

- sport, user level/rating, preferred clubs, recent clubs, favorite clubs, distance radius, date/time filters, match cards, player avatars, ratings, open slots, price.

Unclear:

- Whether `Compete` and `Find a match` are separate entry points or aliases to the same `Matches` experience.

## Community / Social Flow

```text
Community -> Feed
  -> Player search
  -> User suggestions
  -> Official/user posts
  -> Floating plus action

Community -> Groups
  -> New group
     -> Step 1 sport/privacy
     -> Step 2 group info
     -> Add members
     -> Group detail
     -> Group chat
```

Captured data requirements:

- player search index, feed posts, user suggestions, group membership, group privacy, group sport, group image/name/description, invitations, realtime chat.

Missing:

- post composer details, comments/reactions, group editing, group deletion/leave, notification list.

## User Account / Profile Flow

```text
Profile
  -> Edit profile
  -> Go Premium
  -> Start levelling
  -> Edit player preferences
  -> Add location
  -> Menu -> Settings / Activity
```

Captured data requirements:

- user name, email, phone, country code, avatar, gender, date of birth, description, location, followers/following counts, match count, sport preferences, player level history, premium status.

Missing:

- save confirmation/error states, full level test, follower/following list, public profile view of another player.

## Settings / Privacy Flow

```text
Settings
  -> Privacy
     -> Private account
     -> Blocked accounts
     -> Interaction visibility
     -> Location visibility
     -> Third-party settings
     -> Data deletion
  -> Notifications
     -> App notification toggles
     -> Priority alerts
     -> Marketing communications
  -> Security (missing)
  -> Delete account and data (missing)
```

Captured data requirements:

- privacy flags, notification preference flags, push permission state, blocked account list, marketing consents, deletion/data rights endpoints.

## Owner / Admin Pages

- No owner/admin facility management screens were captured.
- The visible product is player-facing only.
- If owners/admins exist, likely missing areas include facility profile management, court inventory, availability calendars, pricing, bookings, payments, staff, and customer support.

## Responsive / Mobile Observations

- All screenshots are Android mobile portrait.
- Multiple flows use bottom sheets over dimmed backgrounds for step-by-step choices.
- Full-screen pickers use sticky bottom CTAs.
- Horizontal carousels are common for venues, clubs, suggestions, and quick actions.
- No tablet, desktop, mobile landscape, or web responsive screens were present.

## Duplicated / Needs Verification

- `Profile.jpg` and `Profile 2.jpg` are the same profile screen at different scroll positions.
- `Settings -- Privacy.jpg` and `Settings -- Privacy 2.jpg` are the same privacy screen at different scroll positions.
- `Settings -- Notification.jpg` and `Settings -- Notification 2.jpg` are the same notification screen at different scroll positions.
- `Book a court -- filter.jpg` and `Book a court -- filter 2.jpg` are the same filter screen at different scroll positions.
- `Community -- Created Group.jpg` appears to be an add-members step, despite the filename.
- `Premium Plan.jpg` contains repeated benefit labels; verify whether this is production copy, placeholder data, or a rendering issue.

