# PicklePlay Existing Screens Map

This file is a screenshot-by-screenshot reference. Every image in the current directory is documented explicitly, with a best-effort identification of the screen, its purpose, its visible controls, and what it appears to connect to.

## Scope

- Source: screenshots only
- Platform: mobile UI
- Goal: help a new team member understand existing pages without opening every image one by one
- Confidence is highest where labels are visible on-screen
- `Needs verification` means the image is clear enough to classify, but the wider flow or exact downstream behavior is not fully proven by screenshots alone

## App-Wide UI Patterns

- Top-level screens often show:
  - account/profile icon
  - add/create icon
  - Pickleheads logo
  - bell icon
  - chat icon
- Main navigation tabs:
  - Home
  - Nearby
  - Games
  - Groups
  - Stats
- Most secondary screens use:
  - a `Back` button
  - a dropdown-like section selector at the top
  - large rounded cards
  - big touch-friendly CTAs
- The product uses a friendly visual style with:
  - pale blue panels
  - white cards
  - dark navy text
  - coral/orange accents for important buttons

## Screenshot Inventory

## Account / Settings

### `account settings -- contact info.jpeg`

- Screen name:
  - Contact Info
- Purpose:
  - Manage the user's stored email addresses and phone numbers
- Main UI:
  - `Back`
  - top selector showing `Contact`
  - section title `Contact Info`
  - `Email Addresses`
  - one visible email: `nathaziaw@gmail.com`
  - `Primary` badge
  - star icon
  - trash icon
  - add row under email addresses
  - `Phone Numbers`
  - add row under phone numbers
- Actions visible:
  - mark or inspect primary/default email
  - favorite/star `needs verification on exact meaning`
  - delete stored email
  - add email
  - add phone number
- Related screens:
  - account settings hub
  - permissions
  - profile
- Notes:
  - Multiple contact methods are clearly supported.
  - Phone list is empty in this state.
- Inferred data needs:
  - multi-email and multi-phone support
  - primary contact flag

### `account settings -- location settings.jpeg`

- Screen name:
  - Location Settings
- Purpose:
  - Set the user's default area for local discovery
- Main UI:
  - `Back`
  - top selector showing `Location`
  - title `Home Location`
  - helper text: `To show nearby courts, games & groups.`
  - current location card: `General Trias, Calabarzon, PH`
  - pencil/edit icon
  - `Vacation Mode` toggle with helper text
- Actions visible:
  - edit home location
  - toggle vacation mode
- Related screens:
  - Home filters
  - Nearby discovery
- Notes:
  - Vacation Mode is explicitly framed as a temporary location override.
- Inferred data needs:
  - saved home location
  - temporary override state

### `account settings -- notifications.jpeg`

- Screen name:
  - Notification Settings
- Purpose:
  - Fine-grained control over push and email alerts
- Main UI:
  - `Back`
  - top selector showing `Notifications`
  - section `Alerts`
  - `Push Notifications`
  - `Device Permissions` with `Currently ON`
  - `Edit` button leading out of app
  - push categories checked:
    - Announcements
    - Group messages
    - Court chat messages
    - Session messages
    - Direct messages
    - Invites & reminders
    - Organizer notifications
    - Nearby Games
  - `Test Notifications`
  - `Email Alerts` with visible email `nathaziw@gmail.com`
  - similar email categories checked
  - toggles for:
    - Newsletter
    - Tutorials
    - Local News
  - `Group Alerts`
  - one visible group checked: `Wycs Group`
  - `Session Alert Settings`
  - day/time matrix:
    - 11am
    - 11am-4pm
    - 4pm
  - visible checked formats:
    - Round Robin
    - Open Play
    - Members Only
    - Challenge Courts
    - Lessons
    - Doubles
    - Singles
    - Beginner Clinic
    - Drills
    - League Play
    - Kids Clinic
    - Seniors Only
    - Ladder
    - Clinic
    - Men Only
    - Women Only
    - Mixed
  - skill slider from `2.0` to `5.5+`
- Actions visible:
  - toggle notification channels and categories
  - open device permissions
  - test push notifications
  - define when discovery/session alerts should arrive
  - set format and skill preferences for alerts
- Related screens:
  - permissions screen
  - reminder email
- Notes:
  - One of the most detailed settings screens in the set.
  - The app appears to support behavioral filtering of notifications, not just on/off.
- Inferred data needs:
  - category-level preferences
  - day/time scheduling matrix
  - skill and format interest profile

### `account settings -- payment.jpeg`

- Screen name:
  - Payments
- Purpose:
  - Configure payment collection and stored payment preferences
- Main UI:
  - `Back`
  - top selector showing `Payments`
  - Stripe panel: `No account connected`
  - CTA: `Start collecting payments`
  - helper text: `Start collecting payments from Pickleheads users for sessions or group memberships.`
  - `Payment methods`
  - CTA: `Add Credit or Debit Card`
  - `Preferred Currency` dropdown set to `USD`
  - `Payment history`
  - empty state: `No charges found for this month`
  - `View all charges`
  - `Third-party payment info`
  - warning: `Support for third-party payments will be going away soon!`
  - fields:
    - Venmo
    - Cash App
    - Paypal
- Actions visible:
  - connect Stripe
  - add card
  - choose currency
  - view charges
  - store Venmo/Cash App/PayPal info
- Related screens:
  - subscription
  - session creation `Collect payment`
- Notes:
  - The product appears to support both platform-native and off-platform payment methods.
