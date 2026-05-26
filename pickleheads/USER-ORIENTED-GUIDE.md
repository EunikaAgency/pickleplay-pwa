# PicklePlay User-Oriented Guide

This guide explains the product from the **user's point of view** using only the screenshots available in this folder. It is meant to help a new teammate understand what users can do, what each area of the app is for, and how the main experiences appear to connect.

## What PicklePlay Appears To Be

PicklePlay looks like a mobile-first pickleball app focused on:

1. finding courts nearby
2. discovering or creating games
3. joining small communities or groups
4. chatting with players
5. tracking ratings and play history
6. managing account, notifications, and payment setup

From the screenshots, the app seems designed for both:

- everyday players who want to find people and places to play
- organizers who create sessions and manage invitations

## Main Areas A User Sees

The bottom navigation suggests five main areas:

1. `Home`
2. `Nearby`
3. `Games`
4. `Groups`
5. `Stats`

The top bar also gives quick access to:

1. account/settings
2. create/add actions
3. notifications or invites
4. chat/messages

## The App In Plain Language

### Home

Home looks like the user's dashboard. It combines:

- shortcuts for common actions
- onboarding/setup reminders
- quick counts for invitations and messages
- a feed of upcoming games

This is probably the first place a returning user checks to:

- create a game
- find games
- see whether anyone has messaged or invited them
- continue setup tasks

### Nearby

Nearby looks like the place where users search for courts and possibly local games. It has:

- a map/list toggle
- search
- court/game filters
- court detail pages

This is likely where a player goes when they want to:

- find a place to play
- see what amenities a court has
- follow a court
- get directions

### Games

Games looks like the scheduling and session-management area. It appears to support:

- upcoming games
- completed games
- pending invites
- creating a new session
- managing a session after it is created

This is likely the most important area for organizers.

### Groups

Groups looks like the community layer of the app. Users can likely:

- create groups
- browse their groups
- create reusable player lists
- chat within a group
- manage invite-only or skill-based communities

### Stats

Stats looks like a personal performance area, with:

- activity summary
- session totals
- frequency
- record or medals
- rating-related information

### Account / Settings

The account area appears to centralize:

- profile
- rating
- location
- contact info
- plan/subscription
- payments
- notifications
- device permissions

## The Most Important User Journeys

## 1. New user getting started

The clearest first-time-user experience is the checklist shown on Home.

### What the user sees

- a welcome card
- a progress indicator
- a short list of setup tasks

### Tasks visible in the screenshots

- Join Pickleheads
- Add your skill level
- Add a profile image
- Follow your first court
- Enable push notifications

### What this tells us about the user experience

- The app wants users to become discoverable and ready to join games quickly.
- Location, rating, and notifications seem especially important early on.
- Following a court may be a key trigger for local discovery and invites.

### Likely user path

`Home checklist` -> `Profile/Rating/Location/Nearby` -> `more complete discovery experience`

## 2. A player looking for somewhere to play

This journey is centered on `Nearby`.

### What the user can do

- search for a court
- switch between map and list
- apply filters
- open a court detail page

### What matters to the user on a court page

- address
- directions
- fees
- number of courts
- indoor/outdoor or surface info
- amenities
- weather nearby
- whether they can follow the court

### Why this is user-important

The court detail page answers practical player questions:

- Is this place usable for me?
- What do I need to know before I go?
- Can I connect with players tied to this court?

### Likely next steps from this page

- follow the court
- get directions
- copy the address
- possibly check schedule/groups/chat

## 3. A player looking for a game

This journey appears in both `Home` and `Games`.

### On Home

Users can browse a game feed by:

- date range
- type of game
- skill level
- time of day
- location preference

### In Games

Users can switch among:

- invites
- upcoming
- completed

### What this tells us

- Home looks optimized for discovery.
- Games looks optimized for commitment and management.

### Likely user path

