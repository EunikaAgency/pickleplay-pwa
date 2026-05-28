# Playbypoint Existing Pages Map

Source screenshots: 58 Android mobile screenshots in `playbypoint/`, all `1080x2400`.

This document maps the current app/website surface from screenshots only. It does not rely on implementation code, so any route names, data models, and behavior below are inferred from visible UI and marked where verification is needed.

## Global Observations

- The captured product is primarily a mobile app experience with Android system/navigation bars visible.
- Most authenticated screens are for user `EA Michael Robert Dellosa` / `ea.michaelrobertdellosa@gmail.com`.
- Primary bottom navigation has four tabs: `Clubs`, `Bookings`, `Discover`, `Profile`.
- Core product areas visible: onboarding, authentication, club discovery, club detail, booking calendar, booking history, chat/support, profile, settings, payments, memberships, waivers, family, friends, game matches, notifications.
- Owner/admin pages are not visible in this screenshot set.
- No complete checkout/payment confirmation screen is visible. Booking selection reaches calendar and reservation detail states, but not a final paid booking flow.
- All screenshots are mobile portrait. No tablet, desktop, or responsive web breakpoints are represented.

## High-Level Site/App Map

### Public / Unauthenticated

- Welcome greeting
- Goal/onboarding selection
- Sign in
- Sign in with magic link modal
- Sign up
- Terms of Service and Privacy Policy links are visible but target pages are not captured

### Core Authenticated Tabs

- `Clubs`
  - Find a club
  - Favorite clubs empty state
  - GPS disabled dialog
  - Club detail
  - Club chat entry
- `Bookings`
  - My bookings: Scheduled
  - My bookings: Unscheduled
  - Booking filters: date, payment status, categories
- `Discover`
  - Discover home
  - Discover filters
  - Discover map
  - Club and bookable court suggestions
- `Profile`
  - Profile overview
  - Profile update/edit
  - Settings directory

### Booking / Payment Related

- Club detail `Book` tab
- Book now bottom sheet
- Calendar/schedule view
- Reservation detail modal
- Member-only booking gate
- Payment settings
- Cards list and add-card form
- Billing address list and add-address form
- Payment history
- Club credits
- Club account
- Booking passes

### Account / Settings

- Settings index
- General settings
- Language selector
- Statistics
- Change password
- Notifications
- Memberships
- Proof of residency
- Family
- Waivers
- Friends/followers/following
- My recordings
- Leaderboard
- My orders
- Help center
- App feedback/support widget
- Sign out and delete account actions

### Not Discovered In Screenshots

- Owner/facility admin dashboard
- Court/facility management screens
- Event/program/class detail pages beyond references in copy
- Coach/pro listings
- Checkout/payment confirmation
- Booking cancellation confirmation
- Password reset flow after tapping `Forgot your password?`
- Terms/Privacy pages
- Desktop or web-specific layout

## Detailed Screen Catalog

### 1. Welcome Greeting

- Screenshots: `playbypoint/welcome.jpg`
- Purpose: Entry/welcome screen after authentication or first launch, greeting the logged-in user.
- Main UI sections/components: Full-screen background image, centered welcome headline, product summary copy, bottom CTA.
- Visible buttons, tabs, filters, menus, CTAs: `Let's go!`
- User actions: Continue into onboarding or main app.
- Related pages / next screens: Onboarding goal selection (`Welcome first step.jpg`) or main app tabs.
- Backend/data requirements inferred: Authenticated user first/name display; app assets/background image.
- Notes: Text says users can find clubs, classes and pros for padel, tennis and pickleball, but class/pro pages are not present in the screenshot set.

### 2. Onboarding Goal Selection

- Screenshots: `playbypoint/Welcome first step.jpg`
- Purpose: Collect the user's initial intent.
- Main UI sections/components: Playbypoint logo, title `What brings you to Playbypoint?`, selectable goal options, disabled bottom `Next`.
- Visible controls: `Join a specific club or facility`, `Discover a club near me`, `Find matches and play with others`, `Something else`, `Next`.
- User actions: Select one goal, proceed with `Next`.
- Related pages / next screens: Likely routes to Find a club, Discover, or Game Matches depending on selection.
- Backend/data requirements inferred: User onboarding preference/goal persistence.
- Notes: The screenshot shows no selected option, so `Next` is disabled.

### 3. Sign In