- Inferred data needs:
  - Stripe account linkage
  - card storage/tokenization
  - payment history

### `account settings -- permissions.jpeg`

- Screen name:
  - Permissions
- Purpose:
  - Show device permission states and deep-link to OS settings
- Main UI:
  - `Back`
  - top selector showing `Permissions`
  - explanation text about modifying settings only in device preferences
  - rows with `Open` buttons:
    - Push Notifications `Currently ON`
    - Location Access `Currently ON`
    - Camera Access `Currently ON`
    - Microphone Access `Currently OFF`
    - Photo Library `Currently ON`
    - Link your Contacts `Currently OFF`
- Actions visible:
  - open each OS permission area
- Related screens:
  - notifications
  - profile photo upload
  - group photo upload
  - invite flows
- Notes:
  - This screen clearly links product capabilities to system permissions.
- Inferred data needs:
  - permission-state awareness
  - deep-link support

### `account settings -- reachable via account icon on home.jpeg`

- Screen name:
  - Account Settings Hub
- Purpose:
  - Central hub for profile, plan, and account controls
- Main UI:
  - title `Account Settings`
  - close `X`
  - user summary card:
    - `Na Wycs`
    - `2.0 Self-Reported`
  - upgrade CTA: `Upgrade to Pickleheads PLUS`
  - tiles:
    - Profile
    - Rating
    - Location
    - Contact
    - My Plan
    - Payments
    - Notifications
    - Permissions
  - support CTA: `Have a question? Get help!`
  - footer buttons:
    - Privacy
    - Terms
    - Log out
  - version text: `Version 2.2.5 (Build 652)`
- Actions visible:
  - enter any setting area
  - upgrade plan
  - open help
  - log out
- Related screens:
  - all settings pages
- Notes:
  - This is the clearest top-level settings launcher in the set.

### `account settings -- subscription.jpeg`

- Screen name:
  - Subscriptions / My Plan
- Purpose:
  - Show usage limits and upgrade options
- Main UI:
  - `Back`
  - top selector showing `Subscriptions`
  - `Your usage`
  - reset date: `Resets Jun. 1, 2026`
  - usage bars:
    - `Round Robins (per month)` `0/2`
    - `Guest Adds (per month)` `0/20`
    - `Private Lists` `0/2`
  - state: `NOT SUBSCRIBED`
  - `Choose the right plan for you`
  - plan cards:
    - `PLUS` `$12.00 USD / year` `For diehard pickleball players.`
    - `PRO` `$14.99 USD / month` `For serious pickleball organizers.`
    - `ULTRA` `$74.99 USD / month` `For power-organizers and facilities.`
- Actions visible:
  - compare plans
  - likely tap to upgrade `not explicitly shown but strongly implied`
- Related screens:
  - payments
  - premium-gated creation/discovery features
- Notes:
  - The plan copy distinguishes players from organizers and facilities.
- Inferred data needs:
  - usage counters
  - plan catalog
  - entitlement state

### `easy access links when navigating on account settings.jpeg`

- Screen name:
  - Account Settings section menu overlay
- Purpose:
  - Show category switcher inside the settings area
- Main UI:
  - `Back`
  - dropdown/overlay menu opened from section selector
  - visible items:
    - Profile
    - Rating
    - Location
    - Contact
    - Subscriptions
    - Payments
    - Notifications
    - Permissions
  - partially visible underlying profile form with:
    - last name `Wycs`
    - gender `Female`
    - `Delete My Account`
- Actions visible:
  - jump directly between settings sections
- Related screens:
  - profile settings
  - rating settings
  - all account pages
- Notes:
  - This confirms the settings area uses a dropdown-like section switcher, not only a tile hub.

### `profile settings under account settings.jpeg`

- Screen name:
  - Profile Settings
- Purpose:
  - Edit user identity basics
- Main UI:
  - `Back`
  - top selector showing `Profile`
  - large placeholder avatar
  - upload icon over avatar
  - `First name` = `Na`
  - `Last name` = `Wycs`
  - `Gender` dropdown = `Female`
  - `Delete My Account`
- Actions visible:
  - upload/change avatar
  - edit first and last name
  - choose gender
  - delete account
- Related screens:
  - account hub
  - rating
- Notes:
  - The profile form is intentionally minimal.

### `ratings page where it integrates with universal ratings also has self reporting ratings.jpeg`

- Screen name:
  - Rating Settings
- Purpose:
  - Manage visible skill/rating sources
- Main UI:
  - `Back`
  - top selector showing `Rating`
  - prominent DUPR panel:
    - placeholder rating `0.00`
    - `Connect your DUPR ID`
  - `Self-Reported` = `2.00`
  - fields:
    - `UTR-P`
    - `WPR`
    - `UTPR`
    - `CTPR`
  - `Display this rating on my profile` dropdown set to `Self-Reported`
  - explanatory text:
    - rating is visible in sessions and groups
    - DUPR sessions always use DUPR rating
- Actions visible:
  - connect DUPR
  - enter manual rating values
  - choose displayed profile rating
- Related screens:
  - stats
  - sessions/groups that use rating
- Notes:
  - Rating is clearly user-visible and not just a backend matching field.

## Communications / Alerts

### `an email user gets 4 hours before the play.jpeg`

- Screen name:
  - Reminder email for under-filled session
- Purpose:
  - Warn organizer that a session has fewer than 4 players less than 4 hours before start
