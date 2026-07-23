# app/ — PickleBallers PWA (read this first)

Mobile-first React PWA for finding pickleball games, courts, clubs, and players.
**This file is the map.** Skim it before grepping/scanning the tree — it points
you straight at the right file so you don't have to read everything.

- Deep architecture, the add-a-screen checklist, and the roadmap-update rule
  live in [CLAUDE.md](CLAUDE.md). Repo-wide conventions live in
  [../AGENTS.md](../AGENTS.md). This file is the quick index; keep it short.

## Commands

```sh
npm run build    # tsc -b && vite build  — MUST stay clean after any change
npm run lint     # eslint .
npm run preview  # preview the production build
npm run doctor   # react-doctor diagnostics (lint/a11y/bundle/architecture)
```

## Stack

React 19 · TypeScript · Vite 8 · Tailwind v4 (`@tailwindcss/vite`, no config file —
tokens are CSS vars in `src/shared/styles/index.css`) · Leaflet (maps) ·
Material Symbols + a wrapper `Icon` · vite-plugin-pwa. Most state is local
`useState`; **auth/session state lives in a Zustand store**
(`shared/lib/authStore.ts`) so screens read the current user without prop-drilling.

## Entry points & navigation

- `index.html` → `src/main.tsx` → **`src/App.tsx`** (the composition root: holds
  all nav state, auth/guest state, and renders chrome + the active screen).
- No router lib. Navigation is a **screen-stack in `App.tsx`**: a `Screen`
  discriminated union + history array; `navigate(id, params?)` pushes, `goBack()`
  pops. The union and `tabScreens`/`TabId` live in `src/shared/lib/navigation.ts`.
- To add a screen: create it in the right `features/<slice>/`, then add it to the
  `Screen` union **and** the `renderScreen()` switch in `App.tsx`. (Full checklist
  in CLAUDE.md.)

## Directory map

