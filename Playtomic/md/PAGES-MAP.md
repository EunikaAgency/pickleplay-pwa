# Pages Map

Reverse-engineered from the mobile screenshots in this directory. All screens appear to be a Playtomic/Pickleheads-style sports booking and social app, focused mainly on padel with tennis and pickleball also present. Screens are mobile portrait only unless noted.

## Global Navigation And Shared UI

- Bottom tab bar appears on authenticated main screens: `Home`, `Community`, `Profile`.
- Top blue app shell appears on `Home`, `Community`, and `Profile`, with notification bell and hamburger/menu icons.
- Search/discovery screens use a white header with back arrow, title, search field, location arrow, favorites heart, filters, and filter chips.
- Primary CTA style is a large blue pill button. Premium uses a gold CTA on a dark plan page.
- Most screens assume a logged-in user named `Prism Parker` with initials `PP`.

## Home And Discovery

### Home Dashboard

- Screenshot: `HomePage 1.jpg`
- Purpose: Authenticated landing page for player tasks, sports actions, nearby clubs, and recommendations.
- Main UI sections/components: PLAYTOMIC blue header, notification bell, hamburger menu, "Don't forget" task card, four quick action shortcuts, suggested clubs carousel, suggested-for-you carousel, bottom navigation.
- Visible controls/CTAs: `Edit your player preferences` card with close `X`, `Book a court`, `Learn`, `Compete`, `Find a match`, `See all`, location enable card with `Enable`.
- User actions: open booking search, open lessons/learn listings, open match search/competition flow, find/create matches, dismiss task prompt, enable location permission, open notifications/menu/profile/community.
- Related screens: `Book a court.jpg`, `Learn.jpg`, `Compete -- Step 1.jpg`, `Community.jpg`, `Profile.jpg`, `Premium Plan.jpg`.
- Backend/data requirements: user profile completeness flags, location permission state, club recommendation feed, club image/assets, club distance, activity counts.
- Notes: "Suggested clubs" shows a location permission fallback plus remote club data from Madrid despite the screenshots otherwise using Manila/Paranaque.

### Home Dashboard Scrolled

- Screenshot: `HomePage 2.jpg`
- Purpose: Lower portion of the home feed showing friend suggestions and lesson/course recommendations.
- Main UI sections/components: partially visible club carousel, "Suggested for you", "Improve your level", lesson/course card.
- Visible controls/CTAs: `See all`, add friends card, course/listing card.
- User actions: add friends from phonebook, browse all suggestions, open lesson pack/course listing.
- Related screens: `Learn.jpg`, `Profile.jpg`, possibly contacts permission flow.
- Backend/data requirements: phonebook/contact integration state, lesson listings, price, venue, gender/level filters, date ranges.

### Login Or Sign Up

- Screenshot: `Login.jpg`
- Purpose: Authentication entry point.
- Main UI sections/components: Playtomic logo, title, social login buttons, email login button, legal text.
- Visible controls/CTAs: `Continue with Google`, `Continue with Facebook`, `Continue with email`, `Terms of Use`, `Privacy Policy`.
- User actions: start OAuth login, email auth, view legal pages.
- Related screens: Home after login, onboarding/profile setup not captured.
- Backend/data requirements: OAuth providers, email auth, legal URLs, account creation/session handling.
- Notes: No password or email form screen captured.

## Booking Courts

### Court Search Results List

- Screenshot: `Book a court.jpg`
- Purpose: Find and book available courts by location, sport, date, and time.
- Main UI sections/components: search header, location search field, sport/date/time filter chips, list of venue cards with large images, distance/location, price, duration, favorite heart, horizontal time-slot buttons.
- Visible controls/CTAs: back, `View map`, search field `Around me`, location arrow, heart, filter sliders, chips `Padel`, `May 25`, `00:00 - 23:59`, venue time slots such as `15:00`, `15:30`, `16:00`, `16:30`, `17:00`.
- User actions: search location, use current location, favorite venue, open filter panel, change sport/date/time, switch to map, select venue/time slot, go back.
- Related screens: `Book a court -- View Map.jpg`, `Book a court -- search.jpg`, `Book a court -- filter.jpg`, `Book a court -- filter 3.jpg`, `Book a court -- filter 4.jpg`, `Book a court -- filter 5.jpg`.
- Backend/data requirements: venue catalog, geocoding, availability by court/time, pricing, venue images, distance calculation, favorite clubs.
- Notes: Booking confirmation/payment screens are not captured.