- Main UI:
  - email subject area: `Your session has less than 4 players`
  - session card:
    - `Sun, May 24 • 12:00 AM - 2:00 AM`
    - `Wycs Session at The PickleGround PH`
    - address
    - `Add to Calendar`
    - `Directions`
  - email body highlights:
    - fewer than 4 players signed up
    - venue, time, skill level `2.0-3.0`
    - `Are courts reserved? No`
    - direct session URL
    - important note: `This is not a court reservation.`
    - facilities may require membership or charge one-time fees
  - app store badges
  - `Update your Email Alert Preferences`
  - `Unsubscribe`
  - downloadable attachment: `session-event.ics`
- Actions visible:
  - add to calendar
  - get directions
  - open session URL
  - unsubscribe/update email prefs
- Related screens:
  - session details
  - notifications
- Notes:
  - Important product rule exposed in email: session creation is distinct from court reservation.

### `pending invites when notification bell was clicked.jpeg`

- Screen name:
  - Pending Invites empty state
- Purpose:
  - Show current pending invites or, in this image, an empty invite inbox
- Main UI:
  - title `Pending Invites`
  - close `X`
  - empty illustration
  - text `No pending invites.`
  - `Refresh`
  - bottom CTAs:
    - `Create a new session`
    - `View declined sessions`
- Actions visible:
  - refresh invite inbox
  - create session
  - review declined sessions
- Related screens:
  - Games tab
  - session creation
- Notes:
  - Filename references bell notification, but this feels like a dedicated invite inbox screen.

### `this shows when active chat icon was clicked which is beside bell notification.jpeg`

- Screen name:
  - Active Chats
- Purpose:
  - Global chat/thread inbox
- Main UI:
  - top-left avatar
  - title/dropdown `Active Chats`
  - compose icon
  - thread row:
    - `Need help with something?`
    - subtitle `Just ask. I’m here to help!`
    - message icon button
  - thread row:
    - `Wycs Group`
    - snippet beginning `Pickleheads:`
    - timestamp `2 days ago`
- Actions visible:
  - open support conversation
  - open group conversation
  - start new message
  - possibly switch chat filter via dropdown
- Related screens:
  - group chat
  - support thread `not shown`
- Notes:
  - Threads appear to be context-based, not only person-to-person.

## Home

### `homepage.jpeg`

- Screen name:
  - Home dashboard, join-state variant
- Purpose:
  - Signed-in landing page with discovery feed and community promotion
- Main UI:
  - top shortcuts:
    - `Create an account`
    - `Find a court`
    - `Find games`
    - `Take a lesson`
    - `Learn to play`
  - promo card:
    - `Join Pickleheads!`
    - `Become part of the fastest growing pickleball community.`
  - `Find Games`
  - `Customize` plus filter icon
  - date chips:
    - `Next 7 days`
    - `May 29 - Jun 4`
    - next week range partially visible
  - type chips:
    - `All`
    - `Games`
    - `Open Plays`
    - `Round Rob...` partially visible
  - schedule feed:
    - `Today` no games
    - `Tomorrow` session card with lock icon
    - `Sun, May 24` session card with lock icon
    - later days showing no games
  - card details include skill range and player count
- Actions visible:
  - open discovery shortcuts
  - filter feed
  - open session cards
- Related screens:
  - Home filter panel
  - session details
- Notes:
  - The shortcut `Create an account` is unusual on what otherwise looks like a signed-in screen and should be verified later.

### `homepage- when logged in.jpeg`

- Screen name:
  - Home dashboard, logged-in checklist-summary variant
- Purpose:
  - Signed-in home with compact onboarding summary and status cards
- Main UI:
  - top shortcuts:
    - Create a game
    - Find games
    - Take a lesson
    - Learn to play
    - Create a group
  - checklist summary card:
    - `Hi, Na!`
    - `Only 1 easy setup task left!`
    - progress icons
    - expand arrow
  - status cards:
    - `0 invitations`
    - `0 messages`
  - `Find Games`
  - `Customize` plus filter icon
  - date chips and game-type chips
  - `Today` empty-state beginning visible
- Actions visible:
  - expand checklist
  - open invites/messages
  - filter game feed
- Related screens:
  - expanded checklist
  - Home filter panel
  - Active Chats
  - Pending Invites
- Notes:
  - This is likely the same route as `homepage.jpeg` but in a different user state.

### `homepage checklist after registration.jpeg`

- Screen name:
  - Expanded Home onboarding checklist
- Purpose:
  - Walk a newly registered user through final setup steps
- Main UI:
  - same top shortcut row as logged-in home
  - expanded card:
    - `Hi, Na!`
    - `Only 1 easy setup task left!`
    - visual progress dots
  - checklist rows:
    - `Join Pickleheads`
    - `Add your skill level`
    - `Add a profile image`
    - `Follow your first court` with subtext `Chat with other players and get invited to play.`
    - `Enable push notifications`
    - `Hide this checklist`
  - bottom collapse handle
- Actions visible:
  - tap remaining onboarding task
  - hide checklist
  - collapse card
- Related screens:
  - Nearby court detail/follow
  - profile
  - ratings
  - notifications/permissions
- Notes:
  - This clarifies the product’s onboarding priorities.

### `fileters found on homepage.jpeg`

- Screen name:
  - Filter Games panel on Home
- Purpose:
  - Personalize Home’s game discovery feed