- Screenshots: `playbypoint/Signin.jpg`, `playbypoint/Sign In Magic Link.jpg`
- Purpose: Email/password authentication and alternate magic-link authentication.
- Main UI sections/components: Back button, logo, `SIGN IN` heading, email field, password field with visibility toggle, forgot password link, sign-in CTA, magic-link link, sign-up link, legal links.
- Visible controls: `Back`, email input, password input, eye icon, `Forgot your password?`, disabled `Sign In`, `Sign in with magic link`, `Sign Up`, `Terms of Service`, `Privacy Policy`.
- Magic-link modal controls: Close `X`, email input with clear button, `Send Magic Link`.
- User actions: Enter credentials, submit sign-in, open magic-link modal, send magic link, navigate to sign-up, navigate back, open legal links.
- Related pages / next screens: Sign up, password reset, welcome/main app after successful auth.
- Backend/data requirements inferred: User auth API, password auth, magic-link email delivery, session creation, validation/error states, legal URL config.
- Notes: Password reset target is visible as a link but no reset screen is captured.

### 4. Sign Up

- Screenshots: `playbypoint/Signup.jpg`
- Purpose: New account registration.
- Main UI sections/components: Back button, logo, `SIGN UP` heading, first name, last name, email, phone number with country selector, password field, sign-up CTA, sign-in link, legal links.
- Visible controls: First name, last name, email, phone number (`+1`), password, password visibility toggle, disabled `Sign Up`, `Sign In`, `Terms of Service`, `Privacy Policy`.
- User actions: Enter registration details, submit, navigate to sign-in, go back, open legal links.
- Related pages / next screens: Welcome/onboarding after registration; sign-in for existing users.
- Backend/data requirements inferred: User creation, email uniqueness, phone/country code parsing, password validation, legal acceptance.
- Notes: The displayed default country flag/code is US while most club data appears to be Philippines-based; verify phone-region defaults.

### 5. Find A Club / Club Search

- Screenshots: `playbypoint/Find a club.jpg`, `playbypoint/Enable Location.jpg`, `playbypoint/Favorite Club.jpg`
- Purpose: Discover and add clubs from the `Clubs` tab.
- Main UI sections/components: Logo/title panel, search field, suggested clubs list, location-based exploration row, bottom navigation.
- Visible controls: Search field, `Explore clubs near you`, individual club rows, bottom nav `Clubs`, `Bookings`, `Discover`, `Profile`.
- Favorite clubs empty state controls: Back, close `X`, `Discover more Clubs`.
- GPS disabled dialog controls: `OK`.
- User actions: Search clubs, open a club row, request nearby clubs, handle GPS disabled prompt, discover more clubs from favorites empty state.
- Related pages / next screens: Discover map, selected club detail, favorite clubs.
- Backend/data requirements inferred: Club search endpoint, suggested clubs endpoint, club logos, addresses, distance calculations, geolocation permission/status, favorites data.
- Notes: GPS disabled prompt appears over Find a club. Favorite Clubs state says tap heart on clubs to populate.

### 6. Discover Home

- Screenshots: `playbypoint/Discover Page.jpg`
- Purpose: Main discovery dashboard for nearby clubs and bookable courts.
- Main UI sections/components: Current location header, filter icon, large `DISCOVER` heading, club search field, map button, `Your Clubs`, `Clubs for You`, `Book a Court`, bottom nav.
- Visible controls: Current location, filter icon, search field `Find a club`, map icon, `Add Club`, `View all` for clubs, `View all` for courts, bottom nav.
- User actions: Open filters, search for club, open map, add club, view all clubs, select club, select bookable court card, switch bottom tabs.
- Related pages / next screens: Discover filters, Discover map, Find a club, Selected club, calendar/booking.
- Backend/data requirements inferred: User location, user clubs, recommendations, club list, bookable court availability, sports/categories, date/time slots, club logos and addresses.
- Notes: `Your Clubs` appears empty except for `Add Club`.

### 7. Discover Filters

