# Product Specification — PicklePlay PWA

## Product Goals

Build the easiest way for a regular person to find pickleball games, meet players, and organize play.

### User Promise

"I want to play pickleball. Where do I go, who do I play with, and how do I join?"

### Success Metrics
- New user can find and join a game within 3 minutes of signup
- Organizer can create a game and invite players in under 2 minutes
- 60% of new users return within 7 days

## Target Users

### Primary: Casual/Regular Player
- Wants to find courts and games nearby
- Wants to join sessions easily
- Wants to know who they're playing with (skill level, count)

### Primary: Organizer
- Creates sessions regularly
- Needs invite and attendance tools
- May run round robins or recurring games

### Secondary: Club/Group Lead
- Runs a local pickleball community
- Needs a durable home for their group
- Wants announcements, events, and member communication

### Secondary: First-Time Player
- Doesn't know where to start
- Needs gentle guidance
- Wants beginner-friendly games

## Core User Journeys

### 1. First-time player finds a game
1. Opens app → sees onboarding (skippable)
2. Sets location → sees nearby courts and games
3. Browses games feed
4. Taps a public game → sees details → taps "Join"
5. Game appears in "My Games"

### 2. Organizer creates and fills a session
1. Taps "+" → chooses "Create Game"
2. Fills form: name, location, date/time, player limit, skill range
3. Creates session → invites players via link or from list
4. Manages attendance and chats with confirmed players

### 3. Player discovers a club and joins
1. Browses Clubs tab → sees nearby clubs
2. Taps a club → sees members, events, description
3. Taps "Join" → becomes member
4. Sees club events and can RSVP

## Design Principles

1. **Mobile-first**: Design for 320-428px width first. Tablet is secondary.
2. **Clean > Comprehensive**: Fewer filters, fewer options, clearer paths.
3. **Friendly**: Rounded corners, soft colors, approachable copy.
4. **Fast**: Sub-3s load on 4G. No unnecessary animations.
5. **Empty states matter**: Every empty list has an illustration, friendly text, and one clear CTA.