- Main UI:
  - title `Filter Games`
  - close `X`
  - `Suggested skill level` slider
  - label `Your level 2.0`
  - day chips: `M T W T F S S`
  - `Time of day`:
    - Morning
    - Afternoon
    - Evening
  - `What locations?`
    - `Nearby courts`
    - `Courts I follow`
  - `Show games within`
    - minus button
    - `20 miles`
    - plus button
  - location card `General Trias, Calabarzon, PH`
  - pencil icon
  - `Vacation Mode`
  - footer actions:
    - `Clear`
    - `Apply`
- Actions visible:
  - change skill, day, time, location scope, radius
  - edit location
  - enable vacation mode
  - clear/apply
- Related screens:
  - home dashboard
  - location settings

## Games / Sessions

### `games -- a private session where other player set it.jpeg`

- Screen name:
  - Session detail, private session owned by another player
- Purpose:
  - Let a non-owner inspect the session and request access
- Main UI:
  - `Back`
  - tabs:
    - Details active
    - Players disabled-looking
    - Chat disabled-looking
  - title `CenLabSmashers`
  - date/time `Fri, May. 29 | 1:00 PM - 4:00 PM`
  - count `1/13`
  - skill `2.0-3.0`
  - location `Tiendesitas`
  - `Format` = `Popcorn`
  - `Player limit` = `13`
  - venue card with:
    - Perm. Lines
    - Fee
    - Portable Nets
  - utility buttons:
    - Get Directions
    - Copy Address
  - weather card `32°` `Patchy rain nearby` `9 mph`
  - pink notice: `Session is private. Request to join!`
  - CTA `Request to Join`
- Actions visible:
  - request access
  - get directions
  - copy address
- Related screens:
  - other session detail variants
- Notes:
  - This is the clearest view of a gated participation state.

### `games -- create session.jpeg`

- Screen name:
  - Games landing, Upcoming tab
- Purpose:
  - Main schedule/index view for games
- Main UI:
  - top actions and logo
  - tabs:
    - Invites
    - Upcoming active
    - Completed
  - `Upcoming Games`
  - filter icon
  - date chips:
    - `Next 7 days`
    - `May 29 - Jun 4`
    - next range partially visible
  - role/state chips:
    - `All Games`
    - `Organizing`
    - `Playing`
  - empty state: `No games scheduled from May 22 - May 28.`
  - CTA `Create a new session`
- Actions visible:
  - switch tab/date view
  - filter
  - create a session
- Related screens:
  - pending invites
  - mode selector
  - session details
- Notes:
  - Filename suggests session creation, but this is actually the main Games index screen.

### `games -- options after create session .jpeg`

- Screen name:
  - Play Pickleball mode selector
- Purpose:
  - Choose what kind of play/session to create
- Main UI:
  - `Back`
  - title `Play Pickleball`
  - stacked option cards:
    - `Quick Game` `Set up a game with your friends and see who’s in.`
    - `Weekly Game PRO` `Set up a weekly game with automatic invites.`
    - `Round Robin` `Generate matchups, add scores and see who wins!`
    - `Mini Tournament` `Invite nearby players at your level to join a game.`
  - bottom actions:
    - `New group`
    - `New list`
- Actions visible:
  - choose creation mode
  - jump to group/list creation
- Related screens:
  - quick game form
  - group creation wizard
- Notes:
  - `Weekly Game` is explicitly premium-gated.

### `games -- session details.jpeg`

- Screen name:
  - Session detail, organizer/member-in-session variant
- Purpose:
  - View and manage a joined or owned session
- Main UI:
  - `Back`
  - top-right label `Invite` with icon
  - tabs:
    - Details active
    - Players
    - Chat
  - action bar:
    - crown badge
    - Invite
    - Edit
    - Cancel
    - copy/duplicate-like icon
  - title `Wycs Session`
  - date/time `Sun, May. 24 | 12:00 AM - 2:00 AM`
  - small calendar icon button
  - count `1/3`
  - skill `2.0-3.0`
  - location `The PickleGround PH`
  - `Player limit 3`
  - organizer card `Na Wycs`
  - venue card with:
    - Perm. Lines
    - Fee
    - Perm. Nets
  - `Get Directions`
  - `Copy Address`
  - weather card `29°` `Clear` `3 mph`
  - green status strip `You’re in this session!`
  - buttons:
    - `Add a guest`
    - `Leave`
- Actions visible:
  - invite, edit, cancel, maybe duplicate
  - add guest
  - leave session
  - open players/chat tabs
- Related screens:
  - invite menu
  - session-created confirmation
- Notes:
  - Combines organizer actions and participant state in one screen.

### `games -- when a session clicked invite players now.jpeg`

- Screen name:
  - Add players to your game
- Purpose:
  - Choose invite method after or during session management
- Main UI:
  - `Back`
  - title `Add players to your game`
  - large action rows:
    - `Text an invite link`
    - `Scan a QR code`
    - `Invite players`
    - `Invite groups`
    - `Invite lists`
    - `Add confirmed players`
  - bottom link `Maybe later`
- Actions visible:
  - choose invite strategy
  - postpone
- Related screens:
  - group/list selectors `not shown`
  - confirmation screen

### `games -- when a session successfully created.jpeg`

- Screen name:
  - Session created modal / invite prompt
- Purpose:
  - Celebrate session creation and push organizer into inviting