- Screenshots: `playbypoint/Discover Filter.jpg`, `playbypoint/Settings Discover Filter.jpg`
- Purpose: Bottom sheet for filtering availability discovery.
- Main UI sections/components: Dimmed Discover page, bottom sheet, date selector, time selector, availability window copy, sport checklist, apply action.
- Visible controls: Close `X`, horizontal date picker, time picker/slider state (`2:30 PM`, selected `3:00 PM`, `3:30 PM`), sport checkboxes, `Apply`.
- Sports visible: Tennis, Pickleball, Padel, Squash, Golf, Badminton, Swimming, Fitness.
- User actions: Select date, select time, toggle sports, apply filters, close sheet.
- Related pages / next screens: Discover home filtered results, Book a Court cards.
- Backend/data requirements inferred: Availability search by date/time, sport taxonomy, club/court sport mapping, timezone-aware availability windows.
- Notes: `Discover Filter.jpg` appears scrolled lower with sport list; `Settings Discover Filter.jpg` shows the top date/time area. The filename prefix `Settings` is likely inaccurate.

### 8. Discover Map

- Screenshots: `playbypoint/Discover Map.jpg`
- Purpose: Map-based club discovery.
- Main UI sections/components: Google map, back button, search field, club markers with logos, user location dot, selected club bottom card.
- Visible controls: `Back`, search field, map markers, `Search here`, location/arrow button, selected club card.
- User actions: Search a map area, recenter/location, tap markers, open selected club, go back.
- Related pages / next screens: Find a club, Selected club detail, Discover home.
- Backend/data requirements inferred: Google Maps integration, geocoded club locations, user location, spatial search by bounds, club preview card data.
- Notes: Map shows Manila/Quezon City/Makati area and club distances/addresses in miles.

### 9. Selected Club Detail

- Screenshots: `playbypoint/Selected Club About.jpg`, `playbypoint/Selected Club Book.jpg`, `playbypoint/Book Now Button.jpg`
- Purpose: Facility detail page for `ACCI RACKET SPORTS`.
- Main UI sections/components: Club hero image, save/favorite button, facility selector/header, `About` and `Book` tabs, chat button, club overview, address/phone/map, court playable status, calendar shortcut, camera/icon button, sticky `Book now` CTA, bottom nav.
- Visible controls: `Save`, facility dropdown/chevrons, `About`, `Book`, `Chat`, `Read More`, address link, phone link, `All Courts Playable`, `View Calendar`, camera icon, `Book now`.
- Book-now modal controls: Close `X`, radio option `Book Now - Book a court now`, disabled `Next`.
- User actions: Save/favorite club, switch About/Book tabs, chat with club, read more, open address/map, call phone, view calendar, open booking type modal, choose booking type, continue.
- Related pages / next screens: Chat screens, View Calendar, membership gate, Discover/Find club.
- Backend/data requirements inferred: Facility profile, hero media, logo, overview text, contact info, map coordinates, club membership policy, favorite status, court playability status, availability calendar.
- Notes: The club overview says booking is strictly for Alabang Country Club members only. This likely explains the member-only gate.

### 10. Booking Calendar / Schedule

- Screenshots: `playbypoint/View Calendar.jpg`, `playbypoint/View Calendar Schedule.jpg`
- Purpose: Court schedule grid for a selected club/date.
- Main UI sections/components: Back button, selected date title, horizontal day selector, court rows, time columns, reservation blocks.
- Visible controls: `Back`, date selector (`Today`, Tue-Fri), scrollable schedule grid, reservation blocks, reservation detail modal with `Cancel`.
- User actions: Change date, horizontally/vertically scroll schedule, tap reservation blocks, cancel/close reservation detail.
- Related pages / next screens: Selected club Book tab, Book now flow, reservation details.
- Backend/data requirements inferred: Facility courts, court names/types, reservations by court/time, date/time slot data, reservation status, permissions for viewing/canceling.
- Notes: Grid shows existing reservations, not open/available slots. No final reservation creation or payment confirmation screen is captured.

### 11. Member-Only Booking Gate

- Screenshots: `playbypoint/Settings Membership required if not member.jpg`
- Purpose: Block booking for a facility that only allows verified members.
- Main UI sections/components: Back button, explanatory message, membership CTA, verification request CTA.
- Visible controls: `Back`, `EXPLORE MEMBERSHIPS`, `CLICK TO REQUEST MEMBER VERIFICATION`.
- User actions: Explore memberships, request member verification, go back.
- Related pages / next screens: Memberships screen, proof/residency/member verification flow, club booking.
- Backend/data requirements inferred: User membership status per facility, verification request workflow, membership catalog.
- Notes: Filename references settings, but the screen appears to be a booking access gate.