```
src/
  App.tsx              # composition root — nav stack, auth gate, chrome wiring  ← start here
  main.tsx             # mount
  pwaUpdate.ts         # service-worker auto-update

  features/<slice>/    # vertical slices; each owns its screens + slice-only UI (filter sheets)
    auth/              # LandingScreen, LoginScreen, OnboardingScreen, SplashScreen (+splash.css —
                       #   animated launch intro, once-per-session overlay from App.tsx);
                       #   Forgot/ResetPasswordScreen; VerifyEmailScreen (emailed-link deep
                       #   target, /verify-email) + VerifyEmailBanner (App.tsx nudge for
                       #   signed-in unverified users)
    home/              # v2/HomeScreenV2 — the only player home (App.tsx routes owners to
                       #   owner/OwnerHomeScreen instead). The legacy New/Classic home variants
                       #   + the floating design toggle were removed; v2.1 is the sole player design.
    # NOTE: each player slice has a v2/ folder with its "Pickleballers Mockup v2.1"
    #   redesign screen (venues/v2, games/v2 incl. CreateGameV2 + CreateChoiceSheet
    #   "Game On" join-vs-host chooser, tournaments/v2 browse+detail tab, clubs/v2
    #   incl. CreateClubV2, profile/v2 incl.
    #   SettingsScreenV2) — these are what every player/guest sees. See the
    #   "Design" note below + shared/components/layout/V2Chrome + shared/styles/v2.css.
    games/             # Games (player browse/join — owners get owner/OwnerGames instead via App.tsx),
                       #   GameDetails, CreateGame (venue-first: pick a priced court → date +
                       #   start/end time → details → PAY to book the court → game posts; with a
                       #   gameId prop it switches to the MANAGE form: edit details + kick players,
                       #   venue/time locked), MyGames (manage games you created: status + edit/delete),
                       #   InvitePlayers, GameChat (per-game group chat for the roster — opened from
                       #   GameDetails' "Chat" AND from the player-hosted Open Play detail, whose
                       #   roster is interestedUserIds; realtime via realtimeBus 'game.message';
                       #   gated by player.games.chat),
                       #   v2/OpenPlayChat (group chat for an organizer-published OpenPlaySession —
                       #   listOpenPlayMessages/sendOpenPlayMessage, realtime 'openplay.message';
                       #   same shared ChatThread, same player.games.chat gate),
                       #   GameFilterSheet + gameFilters (when/skill/type/openings
                       #   filter model+predicate), gameDisplay (API-wired: create/edit/delete/
                       #   list/detail/join/kick/group-chat; invite-send still demo).
                       #   playRanking.ts NO LONGER SCORES — the Discover feed is ranked by the
                       #   SERVER (getPlayDiscover → GET /api/v1/play/discover; the scorer lives in
                       #   api/src/features/play/), so every device gets the same order and the
                       #   weights retune without an app release. What's left here is the client's
                       #   own job: sortScored() re-orders the ranked set the server sent when the
                       #   user flips Sort (soonest/nearest/spots-left/newest are pure reorderings
                       #   of a set we already hold — a round-trip per tap would only feel slower),
                       #   plus the PlayItem/ScoredPlayItem types re-exported from api.ts.
                       #   The Play tab's SECTION control (Open Play | Events) is a visible tab
                       #   row now (§3.4) — it was a dropdown that read only "Open Play", so a
                       #   player who never opened it had no way of knowing Events existed. A bare
                       #   /games also opens on OPEN PLAY, not Events (§3.3): both the URL parser's
                       #   default and syncTabUrl's omit-the-default rule had to flip together, or
                       #   picking Events writes nothing to the URL and a reload bounces you back.
                       #   gameFilters gained §4.3's four: cost / access / repeat / venue. `cost`
                       #   keys off ScoredPlayItem.joinFee, NOT priceLabel — on a GAME the label is
                       #   the VENUE's hourly rate (the host paid it), so a "Free" filter built on
                       #   the label would hide games that are in fact free to join.
                       #   Open Play (gameType 'open') = INTEREST board, no lobby: v2/OpenPlayDetail
                       #   shows an "I'm Interested" toggle (toggleGameInterest) + who's interested,
                       #   not slots (applies to organizer sessions too). Public game (gameType
                       #   'public') = v2/CreateGameV2 4-step wizard (Format→Slots→Details→Review)
                       #   → format-driven capped game with the full lobby (GameDetails).
    bookings/          # BookCourt (pick venue→court (CourtPicker)→whole-hour start/end via HourSelect,
                       #   taken hours greyed out from that court's live availability→pay test-checkout;
                       #   at a venue with requireBookingApproval it becomes "Request booking" — saves
                       #   the card, no charge, lands "awaiting approval"), MyBookings (list+cancel; an
                       #   approved booking shows "Pay {amount} by <deadline>" → checkout → confirmed),
                       #   BookingRefund (refund/cancel a single court booking — reached after a host
                       #   deletes a lobby but keeps the court; loads getBooking → cancelBooking),
                       #   OpenPlayBook (V3 — courtless per-session drop-in: date+time+party →
                       #   createBooking{bookingType:'open_play'} priced from venue.openPlayPrice →
                       #   checkout; reached from the court page "Join open play" CTA),
                       #   ModifyBookingSheet (reschedule date/time, max 3× — the server re-prices
                       #     the new slot, so the success line reports the returned priceDelta:
                       #     "₱N extra is due" / "₱N will be credited back"),
                       #   bookingDisplay (status chips incl. awaiting_payment "Pay to confirm"
                       #     and a "No-show" chip that outranks "Completed" — a no-show is its own
                       #     ending, not a cancellation: the slot was used and the payment kept;
                       #     also the approval-deadline formatters — countdownLabel/deadlineLabel/
                       #     deadlineUrgency, plus estimateApprovalDeadline, a MIRROR of the
                       #     server's api/src/features/bookings/bookingDeadlines.ts used only
                       #     pre-submit; both sides share one test fixture so they can't drift,
                       #     and anything post-submit renders the server's approvalDeadline),
                       #   useVenueBookingContext (one keyed hook: getVenue→courts+viewerIsMember +
                       #   getHours + slot-overrides — replaces the old listCourts + getVenue-for-member;
                       #   BookCourt no longer pulls the whole directory on a deep-link), useBookingPricing
                       #   (pure rate/blend/surcharge/service-fee/grand-total math, extracted from BookCourt),
                       #   bookingErrors (mapBookingError → friendly copy keyed on ApiError.code:
                       #   SLOT_CONFLICT/PAST_SLOT/PRICE_MISMATCH bounce back to Step 0)
    venues/            # Nearby (the "Nearby" tab — player discover view; owners get owner/OwnerNearby instead via App.tsx), CourtDetails (+ "Join Membership"/"Renew Subscription" CTA beside "Book this court" → MembershipSheet; button hidden when membership is active per viewerMembershipExpiresAt), NearbyFilterSheet, venueFilters (filter model+predicate), MembershipSheet (subscription-plan picker BottomSheet; handles join, switch, and renewal) + membership.ts (default plans + helpers; join persists server-side as a VenueMember via joinVenueMembership/leaveVenueMembership, seeded from venue.viewerMembershipTier + viewerMembershipExpiresAt — surfaces in the owner Members tab + member pricing; expiry computed from plan cadence), v2/NearbyScreenV2 (the Nearby tab — map + pull-down sheet holding the venue grid), v2/NearbyFilterRow (date · free-time-range · area · court-type filter row; the time range is ONE field showing "6 PM – 9 PM" that opens a two-thumb `input[type=range]` spanning the whole day, full span = "any time"/off. All three dropdowns render through the local `AnchoredPanel`, which switches them to `position: fixed` with measured coords so they escape `.nearby-sheet`'s `overflow: hidden` and flip above the trigger when there's no room below the tab bar), v2/RecentVenuesSection ("venues you've played at recently" rail), v2/VenueGridCard (venue card: photo + indoor/outdoor, instant-vs-request-book and open-slot badges, member/guest rates, amenity chips, "View Courts"), v2/nearbyDisplay (card formatters — venueRates/venueTypeBadge/openSlotCount/venueArea/hourLabel/freeAcrossWindow + deriveRecentVenues rollup of the player's bookings), v2/DateTimeFilterBar (the old date/time filter bar; **dead — nothing imports it**, NearbyFilterRow superseded it and restored the time-window filter, so this file + its `.dt-*` CSS can be deleted)
    tournaments/       # Player Tournament tab (live): v2/TournamentsScreenV2 (role-aware tabs —
                       #   Open · Managing(organizer)/Joined(player) · Results), v2/TournamentDetailScreen
                       #   (overview + register/withdraw + announcements + Chat),
                       #   v2/TournamentChatScreen (participant group chat — roster of
                       #   organizer + registrants; realtime via realtimeBus 'tournament.message';
                       #   gated by player.tournaments.chat — mirrors GameChat), tournamentDisplay
                       #   (status/format/date/money formatters). Reuses the /tournaments API
                       #   (listPublicTournaments/register/withdraw/my-registration/messages).
    social/            # the **Social tab** (Clubs + Friends). SocialScreen (shell +
                       #   the Clubs|Friends `Segmented` switch, sub-tab in `?tab=`,
                       #   landing rule: pending friend requests → Friends, else Clubs;
                       #   guests are gated into Clubs), ClubsPanel (was clubs/v2/
                       #   ClubsScreenV2 — my/discover lists, cursor-paginated + server
                       #   search; its empty "My Clubs" state cross-links to Friends),
                       #   FriendsPanel (was profile/FriendsScreen — friends/requests/
                       #   find, geolocated suggestions, DM hand-off; restyled to v2 and
                       #   owns its own signed-out state). PickleFeed posts carry photos
                       #   (post: photo-only, each w/ optional caption) + comments carry
                       #   photos & GIFs — FeedMedia.tsx renders them, feedAttachments.ts
                       #   splits media vs share cards. Every post has a ⋯ menu (FeedPanel):
                       #   author→edit/delete, others→interested/not-interested/report/
                       #   hide-24h/notify-on-comment.
                       #   Club **detail** screens stay in clubs/ below. Scoped by
                       #   `.pb-v2.v2-social` in v2.css.
    clubs/             # club DETAIL screens (the list lives in social/ above).
                       #   ClubDetails (live: detail + members +
                       #   Facebook-style feed with post/like + photo/GIF
                       #   attachments, realtime via the club SSE stream, join/leave,
                       #   ⋯ menu: invite/share link + host edit/delete + host
                       #   moderation — approve/deny private-club join requests
                       #   (sheet), remove members, author/host delete of any post;
                       #   ⋯→Edit post opens ClubPostEdit), ClubPost (single-post
                       #   permalink — tap a feed post → post + all comments +
                       #   composer; owns commenting + comment inline edit/delete;
                       #   ⋯→Edit post opens ClubPostEdit), ClubPostEdit (Facebook-
                       #   style dedicated "Edit post" page — author-only, edits the
                       #   body via PATCH /posts/:id), ClubChat (live member group
                       #   chat — separate from the feed; shared ChatThread UI,
                       #   realtime via club.message on the per-user SSE stream;
                       #   detects pasted game URLs → rich GameChatCard via game-link.ts),
                       #   CreateClub + EditClub (live: POST/PATCH
                       #   /clubs — name/description/visibility + cover-photo upload
                       #   + member limit). All via the clubs client in api.ts.
    coaches/           # the coach feature. CoachSubscribeScreen shows the live plan, a
                       #   "Subscription ending" state + Resume when cancelAtPeriodEnd is set,
                       #   a Subscription-history list, and an in-app confirm BottomSheet for
                       #   cancelling (never window.confirm) behind a solid-red Button
                       #   variant="danger". (`coach-subscribe`,
                       #   /coach/subscribe) — the CANONICAL entry, reached from the Profile
                       #   tab's "Coaching" section; the Home CTA only links here. Buys the
                       #   paid plan (price + term from GET /settings), blocks on an
                       #   incomplete profile address (ADDRESS_REQUIRED → Edit Profile), and
                       #   calls authStore.restore() so the new coach role lands without a
                       #   re-login. FindCoachScreen (`find-coach`, /coaches) — lists ONLY
                       #   coaches holding a live subscription (listCoaches({subscribed:true})),
                       #   debounced server-side search; hides the viewer's OWN listing (you
                       #   can't book yourself — the API 400s SELF_BOOKING). CoachPricingScreen
                       #   (`coach-information`, /coach/information; /coach/pricing legacy alias) —
                       #   titled "Coach Information", where a coach edits their public profile
                       #   (headline, city, experience, bio, languages, certifications — everything
                       #   on the public /coaches/:slug card updates live) and sets their rates:
                       #   standard private/group, plus a per-venue override per approved venue
                       #   standard private/group, plus a per-venue override per approved venue
                       #   (blank = bill the standard rate); saves via updateMyCoach. Reached
                       #   from CoachSubscribeScreen's partner tools. A coach profile is only
                       #   created by a venue owner APPROVING an application, so this screen
                       #   404s → "no coach profile yet" for a subscriber who hasn't applied.
                       #   CoachDetailScreen (`coach-detail`,
                       #   Threads-style public profile via shared PublicProfileHero — About/
                       #   Sessions/Venues tabs, Book + Message actions) →
                       #   BookCoachScreen (`book-coach`): pick a CoachService or the plain
                       #   hourly session, date + HourSelect start time, notes →
                       #   createCoachBooking (the SERVER prices it). CoachBookingsScreen
                       #   (`coach-bookings`) = the coach's inbox (accept/decline/cancel).
                       #   coachDisplay.ts holds the local formatters (rate/location/service/
                       #   status chip) — the slice must not import another slice's display module.
    profile/           # Profile, EditProfile (address1/2 + city/province/zipcode, re-seeded
                       #   once the session restores), Settings, Notifications, PaymentHistory,
                       #   PlayerProfileScreen (`player-profile`, /players/:id — another
                       #   player's PUBLIC card via getPublicUser; Threads-style layout via shared
                       #   PublicProfileHero (name+handle/role, avatar, bio, location, DUPR/joined
                       #   stats, Message + Share actions); partner-role badges via
                       #   shared/lib/roleDisplay.ts ROLE_META; a live coach gets a "Book a
                       #   coaching session" shortcut. Reached by tapping a row in social/FriendsPanel),
                       #   CoachPromoSheet (the "what you get" popup behind the Coaching
                       #   upgrade banner on ProfileScreenV2 — perks + live price from
                       #   getSettings; Continue routes to `coach-subscribe`, which still
                       #   owns the address gate + payment. Lives in profile/ because a
                       #   feature slice must not import another slice's components),
                       #   OrganizerPromoSheet (the same popup for the ₱999 Organizer plan —
                       #   perks + live price; Continue routes to `organizer-subscribe`),
                       #   MembersScreen (player-facing community dashboard: clubs + venue
                       #   memberships in a searchable, filterable table with KPI cards,
                       #   status badges, loading skeletons, and empty state; reachable
                       #   from ProfileScreenV2's Account section),
                       #   TestEmail (admin tool: send sample transactional emails to preview
                       #   templates in an inbox; gated by admin.access, reachable from Settings)
                       #   (player spend report: KPIs + 6-month BarChart + receipts,
                       #    from listPayments; gated by player.payments.view)
    messages/          # direct 1:1 chat: ConversationsScreen (thread list, from Profile → Messages or
                       # the desktop Sidebar "Messages"; has a "New message" ✏️ that searches any
                       # player (searchPlayers) → startConversation → chat, so you can DM someone you've
                       # never met in a game),
                       # ChatScreen (thread + composer; reached from a game's "Message organizer" or
                       # a message notification → /messages/:id). Realtime: both screens subscribe to
                       # the realtime bus ('message') so new messages append / the list reorders live
                       # (see shared/lib/realtimeBus.ts + shared/hooks/useRealtimeStream.ts). Gated by
                       # user.messages.send.
    search/            # SearchScreen — live global search across courts/games/clubs/players
                       #   (crossSearch → GET /api/v1/search?type=all); debounced, recent
                       #   searches in localStorage, player rows open a DM. Gated by player.search.use
    owner/             # venue-owner console (the one feature with internal subfolders — it's
                       # ~3x any other slice). Root = the screens: OwnerHome (the Home tab for
                       # owners — dashboard: revenue hero + KPIs + cross-venue pending/upcoming +
                       # venue cards + a "Front desk" quick action), OwnerFrontDesk (the
                       # operator/staff console — owner-front-desk: today's schedule +
                       # pending approvals + manual-entry count for one venue (venue picker
                       # when multi-venue); "Add booking" records an off-platform
                       # phone/Messenger/IG/walk-in reservation, "Block slot" makes a time
                       # unavailable — both via createVenueBooking → POST /venues/:id/bookings,
                       # double-booking-guarded, no payment flow. A manual booking REQUIRES a
                       # positive amount (server: AMOUNT_REQUIRED) — a blank field used to file
                       # the walk-in at ₱0; a non-paying hold is what "Block slot" is for),
                       # OwnerBookingDetailSheet (per-booking actions: approve/decline/cancel,
                       # mark-GCash-paid, and — once the slot has started — Mark no-show /
                       # Undo no-show via markBookingAttendance; also shows the attendance +
                       # refund-settlement rows), OwnerBookings (titled
                       # "Reports" — a pure analytics dashboard styled after a modern BI console:
                       # Date-range/Venue/Status filters + CSV/PDF export, 8 KPI cards
                       # (KpiCard), a Booking-trends line chart (Daily/Weekly/Monthly/Yearly),
                       # Revenue/Bookings-by-venue bars, a status DonutChart, a Venue-performance
                       # matrix (search/sort/paginate/sticky-header/score bars), Quick insights +
                       # a read-only Recent-activity feed — tap a feed row → OwnerBookingDetailSheet,
                       # which still carries confirm/decline/cancel (so per-booking management stays
                       # reachable without the old all-venues inbox; approvals also live on
                       # OwnerFrontDesk + the per-venue Bookings tab)) + OwnerInsights (all-venues
                       # analytics: combined trends + per-venue compare) — the Home Bookings/Insights
                       # buttons open these; OwnerGames (the Games tab for owners — "Your courts":
                       # Schedule agenda of bookings+games per day + Games list at their venues);
                       # OwnerNearby (the Nearby tab for owners — a "your venues" operations
                       # map: your venues as live-status pins (today's bookings / pending /
                       # occupancy), tap → glance → console; attention-sorted venue list below);
                       # OwnerVenues (list w/ per-card glance + "Claim" entry),
                       # OwnerVenuesV2 (courts-first view w/ venue dropdown, reuses
                       # CourtsEditorTab; the primary owner "Venues" tab entry point),
                       # OwnerVenue
                       # (tabbed host), OwnerNewVenue (create), ClaimVenue (search the
                       # directory for an unclaimed listing → submit an ownership claim
                       # with proof; gated by owner.venues.claim); OwnerStaff (org-level
                       # staff accounts — create a login that manages ALL the owner's
                       # venues/bookings/clubs; reached from the Profile "Staff" row,
                       # gated by owner.staff.manage; distinct from the per-venue Team tab).
                       # SubscriptionPlans (owner-subscription-plans, reachable from the
                       # Membership tab's "Manage Subscription" button) — CRUD screen for
                       # venue membership plans (SubscriptionPlan + versioned
                       # SubscriptionPlanVersion); create/edit via CreateEditPlanSheet
                       # (match the player MembershipSheet design); versioning:
                       # structural edits (price/billing/benefits) create a new version
                       # so existing subscribers stay on their version until renewal.
                       # OwnerShop (owner-shop, route /shop, gated by owner.access) —
                       # rental-inventory management: KPI grid (total/rented/available/
                       # low-stock), venue filter, category/search, table (desktop) +
                       # cards (mobile), add/edit via InventoryItemForm, detail via
                       # InventoryItemDetail, CSV export.
      components/      # BookingLinkShare (copy/share the auto-generated booking link +

                       # optional custom slug; rendered on the Overview tab + Listing
                       # editor),
                       # CreateEditPlanSheet (owner creates/edits subscription plans —
                       # name/price/billing-cycle/benefits/status/settings; BottomSheet
                       # matching the player MembershipSheet design).
                       # InventoryItemForm (add/edit rental inventory item form as a
                       # BottomSheet — name/SKU/category/price/stock/condition/status),
                       # InventoryItemDetail (read-only rental item detail as a BottomSheet).
      tabs/            # the OwnerVenue panels: Overview (business dashboard: revenue/bookings/
                       # occupancy KPIs + revenue trend chart), Insights (per-venue segmented
                       # analytics), Bookings (per-venue inbox — Approve a request-to-book →
                       # awaiting_payment, or Decline/Cancel), Membership (the venue's actual
                       # MEMBERS — players who joined the membership (VenueMember, via the
                       # court page's "Join Membership") + anyone the owner adds by hand;
                       # member pricing applies. NOT booking-derived — "Add member" opens a
                       # search field (finds any player by name via /search?type=players) above
                       # a picker of past players; remove revokes it. A "Manage Subscription"
                       # button opens the SubscriptionPlansScreen for the owner to create,
                       # edit, duplicate, enable/disable and delete plans),
                       # Listing (identity/contact/pricing/
                       # amenities + a "Booking policy" section: require-approval toggle +
                       # pay-window)/Location/Courts/Closures/Faqs/Reviews/Photos editors.
                       # Courts owns per-court details (name auto-numbered, surface,
                       # thumbnail+photo gallery, description), a per-court booking
                       # policy (approvalMode override of the venue's approval +
                       # turnoverMinutes buffer between bookings) AND each court's own
                       # operating hours (+ hours pricing, via WeeklyHoursEditor);
                       # Closures = venue-wide holiday dates only (operating hours
                       # moved per-court).
                       # Demand tab: unified demand-analytics (GET /demand/venues/:id) —
                       # 9-signal summary grid, conversion + cancellation rate,
                       # demand-by-hour heatmap, supply summary with occupancy,
                       # quick link to the Leakage funnel + inline pricing suggestions.
      components/      # reusable blocks: OwnerSection/OwnerStat/KpiCard (analytics summary tile
                       # w/ trend delta, used by the Reports dashboard)/VenueCard/OwnerBookingRow/
                       # OwnerGameCard/CompletenessMeter/
                       # BookingLinkShare (the auto-generated …/venues/<slug> booking link +
                       # Copy/Share — on the venue Overview card AND the Listing editor)/
                       # WeeklyHoursEditor (per-court weekly open/close + hours-pricing grid;
                       # loads/saves one court's hours, inherits the venue default until set)
      hooks/           # useOwnerDashboard.ts (shared venues+analytics+bookings+games hook; opts
                       # withBookings/withGames/withAnalytics; exposes analyticsByVenue, bookings, games)
      utils/           # ownerMetrics.ts (revenue bucketing + cross-venue merge helpers)
    organizer/         # organizer console (Phase 3) — entry from Profile "Organize" row →
                       # organizer-hub (gated by organizer.access). Organizers are players who
                       # ALSO run events, so this is an entry point, NOT a tab takeover (cf. owner).
                       # Root = OrganizerHubScreen (tool cards) + organizerDisplay.ts (status
                       # chips + date/time/days formatters). Reuses the same API the web
                       # /organizer console uses — no API changes, no new permissions.
      hooks/           # useOrganizerHub (aggregate hub counts), useVenueOptions (venue picker)
      components/      # OrganizerSection, StatusChip, ParticipantRow (approve/decline OR
                       # attendance+paid — shared by tournaments + open play), AnnouncementsPanel
      tournaments/     # TournamentsScreen (list), CreateTournamentScreen (draft form),
                       # TournamentDetailScreen (overview + participants + announcements +
                       # venue-request + Manage bracket), BracketScreen (orchestrator);
        bracket/       #   EntrantsManager (build/seed), BracketGenerator (format → generate),
                       #   BracketView (round-by-round match cards + standings; no pan/zoom),
                       #   MatchScoreSheet (enter games/walkover in a BottomSheet)
      openplay/        # OpenPlayScreen (series list + create), SessionRosterScreen (roster mgmt)
      rosters/         # RostersScreen (lists + create), RosterDetailScreen (members CRUD)
      venues/          # VenueRequestsScreen (submit + track tournament venue requests)
    admin/             # moderation console (gated by admin.moderation.manage) — entry from
                       # OwnerProfile "Venue claims"/"Post reports" rows (admins) / ProfileScreenV2
                       # "Admin" section (moderators). AdminClaimsScreen (admin-claims) lists submitted
                       # venue-ownership claims (status filter, pending first) and approves /
                       # rejects / requests-more-info on a pending claim with a note relayed to
                       # the claimant. AdminPostReportsScreen (admin-post-reports) lists reported
                       # PickleFeed posts (Pending/Resolved/Dismissed) with the post + author +
                       # reporter + reason → Resolve/Dismiss + "View post". Consumes
                       # listClaims/reviewClaim + listAdminFeedReports/resolveAdminFeedReport in shared/lib/api.ts
                       # (GET/PATCH /api/v1/claims). Reuses the same API the web console uses.
                       # AdminDataToolsScreen (admin-data-tools, System section, gated by
                       # admin.settings.manage): DB snapshot per collection, the "never deleted"
                       # preserve list (admins, roles, appsettings, Gmail-token file, uploads/images),
                       # a step-checklist seed runner with live polled job log, and the danger-zone
                       # wipe sheet (typed DELETE ALL DATA + password; dry-run preview on by default;
                       # optional orphaned-uploads sweep). Consumes getDataStatus/runDataSeed/
                       # runDataTruncate/getDataJob in shared/lib/api.ts (/api/v1/admin/data/*).

  shared/              # cross-feature only (never import a feature from another feature)
    components/ui/      # Icon, Avatar, Button, Card, Chip, StatusChip (one pill for every
                        #   {label,className} descriptor — bookingDisplay's + organizerDisplay's;
                        #   moved up from features/organizer/components/, which re-exports it),
                        #   BottomSheet, AuthPromptSheet,
                        # AvatarCropper (circular photo crop via croppie; used by EditProfile),
                        # MapPinPicker (tap/drag-to-drop-pin Leaflet map; the new-venue form and
                        #   EditProfile reverse-geocode the pin to auto-fill the address),
                        # ChatThread (shared Messenger-style group-chat thread — used by
                        #   GameChatScreen + tournaments/v2/TournamentChatScreen),
                        # PublicProfileHero (Threads-style public-profile header — name+handle,
                        #   round avatar top-right, bio, detail line, stats row, two-button action
                        #   row, optional tab strip; shared by CoachDetailScreen + PlayerProfileScreen
                        #   so they render identically; wrap in a `.pb-v2 .px-profile` scope),
                        # EmptyState/ErrorState/LoadingSkeleton (v1) +
                        #   V2Skeleton (v2.1 player-screen skeletons, card-shaped),
                        #   DemoBranch, Toast,
                        # NotificationBadge (live unread-count bubble — reads notificationStore),
                        # Dropdown (the one on-brand select/sort menu — field + pill
                        #   variants, portalled so cards' overflow never clips it),
                        # HourSelect, CourtPicker (pick which court to book/host),
                        # CalendarDatePicker (month-grid date picker),
                        # Chart (dependency-free BarChart/LineChart/Sparkline/Heatmap/DonutChart), … (see folder)
    components/layout/  # TabBar (mobile), Sidebar (desktop)
    components/forms/   # FormField, FormSelect (renders Dropdown), FormTierPicker,
                        # AddressAutocomplete (true type-ahead address/place field —
                        # debounced /geocode/suggest list, keyboard nav; pick → parsed
                        # city/region/line1/postcode + coords. Used by onboarding step 2,
                        # the new-venue form, and the LocationEditor pin search)
    hooks/              # useForm, useTheme, usePrefersReducedMotion, useDragScroll
                        #   (drag/wheel-pan a .scroll-x carousel on desktop), useVenueAvailability
                        #   (per-hour availability → greys out taken hours; pass a courtId to
                        #    scope it to that court, else the whole-venue pool; exposes
                        #    ready/checkFailed/reload so the booking flow fails closed — holds
                        #    "Continue" until the check loads instead of waving a taken slot through),
                        #   useDemandTracking (typed fire-and-forget demand-signal capture —
                        #    search, venue_view, booking_attempt/completed, checkout_started/
                        #    abandoned, booking_link_shared),
                        #   useCountdown (ticking clock for deadline labels — 30s, and stops
                        #    itself once the deadline passes; pairs with bookingDisplay's
                        #    countdownLabel on the request-to-book countdowns),
                        #   useNotificationPolling (keeps the unread badge live: polls +
                        #    refreshes on focus/visibility while signed in — now a fallback),
                        #   useMessagePolling (polls unread message count for the sidebar/tab-bar
                        #    Messages badge — same focus/visibility-refresh pattern),
                        #   useFriendRequestPolling (same pattern for the Social tab's
                        #    pending friend-request badge; also refreshes on the realtime
                        #    'notification' bus event, and zeroes when logged out),
                        #   useRealtimeStream (one app-wide EventSource to GET /api/v1/me/stream;
                        #    fans new notifications + incoming messages onto the realtime bus)
    lib/                # navigation.ts, permissions.ts, authStore.ts, api.ts, venueDisplay.ts,
                        # geo.ts (distance/geolocation), demoState.tsx, skillTiers.ts, initials.ts, types.ts,
                        # roleDisplay.ts (ROLE_META label+colour + primaryRole — shared profile role badges),
                        # notificationStore.ts (Zustand: live unread count + refresh, for the badge),
                        # messageStore.ts (Zustand: live unread message count + refresh, for the
                        #   sidebar/tab-bar/V2TopNav Messages badge),
                        # friendRequestStore.ts (Zustand: pending friend-request count +
                        #   refresh — drives the Social tab badge; `loaded` gates the
                        #   Social landing rule so a cold load doesn't read 0),
                        # realtimeBus.ts (tiny in-app pub/sub; useRealtimeStream publishes, screens subscribe),
                        # adminSectionPrefs.ts (which admin-console nav sections are open —
                        #   persisted, shared by the desktop Sidebar + mobile AdminDrawer)
                        # (games formatters live in features/games/gameDisplay.ts, next to the screens)
    styles/index.css    # Tailwind + all design tokens (--primary, --lime, --coral, shadows…)
```

