# PicklePlay Project Overview

This document summarizes the project based on the full screenshot set and the supporting reverse-engineering docs in this folder.

It is meant to answer three basic questions for a new teammate:

1. What is this product?
2. How are users supposed to use it?
3. How is the app organized from a navigation and feature perspective?

## What This Project Appears To Be

PicklePlay appears to be a mobile-first pickleball community and session-organizing app.

At a high level, it combines:

- local court discovery
- game/session discovery
- self-organization tools for players and organizers
- recurring communities through groups
- reusable player lists for repeat invites
- chat and invite workflows
- player ratings and light stats
- subscriptions and organizer payment setup

The product does not look like a simple court directory or a simple calendar app. It looks more like a hybrid of:

- sports discovery
- social coordination
- lightweight competition management
- organizer tooling

## Core Product Promise

From the UI, the product promise looks something like this:

- find a place to play
- find people to play with
- join or request to join games
- organize your own sessions when needed
- stay connected through groups and chat
- manage your profile, rating, notifications, and plan in one place

## Primary User Types

The screenshots suggest the app serves several overlapping user types.

### 1. Casual or regular player

This user likely wants to:

- find courts nearby
- browse upcoming games
- follow a court
- join sessions
- message or chat with groups
- maintain a visible skill level

### 2. Returning local player

This user likely uses the app more habitually and cares about:

- recurring local discovery
- saved preferences
- alerts about nearby sessions
- existing groups and conversations

### 3. Organizer

This user likely:

- creates sessions
- invites players
- uses groups and lists
- defines skill ranges and participation rules
- may collect payments
- may run round robins or mini tournaments

### 4. Community builder / group manager

This user likely:

- creates local groups
- defines group access rules
- manages membership
- uses group chat
- keeps venue-based or skill-based communities active

## Main Product Areas

The app is organized around five primary bottom-navigation sections, plus a few global shortcuts.

### Bottom tabs

1. Home
2. Nearby
3. Games
4. Groups
5. Stats

### Global top actions

1. Account / Settings
2. Create / Add
3. Invites / Notifications
4. Active Chats

## How Users Are Supposed To Interact With The Product

The clearest way to understand PicklePlay is by following the most likely user journeys.

## 1. First-time setup and onboarding

The app appears to onboard users directly inside Home, not in a completely separate wizard.

### What users are encouraged to do first

- join Pickleheads
- add their skill level
- add a profile image
- follow their first court
- enable push notifications

### Why that matters

This tells us the product depends heavily on a few core identity and discovery signals:

- location
- skill/rating
- social visibility
- notification permission

Without those, the user probably gets less value from discovery and invitations.

## 2. Discovering places to play

Users can browse nearby courts through:

- map view
- list view
- filters
- court detail pages

The court experience is not just a static directory. A court can be:

- followed
- used as a discovery anchor
- connected to schedule, groups, and chat

This suggests that courts are central objects in the product, not just metadata.

## 3. Discovering games

Users can discover games in at least two places:

- Home feed
- Games area

### Home

Home discovery seems more recommendation-oriented and lightweight.

Users can filter by:

- skill level
- day of week
- time of day
- location scope
- distance
- followed courts

### Games tab

Games seems more schedule-oriented and operational. It divides the user’s game world into:

- Invites
- Upcoming
- Completed

This suggests:

- Home helps users discover what is out there
- Games helps users manage what they are already involved in

## 4. Joining and attending sessions

Sessions appear to have multiple participation states.

### Possible user states shown in screenshots

- invited
- joined
- outsider viewing a private session
- organizer

### Visible session actions

Depending on role, users may:

- request to join
- add a guest
- leave the session
- view players
- open chat
- get directions
- copy address

This means sessions are not just passive listings. They are active coordination spaces.

## 5. Creating sessions

This is one of the deepest parts of the product.

### Basic creation flow

1. Open Games
2. Create a new session
3. Choose a play mode
4. Configure details
5. Create the session
6. Invite players

### Supported visible session types

- Quick Game
- Weekly Game
- Round Robin
- Mini Tournament / advanced round-robin style flow

### Session creation capabilities visible in the screenshots

- set title
- choose location
- set player or team limits
- choose date and time
- choose public or private
- set repeat behavior
- attach description and images
- set skill level
- add co-host
- enable payment collection
- define advanced participation rules

This strongly suggests the app is intentionally organizer-friendly.

## 6. Running structured or competitive play

The newer screenshots make this area much clearer.

Round robin is not a single option. It has its own format-selection layer.