### 12. My Bookings

- Screenshots: `playbypoint/My Booking Scheduled.jpg`, `playbypoint/My Booking Unscheduled.jpg`, `playbypoint/My Booking Categories Filter.jpg`, `playbypoint/My Booking Payment Filter.jpg`
- Purpose: User booking history/upcoming bookings split into scheduled and unscheduled tabs.
- Main UI sections/components: Page title, `Scheduled`/`Unscheduled` tabs, filter chips, empty state, bottom nav.
- Visible controls: `Date`, `Payment status`, `Categories`, filter bottom sheet with `Close` and `Apply`.
- Category filter options visible: All, Reservation, Lesson, Rental, partially visible `Progra...` (likely Program).
- Payment filter options visible: All, Paid, Unpaid.
- User actions: Switch Scheduled/Unscheduled, filter by date/payment/category, apply filters, switch bottom tabs.
- Related pages / next screens: Booking details not captured; Discover/Club booking sources.
- Backend/data requirements inferred: Bookings list, booking status, scheduled/unscheduled classification, payment status, category taxonomy, filtering.
- Notes: Empty state says `No bookings found`.

### 13. Orders / My Orders

- Screenshots: `playbypoint/Orders.jpg`, `playbypoint/Settings My Orders.jpg`
- Purpose: Order history/commerce history from settings.
- Main UI sections/components: Back button, empty order state.
- Visible controls: Back button only in `Orders.jpg`.
- User actions: Go back.
- Related pages / next screens: Settings index `My Orders`, payments.
- Backend/data requirements inferred: Orders list, purchase/payment records.
- Notes: `Settings My Orders.jpg` displays a title `Memberships` with a blank content area, which conflicts with the filename. Needs verification; it may be a mislabeled screenshot, a duplicate membership screen, or a routing/title bug.

### 14. Chats

- Screenshots: `playbypoint/Chats Support.jpg`, `playbypoint/Chats Reservation.jpg`, `playbypoint/Chat Archieved.jpg`
- Purpose: In-app chat inbox for support and reservation conversations, plus archived chats.
- Main UI sections/components: Back button, `Chats` title, archive icon, segmented tabs, empty state.
- Visible controls: `SUPPORT`, `RESERVATION`, archive icon, back; archived page title `Archived chats`.
- User actions: Switch support/reservation tab, open archived chats, go back.
- Related pages / next screens: Club detail chat button, Help Center chat, App Feedback/support widget.
- Backend/data requirements inferred: Chat conversations by type, archived conversations, reservation-specific chat threads, support messaging service.
- Notes: Both chat inbox tabs and archive list are empty.

### 15. Profile Overview

- Screenshots: `playbypoint/Profile.jpg`
- Purpose: User profile landing page.
- Main UI sections/components: Header area, settings gear, avatar with edit pencil, name/email, counts, statistics card, bottom nav.
- Visible controls: Settings gear, avatar edit pencil, bottom nav.
- User actions: Open settings, edit profile/avatar, switch bottom tabs.
- Related pages / next screens: Profile update, Settings index.
- Backend/data requirements inferred: User profile, avatar, booking count, follower/following counts, statistics/NRP value.
- Notes: Header image area appears as a gray placeholder or empty banner.

### 16. Profile Update

- Screenshots: `playbypoint/Profile Update.jpg`
- Purpose: Edit user profile data and profile visibility settings.
- Main UI sections/components: Back button, `Update` action, avatar, `Set New Photo`, name fields, phone field, email/address fields, visibility toggles.
- Visible controls: `Update`, `Set New Photo`, first/last name fields, cell phone field, email/address fields, `PUBLISH PHONE INFORMATION ON PROFILE`, `PUBLISH PROFILE` toggles.
- User actions: Update photo, edit profile fields, toggle visibility, save update, go back.
- Related pages / next screens: Profile overview.
- Backend/data requirements inferred: Profile update API, avatar upload, phone/email/address validation, privacy settings.
- Notes: Only the upper portion is captured; additional fields may exist below.

### 17. Settings Directory

- Screenshots: `playbypoint/Settings.jpg`, `playbypoint/Settings2.jpg`
- Purpose: Central settings/menu page.
- Main UI sections/components: Back button, title, user identity header, grouped settings list.
- Visible settings entries:
  - Game Matches
  - My Recordings
  - Leaderboard
  - My Orders
  - Memberships
  - Payments
  - Proof Of Residency
  - Family
  - Waivers
  - Friends
  - Notifications
  - General
  - Help Center
  - App Feedback
  - About (`v4.1.3`)
  - Sign out
  - Delete Account
