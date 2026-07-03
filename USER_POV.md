# Player-POV Model 

## Book (private)

* Player books a court at a venue for a specific date and time.
* This is private.
* Only the player with friends.
* No lobby.
* No roster/team.
* No join flow for strangers.
* Who can create:

  * Any role, as long as they have player.bookings.create permission.

## Open Play (public)

* Player publishes their booking as an Open Play listing so other players can join.
* Can join to notify player that someone is interested and want to join but not required to participate if they are not available
* This is public.
* It is visible in:
  * Games tab
  * Open Play
  * Discover
* When other players tap it, they should only see:

  * Open Play info
  * Join button
* Open Play should not have:

  * Lobby
  * Roster management
  * Chat
  * Host tools
  * Grace period
  * Kick feature
* Once joined, players simply show up at the venue on the set date and time.
* Who can publish:

  * All roles
  * Player
  * Organizer
  * Coach
  * Other roles

## Game (organizer-only)

* Required players to participate if they join in the game
* This is a full game with a lobby.
* The lobby includes:

  * Roster
  * Group chat
  * Host management
  * Grace period
  * Kick feature
* It has a selected venue.
* The lobby must fill up first before the final date and time is confirmed.
* Who can create:

  * Organizer role only.
* Should have already a venue without a date and time
* Data and time should be set if lobby is already full

## What to fix

1. createGame API permission

* File:
  api/src/features/games/games.controller.ts:228

* Change:
  player.games.create

* To:
  organizer.access

* Reason:
  Game creation should be organizer-only.

2. Player “Make Open Play” button

* File:
  app/src/features/games/v2/GamesScreenV2.tsx:388-389

* Current issue:
  It creates a Game document.

* Required fix:
  Do not create a Game document.

* It should create a lightweight Open Play listing only.

* Open Play must not have:

  * Lobby
  * Roster management
  * Chat
  * Grace period
  * Kick feature
  * Host tools

3. Open Play Discover tab

* File:
  app/src/features/games/v2/GamesScreenV2.tsx:360-362

* Current issue:
  Some Open Play items can still open like a lobby or game detail.

* Required fix:
  All items in Open Play Discover should only open the info + Join screen.

* This applies to both:

  * source = game
  * source = session

* Both should behave the same:

  * Info screen
  * Join button only
  * No lobby

4. Deep link /open-play/:id

* File:
  app/src/shared/lib/navigation.ts:225-228

* Current issue:
  It tries getGame(id) first, then may open GameDetailsScreen.

* Required fix:
  Do not try getGame(id) first.

* For /open-play/:id, always open the Open Play info + Join screen.

* Never open GameDetailsScreen from this deep link.

5. Open Play detail behavior

* File:
  app/src/features/games/v2/OpenPlayDetailScreen.tsx:66

* Required fix:
  Make it behave the same as OrganizerOpenPlayDetail.

* It should only show:

  * Open Play info
  * Join button
  * Leave button if already joined

* It should not show:

  * Lobby
  * Roster management
  * Chat
  * Grace period
  * Kick feature
  * Host tools

6. Open Play join/leave

* Current issue:
  Open Play may be using joinGame/leaveGame.

* Required fix:
  Open Play must have its own join and leave endpoints.

* Do not use:

  * joinGame
  * leaveGame

* Open Play join/leave should be simple:

  * Join anytime
  * Leave anytime
  * No grace period lock
  * No lobby rules
  * No game roster management

Final expected behavior

Book

* Private court booking only.

Open Play

* Public listing only.
* Players can view info.
* Players can tap Join or Leave.
* No lobby.

Game

* Organizer-only.
* Full lobby flow with:

  * Roster
  * Chat
  * Host tools
  * Grace period
  * Kick feature