### Rotating-partner formats visible

- Popcorn
- Gauntlet
- Up & Down the River
- Claim the Throne
- Cream of the Crop
- Double Header
- Mixed Madness
- Scramble

### Fixed-partner formats visible

- Pool Play
- Shuffle
- Bracket

### Why this matters

This tells us the product supports more than casual session scheduling. It also supports lightweight competition design and structured play.

That makes PicklePlay meaningfully broader than:

- a sports calendar
- a meetup board
- a casual chat app

## 7. Inviting players

Invites are one of the product’s core interaction loops.

### Session invite methods shown

- text an invite link
- scan a QR code
- invite players
- invite groups
- invite lists
- add confirmed players

### Group invite methods shown

- text invite link
- scan QR code
- invite players directly

### List add-player methods shown

- search Pickleheads
- from contacts
- by email or phone

### Product implication

The app supports both:

- casual ad hoc sharing
- repeat organizer workflows

That is a major characteristic of the product.

## 8. Groups and community spaces

Groups appear to be persistent communities, not just temporary chat threads.

### Groups visibly support

- name and description
- venue association
- privacy settings
- skill targeting
- optional plan requirements
- member invite permissions
- chat
- sessions tab

This makes groups feel like local community containers for recurring play.

## 9. Reusable player lists

The newly added screenshots show that `My Lists` is a genuine feature, not a placeholder.

### What lists appear to be

Lists seem to be private, reusable rosters of players.

Users can:

- create a list
- name it privately
- populate it from:
  - in-app search
  - phone contacts
  - direct email/phone entry

### Why this is important

Lists reduce repeat invitation work for organizers.

They likely support:

- recurring game invites
- organizer convenience
- faster roster reuse than groups in some cases

## 10. Chat and support

Chat appears in at least three ways:

- global Active Chats inbox
- group chat
- implied session or court chat tabs

There is also a visible support/help thread, which implies that user support is built into the communication model rather than being entirely external.

## 11. Ratings and stats

Rating is a first-class user concept in the UI.

### Visible rating features

- self-reported rating
- DUPR integration
- alternate rating-source fields
- profile display preference

### Visible stats features

- activity summary
- session count
- frequency
- best week
- win/loss/tie record
- match history tab `not yet captured`

### Product implication

Skill level is not hidden. It is central to:

- player identity
- session filtering
- group fit
- social presentation

## 12. Notifications, reminders, and re-engagement

The app puts unusual emphasis on notification control.

Users can configure:

- push categories
- email categories
- group alerts
- nearby session timing
- format preferences
- skill-level relevance

The reminder email screenshot also shows:

- event reminders
- calendar attachment
- directions
- alert-preference links

That suggests notifications are a major part of how the app keeps users engaged.

## 13. Subscription and payments

The app clearly has a monetization layer.

### Visible plan tiers

- Plus
- Pro
- Ultra

### Visible gating and premium signals

- some filters marked `PLUS`
- Weekly Game marked `PRO`
- advanced stats upsell
- subscriptions tied to usage quotas

### Payment setup

Users can connect:

- Stripe
- card methods
- preferred currency
- third-party handles like Venmo, Cash App, PayPal

### Product implication

The app appears to monetize both:

- player-level premium access
- organizer-level advanced functionality

## Navigation Tree

Below is a user-facing navigation tree based on all currently documented screenshots.