- Main UI:
  - dark overlay over underlying invite screen
  - close `X`
  - celebratory icon
  - heading `Your session is ready to go!`
  - session summary card:
    - `SUN 5/24`
    - `12:00am - 2:00am`
    - `Wycs Session at The PickleGround PH`
    - `Private`
    - `2.0-3.0`
  - CTA `Invite Players Now`
  - underlying `Maybe later` visible beneath modal
- Actions visible:
  - invite now
  - close / maybe defer
- Related screens:
  - invite menu
  - session details

### `games -- when quick game is clicked.jpeg`

- Screen name:
  - Quick Game creation form
- Purpose:
  - Define the session before creating it
- Main UI:
  - `Back`
  - title `Create a quick game`
  - `Session details`
  - field `Name your session`
  - field `Location`
  - player count stepper with `No limit` hint
  - date field
  - start time and end time selectors
  - `Plus-power this session` toggle
  - helper text: `Including unlimited round robins and leagues.`
  - `Who can join?`
    - `Public` selected
    - `Private`
  - expandable/settings rows with edit icons:
    - Repeats weekly -> `Does not repeat`
    - Description & Images
    - Add a round robin -> `Doubles`
    - Skill level -> `Level 2.0-3.0` and `DUPR not required`
    - Add a co-host -> `No co-hosts set`
    - Collect payment
    - Advanced settings -> list:
      - Anyone can join
      - Players can bring a guest
      - Players can invite others
      - Players can see my contact info
  - disabled-looking CTA `Create Session`
- Actions visible:
  - configure session fields
  - open sub-settings
  - change join visibility
- Related screens:
  - mode selector
  - created confirmation
- Notes:
  - Very strong organizer-oriented form.

## Groups

### `groups -- Adding player to a group --kinda like invite a player.jpeg`

- Screen name:
  - Add players to your group
- Purpose:
  - Choose how to invite people into a group
- Main UI:
  - `Back`
  - title `Add players to your group`
  - action rows:
    - `Text an invite link to your friends`
    - `Scan a QR code`
    - `Invite players` with subtext `Invite individual players to your group`
- Actions visible:
  - share invite link
  - scan QR code
  - open player picker
- Related screens:
  - group creation confirmation
  - My Groups
- Notes:
  - This is now clearly confirmed, not just inferred.
  - Unlike the session invite flow, this one does not show groups/lists/confirmed-player options.

### `groups -- create group confirmation.jpeg`

- Screen name:
  - Group creation confirmation
- Purpose:
  - Confirm the new group is created and encourage invitations
- Main UI:
  - heading `CREATE A GROUP`
  - title `Confirmation`
  - close `X`
  - centered group card:
    - `Eunika`
    - `Private`
    - `2.0-5.5`
  - text `Your group has been created!`
  - helper text `Invite some friends, or skip for now.`
  - bottom actions:
    - `Invite Players`
    - `Skip`
- Actions visible:
  - invite players immediately
  - skip and continue
- Related screens:
  - group invite screen
  - My Groups

### `groups -- create group step 1.jpeg`

- Screen name:
  - Create Group step 1: Basic Information
- Purpose:
  - Collect the group’s name and description
- Main UI:
  - heading `CREATE A GROUP`
  - title `Basic Information`
  - close `X`
  - `Group Name` field
  - `Group Description` textarea
  - example text:
    - `Join us for weekly open play and challenge court sessions at local Atlanta courts.`
  - step dots
  - `Prev`
  - `Next`
- Actions visible:
  - enter group basics
  - continue wizard

### `groups -- create group step 2.jpeg`

- Screen name:
  - Create Group step 2: Choose Your Courts
- Purpose:
  - Link the group to one or more courts
- Main UI:
  - heading `CREATE A GROUP`
  - title `Choose Your Courts`
  - close `X`
  - helper text `Where does your group play? Add one or more courts.`
  - large search field `Search for courts`
  - search icon
  - step dots
  - `Prev`
  - `Next`
- Actions visible:
  - search and add courts
  - continue wizard

### `groups -- create group step 3.jpeg`

- Screen name:
  - Create Group step 3: Group Access
- Purpose:
  - Define visibility and membership rules
- Main UI:
  - heading `CREATE A GROUP`
  - title `Group Access`
  - close `X`
  - `Visibility`
    - `Private`
    - `Public` selected
  - helper text `All players may join.`
  - `Skill Level`
    - All
    - Beginner
    - Intermediate
    - Advanced
  - `Require Pickleheads Plus` toggle off
  - `Allow players to: Invite others` toggle on
  - step dots
  - `Prev`
  - `Next`
- Actions visible:
  - set public/private state
  - choose skill targeting
  - require paid membership
  - let members invite others

### `groups -- create group step 4.jpeg`

- Screen name:
  - Create Group step 4: Group Photo
- Purpose:
  - Add optional visual identity to the group
- Main UI:
  - heading `CREATE A GROUP`
  - title `Group Photo`
  - close `X`
  - upload guidance:
    - `Please upload a group photo.`
    - `We suggest a JPEG or PNG at least 800px by 600px (3:2 ratio).`
  - large placeholder box with camera icon
  - CTA `Select a photo`
  - note `You can skip this for now`
  - step dots
  - `Prev`
  - `Finish`
- Actions visible:
  - upload image
  - skip image
  - finish group creation

### `groups -- group chat.jpeg`

- Screen name:
  - Group chat
- Purpose:
  - Messaging area inside a specific group