### Court Search Location Picker

- Screenshot: `Book a court -- search.jpg`
- Purpose: Choose a city/place for court search.
- Main UI sections/components: modal/fullscreen location picker, search input with typed query, current-location CTA, list of geocoded locations.
- Visible controls/CTAs: close `X`, input `paranaque`, clear input `X`, `Around me`, location rows with arrow icons.
- User actions: type search query, clear query, select a location, use current location, close.
- Related screens: `Book a court.jpg`, `Book a court -- View Map.jpg`.
- Backend/data requirements: geocoding/autocomplete, current location permission, persisted selected search area.

### Court Search Map View

- Screenshot: `Book a court -- View Map.jpg`
- Purpose: Show matching clubs on a Google map.
- Main UI sections/components: search header, selected location, filter chips, map markers, Google map controls.
- Visible controls/CTAs: back, `View list`, search field `Parañaque`, location arrow, favorites heart, filters, sport/date/time chips, map zoom controls.
- User actions: pan/zoom map, tap club marker, switch back to list, adjust filters.
- Related screens: `Book a court.jpg`, `Book a court -- search.jpg`, filter screens.
- Backend/data requirements: map provider/API key, club latitude/longitude, active filters, marker state.
- Notes: Marker detail sheet is not captured.

### Court Filter Panel

- Screenshots: `Book a court -- filter.jpg`, `Book a court -- filter 2.jpg`
- Purpose: Advanced court search filters.
- Main UI sections/components: full-screen filter list with availability toggle, duration, court type, court features, size.
- Visible controls/CTAs: close `X`, `Reset`, checkbox `Show clubs without availability`, duration checkboxes `60 min`, `90 min`, `120 min`, `150 min`, `180 min`, type checkboxes `Indoor`, `Outdoor`, `Roofed outdoor`, feature checkboxes `Wall`, `Crystal`, `Panoramic`, size checkboxes `Single`, `Double`, sticky `See 7 results`.
- User actions: select/deselect filters, reset all, view results, close.
- Related screens: `Book a court.jpg`.
- Backend/data requirements: court metadata, availability counts, result count recalculation.
- Notes: Some disabled/greyed options imply unavailable filter values in current result set.

### Sport Selector Bottom Sheet

- Screenshot: `Book a court -- filter 3.jpg`
- Purpose: Change sport for court search.
- Main UI sections/components: dimmed search page background, bottom sheet with sport radio options.
- Visible controls/CTAs: radio options `Padel`, `Tennis`, `Pickleball`, `Other sports`, `Select sport`.
- User actions: select sport, open other sports, confirm.
- Related screens: `Book a court.jpg`, court filter panel.
- Backend/data requirements: supported sport list, sport-specific court filters and result availability.

### Date Selector

- Screenshot: `Book a court -- filter 4.jpg`
- Purpose: Choose up to 3 days for court availability search.
- Main UI sections/components: full-screen calendar for May/June 2026, selected day marker.
- Visible controls/CTAs: close `X`, calendar days, `See results`.
- User actions: select/deselect dates, scroll calendar, submit date filter.
- Related screens: `Book a court.jpg`.
- Backend/data requirements: date availability windows, multi-day search support.
- Responsive/mobile notes: Calendar is vertically scrollable with sticky bottom CTA.

### Time Selector Bottom Sheet

- Screenshot: `Book a court -- filter 5.jpg`
- Purpose: Choose time-of-day filter for court availability.
- Main UI sections/components: dimmed search background, bottom sheet with radio options.
- Visible controls/CTAs: `Specific hours`, `All day 00:00 - 23:59`, `Morning 06:00 - 12:00`, `Afternoon 12:00 - 18:00`, `Evening 18:00 - 24:00`, `See results`.
- User actions: choose time preset, potentially open specific-hour range, submit.
- Related screens: `Book a court.jpg`.
- Backend/data requirements: time range filtering, timezone-aware availability.

## Learn

### Learn / Classes Search

- Screenshot: `Learn.jpg`
- Purpose: Discover classes, courses, or lessons.
- Main UI sections/components: search header titled `Classes`, search field `Around me`, filter chips, grouped listings by date.
- Visible controls/CTAs: back, location arrow, favorites heart, filters, chips `Padel`, `All levels`, `Show...`, class cards with players, venue, price.
- User actions: search location/club, filter sport/level/date, favorite, open class detail, book or inspect a class.
- Related screens: `HomePage 2.jpg`, payment/booking screens not captured.
- Backend/data requirements: class/course catalog, dates/times, venue, instructor/participants, prices, level/gender constraints.
- Notes: Full class detail and checkout screens are missing.