## Key shared modules (know these before touching behavior)

- **`shared/lib/navigation.ts`** — `Screen` union, `ScreenId`, `tabScreens`, `Navigate`.
- **`shared/lib/permissions.ts`** — roles → permissions, `AppUser`, `userHasPermission`, `firstNameOf`.
- **`shared/lib/authStore.ts`** — Zustand store: `user`, `isLoggedIn`, and the
  `login`/`logout`/`restore`/`updateProfile`/`completeOnboarding` actions. Read it directly
  with `useAuthStore((s) => s.user)` instead of threading the user through props. Wraps `api.ts`
  (`updateProfile`/`completeOnboarding` → `PATCH /me`).
- **`shared/lib/api.ts`** — the API client. Auth (login/logout/`/me`) with token storage in
  `localStorage` + `toAppUser`, **and** venues/courts (`listVenues`/`getVenue` →
  `ApiVenue`/`ApiVenueDetail`). Talks to the Hono API (relative in dev via the Vite proxy;
  `VITE_API_BASE_URL` in prod). `shared/lib/venueDisplay.ts` holds the venue formatters
  (price/location/tags/amenities/`mapsUrl`). Also carries the **owner** endpoints
  (`listOwnerVenues`/`getOwnerVenue`/`updateVenue`/`createVenue`, courts/hours/closures/faqs/
  reviews CRUD, `uploadVenueMedia`, `submitVenueClaim` (claim an unclaimed listing), `fetchCities`/`geocodePlace`/`suggestPlaces` (type-ahead address list), plus the owner bookings inbox
  `getVenueBookings`/`updateBookingStatus` and `getVenueAnalytics`→`OwnerAnalytics`) + their
  `Owner*` types, **and
  the games endpoints** (`listGames`/`getGame`/`createGame`/`joinGame`/`leaveGame` → `ApiGame`);
  `features/games/gameDisplay.ts` holds the game formatters (day/time/location/title/spots).
