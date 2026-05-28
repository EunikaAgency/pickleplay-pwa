# PlayByPoint Project Overview

## Product Summary

PlayByPoint appears to be a mobile-first racquet-sports platform for finding clubs, booking courts, managing memberships, and handling player account operations in one place.

The screenshots suggest the product is strongest as:

- a facility and club discovery app
- a scheduling and booking app
- a member account and payments utility
- a facility-linked player portal for waivers, family profiles, orders, and club communications

Sports explicitly visible:

- padel
- tennis
- pickleball

## Main User Types

### Player or member

Uses the app to:

- discover clubs nearby
- view club details and book courts
- track scheduled and unscheduled bookings
- manage membership-related account settings
- update profile, family, waivers, and payment details

### Active competitive player

Uses the app to:

- browse game matches
- review leaderboards
- view recordings
- inspect statistics and open matches

### Club-affiliated customer

Uses the app to:

- manage club-specific memberships
- store cards and billing addresses
- view payment history and passes
- interact with reservation chat or support

## Core Product Areas

### Onboarding and authentication

- welcome splash
- goal-based onboarding
- sign in
- sign up
- magic link sign in

### Club discovery

- find a club
- location enablement
- favorite clubs
- discover feed
- discover filters
- discover map

### Booking

- club detail
- book tab
- book now sheet
- calendar
- reservation states
- booking filters
- scheduled and unscheduled bookings

### Account and profile

- profile
- profile update
- settings directory
- general settings
- notifications
- language
- change password

### Payments and membership

- payment settings
- payment history
- stored cards
- billing addresses
- booking passes
- club credits
- club account
- memberships

### Player support and extras

- waivers
- proof of residency
- family
- friends
- leaderboard
- recordings
- orders
- help center
- app feedback

## Navigation Model

The main authenticated product appears to use a four-tab bottom bar:

```text
Clubs | Bookings | Discover | Profile
```

The deeper experience is mostly push-navigation from those tabs into details, forms, and settings screens.

## Strong Product Themes

- Facility-centric experience rather than generic social networking
- Strong emphasis on member operations and payments
- Club detail and booking discovery are central
- Settings surface is unusually broad and operationally important
- The app blends consumer UX with facility/member-admin concerns

## Likely Backend Domains

- auth and session
- user profile
- club/facility catalog
- location and geocoding
- booking availability
- memberships
- payment methods and billing
- orders and passes
- waivers
- friends/family relationships
- rankings and match recordings

## Strengths Visible In Screenshots

- clear segmentation of discovery, bookings, and account areas
- wide coverage of real member needs beyond simple booking
- polished booking and settings depth
- multiple entry points into clubs and reservations

## Gaps Or Uncaptured Areas

- no full checkout confirmation flow
- no password reset completion flow
- no owner/admin control panel
- no class/pro detail pages despite mention in welcome copy
- no desktop or tablet views

## Recommended Companion Docs

- Read [USER-ORIENTED-GUIDE.md](./USER-ORIENTED-GUIDE.md) for the product from the user perspective.
- Read [APP-FLOWS.md](./APP-FLOWS.md) for route-like movement and flow dependencies.
- Read [PAGES-MAP.md](./PAGES-MAP.md) for screenshot-by-screenshot reference.
- Open [screenshot-gallery.html](./screenshot-gallery.html) for the visual companion.