## Matches / Compete

### Match Search Initial Sport Step

- Screenshot: `Compete -- Step 1.jpg`
- Purpose: Start match search by choosing sport.
- Main UI sections/components: matches search page in background, bottom sheet wizard.
- Visible controls/CTAs: back, search field `Search for a club or location`, filter chip group `Sport | Places | Dates and times`, radio options `Padel`, `Tennis`, `Next`.
- User actions: choose sport, continue, close/back.
- Related screens: `Compete -- Step 2.jpg`, `Compete -- Step 3.jpg`, `Compete Result.jpg`.
- Backend/data requirements: sport list, match search preferences.

### Match Search Level Step

- Screenshot: `Compete -- Step 2.jpg`
- Purpose: Collect user level for better match results.
- Main UI sections/components: bottom sheet level selector.
- Visible controls/CTAs: back within sheet, level radios `Beginner`, `Intermediate`, `Intermediate high`, `Advanced`, `Competition`, link `Do you want to take the full test?`, `Next`.
- User actions: choose skill level, start full level test, continue.
- Related screens: `Compete -- Step 3.jpg`, profile levelling flow not captured.
- Backend/data requirements: user sport level/rating, optional full assessment flow.

### Match Search Place Step

- Screenshot: `Compete -- Step 3.jpg`
- Purpose: Choose where to find matches.
- Main UI sections/components: bottom sheet with location input, club cards, club source checkboxes, distance slider.
- Visible controls/CTAs: back within sheet, `Around me` field, club cards `THE SUPREME COURTS`, `Warehouse71`, `Padel 300`, checkboxes `Recent clubs`, `Favorite clubs`, `Select a distance`, distance slider `0, 3, 6, 9, 12, 18, 24`, `Next`.
- User actions: choose specific clubs, filter recent/favorites, set distance, continue.
- Related screens: `Compete Result.jpg`.
- Backend/data requirements: clubs near selected location, recent/favorite clubs, distance units, match inventory.

### Match Search Results Empty/Flexible

- Screenshot: `Compete Result.jpg`
- Purpose: Display filtered match search result and suggested alternatives.
- Main UI sections/components: search header, chips, empty state, create-match CTA, flexible alternatives section with match card.
- Visible controls/CTAs: back, search field `Around me`, location arrow, heart, filters, chips `Padel`, `Tomorrow`, `All day`, `Clear all`, `Start a match`, expandable `Are you flexible?`, alternative match card with available player slots.
- User actions: clear filters, open filters, create match, join available match slot, expand/collapse flexible suggestions.
- Related screens: match creation flow not captured, `Compete -- Step 1.jpg`.
- Backend/data requirements: match search API, empty state logic, suggested alternative ranking, player avatars/ratings, price/slot availability.
- Notes: The "Start a match" creation flow is not captured.

## Community And Groups

### Community Feed

- Screenshot: `Community.jpg`
- Purpose: Social feed with player discovery and official posts.
- Main UI sections/components: search players bar, notification bell, hamburger menu, tabs `Feed` and `Groups`, feed filters, suggested users, official Playtomic post, floating compose button, bottom nav.
- Visible controls/CTAs: `Search players`, `Feed`, `Groups`, `All`, `Your posts`, `See all`, overflow menu on post, floating `+`.
- User actions: search users, switch tabs, filter feed, view all suggestions, open post menu, create post/group, navigate home/profile.
- Related screens: `Community Groups.jpg`, `Community -- Create Group.jpg`, `Community -- Created Group 2.jpg`.
- Backend/data requirements: social feed posts, suggested users, notifications, user search, post creation.

### Community Groups Empty State

- Screenshot: `Community Groups.jpg`
- Purpose: Show user group membership and invite group creation when empty.
- Main UI sections/components: same community shell, `Groups` tab active, empty-state card, floating `+`.
- Visible controls/CTAs: `New group`, floating `+`, bottom nav.
- User actions: create a new group, switch to feed, search players.
- Related screens: `Community -- Create Group.jpg`.
- Backend/data requirements: group membership list.

### New Group Step 1