- User actions: Open each settings area, sign out, delete account, go back.
- Related pages / next screens: All settings subsections in this document.
- Backend/data requirements inferred: Authenticated user, feature flags, app version, sign-out endpoint/session clearing, account deletion workflow.
- Notes: `Settings.jpg` and `Settings2.jpg` are scroll positions of the same screen.

### 18. General Settings

- Screenshots: `playbypoint/Settings General.jpg`, `playbypoint/Settings General Language.jpg`, `playbypoint/Settings General Statistics.jpg`, `playbypoint/Settings General Change Password.jpg`
- Purpose: Account-level preferences and self-service security/statistics.
- Main UI sections/components: General menu with Language, Statistics, Change Password; language picker; monthly statistics; password update form.
- Visible controls:
  - General menu: Language value `English`, Statistics, Change Password.
  - Language screen: `English`, `Spanish`, `French`, `Japanese`, selected checkmark, `Accept`.
  - Statistics screen: monthly cards for Created Reservations, RainOut, Total Reservations, Cancelled, No Show (`0 / 100`).
  - Change Password: password and confirm password fields, visibility toggles, `UPDATE`.
- User actions: Change language, view stats, update password.
- Related pages / next screens: Settings directory.
- Backend/data requirements inferred: User locale preference, monthly reservation stats, password update endpoint, validation.
- Notes: Language option is misspelled as `Spahish`; needs verification/fix later.

### 19. Notifications

- Screenshots: `playbypoint/Settings Notifications.jpg`, `playbypoint/Settings Notifications2.jpg`
- Purpose: Configure push and email notification preferences.
- Main UI sections/components: Push Notifications master toggle, long list of push notification categories, Email Notifications master toggle, email categories, sticky `UPDATE` button.
- Visible push categories include: Gamematch, Announcement, Clinic Reminder, Lesson Reminder, Clinic Raincheck, Clinic Confirmation, Reservation Reminder, Reservation Waitlist, Reservation Game Match, Reservation User Added, Reservation User Removed, Clinic Waitlist Approved, Reservation Cancellation, Reservation Confirmation, Reservation Someone Joined, Proof Of Residency Approved, Reservation Guest Invitation.
- Visible email categories include: Gamematch, Announcement, Clinic Reminder, Lesson Reminder, Clinic Raincheck, Clinic Confirmation, Reservation Reminder, and more below the fold.
- User actions: Toggle master/category notifications, save with `UPDATE`, go back.
- Related pages / next screens: Settings directory.
- Backend/data requirements inferred: Notification preference store by channel/category, push token state, email opt-in state.
- Notes: Both screenshots are scroll positions of one long form.

### 20. Payments

- Screenshots: `playbypoint/Settings Payment.jpg`, `playbypoint/Settings Payment Cards Add New Cards.jpg`, `playbypoint/Add New Cards Form.jpg`, `playbypoint/Settings Payment Billng Address.jpg`, `playbypoint/Settings Payment Billing Address Add Form.jpg`, `playbypoint/Settings Payment Club Credits.jpg`, `playbypoint/Settings Payment Club Account.jpg`, `playbypoint/Settings Payment Payment History.jpg`, `playbypoint/Settings Payment Booking Passes.jpg`
- Purpose: Manage stored payment methods, billing addresses, facility credit/account balances, payment history, and passes.
- Payment index controls: Cards, Club Credits, Club Account, Payment History, Billing address, Booking passes.
- Cards empty state: `Add a new card to get started`, top plus, bottom `ADD NEW CARD`.
- Add card form fields: Card Number, Exp. Date, CVV, Name on Card, authorization copy, `SAVE`.
- Billing address list: title, plus button, empty `No data`.
- Billing address form fields: Full Name, Address, City, State, Zip Code, `Default Address`, top `SAVE`.
- Club Credits: Facility selector (`ACCI RACKET SPORTS`), current balance `P0.00`.
- Club Account: Facility value (`ACCI RACKET SPORTS`), `No Account available`.
- Payment History: Empty state `You have not made any payment yet`.
- Booking passes: Message that user is out of booking passes and should contact facility or check membership options.
- User actions: Open payment subsections, add card, save card, add billing address, save billing address, select facility, review balances/history/passes, go back.
- Related pages / next screens: Booking flow, membership gate, settings.
- Backend/data requirements inferred: Payment processor tokenization, saved cards, billing addresses, facility accounts, credits ledger, payment transactions, booking pass inventory, currency/locale (Philippine peso shown as `P`/peso symbol).
- Notes: Filename `Settings Payment Billng Address.jpg` has typo `Billng`; screen title is `Billing address`.