- **`shared/lib/appLaunch.ts`** — installed-app hand-off: `isStandalone()`, `detectInstalledApp()`
  (`navigator.getInstalledRelatedApps()`, backed by the manifest's self-referencing
  `related_applications`; falls back to a remembered `appinstalled` flag), and
  `androidHandoffUrl()` (the `intent://` URL that opens the installed WebAPK). Driven by
  `shared/components/ui/OpenInAppGate.tsx`, mounted in `App.tsx`.
- **`shared/lib/game-link.ts`** — `extractGameUrl(body)` detects game URLs in text
  (`/games/<id>` or full URLs) and extracts the game ID; `apiGameToCardData(game)`
  maps an `ApiGame` → `GameLinkCard` (used by the club chat send wrappers).
- **`shared/lib/demoState.tsx`** — `DemoStateProvider`/`useDemoState`; lets reviewers flip
  normal/empty/loading/error/offline. Screens branch on it via `DemoBranch`.
- **`shared/styles/index.css`** — design tokens + most component classes (`.avatar`,
  `.game-row`, `.tabbar`, `.sticky-cta`, …). Prefer tokens over hard-coded hex.

## App behavior worth knowing

- **Guest-first flow:** cold start lands on the **home tab as a guest** (not the
  landing page). Guests browse everything; **commit actions** (join a game, create
  a game/club, the "You"/profile tab) are soft-gated by `requireAuth(intent)` in
  `App.tsx`, which opens `AuthPromptSheet` → login. Screen-level gates are driven
  by `SCREEN_PERMISSIONS` + `SCREEN_AUTH_INTENT` in `App.tsx`; the Join button is
  gated via the `onRequireAuth` prop on `GameDetailsScreen`.
