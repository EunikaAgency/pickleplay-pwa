# Playtomic Project Overview

## Product Summary

Playtomic appears to be a polished mobile sports marketplace for booking courts, discovering clubs, joining match-related activities, and participating in a lightweight community layer.

Compared with PlayByPoint, the screenshots suggest a more consumer-market, discovery-led product with a stronger brand shell and a clearer premium upsell path.

## Main User Types

### Casual or regular player

Uses the app to:

- book a court
- search nearby venues
- compare time slots and prices
- discover clubs and recommendations

### Improving player

Uses the app to:

- browse lessons and learning options
- track profile progress
- edit player preferences

### Social or match-seeking player

Uses the app to:

- join groups
- use the community area
- enter match-finding or compete flows

## Core Product Areas

### Home

- recommendations
- suggested clubs
- player-preference reminder
- quick actions

### Court booking

- court search
- map view
- location search
- advanced filters
- sport/date/time selectors

### Learning and competition

- learn listings
- compete wizard
- match results

### Community

- community feed
- group list
- create group flow
- group chat

### Profile and settings

- profile overview
- edit profile
- privacy
- notifications
- premium upsell
- activity history

## Navigation Model

Main authenticated navigation appears to be:

```text
Home | Community | Profile
```

The booking and compete experiences branch deeply from Home rather than living in their own permanent tabs.

## Strong Product Themes

- discovery-first
- premium upsell is visually central
- booking is the core utility
- community exists, but booking remains the main anchor
- product branding is stronger and more opinionated than the other screenshot sets

## Likely Backend Domains

- auth and session
- venue catalog
- geocoding and location permissions
- booking availability and pricing
- community groups and chat
- player preferences and progression
- premium subscription
- activity history

## Gaps Or Uncaptured Areas

- no checkout completion flow
- no booking confirmation page
- no deep lesson detail page
- no full account security flow
- no tournament organizer tooling

## Recommended Companion Docs

- Read [USER-ORIENTED-GUIDE.md](./USER-ORIENTED-GUIDE.md) for the player perspective.
- Read [APP-FLOWS.md](./APP-FLOWS.md) for route-like movement.
- Read [PAGES-MAP.md](./PAGES-MAP.md) for per-screen details.
