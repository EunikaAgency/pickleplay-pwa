# PlayByPoint Navigation Map

## Root Navigation

Authenticated bottom navigation appears to be:

```text
Clubs | Bookings | Discover | Profile
```

## Public / Pre-Auth

```text
Welcome
  -> Onboarding goal selection
  -> Sign in
  -> Sign up
  -> Magic link modal
```

## Authenticated Hierarchy

```text
Clubs
  -> Find a club
  -> Favorite club state
  -> Selected club
     -> About
     -> Book
     -> Chat or reservation communication

Bookings
  -> Scheduled
  -> Unscheduled
  -> Category filter
  -> Payment filter

Discover
  -> Discover home
  -> Discover filter
  -> Discover map
  -> Club recommendations
  -> Book a court cards

Profile
  -> Profile
  -> Profile update
  -> Settings directory
```

## Settings Menu Structure

```text
Settings
  -> Game Matches
     -> Match list
     -> Match filter
     -> Closed match
  -> My Recordings
  -> Leaderboard
  -> My Orders
  -> Memberships
     -> Member-required state
  -> Payments
     -> Cards
     -> Add card
     -> Billing address
     -> Add billing address
     -> Club account
     -> Club credits
     -> Booking passes
     -> Payment history
  -> Proof of Residency
  -> Family
  -> Waivers
  -> Friends
  -> Help Center
  -> App Feedback
  -> General
     -> Language
     -> Statistics
     -> Change password
  -> Notifications
```

## Booking Flow Navigation

```text
Discover or Clubs
  -> Selected club
  -> Book tab or book sheet
  -> Calendar
  -> Reservation detail
  -> Member gate or next booking step
```

## Important Navigation Observations

- The product is tab-rooted but settings-heavy.
- `Profile -> Settings` is effectively a second-level product hub.
- Booking can be entered from more than one place.
- Some screenshots imply chat/support can be contextual to reservations.