`Home` -> `Find Games filters` -> `game card` -> `session details`

or

`Games` -> `Upcoming` -> `session details`

## 4. A player joining a game

The session details screen shows different states depending on the user.

### If the user is already in the session

Visible actions include:

- Add a guest
- Leave

This suggests the user can manage their participation after joining.

### If the session belongs to someone else and is private

Visible action:

- Request to Join

This implies the user cannot always self-join and may need approval.

### Practical user meaning

The app seems to distinguish clearly between:

- being invited
- being a confirmed participant
- being an outsider requesting access

## 5. An organizer creating a game

This is one of the strongest flows in the screenshots.

### The process looks like this

1. go to Games
2. tap `Create a new session`
3. choose a format such as:
   - Quick Game
   - Weekly Game
   - Round Robin
   - Mini Tournament
4. fill out the session form
5. create the session
6. invite players

### What the organizer can define

- session name
- location
- number of players
- date and time
- public vs private
- repeat settings
- description and images
- round robin options
- skill level
- co-host
- payment collection
- advanced participation permissions

### Why this matters

This is not just a simple event form. It looks like a fairly flexible organizer workflow designed for recurring, skill-targeted, and possibly paid games.

### Post-create behavior

Right after creation, the app strongly pushes the user to invite players, which tells us:

- session creation alone is not the endpoint
- invitation and attendance management are core parts of the flow

### Competitive format depth

The new screenshots also show that `Round Robin` is not a single preset. Users can choose from many structured formats.

If partners rotate, visible options include:

- Popcorn
- Gauntlet
- Up & Down the River
- Claim the Throne
- Cream of the Crop
- Double Header
- Mixed Madness
- Scramble

If partners stay fixed, visible options include:

- Pool Play
- Shuffle
- Bracket

This makes the organizer experience much richer than a basic event scheduler. The app supports actual competition design.

## 6. Inviting others to a game

The invite screen is very user-centered and gives multiple methods.

### Visible invitation methods

- text an invite link
- scan a QR code
- invite players
- invite groups
- invite lists
- add confirmed players

### What this means from the user perspective

The app is trying to support both:

- casual direct sharing
- structured community-based organizing

This also suggests that users may already have:

- saved player lists
- groups they manage
- players who can be confirmed manually

## 6b. A user creating reusable player lists

The new screenshots confirm that `My Lists` is a real feature, not just a visible tab.

### What a list appears to be

A list looks like a reusable private roster of players that the user can build once and use again later.

### Visible flow

1. go to `Groups`
2. switch to `My Lists`
3. tap the plus button
4. name the list
5. add players from:
   - Pickleheads search
   - contacts
   - email or phone

### Why this matters

This suggests the app supports repeat organizers who do not want to rebuild invite rosters from scratch every time.

## 7. A user managing their groups

The Groups area looks like a place to maintain recurring communities.

### What the user sees

- My Groups
- My Lists
- Nearby
- search
- group cards with privacy, skill range, member count, and actions

### Group card actions shown

- Details
- Chat
- Mute

### What this tells us

Groups appear to be persistent spaces, not one-time events.

They likely help users:

- gather recurring players
- manage local communities
- organize future sessions
- keep conversations separate from direct chats

## 8. A user creating a group

The group creation flow is step-based and easy to interpret.

### Step 1

- basic info
- name
- description

### Step 2

- choose courts

### Step 3

- choose public or private
- set skill level
- possibly require Pickleheads Plus
- control whether players can invite others

### Step 4

- upload a group photo

### Confirmation

- group is created
- user can invite players immediately or skip

### User meaning

Groups are not just chat rooms. They appear to have:

- a location context
- a skill identity
- access rules
- member/invite behavior

## 9. A user chatting

Two chat experiences are visible:

1. a global `Active Chats` inbox
2. a group-level chat screen

### Global Active Chats inbox

This looks like a list of conversations, including:

- support/help chat
- group conversation(s)

### Group chat

The group chat screen includes tabs for:

- Details
- Sessions
- Chat

This suggests chat is part of a larger group hub rather than a standalone messenger.

### What users likely expect here

- conversation history
- quick navigation back to group info
- session context inside a community

## 10. A user handling invites and alerts

The screenshots show two related but different things:

- pending invites
- notification preferences

### Pending invites

This appears to be an inbox for play invitations.

The empty state still gives useful actions:

- refresh
- create a new session
- view declined sessions

### Notification settings

This is much more detailed than a normal simple settings page.

Users can manage:

- push categories
- email categories
- newsletter/tutorial/news preferences
- group alerts
- alert timing by day and time bucket
- preferred session formats
- skill-level targeting

### User meaning

The app seems to assume users care a lot about not being overwhelmed by alerts.

Instead of only on/off controls, it appears to let users decide:

- what they hear about
- when they hear about it
- which types of play matter to them

## 11. A user managing profile, rating, and identity

The account area is built around a clear personal setup model.

### Profile settings

The user can likely edit:

- profile image
- first name
- last name
- gender

There is also a visible `Delete My Account` action.

### Contact info

The user can manage:

- email addresses
- phone numbers
- primary contact method

### Location settings

The user can set:

- home location
- vacation mode

This likely affects discovery and game recommendations.

### Rating page

The user can:

- connect a DUPR ID
- enter self-reported rating
- store alternative ratings
- choose which rating appears on their profile

### User meaning

The app treats skill level as an important part of identity, not just a hidden setting.

## 12. A user checking progress and performance

The Stats page appears to give users a lightweight personal dashboard.

### Visible information

- current visible rating
- activity over time
- how often they play
- record summary
- premium upsell for deeper stats/match history

### Likely user motivation

- see whether they are playing consistently
- track progress
- compare over time
- unlock richer performance info with a paid plan

## 13. A user managing plan and payments

There are two related areas:

1. subscription/plan usage
2. payments

### Subscription page

Shows:

- plan options
- usage counters
- reset date

This tells the user what they have used and what they can upgrade to.

### Payments page

Shows:

- Stripe connection
- credit/debit card entry
- preferred currency
- payment history
- Venmo, Cash App, PayPal fields

### User meaning

This area seems aimed more at organizers or users who may collect money for sessions, not just players paying to join.

## Common User States Seen In The UI

### New user

- sees setup checklist
- likely has incomplete profile/location/rating setup

### Returning player

- uses Home and Nearby for discovery
- checks invites/messages

### Session organizer

- gets create, edit, cancel, invite actions
- may use payments and co-host features

### Participant

- joins sessions
- may add a guest or leave

### Group manager

- creates groups
- controls access
- invites members

## Questions A New Teammate Should Keep In Mind

These are still user-focused unknowns worth verifying later:

1. Are `Take a lesson` and `Learn to play` full app flows or just shortcuts?
2. Can users create courts directly, or only suggest them?
3. How fully featured are `My Lists` after creation beyond what the screenshots show?
4. Are invites opened from the bell, the Games tab, or both?
5. Do users chat in session-specific threads, court-specific threads, or only group/global threads?
6. How much of the app is available before sign-in?

## Best Way To Read The Existing Screenshot Set

If someone new joins the project, the easiest order is:

1. open [PAGES-MAP.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/PAGES-MAP.md) for the full screen inventory
2. read [APP-FLOWS.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/APP-FLOWS.md) for navigation and flow structure
3. use [screenshot-gallery.html](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/screenshot-gallery.html) to visually browse grouped screens
4. read this file last to understand the user story behind the screens

## Short Takeaway

From the screenshots alone, PicklePlay looks like a player-and-organizer app built around a simple user promise:

- find a place to play
- find people to play with
- organize sessions if needed
- stay connected through groups and chat
- manage your level, alerts, and account in one place