- Screenshot: `Community -- Create Group.jpg`
- Purpose: First step of group creation.
- Main UI sections/components: back arrow, title `New group`, progress indicator `1/3`, sport field, privacy field, private group info box.
- Visible controls/CTAs: sport selector `Padel`, privacy selector `Private`, `Next step`.
- User actions: select sport, select privacy, continue, go back.
- Related screens: `Community -- Create Group 2.jpg`.
- Backend/data requirements: supported sports, privacy model.

### New Group Step 2

- Screenshot: `Community -- Create Group 2.jpg`
- Purpose: Enter group information.
- Main UI sections/components: title `Group information`, progress indicator, upload picture field, group name, description, max character counts.
- Visible controls/CTAs: back/close implied, `Upload a picture`, fields for group name and description, bottom `Create group`/next-style CTA appears disabled.
- User actions: upload group image, edit name, edit description, continue/create.
- Related screens: `Community -- Created Group 2.jpg`, `Community -- Created Group.jpg`.
- Backend/data requirements: image upload, group name, description validation.
- Notes: Exact CTA text is small/partially unclear; needs verification.

### Created Group Detail

- Screenshot: `Community -- Created Group 2.jpg`
- Purpose: Group landing page after creation.
- Main UI sections/components: blue court-themed header, group title `Padel with me`, member count, members strip, details card, chat floating button.
- Visible controls/CTAs: back, hamburger/menu, `View all`, `Add`, chat bubble button, detail rows `Padel`, `Private group`.
- User actions: go back, open group menu, add members, view all members, open group chat.
- Related screens: `Community -- Created Group.jpg`, `Community -- Group Chat.jpg`.
- Backend/data requirements: group entity, membership, owner/current-user state, sport, privacy, chat channel.

### Add Members To Group

- Screenshot: `Community -- Created Group.jpg`
- Purpose: Invite members to a created group.
- Main UI sections/components: back arrow, title `Add members`, search field/row of contacts, suggestions.
- Visible controls/CTAs: search input, suggested user card with `Add`, bottom `Create group`.
- User actions: search users, add suggested users, finish group creation.
- Related screens: `Community -- Created Group 2.jpg`.
- Backend/data requirements: user search, suggestions, invitations/membership mutation.
- Notes: Filename suggests created group, but UI is an invitation step; likely group creation step 3 or post-create invite.

### Group Chat

- Screenshot: `Community -- Group Chat.jpg`
- Purpose: Chat inside a group.
- Main UI sections/components: chat title `Padel with me`, message list, date separator, composer.
- Visible controls/CTAs: back, `Details`, message input `Write a message`, send button.
- User actions: view details, type/send message, go back.
- Related screens: `Community -- Created Group 2.jpg`.
- Backend/data requirements: realtime/group chat messages, sender identity, message timestamps.

## Profile, Account, Settings

### Profile Overview

- Screenshot: `Profile.jpg`
- Purpose: User profile summary.
- Main UI sections/components: blue header, avatar initials, name/location, stats, profile actions, sport tabs, level progression.
- Visible controls/CTAs: notification bell, menu, `Add my location`, `Edit profile`, `Go Premium`, sport tabs `Padel`, `Tennis`, `Pickleball`, level result filters `5 results`, `10 results`, `All results`, `Start levelling`.
- User actions: edit profile, upgrade to premium, add location, change sport tab, start levelling, open notifications/menu, navigate tabs.
- Related screens: `Profile 2.jpg`, `Profile -- Edit.jpg`, `Premium Plan.jpg`, `Settings.jpg`.
- Backend/data requirements: user profile, counts, follower graph, sport levels, premium entitlement.

### Profile Scrolled Preferences

- Screenshot: `Profile 2.jpg`
- Purpose: Lower profile page showing player preferences.
- Main UI sections/components: level progress card continuing from profile, player preferences list.
- Visible controls/CTAs: `Start levelling`, `Edit`, preference cards `Best hand`, `Court position`, `Match type`, `Preferred time to play`, all `Not set`.
- User actions: edit preferences, start levelling.
- Related screens: `Profile -- Edit 2.jpg`, `Compete -- Step 2.jpg`.
- Backend/data requirements: player preference fields, sport-specific profile data.

### Edit Profile Form

- Screenshots: `Profile -- Edit.jpg`, `Profile -- Edit 2.jpg`
- Purpose: Edit personal profile fields, player preferences, interests, and password.
- Main UI sections/components: back arrow, profile picture editor, personal information form, extended sections.
- Visible controls/CTAs: `Change profile picture`, name, email, country code dropdown `PH (+63)`, phone, gender dropdown, date of birth picker, description field with `160 characters`; additional screen shows location, date of birth, description, player preferences, interests, password sections.
- User actions: update avatar, edit profile fields, choose country/gender/date, edit description, edit preferences/interests/password, save likely below viewport.
- Related screens: `Profile.jpg`.
- Backend/data requirements: user account fields, phone country code, validation, avatar upload, preferences, password management.
- Notes: Save button is not visible in captured area; needs verification.