- Main UI:
  - `Back`
  - top-right `Invite`
  - tabs:
    - Details
    - Sessions
    - Chat active
  - header:
    - `Wycs Group`
    - `1 member, 1 online`
    - `View Details`
    - group avatar
  - chat timeline markers `Today`
  - system/help-like starter bubble `Send a message to the group`
  - timestamp `5:44 PM`
  - message input `Send a message`
  - plus icon left of composer
  - send arrow button right of composer
- Actions visible:
  - send group message
  - invite others
  - switch to Details or Sessions
  - open group details

### `groups -- my groups.jpeg`

- Screen name:
  - My Groups hub
- Purpose:
  - Manage current groups and create new ones
- Main UI:
  - top icons and logo
  - tabs:
    - `My Groups (1)` active
    - `My Lists (0)`
    - `Nearby (0)`
  - search field `Find a Group`
  - group card:
    - `Wycs Group`
    - `Private`
    - `2.0-5.5`
    - member count `1`
    - actions:
      - `Details`
      - `Chat`
      - `Mute`
  - lower CTA zone:
    - `Manage another group? Create it now!`
    - `Create Group`
- Actions visible:
  - search groups
  - open details/chat
  - mute group
  - create another group

## Nearby / Courts

### `nearby -- court-details.jpeg`

- Screen name:
  - Court Details
- Purpose:
  - Full venue profile
- Main UI:
  - `Back`
  - share icon
  - tabs:
    - Details active
    - Schedule
    - Groups
    - Chat
  - `Follow this court`
  - title `The PickleGround PH`
  - hero image
  - badge `One-Time Fee Required`
  - address:
    - `EPZA Diversion Road, Kawit, Cavite, Philippines`
  - external link `facebook.com`
  - map block
  - `Get Directions`
  - `Copy Address`
  - `6 Dedicated Courts`
  - `Surface & Features`
    - Concrete Surface
    - 6 Indoor Courts
  - `Nets & Lines`
    - Permanent Lines
    - Permanent Nets
  - `Amenities`
    - Food and Drinks
    - Restrooms
    - Water
    - Lighted Courts
    - Trainers & Lessons
  - weather strip:
    - `34° / 28°`
    - `Patchy rain nearby`
    - `10%`
    - `12 mph`
  - `Suggest Edits to this Court`
  - bottom promo:
    - `Connect with 10 players at this location`
    - `Follow now`
- Actions visible:
  - follow court
  - get directions
  - copy address
  - suggest edits
  - navigate to schedule/groups/chat tabs

### `nearby -- courts -- filter options.jpeg`

- Screen name:
  - Filter Courts panel part 1
- Purpose:
  - Narrow court results
- Main UI:
  - title `FILTER COURTS`
  - close `X`
  - `Show only courts I’m following` toggle off
  - `Number`:
    - 2+
    - 4+
    - 6+
    - 8+
    - 10+
  - `Type`:
    - Dedicated `PLUS`
    - Reservable `PLUS`
    - Lighted
    - Indoor
    - Outdoor
  - `Access` section starts at bottom
  - footer:
    - `Clear`
    - `View 2 Courts`
- Actions visible:
  - filter by followed courts, court count, type

### `nearby -- courts -- filter options part 2.jpeg`

- Screen name:
  - Filter Courts panel part 2
- Purpose:
  - Continue access and amenities filtering
- Main UI:
  - `Access`
    - Public
    - Membership Required
    - One-Time Fee
  - `Amenities`
    - Food and Drink
    - Locker Rooms
    - Pro Shop / Equipment Store
    - Restrooms
    - Trainers & Lessons
    - Water
    - Wheelchair Accessibility
    - Youth Programming
    - Adaptive Programming
  - footer:
    - `Clear`
    - `View 2 Courts`
- Actions visible:
  - refine by access and amenities

### `nearby -- courts -- filter options part 3.jpeg`

- Screen name:
  - Filter Courts panel part 3
- Purpose:
  - Continue amenities and surface filtering
- Main UI:
  - remaining amenities visible again:
    - Trainers & Lessons
    - Water
    - Wheelchair Accessibility
    - Youth Programming
    - Adaptive Programming
  - `Surface`
    - Wood
    - Asphalt
    - Hard
    - Acrylic
    - Concrete
    - Carpet
    - Clay
    - Grass
  - footer:
    - `Clear`
    - `View 2 Courts`
- Actions visible:
  - refine by surface

### `nearby -- find courts.jpeg`

- Screen name:
  - Nearby discovery, map mode
- Purpose:
  - Search and browse nearby courts geographically
- Main UI:
  - search field `Find a Court`
  - filter/settings icon inside field
  - map/list toggle icon with list selected-looking
  - segmented toggle:
    - Courts selected
    - Games
  - map with pins around General Trias / Noveleta / Kawit
  - target/location button on map
  - bottom venue card:
    - `The PickleGround PH`
    - `6 Courts`
    - `Perm. Lines`
    - `Fee`
    - `Perm. Nets`
- Actions visible:
  - search
  - open filters
  - toggle between Courts and Games
  - inspect map pins
  - open selected venue card
- Notes:
  - The rightmost icon may toggle list view.

### `nearby -- games -- filter icon when clicked.jpeg`

- Screen name:
  - Filter Games panel part 1 in Nearby
- Purpose:
  - Narrow nearby game discovery
- Main UI:
  - title `FILTER GAMES`
  - close `X`
  - toggles:
    - `Include courts with no games`
    - `Include games that aren’t on Pickleheads`
  - `Skill Level PLUS` slider from `2.0` to `5.5+`
  - `Time of Day PLUS`
    - Morning (Before 11:00am)
    - Afternoon (11:00am - 4:00pm)
    - Evening (After 4:00pm)
  - `Access`
    - Public Court
  - footer:
    - `Clear`
    - `View 2 Courts`