- **Login is live against the API:** `LoginScreen` calls `useAuthStore().login()` →
  `POST /api/v1/auth/login`, stores tokens, and the user populates the greeting, profile,
  sidebar, etc. On cold start `App.tsx` calls `authStore.restore()` to revalidate a stored
  token via `/me`. **Profile edits save to the account** (`EditProfileScreen` → `updateProfile`
  → `PATCH /me`) and **onboarding is remembered** via a `hasOnboarded` flag on the user
  (set by `completeOnboarding`); `App.tsx` only onboards when `!user.hasOnboarded`. Profile
  *stats* (win rate, streak, achievements) are still demo data — only identity fields come from the API.
- **Nearby tab is live** (the tab labelled "Nearby"; `nearby` screen id): `NearbyScreen` lists venues and `CourtDetailsScreen` loads one
  from `/api/v1/venues` (see `api.ts`/`venueDisplay.ts`). Both own their loading/error/empty
  states. The list **paginates** (20/page via "Load more" using the API cursor) and shows
  venue **images** (media-derived) with a gradient fallback. **Near me:** the "Near me"
  chip / locate button asks for the user's location (`shared/lib/geo.ts`) and shows the
  courts *near them* — locatable venues only, ranked nearest-first and capped to a radius
  (default 10 km, adjustable in the sheet; `resolveNearby`), with a nearest-few fallback —
  not the whole directory. **Open to guests** (browse aid); `player.venues.locate` only governs signed-in
  users (`!isLoggedIn || userHasPermission(...)`). **Filters narrow the list too:** the quick
  chips (Games here / Indoor / Free / Lighted) and the `NearbyFilterSheet` (court type, price,
  open play, distance cap, amenities) edit one `VenueFilters` state applied via `matchesFilters`
  (`venueFilters.ts`). Filtering or locating switches the list to the full set (so a filter
  can't hide matches on unfetched pages); otherwise it stays the server-paged directory. Real
  data is sparse (ratings/coords often null) so fields degrade gracefully. **Court detail is
  fully live:** its location card renders a real Leaflet map at the venue's coords (falls back
  to the decorative pin box when a venue has no lat/lng), and the **"Games here"** list loads
  real games hosted at the venue via `listGames({ venueId })` (matched by the game's fixed
  `venueId`) — own loading/empty/error states; nothing on this screen is demo anymore.