### 21. Proof Of Residency

- Screenshots: `playbypoint/Settings Proof Of Residency.jpg`
- Purpose: Capture residency address and government-issued photo ID for verification.
- Main UI sections/components: Address field, Zip Code field, document type dropdown, upload button, verification status copy, accept CTA.
- Visible controls: Address, Zip Code, `ADD PROOF OF RESIDENCY`, `Government Issued Photo Id`, dropdown chevrons, `UPLOAD FILE`, `ACCEPT`.
- User actions: Enter address/zip, choose document type, upload proof file, accept/submit.
- Related pages / next screens: Settings directory, member verification gate, notifications for approval.
- Backend/data requirements inferred: Address/zip validation, file upload/storage, document type taxonomy, residency verification status, approval notification.
- Notes: Status is `Proof of residency not confirmed`.

### 22. Memberships

- Screenshots: `playbypoint/Settings Membership.jpg`
- Purpose: Show user's facility memberships.
- Main UI sections/components: Back button, empty state.
- Visible controls: Back.
- User actions: Go back.
- Related pages / next screens: Member-only gate, settings.
- Backend/data requirements inferred: Membership list/status per facility.
- Notes: Empty state says `Does not have any membership`. Membership catalog/purchase screens are not captured.

### 23. Family

- Screenshots: `playbypoint/Settings Family.jpg`
- Purpose: Manage children or family members linked to account.
- Main UI sections/components: Back button, title, add plus, empty state.
- Visible controls: Plus add button, back.
- User actions: Add family member, go back.
- Related pages / next screens: Add/edit family member form not captured.
- Backend/data requirements inferred: Family member profiles, account relationship model.
- Notes: Empty state says no family members added.

### 24. Waivers

- Screenshots: `playbypoint/Settings Waivers.jpg`
- Purpose: List required waivers/agreements.
- Main UI sections/components: Back button, title, empty state.
- Visible controls: Back.
- User actions: Go back; view/sign waiver when data exists.
- Related pages / next screens: Settings directory, activity/event booking flows.
- Backend/data requirements inferred: Waiver templates, user waiver completion status.
- Notes: No waiver data shown.

### 25. Friends

- Screenshots: `playbypoint/Settings Friends.jpg`
- Purpose: Social graph/friends/followers screen.
- Main UI sections/components: User name title, `0 Followers` and `0 Following` tabs, empty state.
- Visible controls: Back, followers/following tabs.
- User actions: Switch tabs, go back.
- Related pages / next screens: Profile, game matches, social discovery.
- Backend/data requirements inferred: Follower/following lists, friend/player profiles.
- Notes: Empty state says `No players added yet`.

### 26. Game Matches

- Screenshots: `playbypoint/Settings Game Matches.jpg`, `playbypoint/Settings Game Matches Closed Match.jpg`, `playbypoint/Settings Game Matches Filter.jpg`
- Purpose: View open/closed competitive matches and filter by sport/official status.
- Main UI sections/components: Filter panel, open/closed match segmented buttons, filter icon, official match toggle, empty state, filter menu.
- Visible controls: `OPEN MATCH`, `CLOSED MATCH`, lock/unlock icons, filter/sliders icon, `Official Match` toggle, sport popup options `pickleball`, `All`, `Cancel`.
- User actions: Switch open/closed match state, filter sport, toggle official match, go back.
- Related pages / next screens: Onboarding goal `Find matches and play with others`, settings.
- Backend/data requirements inferred: Match list, match visibility/status, sport filter, official match flag.
- Notes: All captured states have no match data.

### 27. My Recordings