- Actions visible:
  - include broader/non-listed results
  - filter by skill and time of day
- Notes:
  - CTA still says `View 2 Courts`, even though this is clearly a game filter screen.

### `nearby -- games -- filter icon when clicked part 2.jpeg`

- Screen name:
  - Filter Games panel part 2 in Nearby
- Purpose:
  - Filter by access restrictions and game formats
- Main UI:
  - access:
    - Membership Required
    - One-Time Fee Required
    - Membership Might Be Required
  - `Game Format`
    - Round Robin
    - Open Play
    - Members Only
    - Challenge Courts
    - Lessons
    - Doubles
    - Singles
    - Beginner Clinic
    - Drills
    - League Play
  - footer:
    - `Clear`
    - `View 2 Courts`
- Actions visible:
  - narrow by format and access rules

### `nearby -- games -- filter icon when clicked part 3.jpeg`

- Screen name:
  - Filter Games panel part 3 in Nearby
- Purpose:
  - Continue long list of game-format filters
- Main UI:
  - format options continuing:
    - Members Only
    - Challenge Courts
    - Lessons
    - Doubles
    - Singles
    - Beginner Clinic
    - Drills
    - League Play
    - Kids Clinic
    - Seniors Only
    - Ladder
    - Clinic
    - Men Only
    - Women Only
    - Mixed
  - footer:
    - `Clear`
    - `View 2 Courts`
- Actions visible:
  - filter by more specialized play formats

### `nearby -- when map is toggled --ether a map or a list.jpeg`

- Screen name:
  - Nearby discovery, list mode
- Purpose:
  - Browse court results in list form
- Main UI:
  - search field `Find a Court`
  - filter icon in field
  - map/list toggle icon with map selected-looking
  - segmented toggle:
    - Courts selected
    - Games
  - count `2 COURTS`
  - result card 1:
    - `The PickleGround PH`
    - `6 Courts`
    - `Perm. Lines`
    - `Fee`
    - `Perm. Nets`
  - result card 2:
    - `One Cavite Pickleball Club`
    - `2 Courts`
    - `Perm. Lines`
    - `Fee`
    - `Portable Nets`
  - missing-court CTA area:
    - `Are we missing a court? Add it now!`
    - `Create Court`
- Actions visible:
  - inspect result cards
  - create or suggest missing court

### `Round robin - rotate format.jpeg`

- Screen name:
  - Round Robin format chooser, rotating-partner mode
- Purpose:
  - Help the organizer choose a competitive format when partners rotate between rounds
- Main UI:
  - `Back`
  - title `Select a format`
  - question `Rotating or fixed partners?`
  - toggle:
    - `Rotate` selected
    - `Fixed`
  - `Help me choose`
  - visible format cards:
    - `Popcorn`
      - `Random Matchups`
      - `1 Game per round`
    - `Gauntlet`
      - `Seeded Matchups`
      - `1 Game per round`
    - `Up & Down the River`
      - `Seeded Matchups`
      - `3-5 Games per round`
    - `Claim the Throne`
      - `Seeded Matchups`
      - `1 Game per round`
    - `Cream of the Crop`
      - `Seeded Matchups`
      - `3-5 Games per round`
    - `Double Header`
      - `Seeded Matchups`
      - `6-9 Games per round`
    - `Mixed Madness`
      - `Random Matchups`
      - `1 Game per round`
    - `Scramble`
      - `Random Matchups`
      - `3-5 Games per round`
- Actions visible:
  - switch between rotating and fixed partner modes
  - select a round-robin structure
- Related screens:
  - `Round robin - Fixed Format.jpeg`
  - `mini-tournament.jpeg`
- Notes:
  - This confirms round robin is a deep feature with multiple subformats, not a single checkbox.

### `Round robin - Fixed Format.jpeg`

- Screen name:
  - Round Robin format chooser, fixed-partner mode
- Purpose:
  - Help the organizer choose a competitive format when players must sign up with a partner
- Main UI:
  - `Back`
  - title `Select a format`
  - question `Rotating or fixed partners?`
  - toggle:
    - `Rotate`
    - `Fixed` selected
  - helper text `Players must sign up with a partner.`
  - `Help me choose`
  - yellow banner: `You can add a championship bracket to any format!`
  - visible format cards:
    - `Pool Play`
      - `Court Optimizer`
      - `Classic pool play`
    - `Shuffle`
      - `Fixed Partners`
      - `1 Game per round`
    - `Bracket`
      - `Up to 32 teams`
      - `Two formats`
- Actions visible:
  - switch to fixed-partner competitive formats
  - choose between pool play, shuffle, and bracket
- Related screens:
  - `Round robin - rotate format.jpeg`
  - `mini-tournament.jpeg`
- Notes:
  - This introduces a more tournament-like branch of the organizer flow.

### `mini-tournament.jpeg`

- Screen name:
  - Create a round robin / advanced competitive session
- Purpose:
  - Create a structured team-based competitive session