- **Games tab is live:** `GamesScreen` has two top tabs — **Booking** and **Games**.
  **Booking** is the court-bookings view (`listBookings`/`cancelBooking`) with a **calendar ⇄
  list** toggle (month grid dots days that have bookings; tap a day to see its cards). **Games**
  holds the **My Games / Browse** sub-tabs: **Browse** = public published games from
  `/api/v1/games`, grouped into date sections with rich cards (time rail, roster avatars,
  spots/skill); **My Games** = games you created or joined, as commitment cards with a status
  accent (HOSTING/GOING). `GameDetailsScreen` loads one via
  `getGame` and **Join** calls `joinGame` (soft-gated by `onRequireAuth`; spots/roster are
  server-derived). A game's roster **is** its lobby: when it fills the **host** sees a
  "lobby full — ready to play" banner **and** gets a real notification in their inbox (the API
  emits a `game_full` `Notification` to the creator on the join that fills the game — see the
  Notifications note below); **joiners** get a **Leave game** action governed by the
  `LOBBY_LEAVE_GRACE_PERIOD_DAYS` rules in `gameDisplay.ts` (`isLobbyFull`/`isWithinGracePeriod`/
  `canLeaveLobby`) — leaveable while the lobby has openings, or when full and the game is still
  >N days out; a full lobby inside the window locks the spot in (final/non-refundable). Joining
  **within** that window first asks for confirmation in a no-refund modal. The rule is enforced
  in the UI **and** on the server — `leaveGame` returns 409 `LOBBY_LOCKED` if a non-host tries to
  leave a full lobby inside the window. `CreateGameScreen` is **venue-first**: a 3-step wizard (pick a priced court
  via `listAllVenues` + search → date + start/end time with a live `rate × hours` cost → game
  details) ending in a **payment** step that books the court (`createBooking` → `checkout`) and
  then posts a fixed-venue game (`createGame` with `venueId` + the booking's `bookingId`). With a
  `gameId` prop it instead renders the **manage** form — edit type/skill/name/spots/visibility
  (`updateGame`) and remove players (`kickPlayer`); venue + schedule are read-only. There is **no
  vote/lobby flow** — games are joinable immediately and open in `GameDetailsScreen`.
  Gated by `player.games.create` (`SCREEN_PERMISSIONS`); creating also exercises
  `player.bookings.create` (the host books the court). Browse **date grouping** is client-side
  over all upcoming published games; the **quick chips + `GameFilterSheet` now filter for real**
  (client-side via `gameFilters.ts` — when/skill/type/has-openings; both edit one `GameFilters`
  state, the header button shows an active-filter count). The search box was removed; the
  Game-Details **chat** is live (`GET|POST /games/:id/messages`), and so is Open Play's —
  see the games slice notes above.
- **Social tab = Clubs + Friends.** Both are "people I play with", so they share one
  tab (`social`, path `/social?tab=clubs|friends`). Friends used to sit three taps deep
  in Profile and nobody found it; it is now half of a top-level tab, and the **badge**
  on that tab (pending friend requests) is what actually surfaces it. Landing on a bare
  `/social`: Friends if requests are waiting, else Clubs — so existing club members see
  no change. The tab is **public** (Clubs is guest-browsable); the auth gate lives inside
  `FriendsPanel`, not in `SCREEN_PERMISSIONS`. `/clubs` and `/friends` remain as
  back-compat aliases onto the right panel, and `tabForScreen` maps the whole club
  family + `friends` → `social`.
- **Clubs are live** (the Clubs half of the **Social** tab, plus the home **Clubs**
  quick-action):
  `ClubsPanel` lists your clubs (`listClubs({ mine: true })`) + a
  Discover directory (`listClubs()`, your clubs filtered out), with server-side search.
  `ClubDetailsScreen` (mounted with `clubId`) loads the club, members, and a
  **Facebook-style feed** — members post (`createClubPost`) and like (`react/unreactClubPost`),
  tapping a post opens the single-post permalink (`ClubPostScreen`), and a post's author edits it
  on a **dedicated page** (`ClubPostEditScreen` → `editClubPost`, opened from the ⋯ menu in both the
  feed and the permalink — comments still edit inline);
  members also get a **live member group chat** separate from the feed (`ClubChatScreen` →
  `listClubMessages`/`sendClubMessage`, realtime via the `club.message` SSE event; a "Club chat" entry
  on the detail, gated by `player.clubs.chat`);
  and anyone can join/leave (`joinClub`/`leaveClub`); the host can't leave but can **edit**
  (`EditClubScreen` → `updateClub`) or **delete** the club (`deleteClub`) from the ⋯ menu,
  which also carries an **invite/share** link
  (`/clubs/<slug>`, native share or clipboard). Arriving via that link shows a welcome modal
  (`invited` prop). Feed/members refetch on tab switch. `CreateClubScreen`
  posts to `createClub` then opens the new club (`replace` so Back skips the wizard); `EditClubScreen`
  prefills + `PATCH`es, then Back remounts the detail with fresh data. Gated by
  the `player.clubs.*` permissions (create/join/post/react/chat; edit reuses `player.clubs.create` + host-ownership). Clubs client lives in `shared/lib/api.ts`. (No club-events surface —
  the old Events tab was dropped; nested post replies aren't shown in the app yet.)
- **Notifications are live** (Profile → bell): `NotificationsScreen` reads the user's real inbox
  (`listNotifications`/`markNotificationRead`/`markAllNotificationsRead` → `/api/v1/notifications`,
  in the API's `interactions` slice). Rows tap through when their `linkUrl` is a known app path
  (currently `/games/:id` → game-details). Today the only producer is the games **`game_full`**
  notification (host's lobby filled); gated by the existing `user.notifications.manage`.
- **Web Push (real OS notifications)** delivers those alerts even with the app closed.
  `shared/lib/push.ts` (`enablePush`/`refreshPushSubscription`/`unbindPushOnLogout`/`disablePush`)
  subscribes the device via the service worker and registers it (`/api/v1/push/*` in `api.ts`); the
  SW push/notificationclick handlers live in `public/push-sw.js` (pulled into the Workbox-generated
  SW via `vite.config` `workbox.importScripts`). `NotificationsScreen` shows a "Turn on push" prompt
  (gated by `user.notifications.manage`); `authStore` re-binds the device on login/restore and
  unbinds on logout. The API signs + sends with VAPID when a game fills.
- **Owner console:** users with `owner.access` see a **"My venues"** row in the Profile
  ("You") tab → `owner-venues`. `OwnerVenuesScreen` lists their venues (live, via
  `listOwnerVenues`); `OwnerVenueScreen` is a single screen with an in-screen tab strip
  (Overview/Listing/Location/Courts/Closures/FAQs/Reviews/Photos) editing live API data
  (operating hours are per-court, inside the Courts tab; Closures = venue-wide dates);
  `OwnerNewVenueScreen` creates one; `ClaimVenueScreen` (`claim-venue`, gated by
  `owner.venues.claim`) searches the directory for an **unclaimed** listing and submits an
  ownership claim with proof + ID upload (claimant tracks status + resubmits on `needs_info`).
  An admin reviews it in `features/admin/AdminClaimsScreen` (`admin-claims`) → on approve the
  venue becomes `claimed` + links to the owner. All gated by `SCREEN_PERMISSIONS` in `App.tsx`.
  Same API the web `/owner/` console uses; no API changes. (Known gaps mirror web: photos
  are upload-only, address text/city are staff-managed, no token refresh on 401.)
- **Organizer console (Phase 3):** users with `organizer.access` see an **"Organize"** row
  in Profile (both designs) → `organizer-hub`. From the hub: **Tournaments** (create draft →
  request venue → open registration → manage participants/payments → announcements →
  bracket: build/seed/generate/score → standings), **Open Play** (recurring series + per-session
  roster), **Player Lists** (reusable rosters), **Venue Requests**. All `features/organizer/`,
  gated by `organizer.*` via `SCREEN_PERMISSIONS`; reuses the web `/organizer` + bracket API
  (no API/route/permission changes). The bracket is mobile-adapted (round-by-round cards +
  a score BottomSheet, not the web's pan/zoom canvas). Out of scope: co-host assignment
  (net-new, needs API), leagues/seasons, and v2.1-redesigned variants of these screens.
- **Player design — "Pickleballers Mockup v2.1":** v2.1 is the **only** player
  design. The legacy New/Classic variants, their floating toggle
  (`DesignSwitch`/`HomeScreenSwitch`), and the `playerDesign` store (`pb-home-design`)
  were removed — every player/guest now sees the "Pickleballers Mockup v2.1"
  redesign: `features/*/v2/*ScreenV2`
  (Home/Nearby/Games/Clubs/Profile/Settings + `CreateGameV2`/`CreateClubV2`, all wired to the
  same live API + formatters as the v1 screens). In v2.1 the **"Game On"** create
  action opens `games/v2/CreateChoiceSheet` (an app-level BottomSheet, `App.tsx`):
  **Join** → Games browse; **Host a lobby** → pick one of your hostable bookings
  (`listBookings` minus already-hosted/cancelled/past) or, with none, go to
  **Nearby** (`intent:'lobby'` → "select a court" banner + a book→create-lobby
  hand-off via `court-details`/`book-court`). `CreateGameV2` then hosts a lobby on
  that **existing booking** — it loads the reservation (`getBooking`), locks
  venue/date/time, and only `createGame({ bookingId })` (no inline book/pay; that
  happened up-front in the Book flow). The v2 screens share chrome from
  `shared/components/layout/V2Chrome.tsx` (`V2Shell`/`V2TopNav`/`V2TabBar`/`V2Fab`)
  and styling from `shared/styles/v2.css` — every rule scoped under `.pb-v2.v2-<screen>`
  (auto-ported from the mockup). For players `App.tsx` suppresses the app's own
  mobile TabBar (v2 supplies its own); the desktop Sidebar stays.
  **Owners** never see v2 (gated by `!owner.access`; `App.tsx` keys this off
  `playerV2 = !isOwner`): they keep their owner dashboards on Home/Nearby/Games and
  fall through to the **retained v1 player screens** for Clubs/Profile/Settings/Create-club.
  `CreateGameScreen` (v1) is also retained for the `edit-game` route — `CreateGameV2`
  only creates, it has no edit mode.
- **Player home (`v2/HomeScreenV2`):** the home **hero is live**: your next
  commitment is the **soonest of your
  games (`listGames({ mine: true })`) and court bookings (`listBookings()`)** —
  a court booking renders the same hero (party size instead of a roster, opens
  My bookings); else it features the best open game (`listGames({ status:
  'published' })`); else the create-a-game prompt. **Open games near you**
  (`listGames({ status: 'published' })`) is a live list, and **Courts to book** is
  **location-aware**: it best-effort requests the user's location (`geo.ts`), and
  once located pulls the full directory (`listAllVenues`) to rank courts
  nearest-first with a distance on each card (heading flips to "Courts near you");
  with no location it falls back to the plain `listVenues({ pageSize: 6 })` list.
  The **check-in banner is live**: it shows the busiest venue right now from real
  check-ins (`getCheckInHotspot`) and hides when nobody's checked in. (The in-app
  check-in/out toggle was removed from the court page — `CourtDetailsScreen` is now
  pure details + "Games here"; the `player.venues.checkin` perm/API still exist.)
  Only the streak card stays demo (no player-stats backend).
- **Chrome:** TabBar (mobile) + Sidebar (desktop) render via `App.tsx`; hidden on
  `landing`/`login`/`onboarding`. The mobile v2 TabBar's tabs are **Home · Map ·
  Games · Tournament · Social · Profile** (Social carries a live badge with the
  count of friend requests awaiting your answer — `useFriendRequestStore`); the legacy/owner chrome also includes
  a Tournament tab. The old center **+** create-FAB was removed in favour of a Clubs
  tab; create a game from the home "Create match" quick-action. The desktop Sidebar still
  carries the create FAB (`onCreate`/`canCreate` props remain for it).

## Conventions (brief — full rules in CLAUDE.md / AGENTS.md)

- Feature slices import cross-feature code only through `shared/`. No `../../../`.
- Don't recreate flat `src/{screens,components,hooks,lib}/` — removed in the slice migration.
- Tailwind classes inline; colors via CSS-var tokens. Loading = `LoadingSkeleton`, not spinners.
- New top-level docs → `../docs/`, screenshots → `../docs/screenshots/`, scripts → `../scripts/`.
- A meaningful change (new/removed screen, flow change, big refactor) also requires a
  roadmap update in `../web/.../RoadmapPage.jsx` — see CLAUDE.md.

## Where to look first, by task

| Task | Open first |
|---|---|
| Navigation / new screen / auth-or-guest flow | `App.tsx`, `shared/lib/navigation.ts` |
| Player UI ("Pickleballers Mockup v2.1" — the only player design) | `features/*/v2/*` (the v2 player screens), `shared/components/layout/V2Chrome.tsx`, `shared/styles/v2.css` (wired in `App.tsx` via `playerV2 = !isOwner`) |
| Login / current user / session | `shared/lib/authStore.ts`, `shared/lib/api.ts`, `LoginScreen.tsx` |
| Nearby tab / courts (list + detail, distance sort, filters) | `features/venues/NearbyScreen.tsx`, `CourtDetailsScreen.tsx`, `NearbyFilterSheet.tsx`, `venueFilters.ts`, `shared/lib/venueDisplay.ts`, `shared/lib/geo.ts` (owners get `features/owner/OwnerNearbyScreen.tsx` — a "your venues" ops map) |
| Games tab (browse/mine, create, detail, join) | `features/games/{GamesScreen,GameDetailsScreen,CreateGameScreen}.tsx`, `gameDisplay.ts`; games endpoints in `shared/lib/api.ts` |
| Player Tournament tab (browse + register) | `features/tournaments/v2/TournamentsScreenV2.tsx` (browse — **role-aware tabs**: Open · Managing/Joined · Results, see below), `v2/TournamentDetailScreen.tsx` (detail + register/withdraw + Chat entry), `v2/TournamentChatScreen.tsx` (participant group chat), `tournamentDisplay.ts`; tournament client (`listPublicTournaments`/`register`/`withdraw`/`getMyTournamentRegistration`/`listMyTournamentRegistrations`/`listTournamentMessages`/`sendTournamentMessage`) in `shared/lib/api.ts`; mounted as the `tournaments` tab + `tournament` detail + `tournament-chat` in `App.tsx` / `shared/lib/navigation.ts`. **Role-gated** by `canSeeTournaments = !isOwner && !isAdmin` in `App.tsx` — players/coaches/organizers see the tab (join/leave only); owners/admins don't (dropped from `V2TabBar`/`TabBar`/`Sidebar`). Organizer tournament CRUD stays in `features/organizer/tournaments/`. |
| Create a game (venue-first + pay) | `features/games/CreateGameScreen.tsx` — `CreateGameWizard`: court → date/start-end → details → `createBooking`+`checkout`+`createGame`; gated by `player.games.create` (+ `player.bookings.create`) |
| Manage games you created (edit details, kick, delete) | `features/games/MyGamesScreen.tsx` (from Profile → "My games") **and** inline on the Games tab's "My Games" rows (`GameManageActions.tsx`); editing reuses `CreateGameScreen` with a `gameId` prop (the `ManageGameScreen` form: edit details + remove players via `kickPlayer`); `updateGame`/`deleteGame`/`kickPlayer` in `shared/lib/api.ts`; gated by `player.games.manage` |
| Payment history / spend report (player) | `features/profile/PaymentHistoryScreen.tsx` (entry rows in `ProfileScreen.tsx` + `v2/ProfileScreenV2.tsx`); `listPayments` in `shared/lib/api.ts` → `GET /api/v1/payments` (self-scoped); `shared/components/ui/Chart.tsx` `BarChart`; gated by `player.payments.view` (`SCREEN_PERMISSIONS` in `App.tsx`) |
| Direct messages / chat (realtime) | `features/messages/{ConversationsScreen,ChatScreen}.tsx`; messaging endpoints in `shared/lib/api.ts`; entry from `GameDetailsScreen` "Message organizer" + Profile → Messages; deep-link `/messages/:id` via `navigation.ts`; gated by `user.messages.send`. Realtime via `shared/hooks/useRealtimeStream.ts` + `shared/lib/realtimeBus.ts` (SSE `GET /api/v1/me/stream`) |
| Live message badge (unread) | `shared/lib/messageStore.ts` + `shared/hooks/useMessagePolling.ts` (started in `App.tsx`); badge on `Sidebar.tsx` Messages button (`.side-tab-badge`), `TabBar.tsx` Messages tab (`.tab-unread-badge`), and `V2Chrome.tsx` V2TopNav Messages icon (`.v2c-notif-badge`) |
| Request-to-book approval deadlines (player + owner countdowns) | Formatters in `features/bookings/bookingDisplay.ts`, ticking via `shared/hooks/useCountdown.ts`. Player: `CourtPicker` "Needs approval" chip, the review-step block + completion copy in `BookCourtScreen.tsx`, the live countdown in `MyBookingsScreen.tsx`. Owner: the chip in `features/owner/components/OwnerBookingRow.tsx` (reaches all four inbox surfaces), deadline-ascending sort in `hooks/useOwnerDashboard.ts`, window settings in `tabs/ListingEditorTab.tsx`. Server-side truth: `api/src/features/bookings/bookingDeadlines.ts` |
| Realtime stream (chat + notifications) | `shared/hooks/useRealtimeStream.ts` (one EventSource, mounted in `App.tsx`) + `shared/lib/realtimeBus.ts` (in-app pub/sub); backed by API `GET /api/v1/me/stream` |
| Live notification badge (unread) | `shared/lib/notificationStore.ts` + `shared/hooks/useNotificationPolling.ts` (started in `App.tsx`); `shared/components/ui/NotificationBadge.tsx` on the home bell + TabBar "You" tab |
| Global search (courts/games/clubs/players) | `features/search/SearchScreen.tsx`; `crossSearch` in `shared/lib/api.ts` → `GET /api/v1/search?type=all`; gated by `player.search.use` |
| Permissions / role gating | `shared/lib/permissions.ts`, `SCREEN_PERMISSIONS` in `App.tsx` |
| Coach subscription / Find Coach / book a coach / coach rates | `features/coaches/` (entry: Profile tab → "Coaching"; the Home `.coach-cta` only links there). ⚠️ Gate the subscribe CTAs on **`user.coachSubscriptionActive`**, never on `roles.includes('coach')` — a venue owner approving a coach application grants that role with **no** subscription, and the role survives a lapsed one. ⚠️ Subscribing does **not** create a `Coach` profile — only a venue owner approving an application does, so a subscriber with no approval has no listing and no rates screen. Rates (standard + per-venue) live in `CoachPricingScreen` → `updateMyCoach`. Backed by `api/src/features/partner-subscriptions/` + `coach-bookings/` |
| Another player's public profile | `features/profile/PlayerProfileScreen.tsx` (`player-profile`, `/players/:id`); `getPublicUser` in `shared/lib/api.ts` → `GET /api/v1/users/:id`; badges via `shared/lib/roleDisplay.ts` |
| Venue-owner console (manage venues) | `features/owner/` (entry row in `ProfileScreen.tsx`); owner endpoints in `shared/lib/api.ts` |
| Owner subscription plans (membership tiers) | `features/owner/SubscriptionPlansScreen.tsx` (`owner-subscription-plans`, from Members tab "Manage Subscription"), `features/owner/components/CreateEditPlanSheet.tsx` (create/edit form), `shared/lib/api.ts` → `listSubscriptionPlans`/`createSubscriptionPlan`/`updateSubscriptionPlan`(versioning)/`deleteSubscriptionPlan`/`duplicateSubscriptionPlan`/`toggleSubscriptionPlan`/`listPublicPlans`/`subscribeToPlan`; player-side: `MembershipSheet.tsx` uses `listPublicPlans` when the owner has active plans (falls back to hardcoded defaults); backed by `SubscriptionPlan`/`SubscriptionPlanVersion`/`VenueSubscription` models in `api/src/features/venues/` |
| Demand data capture (searches, views, bookings funnel, empty slots) | `shared/hooks/useDemandTracking.ts` (client-side signals); `shared/lib/api.ts` → `recordDemandEvent` / `getVenueDemand` / `getVenueLeakageReport` / `getSuggestedPricing`; owner Demand/Leakage/Insights tabs; backed by `api/src/features/demand/` |
| Front desk — manual/walk-in booking + slot blocking + today's schedule | `features/owner/OwnerFrontDeskScreen.tsx` (`owner-front-desk`, from OwnerHome quick action); `createVenueBooking` in `shared/lib/api.ts` → `POST /venues/:id/bookings`. A manual booking needs a positive amount on both sides (client guard + server `AMOUNT_REQUIRED`) |
| How a booking ENDS (no-show / refund / reschedule delta / walk-in) | Owner: `features/owner/OwnerBookingDetailSheet.tsx` (Mark no-show → `markBookingAttendance`) + `OwnerFrontDeskScreen.tsx` (walk-in amount). Player: `features/bookings/MyBookingsScreen.tsx` (refund + no-show detail rows), `ModifyBookingSheet.tsx` (`priceDelta` copy), `bookingDisplay.ts` (No-show chip). Types `attendance`/`noShowFeeAmount`/`refund` on `ApiBooking`, plus `markBookingAttendance`/`listPendingRefunds`/`settleRefund` in `shared/lib/api.ts`. Server truth: `api/src/features/bookings/bookingEndings.test.ts` |
| Opening hours &amp; pricing grid (when a venue is OPEN, and what it costs) | `features/owner/OwnerPricingScreen.tsx` (`owner-pricing`). ⚠️ This grid **is** the operating schedule, not just a rate card — an unpainted hour is **closed**, not "open at the default rate". Two layers: **Save Schedule** writes per-date `SlotPriceOverride` rows for the week on screen (exceptions — holidays, one-off rates); **Save as weekly default** writes the recurring `VenueHour` pattern via `putHours`/`putCourtHours` + flips `useWeeklyPricingDefault` via `updateVenue`, so every future week inherits it and the owner stops repainting weekly. Inherited hours render in their **rule's own colour, faded** (matching by price — the weekly default stores ₱/hr, not a rule id); only priced blocks become the weekly default (Reserved/Maintenance/Closed are per-date). ⚠️ The **Closed** tool is dual-purpose: on an inherited hour it writes an explicit `note:'Closed'` override (else clearing the cell would just fall back to the default and stay open), on an uncovered hour it plain-erases as before. Three reachable states per hour — *priced* · *closed* · *following the default*: a **"Use default"** paint tool (shown only when `weeklyEnabled`) erases the override so the hour inherits again, and a **"Reset this week to the weekly default"** link in the Schedule-window card empties the whole scope (lands on the next Save, since `handleSave` deletes a dirty-but-empty week's overrides and creates nothing). Server resolves override → weekly → closed (`api/src/features/venues/venues.controller.ts`) |
| Manual reservation (dedicated screen; paints the pricing grid) | `features/owner/OwnerManualReservationScreen.tsx` (`owner-manual-reservation`; desktop 2-col: form + venue's upcoming reservations list). Save = `createVenueBooking({ bookingType: 'manual' })` **and** `createSlotOverride({ price: 0, note: 'Reserved' })` so the hours show green on `OwnerPricingScreen`. Entry: Sidebar item on desktop (≥1024px), owner Profile → Manage row on mobile/tablet (`.mtonly` in `v2.css`). Gated by `owner.bookings.manage` |
| Finance &amp; Receipts — the BIR receipt ledger + VAT the owner owes | `features/owner/OwnerFinanceScreen.tsx` (`owner-finance`, `/owner/finance`) — gross / net / **VAT payable** KPIs, status + category chips, search, per-receipt cards → detail sheet, VAT-breakdown-by-category, CSV export. **Read-only**: an `OfficialReceipt` is auto-generated server-side when a booking is paid (`generateReceiptForBooking`), never here. `getOwnerFinance` in `shared/lib/api.ts` → `GET /payments/owner/finance`; roll-up is **paid-only** so a pending/voided/refunded receipt can't inflate VAT payable. Entry: Sidebar item on desktop (≥1024px), owner Profile → Manage row on mobile/tablet (`.mtonly` in `v2.css`). Gated by `owner.reports.view` (owner-only, like `/owner/reports`) |
| Checkout payment options (deposit/full/pay-at-venue) + 7% service fee | `features/bookings/BookCourtScreen.tsx` (review + checkout steps); owner config in `tabs/ListingEditorTab.tsx`; fee % from `getSettings` |
| Admin venue-claim review (approve/reject/needs-info) | `features/admin/AdminClaimsScreen.tsx` (`admin-claims`, gated by `admin.moderation.manage`); entry in `v2/ProfileScreenV2.tsx` → "Admin console" → moderation queues; `listClaims`/`reviewClaim` in `shared/lib/api.ts` |
| Admin reported-post review (resolve/dismiss) | `features/admin/AdminPostReportsScreen.tsx` (`admin-post-reports`, gated by `admin.moderation.manage`); entry in `v2/ProfileScreenV2.tsx` → "Admin console" → moderation queues; `listAdminFeedReports`/`resolveAdminFeedReport` in `shared/lib/api.ts` → `GET|PATCH /api/v1/admin/feed-reports` |
| Admin console (full dashboard port from web) | `features/admin/` — `AdminHubScreen` (KPIs + section nav), `AdminUsersScreen`, `AdminVenuesScreen`, `AdminOwnersScreen`, `AdminCoachesScreen`, `AdminBookingsScreen`, `AdminGamesScreen`, `AdminModerationScreen` (queue overview), `AdminReviewsScreen`, `AdminReviewReportsScreen`, `AdminVenueApprovalsScreen`, `AdminSuggestedEditsScreen`, `AdminSettingsScreen`, `AdminFeatureFlagsScreen`, `AdminRolesScreen`, `AdminDataToolsScreen`, + shared `AdminScaffold.tsx`. Admin API client in `shared/lib/api.ts` (types + fns); all gated by `admin.*` via `SCREEN_PERMISSIONS`. Entry: v2 Profile → "Admin console" (`admin-hub`); desktop Sidebar → "Admin console" item. No API/route change (reuses same endpoints as web `/admin/*`). |
| Seed / wipe the database (launch prep) | `features/admin/AdminDataToolsScreen.tsx` (`admin-data-tools`, `/admin/data-tools`, gated by `admin.settings.manage`); System section of `AdminHubScreen` / `AdminDrawer` / desktop `Sidebar`; `getDataStatus`/`runDataSeed`/`runDataTruncate`/`getDataJob` in `shared/lib/api.ts` → `/api/v1/admin/data/*` (see `api/FILEMAP.md` → `features/data-ops/`) |
| Organizer console (tournaments, brackets, open play, rosters, venue requests) | `features/organizer/` (entry "Organize" row in `ProfileScreen.tsx`/`ProfileScreenV2.tsx` → `organizer-hub`); organizer endpoints in `shared/lib/api.ts`; gated by `organizer.*` perms (`SCREEN_PERMISSIONS` in `App.tsx`). Reuses the web `/organizer` API — no API/route changes |
| Social tab (PickleFeed + Clubs + Friends, the request badge) | `features/social/{SocialScreen,FeedPanel,FeedPostCard,FeedComposerSheet,FeedShareCard,FeedMedia,feedAttachments,FeedPostScreen,RepostQuote,feedTime,ClubsPanel,FriendsPanel}.tsx`; Feed API client in `shared/lib/api.ts` (`FEED_PREFIX`, `uploadFeedMedia`); post photos (per-photo caption) + comment photos/GIFs via `FeedMedia`/`feedAttachments` (GIFs added by pasting from the keyboard/clipboard into the comment field — `onCommentPaste` — or uploading a .gif); per-post ⋯ menu (interested/not-interested/report/hide/notify) via `setFeedSignal`/`hideFeedPost`/`reportFeedPost`/`subscribeFeedPost`; badge = `shared/lib/friendRequestStore.ts` + `shared/hooks/useFriendRequestPolling.ts`, rendered by `V2TabBar` in `shared/components/layout/V2Chrome.tsx`; styles under `.pb-v2.v2-social` in `shared/styles/v2.css`; e2e in `../api/e2e/feed.sh` |
| Colors / spacing / shared CSS classes | `shared/styles/index.css` |
| Install / "open in the app instead of the browser" | Manifest lives in `vite.config.ts` (`pwaManifest` — `handle_links: 'preferred'`, `launch_handler`, self-referencing `related_applications`), served in dev by the `devManifestServer()` plugin and linked from `index.html` (prod runs the DEV server, which the PWA plugin does **not** emit a manifest for). Client: `shared/lib/appLaunch.ts` + `shared/components/ui/OpenInAppGate.tsx` (mounted in `App.tsx`) — **phone/tablet only**, and only when the app is actually installed; desktop and non-installed visitors stay in the browser. `shared/components/ui/InstallPrompt.tsx` is the "Install PickleBallers" popup for **Android phones without the app** (iOS skipped for now): one-tap install via `beforeinstallprompt` when Chrome offers it, browser-menu instructions otherwise, dismissal remembered. `public/install-sw.js` is the deliberately no-op service worker (registered by `appLaunch.registerInstallWorker`, dev-server builds only) that exists solely so Chrome fires `beforeinstallprompt` — ⚠️ it must never cache anything (see the "routing disappeared" history in `ecosystem.config.cjs`) |
| A reusable UI primitive | `shared/components/ui/` (check it exists before building one). `Button` variants: primary/brand/dark/outline/ghost/`destructive` (soft red) / `danger` (solid red, for unmissable destructive actions) |
| A specific screen's content | `features/<slice>/<Name>Screen.tsx` |
| Empty/loading/error states | `DemoBranch` + `EmptyState`/`ErrorState`/`LoadingSkeleton` (v1/owner) or `V2Skeleton` (v2.1 player screens) |

> Keep this file current when structure or core flow changes — it's only useful if it's true.