- Screenshots: `playbypoint/My Recordings.jpg`
- Purpose: Show match recordings.
- Main UI sections/components: Back button, title, camera icon, empty state.
- Visible controls: Back.
- User actions: Go back; open recordings when present.
- Related pages / next screens: Settings directory, possibly match/court recording service.
- Backend/data requirements inferred: User recording list, media metadata, thumbnail/video storage.
- Notes: Empty state displays raw localization keys (`screens.profile.noRecordings`, `screens.profile.noRecordingsDescription`). Needs verification and later fix.

### 28. Leaderboard

- Screenshots: `playbypoint/Leaderboard.jpg`
- Purpose: Rankings/top players at user's club.
- Main UI sections/components: Back button, title, empty state.
- Visible controls: Back.
- User actions: Go back; view rankings when data exists.
- Related pages / next screens: Settings directory, clubs, game matches.
- Backend/data requirements inferred: Player rankings, club association, leaderboard metrics.
- Notes: No leaderboard data shown.

### 29. Help Center

- Screenshots: `playbypoint/Settings Help Center.jpg`
- Purpose: User support entry point.
- Main UI sections/components: Back button, help prompt, `CHAT WITH US`, support options list.
- Visible controls: `CHAT WITH US`, `Call us`, `Technical Support`.
- User actions: Start chat, call support, open technical support.
- Related pages / next screens: Chats, App Feedback/support widget.
- Backend/data requirements inferred: Support contact configuration, chat provider, phone support link.
- Notes: Technical Support copy says account-related issues only; membership cancellations/pauses/refunds should be handled by club directly.

### 30. App Feedback / Support Widget

- Screenshots: `playbypoint/Settings App Feedback.jpg`
- Purpose: Embedded support/help widget for messages, help articles, feedback, and status.
- Main UI sections/components: Dark header, helper avatars, close button, messages/help card, send message CTA, help search, article list, system status.
- Visible controls: Close `X`, Messages, Help, `Send us a message`, search field, help article rows, `System Status`.
- Visible help articles: `How to Manage Memberships`, `All Reservation Rules Explained`, `How to Create and Manage Programs`, `Guide to Real-Time Notifications with Playbypoint Webhooks`.
- User actions: Send support message, search help, open help articles, open system status, close widget.
- Related pages / next screens: Help Center, Chats.
- Backend/data requirements inferred: Third-party support/help center integration, article catalog, system status URL.
- Notes: Filename says App Feedback, but UI functions like a full support center.

## Screenshot Coverage Index