- Main UI:
  - `Back`
  - title `Create a round robin`
  - `Session details`
  - fields:
    - `Name your session`
    - `Location` = `The PickleGround PH`
    - `Max number of teams` = `8`
    - date
    - start time
    - end time
  - `Plus-power this session`
  - `Who can join?`
    - `Public`
    - `Private` selected
  - helper text: `Only players you invite can see the details and sign up. Others may request to join.`
  - reservation question:
    - `Are these courts reserved already?`
    - `Yes`
    - `No` selected
  - field `Which courts are reserved?` marked `Optional`
  - warning: `Important: Creating a session with Pickleheads will not reserve courts`
  - editable settings rows:
    - `Repeats weekly`
    - `Description & Images`
    - `Add a round robin`
      - `Set Partners`
      - `Pool Play`
      - `Timed Rounds? No`
      - `1 Pool`
      - `Championship bracket (All teams)`
      - `Single Elim with Consolation`
      - `2 Courts`
    - `Skill level`
    - `Add a co-host`
    - `Collect payment`
    - `Advanced settings`
      - `Private session`
      - `Players can invite others`
      - `Players can see my contact info`
  - CTA `Create Session`
- Actions visible:
  - build a more competitive session with team count, format, and bracket options
  - define whether courts are already reserved
- Related screens:
  - round robin format choosers
  - standard quick game creation
- Notes:
  - The filename says `mini-tournament`, but the visible title says `Create a round robin`.
  - This likely represents the advanced structured-play flow.

### `sample group list.jpeg`

- Screen name:
  - My Lists tab
- Purpose:
  - Show reusable saved player lists
- Main UI:
  - top icons and logo
  - tabs:
    - `My Groups (1)`
    - `My Lists (1)` active
    - `Nearby (0)`
  - search field `Search lists by name`
  - plus button for creation
  - one visible list card:
    - `Wycs Lists`
    - `0 players`
- Actions visible:
  - search lists
  - create a list
  - likely open list details
- Related screens:
  - `group -- create list.jpeg`
  - `group list add player option.jpeg`
- Notes:
  - This confirms `My Lists` is a real feature and not just an empty placeholder tab.

### `group -- create list.jpeg`

- Screen name:
  - Create a List modal
- Purpose:
  - Let the user create a reusable private player list
- Main UI:
  - modal overlay over `My Lists`
  - title `Create a List`
  - close `X`
  - `List name` field
  - helper text `Players will not see your list name unless shared.`
  - CTA `Create List`
  - secondary action `Cancel`
- Actions visible:
  - name a list
  - create list
  - cancel
- Related screens:
  - `sample group list.jpeg`
  - `group list add player option.jpeg`
- Notes:
  - The helper text suggests lists are organizer-side tools rather than user-visible communities.

### `group list add player option.jpeg`

- Screen name:
  - List created / add players prompt
- Purpose:
  - Prompt the user to populate a newly created list
- Main UI:
  - celebratory modal overlay
  - title `Your list is ready!`
  - prompt `Add Players now:`
  - options:
    - `Search Pickleheads`
    - `From my contacts`
    - `By email or phone`
  - secondary CTA `Add players later`
  - close `X`
- Actions visible:
  - add players from in-app user search
  - add from contacts
  - add by direct email or phone
  - defer
- Related screens:
  - `group -- create list.jpeg`
  - `sample group list.jpeg`
- Notes:
  - This makes the purpose of lists much clearer: they are reusable player rosters.

## Stats

### `stats.jpeg`

- Screen name:
  - My Stats
- Purpose:
  - Show personal activity summary and simple performance record
- Main UI:
  - top tabs:
    - `My Stats` active
    - `My Matches`
  - user summary:
    - `Na Wycs`
    - `2.0 Self-Reported`
  - range chips:
    - `30 days` selected
    - `60 days`
    - `All Time`
  - `Activity`
    - `Last Played` = `N/A`
    - `Played` = `0 sessions`
    - `Frequency` = `0 per week`
    - `Best week` = `0 sessions`
  - upsell card:
    - `Unlock full access to stats, match history, and leaderboards.`
    - `PLUS`
  - `Record`
    - `W`
    - `L`
    - `T`
    - medal-like first/second/third counters
- Actions visible:
  - switch between stats and matches
  - change time range
  - likely upgrade plan
- Related screens:
  - rating settings

## Cross-Feature Notes

- The screenshot set is heavily weighted toward signed-in mobile experiences.
- No login, registration, password reset, or web/desktop layouts are shown.
- Several tab targets are implied but not captured:
- Several tab targets are implied but not captured:
  - session `Players`
  - session `Chat`
  - court `Schedule`
  - court `Groups`
  - court `Chat`
  - `Nearby` groups
  - `My Matches`
- Some filenames are misleading:
  - `games -- create session.jpeg` is a Games index page, not the form
  - `mini-tournament.jpeg` shows a screen titled `Create a round robin`
  - `pending invites when notification bell was clicked.jpeg` may be an invite inbox regardless of entry point
- Nearby game filter panels use a footer CTA that still says `View 2 Courts`, which should be treated as a UI inconsistency until verified.
- The newly added screenshots confirm two previously under-documented feature areas:
  - reusable player lists
  - advanced round robin / bracket selection

## Best Next Use

- Use this file when someone needs an exact reference for a screenshot filename.
- Use [APP-FLOWS.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/APP-FLOWS.md) when someone needs a higher-level view of how these screens likely connect.
- Use [USER-ORIENTED-GUIDE.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/USER-ORIENTED-GUIDE.md) when someone needs the product story from the player/organizer perspective.
- Use [screenshot-gallery.html](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/screenshot-gallery.html) to visually browse the image set.