### Settings Index

- Screenshot: `Settings.jpg`
- Purpose: Account settings hub.
- Main UI sections/components: back arrow, settings list, danger zone.
- Visible controls/CTAs: `Privacy`, `Notifications`, `Security`, `Delete your account and data`.
- User actions: open privacy settings, notification settings, security settings, delete account flow.
- Related screens: `Settings -- Privacy.jpg`, `Settings -- Notification.jpg`, security/delete flows not captured.
- Backend/data requirements: account settings routes, delete-account workflow.

### Privacy Settings

- Screenshots: `Settings -- Privacy.jpg`, `Settings -- Privacy 2.jpg`
- Purpose: Control account visibility, interactions, location, and profile/usage privacy.
- Main UI sections/components: back arrow, privacy sections with rows and toggles.
- Visible controls/CTAs: `Private account`, `Blocked accounts`, `Show your activity`, `Approximate location`, `Turn off live and privacy`, `Third party settings`, `Delete my data` link/row.
- User actions: toggle activity/location/privacy controls, open blocked accounts, open third-party settings, delete/export related data.
- Related screens: `Settings.jpg`.
- Backend/data requirements: privacy flags, blocked-user list, location visibility, third-party consent, data deletion endpoints.
- Notes: Lower portion is partially captured across two screenshots; exact label "Turn off live and privacy" needs verification.

### Notification Settings

- Screenshots: `Settings -- Notification.jpg`, `Settings -- Notification 2.jpg`
- Purpose: Manage app and marketing notifications.
- Main UI sections/components: back arrow, notification permission tip, grouped toggles.
- Visible controls/CTAs: app notification toggles for `Follow-up notifications`, `Like notifications`, `Comment notifications`, `Tag notifications`, `New user/commenter activity`, `Priority alerts`; marketing communication sections such as promotion emails and newsletters.
- User actions: enable/disable notification types, open priority alerts, turn on system notifications.
- Related screens: `Settings.jpg`, `Premium Plan.jpg` for priority alerts.
- Backend/data requirements: notification preferences, push permission state, marketing consent flags, premium-gated priority alerts.

### Your Activity

- Screenshot: `Your Activity.jpg`
- Purpose: Menu of user's historical activity.
- Main UI sections/components: back arrow, activity menu list.
- Visible controls/CTAs: `Bookings`, `Classes`, `Other programs`, `Groups`, `Favorite clubs`.
- User actions: open history/list for each activity type.
- Related screens: booking/class/group/favorites histories not captured.
- Backend/data requirements: user bookings, class enrollments, programs, group membership/activity, favorite clubs.

## Premium

### Premium Plan

- Screenshot: `Premium Plan.jpg`
- Purpose: Upsell and purchase annual premium subscription.
- Main UI sections/components: dark premium page, close button, plan name, trial/pricing, free-vs-premium benefits comparison, legal/restore, sticky gold CTA.
- Visible controls/CTAs: close `X`, `Terms & Conditions`, `Restore purchase`, `Start 14 day free trial`.
- User actions: start trial/purchase, restore purchase, view terms, close.
- Related screens: `Profile.jpg`, possibly notification priority alerts.
- Backend/data requirements: subscription pricing/currency, trial eligibility, in-app purchase/payment provider, entitlement restoration, benefit flags.
- Notes: Comparison rows include repeated labels (`Court reservation`, `Matches & Activities`, `Social community`, `Zero commissions`, `Advanced statistics`, `Priority alerts`), likely rough/test data or duplicate copy needing verification.

## Missing Or Unclear Screens

- Venue/facility detail page is not captured, though list and map imply it exists.
- Court booking checkout/payment and booking confirmation screens are not captured.
- Class/course detail and checkout screens are not captured.
- Match creation flow after `Start a match` is not captured.
- Match detail/join confirmation/payment screen is not captured.
- Email/password auth forms and onboarding/profile setup after login are not captured.
- Security settings and delete-account confirmation flows are not captured.
- Notification detail/priority-alert settings may be premium-gated but are not captured.
- Web/desktop responsive layouts are not captured; the entire set appears to be Android mobile screenshots.