| Screenshot | Mapped screen/catalog entry |
| --- | --- |
| `playbypoint/Add New Cards Form.jpg` | Payments - add card form |
| `playbypoint/Book Now Button.jpg` | Selected Club Detail - booking type bottom sheet |
| `playbypoint/Chat Archieved.jpg` | Chats - archived chats |
| `playbypoint/Chats Reservation.jpg` | Chats - reservation tab |
| `playbypoint/Chats Support.jpg` | Chats - support tab |
| `playbypoint/Discover Filter.jpg` | Discover Filters - lower/sport list state |
| `playbypoint/Discover Map.jpg` | Discover Map |
| `playbypoint/Discover Page.jpg` | Discover Home |
| `playbypoint/Enable Location.jpg` | Find A Club - GPS disabled dialog |
| `playbypoint/Favorite Club.jpg` | Find A Club - favorite clubs empty state |
| `playbypoint/Find a club.jpg` | Find A Club / Club Search |
| `playbypoint/Leaderboard.jpg` | Leaderboard |
| `playbypoint/My Booking Categories Filter.jpg` | My Bookings - category filter |
| `playbypoint/My Booking Payment Filter.jpg` | My Bookings - payment filter |
| `playbypoint/My Booking Scheduled.jpg` | My Bookings - scheduled tab |
| `playbypoint/My Booking Unscheduled.jpg` | My Bookings - unscheduled tab |
| `playbypoint/My Recordings.jpg` | My Recordings |
| `playbypoint/Orders.jpg` | Orders / My Orders |
| `playbypoint/Profile Update.jpg` | Profile Update |
| `playbypoint/Profile.jpg` | Profile Overview |
| `playbypoint/Selected Club About.jpg` | Selected Club Detail - About tab |
| `playbypoint/Selected Club Book.jpg` | Selected Club Detail - Book tab |
| `playbypoint/Settings App Feedback.jpg` | App Feedback / Support Widget |
| `playbypoint/Settings Discover Filter.jpg` | Discover Filters - date/time state |
| `playbypoint/Settings Family.jpg` | Family |
| `playbypoint/Settings Friends.jpg` | Friends |
| `playbypoint/Settings Game Matches Closed Match.jpg` | Game Matches - closed match state |
| `playbypoint/Settings Game Matches Filter.jpg` | Game Matches - sport filter popup |
| `playbypoint/Settings Game Matches.jpg` | Game Matches - open match state |
| `playbypoint/Settings General Change Password.jpg` | General Settings - change password |
| `playbypoint/Settings General Language.jpg` | General Settings - language picker |
| `playbypoint/Settings General Statistics.jpg` | General Settings - statistics |
| `playbypoint/Settings General.jpg` | General Settings - menu |
| `playbypoint/Settings Help Center.jpg` | Help Center |
| `playbypoint/Settings Membership required if not member.jpg` | Member-Only Booking Gate |
| `playbypoint/Settings Membership.jpg` | Memberships |
| `playbypoint/Settings My Orders.jpg` | Orders / My Orders - needs verification |
| `playbypoint/Settings Notifications.jpg` | Notifications - push list top |
| `playbypoint/Settings Notifications2.jpg` | Notifications - lower push/email list |
| `playbypoint/Settings Payment Billing Address Add Form.jpg` | Payments - add billing address |
| `playbypoint/Settings Payment Billng Address.jpg` | Payments - billing address list |
| `playbypoint/Settings Payment Booking Passes.jpg` | Payments - booking passes |
| `playbypoint/Settings Payment Cards Add New Cards.jpg` | Payments - cards empty state |
| `playbypoint/Settings Payment Club Account.jpg` | Payments - club account |
| `playbypoint/Settings Payment Club Credits.jpg` | Payments - club credits |
| `playbypoint/Settings Payment Payment History.jpg` | Payments - payment history |
| `playbypoint/Settings Payment.jpg` | Payments - index |
| `playbypoint/Settings Proof Of Residency.jpg` | Proof Of Residency |
| `playbypoint/Settings Waivers.jpg` | Waivers |
| `playbypoint/Settings.jpg` | Settings Directory - top scroll position |
| `playbypoint/Settings2.jpg` | Settings Directory - lower scroll position |
| `playbypoint/Sign In Magic Link.jpg` | Sign In - magic-link modal |
| `playbypoint/Signin.jpg` | Sign In |
| `playbypoint/Signup.jpg` | Sign Up |
| `playbypoint/View Calendar Schedule.jpg` | Booking Calendar - reservation detail modal |
| `playbypoint/View Calendar.jpg` | Booking Calendar |
| `playbypoint/Welcome first step.jpg` | Onboarding Goal Selection |
| `playbypoint/welcome.jpg` | Welcome Greeting |

## Backend/Data Requirements Summary

- User/auth: account identity, session, password auth, magic-link auth, profile fields, privacy toggles.
- Location/search: device GPS status, permission handling, club geolocation, distance calculation, search by text and map bounds.
- Clubs/facilities: club profile, logo, hero image, overview, contact info, addresses, phone numbers, maps, membership restrictions, favorite status.
- Availability/booking: sports taxonomy, date/time filters, court inventory, court playability, schedule grid, existing reservations, booking type selection, member gating.
- Payments: payment method tokenization, billing addresses, payment history, facility credits, club accounts, booking passes, currency formatting.
- Membership/verification: facility memberships, member verification requests, proof-of-residency uploads, approval notifications.
- Communication: support chat, reservation chat, archived chat threads, help center articles, system status integration.
- Social/game: game matches, official match flag, followers/following, leaderboard, recordings.
- Preferences: locale/language, notification preferences by channel/category, monthly booking statistics.

## Missing / Unclear / Duplicated Screens

- `Settings My Orders.jpg` does not show an Orders title/content; it appears to show a Memberships screen or mislabeled capture. Needs verification.
- `My Recordings.jpg` exposes raw localization keys instead of human-readable empty-state text.
- `Settings Discover Filter.jpg` appears to be the Discover filter sheet despite the Settings filename prefix.
- No owner/admin flow appears in the screenshot set.
- No final booking confirmation, checkout, payment authorization, cancellation confirmation, or receipt screen appears.
- No event/class/program/pro detail pages appear, although copy and help articles reference classes, pros, programs, clinics, lessons, and webhooks.
- No desktop/responsive web screenshots are present.