```text
PicklePlay
|
|-- Top Bar / Global Shortcuts
|   |-- Account / Settings
|   |   |-- Profile
|   |   |-- Rating
|   |   |-- Location
|   |   |-- Contact
|   |   |-- My Plan / Subscriptions
|   |   |-- Payments
|   |   |-- Notifications
|   |   |-- Permissions
|   |   |-- Help
|   |   |-- Privacy
|   |   |-- Terms
|   |   `-- Log out
|   |
|   |-- Notifications / Invites
|   |   |-- Pending Invites
|   |   `-- Declined Sessions
|   |
|   `-- Active Chats
|       |-- Support Chat
|       `-- Group / Context Threads
|
|-- Home
|   |-- Shortcut Actions
|   |   |-- Create a game
|   |   |-- Find games
|   |   |-- Take a lesson
|   |   |-- Learn to play
|   |   `-- Create a group
|   |
|   |-- Onboarding Checklist
|   |   |-- Add skill level
|   |   |-- Add profile image
|   |   |-- Follow first court
|   |   `-- Enable push notifications
|   |
|   `-- Find Games Feed
|       |-- Date filters
|       |-- Type filters
|       `-- Game filter panel
|
|-- Nearby
|   |-- Courts Mode
|   |   |-- Map View
|   |   |-- List View
|   |   |-- Court Filters
|   |   `-- Court Details
|   |       |-- Details
|   |       |-- Schedule
|   |       |-- Groups
|   |       `-- Chat
|   |
|   `-- Games Mode
|       `-- Nearby Game Filters
|
|-- Games
|   |-- Invites
|   |-- Upcoming
|   |-- Completed
|   |
|   |-- Create a Session
|   |   |-- Quick Game
|   |   |-- Weekly Game
|   |   |-- Round Robin
|   |   |   |-- Rotate Partners
|   |   |   |   |-- Popcorn
|   |   |   |   |-- Gauntlet
|   |   |   |   |-- Up & Down the River
|   |   |   |   |-- Claim the Throne
|   |   |   |   |-- Cream of the Crop
|   |   |   |   |-- Double Header
|   |   |   |   |-- Mixed Madness
|   |   |   |   `-- Scramble
|   |   |   |
|   |   |   `-- Fixed Partners
|   |   |       |-- Pool Play
|   |   |       |-- Shuffle
|   |   |       `-- Bracket
|   |   |
|   |   `-- Mini Tournament / Advanced Competitive Flow
|   |
|   |-- Session Created
|   |   `-- Invite Players
|   |
|   |-- Add Players to Your Game
|   |   |-- Text Invite Link
|   |   |-- QR Code
|   |   |-- Invite Players
|   |   |-- Invite Groups
|   |   |-- Invite Lists
|   |   `-- Add Confirmed Players
|   |
|   `-- Session Details
|       |-- Details
|       |-- Players
|       `-- Chat
|
|-- Groups
|   |-- My Groups
|   |   |-- Group Details
|   |   |-- Group Chat
|   |   `-- Mute
|   |
|   |-- My Lists
|   |   |-- Search Lists
|   |   |-- Create List
|   |   `-- Add Players to List
|   |
|   |-- Nearby Groups
|   |
|   |-- Create Group
|   |   |-- Step 1: Basic Information
|   |   |-- Step 2: Choose Courts
|   |   |-- Step 3: Group Access
|   |   |-- Step 4: Group Photo
|   |   `-- Confirmation
|   |
|   `-- Add Players to Your Group
|       |-- Text Invite Link
|       |-- QR Code
|       `-- Invite Players
|
`-- Stats
    |-- My Stats
    |-- My Matches
    `-- Rating Context
```

## Suggested Mental Model For The Team

If a new teammate needs a simple way to think about the app, this is probably the cleanest model:

### Layer 1: discovery

- Home
- Nearby

### Layer 2: participation

- session details
- invites
- messages
- groups

### Layer 3: organization

- create session
- manage session
- create group
- create list
- run round robins / competitive formats

### Layer 4: account and personalization

- profile
- rating
- location
- notifications
- permissions
- plan
- payments

## Main Product Strengths Visible In The Current Screens

Based on the current material, the product seems strongest in:

1. session creation and organizer tooling
2. strong location and court context
3. meaningful skill/rating visibility
4. flexible invitation workflows
5. recurring community features through groups and lists
6. rich round-robin / structured-play support

## Main Areas Still Unclear

Even with the new screenshots, a few parts of the product still need verification later:

1. what `Take a lesson` and `Learn to play` actually open
2. what `Nearby` groups look like in detail
3. what `My Matches` contains
4. what session `Players` and `Chat` tabs look like
5. what court `Schedule`, `Groups`, and `Chat` tabs look like
6. how much of the product is accessible before login
7. whether `Create Court` is a true create flow or a suggestion flow

## How To Use The Other Documentation

- Read [USER-ORIENTED-GUIDE.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/USER-ORIENTED-GUIDE.md) for the user story and major journeys.
- Read [PAGES-MAP.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/PAGES-MAP.md) for explicit per-screenshot UI documentation.
- Read [APP-FLOWS.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/APP-FLOWS.md) for flow relationships and route-like movement between areas.
- Open [screenshot-gallery.html](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/screenshot-gallery.html) when you want the visual companion while reading.

## Short Summary

PicklePlay looks like a social and organizer-friendly pickleball platform built around three big loops:

1. discover courts and games
2. join or organize play
3. stay connected through groups, lists, chat, and alerts

The newly added screenshots strengthen the picture that this is not only a discovery app. It is also a fairly capable lightweight competition and organizer workflow tool.
