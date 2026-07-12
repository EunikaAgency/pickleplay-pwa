const BASE_STYLE = `
  :root { color-scheme: light dark; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; margin: 0; padding: 32px; background: #0b1220; color: #e2e8f0; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .sub { color: #94a3b8; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #1e293b; vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
  td.methods { white-space: nowrap; width: 1%; }
  td.path code { color: #f1f5f9; background: #1e293b; padding: 2px 6px; border-radius: 4px; }
  td.path a { color: #f1f5f9; background: #1e293b; padding: 2px 6px; border-radius: 4px; text-decoration: none; }
  td.path a:hover { background: #334155; text-decoration: underline; }
  td.desc { color: #cbd5e1; }
  .m { display: inline-block; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.04em; }
  .links { margin-top: 16px; display: flex; gap: 12px; flex-wrap: wrap; }
  .links a { color: #f1f5f9; background: #1e293b; padding: 8px 14px; border-radius: 6px; text-decoration: none; font-weight: 500; }
  .links a:hover { background: #334155; }
  .status-ok { display: inline-block; padding: 2px 8px; background: #16a34a; color: #fff; border-radius: 4px; font-weight: 600; font-size: 12px; }
  .ts { color: #94a3b8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
  thead th { position: sticky; top: 0; background: #0b1220; z-index: 1; }
  tr.group td { padding: 30px 12px 8px; border-bottom: none; }
  tr.group:first-child td { padding-top: 8px; }
  tr.group .label { display: block; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; font-weight: 600; padding-bottom: 6px; border-bottom: 1px solid #334155; }
  td .lock { display: inline-block; color: #94a3b8; font-size: 11px; margin-left: 6px; padding: 1px 5px; background: #1e293b; border-radius: 3px; }
`;

function htmlShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${BASE_STYLE}</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function getHealth(c: any) {
  const ts = new Date().toISOString();
  return c.html(htmlShell('Pickleballers API — Health', `
<h1>Health check</h1>
<div class="sub">Status: <span class="status-ok">OK</span></div>
<div class="ts">${ts}</div>
<div class="links">
  <a href="/">Home</a>
  <a href="/lists">Endpoints</a>
</div>
`));
}

export function getHome(c: any) {
  return c.html(htmlShell('Pickleballers API', `
<h1>Pickleballers API</h1>
<div class="sub">Status: <span class="status-ok">OK</span> &middot; Version: <strong>v1</strong></div>
<div class="links">
  <a href="/health">Health</a>
  <a href="/lists">Endpoints</a>
</div>
`));
}

type Endpoint = { path: string; methods: string[]; description: string; auth?: 'user' | 'admin'; sampleQuery?: string };
type Group = { name: string; endpoints: Endpoint[] };

export function listEndpoints(c: any) {
  const groups: Group[] = [
    {
      name: 'Root',
      endpoints: [
        { path: '/', methods: ['GET'], description: 'API home (HTML)' },
        { path: '/health', methods: ['GET'], description: 'Health check (HTML)' },
        { path: '/lists', methods: ['GET'], description: 'This route list (HTML)' },
        { path: '/api/tables/data', methods: ['GET'], description: 'DB collection stats' },
        { path: '/images/venues/:slug/:file', methods: ['GET'], description: 'Static venue photos (mirrored from uploads/)' },
      ],
    },
    {
      name: 'Auth',
      endpoints: [
        { path: '/api/v1/auth/register', methods: ['POST'], description: 'Create a new account; accepts role (player|coach|owner|organizer)' },
        { path: '/api/v1/auth/login', methods: ['POST'], description: 'Log in, get access + refresh tokens' },
        { path: '/api/v1/auth/refresh', methods: ['POST'], description: 'Exchange a refresh token for a new access token' },
        { path: '/api/v1/auth/logout', methods: ['POST'], description: 'Invalidate the current session' },
        { path: '/api/v1/auth/forgot-password', methods: ['POST'], description: 'Request a password-reset token for an email (returns token inline when no EMAIL_FROM is set; otherwise emails it)' },
        { path: '/api/v1/auth/reset-password', methods: ['POST'], description: 'Set a new password with a valid reset token — body { token, password }' },
        { path: '/api/v1/auth/verify-email', methods: ['POST'], description: 'Verify an email address with a token — body { token }' },
        { path: '/api/v1/auth/resend-verification', methods: ['POST'], description: 'Resend the email verification token for the current user', auth: 'user' },
        { path: '/api/v1/auth/gmail-oauth-url', methods: ['GET'], description: 'Returns the Google consent URL for Gmail OAuth setup (admin-only one-time setup)' },
        { path: '/api/v1/auth/gmail-callback', methods: ['GET'], description: 'Google OAuth redirect — exchanges code for Gmail tokens and stores them' },
        { path: '/api/v1/auth/gmail-status', methods: ['GET'], description: 'Check whether Gmail is configured and authorized for sending email' },
        { path: '/api/v1/auth/me', methods: ['GET', 'PATCH'], description: 'Current user profile', auth: 'user' },
      ],
    },
    {
      name: 'Discovery',
      endpoints: [
        { path: '/api/v1/search', methods: ['GET'], description: 'Cross-entity search — requires ?q=; ?type=venues|coaches|players|games|clubs narrows it, ?type=all returns the full set (courts/games/players/clubs/coaches) for global search; no type = legacy venues+coaches', sampleQuery: '?q=zone' },
        { path: '/api/v1/geocode', methods: ['GET'], description: 'Forward-geocode an address/place to coordinates (proxies OSM Nominatim) — requires ?q=, optional ?country=ph', sampleQuery: '?q=SM Mall of Asia' },
        { path: '/api/v1/geocode/suggest', methods: ['GET'], description: 'Type-ahead address suggestions — a ranked list of places (lat/lng + city/region/area/street line1/postcode) for an address being typed (proxies OSM Nominatim) — requires ?q=, optional ?country=ph&limit=', sampleQuery: '?q=SM Mall of&country=ph' },
        { path: '/api/v1/geocode/reverse', methods: ['GET'], description: 'Reverse-geocode coordinates to a place + nearest city/region + street line1/postcode (proxies OSM Nominatim) — requires ?lat=&lng=', sampleQuery: '?lat=14.5547&lng=121.0244' },
        { path: '/api/v1/cities', methods: ['GET'], description: 'City + region lookups' },
        { path: '/api/v1/tags', methods: ['GET'], description: 'Tag/category lookups' },
      ],
    },
    {
      name: 'Venues',
      endpoints: [
        { path: '/api/v1/venues', methods: ['GET', 'POST'], description: 'List venues (filters: city, search, ownerUserId, managedByUserId=<self> (venues you own OR staff, each annotated viewerStaffRole), state=claimed|unclaimed, excludePendingClaims, hasOpenPlay, hasCoaching, …); POST creates an owner-owned venue (auth, owner.venues.create) — stays pending until admin approval' },
        { path: '/api/v1/venues/:id', methods: ['GET', 'PATCH', 'DELETE'], description: 'Single venue — get by slug, custom bookingSlug, or _id; patch (auth, owner.venues.manage; accepts a custom bookingSlug for the auto-generated booking link, uniqueness-checked); DELETE soft-deletes (owner-gated — hides it from everyone but admins, record kept for audit/recovery)' },
        { path: '/api/v1/venues/:id/booking-slug-available', methods: ['GET'], description: 'Live availability check for a custom booking slug (?slug=…) — auth, owner-gated; returns { status: empty|invalid|taken|available, available, normalized }' },
        { path: '/api/v1/venues/:id/reviews', methods: ['GET'], description: 'Venue reviews' },
        { path: '/api/v1/venues/:id/open-play', methods: ['GET'], description: 'Open-play sessions at this venue' },
        { path: '/api/v1/venues/:id/coaches', methods: ['GET'], description: 'Coaches working at this venue' },
        { path: '/api/v1/venues/:id/courts', methods: ['GET', 'POST'], description: 'Courts at this venue' },
        { path: '/api/v1/venues/courts/:id', methods: ['PATCH', 'DELETE'], description: 'Single court mutations', auth: 'user' },
        { path: '/api/v1/venues/courts/:id/hours', methods: ['GET', 'PUT'], description: "A court's own weekly hours (inherits the venue default until set)" },
        { path: '/api/v1/venues/:id/hours', methods: ['GET', 'PUT'], description: 'Weekly opening hours (venue-wide default)' },
        { path: '/api/v1/venues/:id/holiday-closures', methods: ['GET', 'POST'], description: 'Holiday closure dates' },
        { path: '/api/v1/venues/:id/staff', methods: ['GET', 'POST'], description: 'Venue staff (managers / front-desk). GET = owner or staff (identity-enriched team list); POST adds a member by userId + staffRole (owner-only, owner.staff.manage)', auth: 'user' },
        { path: '/api/v1/venues/staff/:id', methods: ['DELETE'], description: 'Remove a venue staff member (owner-only, owner.staff.manage)', auth: 'user' },
        { path: '/api/v1/venues/:id/members', methods: ['GET', 'POST'], description: 'Venue members (member pricing). GET = owner or staff (active members + pending invites). POST = owner/staff invite a player by userId (+ optional tier); the membership starts PENDING and notifies the player — it only becomes active (and member pricing applies) once they accept. Member bookings get Venue.memberDiscountPercent off', auth: 'user' },
        { path: '/api/v1/venues/:id/members/:userId', methods: ['DELETE'], description: 'Remove a venue member (owner or staff)', auth: 'user' },
        { path: '/api/v1/venues/:id/membership', methods: ['POST', 'DELETE'], description: "Self-service membership — POST: the signed-in player joins, switches, or renews this venue's membership (body { planId }); expiry auto-computed from plan cadence (monthly/quarterly/annual). DELETE cancels it. Recorded as a VenueMember (surfaces in the owner Members tab + member pricing). getVenue exposes viewerMembershipExpiresAt (ISO datetime or null for perpetual)", auth: 'user' },
        { path: '/api/v1/venues/:id/membership/respond', methods: ['POST'], description: "The invited player accepts/declines an owner-sent membership invite (body { accept[, planId] }). Accept flips their pending VenueMember to active — if planId is provided or the invite already carries a tier, expiry is computed from that tier cadence; otherwise perpetual. Decline marks it declined. Either way the inviting owner is notified of the outcome", auth: 'user' },
        { path: '/api/v1/venues/:id/subscription-plans', methods: ['GET', 'POST'], description: 'Subscription plans for a venue (owner/staff). GET lists all plans with their current version + member count. POST creates a new plan with its first version (body: name, description?, price, currency?, billingCycle, customBillingDays?, benefits?, maxMembers?, freeTrialDays?, autoRenew?, status?)', auth: 'user' },
        { path: '/api/v1/venues/subscription-plans/:planId', methods: ['GET', 'PATCH', 'DELETE'], description: 'Single subscription plan (owner/staff). GET returns the plan + current version. PATCH updates it — structural changes (price, billingCycle, customBillingDays, benefits) create a new version so existing subscribers stay on their version until renewal; cosmetic changes (name, description, status) apply in-place. DELETE only if no active subscribers (409 otherwise — disable instead)', auth: 'user' },
        { path: '/api/v1/venues/subscription-plans/:planId/duplicate', methods: ['POST'], description: 'Duplicate a subscription plan — copies the current version as version 1 of a new draft plan (owner/staff)', auth: 'user' },
        { path: '/api/v1/venues/subscription-plans/:planId/toggle', methods: ['PATCH'], description: 'Toggle a plan between active ↔ disabled (owner/staff). Draft plans must be edited to change status', auth: 'user' },
        { path: '/api/v1/venues/:id/plans', methods: ['GET'], description: 'Public: active subscription plans for a venue (players browsing membership options). Returns each plan with its current version (price, benefits, billing cycle, etc.)' },
        { path: '/api/v1/venues/subscription-plans/:planId/subscribe', methods: ['POST'], description: 'Self-service: the signed-in player subscribes to a plan. Links to their VenueMember row (joins the membership if not already a member). Enforces plan status (must be active) and optional maxMembers cap. Computes renewal date from billing cycle + trial end from freeTrialDays', auth: 'user' },
        { path: '/api/v1/venues/:id/slot-overrides', methods: ['GET', 'POST'], description: 'Manual surge / slot price overrides. GET = active overrides (public, today onward; owner/staff see all with ?date). POST = owner/staff set an absolute ₱/hr for a date+time window (optional courtId)' },
        { path: '/api/v1/venues/slot-overrides/:id', methods: ['DELETE'], description: 'Remove a slot price override (owner or staff)', auth: 'user' },
        { path: '/api/v1/venues/:id/pricing', methods: ['GET'], description: 'Imported rich pricing data for a venue (per-audience, per-day, per-time-window) — public read-only' },
        { path: '/api/v1/venues/:id/faqs', methods: ['GET', 'POST'], description: 'Venue FAQ entries' },
        { path: '/api/v1/venues/:id/availability', methods: ['GET'], description: 'Per-hour court availability for a date (?date=YYYY-MM-DD) — powers booking time pickers' },
        { path: '/api/v1/venues/:id/availability/range', methods: ['GET'], description: 'Per-day availability across a date range (?from&to&courtId, ≤62 days) — flags fully-booked days for the booking calendar' },
        { path: '/api/v1/venues/availability/batch', methods: ['POST'], description: 'Batch per-hour court availability for multiple venues — body { venueIds[], date }. Returns freeByHour (24 ints) per venue. Powers map date/time filter' },
        { path: '/api/v1/venues/:id/bookings', methods: ['GET', 'POST'], description: 'GET = bookings for this venue (owner or any active staff). POST = owner/staff create a manual off-platform booking (phone/Messenger/IG/walk-in) or block a slot (bookingType manual|blocked) — runs the double-booking guard, no payment flow', auth: 'user' },
        { path: '/api/v1/venues/:id/bookings/:bookingId', methods: ['PATCH'], description: 'Confirm / cancel / mark-paid a booking (owner or any active staff)', auth: 'user' },
        { path: '/api/v1/venues/:id/recurring-bookings', methods: ['GET', 'POST'], description: 'Recurring bookings (weekly regulars / leagues), owner/staff. GET lists series (grouped by recurringId). POST generates the same weekly slot for N weeks (body { startDate, startTime, endTime, weeks, weeklyInterval?, courtId?, customerName?, amount?, bookingType manual|blocked }) — each week double-booking-guarded, clashing weeks skipped + reported', auth: 'user' },
        { path: '/api/v1/venues/recurring-bookings/:recurringId', methods: ['DELETE'], description: 'Cancel a recurring series — cancels its future (today-onward) instances (owner or any active staff)', auth: 'user' },
        { path: '/api/v1/venues/:id/analytics', methods: ['GET'], description: 'Owner analytics — revenue/bookings/occupancy/peak-hours/top-customers (owner or a manager-role staffer; front-desk staff are excluded)', auth: 'user' },
      ],
    },
    {
      name: 'Coaches',
      endpoints: [
        { path: '/api/v1/coaches', methods: ['GET', 'POST'], description: 'List coaches (?subscribed=true returns only coaches with a live coach subscription — powers Find Coach); POST creates the current user\'s coach profile (unlisted until verified; requires coach.profile.manage + an active coach subscription, else 402)' },
        { path: '/api/v1/coaches/me', methods: ['GET', 'PATCH'], description: 'Current user coach profile; PATCH requires coach.profile.manage', auth: 'user' },
        { path: '/api/v1/coaches/:id', methods: ['GET'], description: 'Single coach by slug or _id' },
        { path: '/api/v1/coaches/:id/reviews', methods: ['GET', 'POST'], description: 'Coach reviews (POST requires auth)' },
        { path: '/api/v1/coach-reviews/:id', methods: ['PATCH', 'DELETE'], description: 'Edit / delete a coach review', auth: 'user' },
      ],
    },
    {
      name: 'Coach applications',
      endpoints: [
        { path: '/api/v1/coach-applications', methods: ['POST'], description: 'Apply to coach at a venue — body { venueId } (slug or _id); one per player+venue (requires player.dashboard.access AND an active coach subscription, else 402 SUBSCRIPTION_REQUIRED)', auth: 'user' },
        { path: '/api/v1/coach-applications/mine', methods: ['GET'], description: "Current player's own coach applications, with venue info (player-only)", auth: 'user' },
        { path: '/api/v1/coach-applications/for-venue/:venueId', methods: ['GET'], description: "Current player's coach application for one venue (or null) — drives the Apply button state (player-only)", auth: 'user' },
        { path: '/api/v1/coach-applications/:id', methods: ['DELETE'], description: 'Applicant withdraws their own pending coach application (deletes the row)', auth: 'user' },
        { path: '/api/v1/coach-applications/owner', methods: ['GET'], description: "Applications across all of the current owner's venues (requires owner.coaches.manage)", auth: 'user' },
        { path: '/api/v1/coach-applications/venue/:venueId', methods: ['GET'], description: 'Applications for one owned venue; ?status=pending|approved|rejected filters (owner.coaches.manage)', auth: 'user' },
        { path: '/api/v1/coach-applications/:id/approve', methods: ['PATCH'], description: 'Approve a coach application — grants the coach role + UserRole for that venue (venue owner or admin)', auth: 'user' },
        { path: '/api/v1/coach-applications/:id/reject', methods: ['PATCH'], description: 'Reject a coach application — revokes any existing grant (venue owner or admin)', auth: 'user' },
        { path: '/api/v1/coach-applications/:id/remove', methods: ['PATCH'], description: 'Remove an approved coach from the venue — revokes the grant (venue owner or admin)', auth: 'user' },
      ],
    },
    {
      name: 'Partner subscriptions',
      endpoints: [
        { path: '/api/v1/partner-subscriptions/me', methods: ['GET'], description: "Current user's coach/organizer subscriptions + live status per plan, current pricing, and whether their postal address is complete enough to subscribe", auth: 'user' },
        { path: '/api/v1/partner-subscriptions', methods: ['POST'], description: 'Buy a term of the coach or organizer plan — body { plan, autoRenew? }. 400 ADDRESS_REQUIRED if the profile address is incomplete, 409 ALREADY_SUBSCRIBED if a term is live. Grants the global coach/organizer role', auth: 'user' },
        { path: '/api/v1/partner-subscriptions/:id', methods: ['DELETE'], description: 'Cancel at the END of the paid term — sets cancelAtPeriodEnd + stops auto-renew. Access and the role survive until expiresAt, then the lazy expiry sweep revokes the global grant (venue-scoped grants from approved applications are kept). No refund; 409 ALREADY_CANCELLED if already scheduled', auth: 'user' },
        { path: '/api/v1/partner-subscriptions/:id/resume', methods: ['POST'], description: 'Undo a scheduled cancellation while the term is still running', auth: 'user' },
      ],
    },
    {
      name: 'Coach bookings',
      endpoints: [
        { path: '/api/v1/coach-bookings', methods: ['POST'], description: 'A player requests a coaching session — body { coachId, date, startTime, serviceId?, venueId?, endTime?, durationMinutes?, notes? }. Price is server-derived from the service or the coach\'s hourly rate. 409 COACH_NOT_SUBSCRIBED / SLOT_TAKEN', auth: 'user' },
        { path: '/api/v1/coach-bookings/mine', methods: ['GET'], description: 'Sessions the signed-in player requested', auth: 'user' },
        { path: '/api/v1/coach-bookings/coach', methods: ['GET'], description: "The signed-in coach's incoming session requests", auth: 'user' },
        { path: '/api/v1/coach-bookings/:id/accept', methods: ['PATCH'], description: 'Coach accepts a pending request → confirmed (notifies the player)', auth: 'user' },
        { path: '/api/v1/coach-bookings/:id/decline', methods: ['PATCH'], description: 'Coach declines a pending request — body { reason? } (notifies the player)', auth: 'user' },
        { path: '/api/v1/coach-bookings/:id/cancel', methods: ['PATCH'], description: 'Either party cancels a pending/confirmed session (notifies the other)', auth: 'user' },
      ],
    },
    {
      name: 'Users',
      endpoints: [
        { path: '/api/v1/users/:id', methods: ['GET'], description: "A player's PUBLIC profile card — display name, avatar, bio, skill, city/province, roles, per-venue partner badges, and live isCoach/isOrganizer flags. Never exposes email/phone/postal address; a private profile hides bio/skill/location" },
      ],
    },
    {
      name: 'Organizer applications',
      endpoints: [
        { path: '/api/v1/organizer-applications', methods: ['POST'], description: 'Apply to organise at a venue — body { venueId, message? } (requires player.dashboard.access — player-only gate)', auth: 'user' },
        { path: '/api/v1/organizer-applications/mine', methods: ['GET'], description: "Current player's own organiser applications, with venue info (player-only)", auth: 'user' },
        { path: '/api/v1/organizer-applications/for-venue/:venueId', methods: ['GET'], description: "Current player's organiser application for one venue (or null) — drives the Apply button state (player-only)", auth: 'user' },
        { path: '/api/v1/organizer-applications/:id', methods: ['DELETE'], description: 'Applicant withdraws their own pending organiser application (deletes the row)', auth: 'user' },
        { path: '/api/v1/organizer-applications/owner', methods: ['GET'], description: "Applications across all of the current owner's venues (requires owner.tournaments.manage)", auth: 'user' },
        { path: '/api/v1/organizer-applications/venue/:venueId', methods: ['GET'], description: 'Applications for one owned venue; ?status=pending|approved|rejected filters (owner.tournaments.manage)', auth: 'user' },
        { path: '/api/v1/organizer-applications/:id/approve', methods: ['PATCH'], description: 'Approve an organiser application — grants the organizer role + UserRole for that venue (venue owner or admin)', auth: 'user' },
        { path: '/api/v1/organizer-applications/:id/reject', methods: ['PATCH'], description: 'Reject an organiser application — revokes any existing grant (venue owner or admin)', auth: 'user' },
        { path: '/api/v1/organizer-applications/:id/remove', methods: ['PATCH'], description: 'Remove an approved organiser from the venue — revokes the grant (venue owner or admin)', auth: 'user' },
      ],
    },
    {
      name: 'Partners',
      endpoints: [
        { path: '/api/v1/partners/owner', methods: ['GET'], description: "Combined coach + organizer partner applications across the current owner's venues, tagged kind, with KPI counts (owner.coaches.manage or owner.tournaments.manage)", auth: 'user' },
      ],
    },
    {
      name: 'Tournament requests',
      endpoints: [
        { path: '/api/v1/tournament-applications', methods: ['POST'], description: 'Organizer submits a venue request for a tournament — body { tournamentId, venueId, requestedStartDate, requestedEndDate, timeSlotStart, timeSlotEnd, courtsRequired, message } (organizer.tournaments.manage)', auth: 'user' },
        { path: '/api/v1/tournament-applications/mine', methods: ['GET'], description: "Current organizer's venue requests, with tournament + venue info", auth: 'user' },
        { path: '/api/v1/tournament-applications/:id/cancel', methods: ['PATCH'], description: 'Organizer withdraws a pending venue request', auth: 'user' },
        { path: '/api/v1/tournament-applications/owner', methods: ['GET'], description: "Tournament requests across all of the current owner's venues (owner.tournaments.manage)", auth: 'user' },
        { path: '/api/v1/tournament-applications/venue/:venueId', methods: ['GET'], description: 'Tournament requests for one owned venue; ?status=pending|approved|rejected|cancelled filters (owner.tournaments.manage)', auth: 'user' },
        { path: '/api/v1/tournament-applications/:id/approve', methods: ['PATCH'], description: 'Approve a tournament request — reserves the venue + advances the tournament; rejects if courts are over-subscribed (venue owner or admin)', auth: 'user' },
        { path: '/api/v1/tournament-applications/:id/reject', methods: ['PATCH'], description: 'Reject a tournament request — body { remarks } (venue owner or admin)', auth: 'user' },
      ],
    },
    {
      name: 'Content',
      endpoints: [
        { path: '/api/v1/open-play', methods: ['GET'], description: 'Open-play session feed' },
        { path: '/api/v1/open-play', methods: ['POST'], description: 'Create a recurring open-play series + generate instances — body { title, venueId, daysOfWeek[], startTime, endTime?, capacity, price, weeksAhead } (organizer.events.manage)', auth: 'user' },
        { path: '/api/v1/open-play/mine', methods: ['GET'], description: "Current organizer's open-play series + their session instances (organizer.events.manage)", auth: 'user' },
        { path: '/api/v1/open-play/series/:id/cancel', methods: ['PATCH'], description: 'Cancel a series + its future instances (organizer.events.manage, owner)', auth: 'user' },
        { path: '/api/v1/open-play/:id/cancel', methods: ['PATCH'], description: 'Cancel one session instance + notify joiners (organizer.events.manage, owner)', auth: 'user' },
        { path: '/api/v1/open-play/:id/registrations', methods: ['GET'], description: 'Session roster — organizer (owner) or admin', auth: 'user' },
        { path: '/api/v1/open-play/:id/registrations/:regId', methods: ['PATCH'], description: 'Manage a session registration — body { attended?, paid?, paymentNote? } or { action: approve|decline } (organizer.events.manage, owner)', auth: 'user' },
        { path: '/api/v1/open-play/:id/join', methods: ['POST'], description: 'Mark interest in an open-play session ("I\'m Interested" — no capacity gate, no waitlist)', auth: 'user' },
        { path: '/api/v1/open-play/:id/leave', methods: ['POST'], description: 'Remove your interest from an open-play session', auth: 'user' },
        { path: '/api/v1/tournaments', methods: ['GET'], description: 'Tournaments (filter: status, venueId — venueId returns a venue\'s public tournaments)' },
        { path: '/api/v1/tournaments', methods: ['POST'], description: 'Create a draft tournament (organizer.tournaments.manage)', auth: 'user' },
        { path: '/api/v1/tournaments/mine', methods: ['GET'], description: "Current organizer's tournaments, newest first (organizer.tournaments.manage)", auth: 'user' },
        { path: '/api/v1/tournaments/registrations/mine', methods: ['GET'], description: 'Every tournament the current user registered for ({ tournamentId, status }) — backs the player tab Joined/Open filters', auth: 'user' },
        { path: '/api/v1/tournaments/:id', methods: ['GET'], description: 'Tournament detail by _id or slug (owner sees any status; others only public)' },
        { path: '/api/v1/tournaments/:id', methods: ['PATCH'], description: 'Edit an owned tournament (organizer.tournaments.manage)', auth: 'user' },
        { path: '/api/v1/tournaments/:id/cancel', methods: ['PATCH'], description: 'Cancel an owned tournament (organizer.tournaments.manage)', auth: 'user' },
        { path: '/api/v1/tournaments/:id/open-registration', methods: ['PATCH'], description: 'Open registration on an approved tournament (organizer.tournaments.manage)', auth: 'user' },
        { path: '/api/v1/tournaments/:id/register', methods: ['POST'], description: 'Register for a tournament that is open for registration; waitlists when full (player.tournaments.join)', auth: 'user' },
        { path: '/api/v1/tournaments/:id/withdraw', methods: ['POST'], description: 'Withdraw your tournament registration (player.tournaments.join)', auth: 'user' },
        { path: '/api/v1/tournaments/:id/my-registration', methods: ['GET'], description: 'Your registration for a tournament, or null (drives the Join button)' },
        { path: '/api/v1/tournaments/:id/registrations', methods: ['GET'], description: 'Participant list — organizer (tournament owner) or admin only', auth: 'user' },
        { path: '/api/v1/tournaments/:id/registrations/:regId', methods: ['PATCH'], description: 'Manage a registration — body { attended?, paid?, paymentNote? } or { action: approve|decline } (organizer.tournaments.manage, owner)', auth: 'user' },
        { path: '/api/v1/tournaments/:id/announcements', methods: ['GET'], description: 'Tournament announcement feed (newest first) — schedule/venue/general notices' },
        { path: '/api/v1/tournaments/:id/announcements', methods: ['POST'], description: 'Broadcast an announcement to all registrants — body { title, body, kind: general|schedule|venue }; fans out a notification each (organizer.tournaments.manage, owner)', auth: 'user' },
        { path: '/api/v1/tournaments/:id/messages', methods: ['GET', 'POST'], description: 'Tournament participant group chat — GET lists messages (roster: organizer + registrants); POST sends one (body { body }; roster + player.tournaments.chat) and realtime-fans-out tournament.message.created to the other roster members', auth: 'user' },
        { path: '/api/v1/events', methods: ['GET'], description: 'Events' },
        { path: '/api/v1/posts', methods: ['GET'], description: 'Editorial posts / guides' },
      ],
    },
    {
      name: 'Brackets',
      endpoints: [
        { path: '/api/v1/tournaments/:id/entrants', methods: ['GET'], description: 'Bracket entrants (seedable units — 1 player singles, 2 doubles) — organizer/admin' },
        { path: '/api/v1/tournaments/:id/entrants/build', methods: ['POST'], description: 'Build entrants from registrations — body { mode: auto | pairs, pairs? } (organizer.brackets.manage)', auth: 'user' },
        { path: '/api/v1/tournaments/:id/entrants', methods: ['POST'], description: 'Add one entrant manually (organizer.brackets.manage)', auth: 'user' },
        { path: '/api/v1/tournaments/:id/entrants/seed', methods: ['POST'], description: 'Auto- or manual-seed the field — body { method, seeds? } (organizer.brackets.manage)', auth: 'user' },
        { path: '/api/v1/tournaments/:id/entrants/:entrantId', methods: ['PATCH', 'DELETE'], description: 'Edit seed/name/withdraw or remove an entrant (organizer.brackets.manage)', auth: 'user' },
        { path: '/api/v1/tournaments/:id/bracket', methods: ['POST'], description: 'Generate the bracket — body { format?, matchFormat?, poolCount?, advancersPerPool? }; sets tournament ongoing (organizer.brackets.manage)', auth: 'user' },
        { path: '/api/v1/tournaments/:id/bracket/swap', methods: ['POST'], description: 'Swap two first-round entrants to re-seed the draw — body { a:{matchId,slot}, b:{matchId,slot} }; blocked once a player has advanced (organizer.brackets.manage)', auth: 'user' },
        { path: '/api/v1/tournaments/:id/bracket', methods: ['GET'], description: 'Full bracket — meta + entrants + matches + standings (or null)' },
        { path: '/api/v1/tournaments/:id/bracket', methods: ['DELETE'], description: 'Clear the bracket to regenerate — 409 once a score is entered (organizer.brackets.manage)', auth: 'user' },
        { path: '/api/v1/tournaments/:id/matches/:matchId/result', methods: ['POST'], description: 'Score a match — body { games:[{a,b}] } or { walkover }; derives winner + advances (organizer.brackets.manage)', auth: 'user' },
        { path: '/api/v1/tournaments/:id/matches/:matchId/result', methods: ['DELETE'], description: 'Clear a match result (only if no later round started) (organizer.brackets.manage)', auth: 'user' },
        { path: '/api/v1/tournaments/:id/standings', methods: ['GET'], description: 'Round-robin / pool standings (wins, game + point differential)' },
      ],
    },
    {
      name: 'Games',
      endpoints: [
        { path: '/api/v1/games', methods: ['GET', 'POST'], description: 'List games (filters: status, venueId, date; ?mine=true for created/joined). POST creates a fixed-venue game at a court the host has booked + paid — body takes venueId + bookingId; gameType open=interest-only Open Play, public=format-driven capped game (body.format bracketing|round_robin|mini_tournament) (auth, player.games.create)' },
        { path: '/api/v1/games/:id', methods: ['GET', 'PATCH', 'DELETE'], description: 'Single game (GET). PATCH edits details (type/format/skill/name/capacity/visibility — venue + schedule are locked); DELETE removes it (both host-only, player.games.manage)' },
        { path: '/api/v1/games/:id/join', methods: ['POST'], description: 'Join a game — enforces capacity + one-per-player (rejected for Open Play, which uses interest)', auth: 'user' },
        { path: '/api/v1/games/:id/leave', methods: ['POST'], description: 'Leave a game (re-opens it if it was full)', auth: 'user' },
        { path: '/api/v1/games/:id/interest', methods: ['POST'], description: 'Toggle "I\'m Interested" on an Open Play game (gameType open) — a soft signal, no capacity/roster', auth: 'user' },
        { path: '/api/v1/games/:id/request-leave', methods: ['POST'], description: 'Ask the host for permission to leave a FULL lobby whose 1h free-leave window has closed (adds you to pendingLeaveUsers + notifies the host)', auth: 'user' },
        { path: '/api/v1/games/:id/approve-leave', methods: ['POST'], description: 'Host approves a pending leave request — body { userId }; removes the player from the roster + notifies them', auth: 'user' },
        { path: '/api/v1/games/:id/kick', methods: ['POST'], description: 'Host removes a player from the roster — body { userId } (auth, host)', auth: 'user' },
        { path: '/api/v1/games/:id/invite', methods: ['POST'], description: 'Host invites players — body { userIds } — notifies each + records them on the game (auth, host, player.games.invite)', auth: 'user' },
        { path: '/api/v1/games/:id/messages', methods: ['GET', 'POST'], description: 'Game group chat — GET lists messages (roster only); POST sends one (body { body }; roster + player.games.chat) and realtime-fans-out game.message.created to the other roster members', auth: 'user' },
      ],
    },
    {
      name: 'Clubs (communities + realtime feed)',
      endpoints: [
        { path: '/api/v1/clubs', methods: ['GET', 'POST'], description: 'List clubs (cursor-paginated; ?search=, ?mine=true for joined/created). POST creates a club + host membership (auth, player.clubs.create)' },
        { path: '/api/v1/clubs/:id', methods: ['GET', 'PATCH', 'DELETE'], description: 'Single club by slug or _id (private → 404 to non-members). PATCH/DELETE are host-only (DELETE hard-cascades members/posts/reactions/requests)' },
        { path: '/api/v1/clubs/:id/members', methods: ['GET'], description: 'Club member list (members/host only for private clubs)' },
        { path: '/api/v1/clubs/:id/members/:userId', methods: ['DELETE'], description: 'Remove a member (host-only)', auth: 'user' },
        { path: '/api/v1/clubs/:id/join', methods: ['POST'], description: 'Join a public club (enforces join limit) or request to join a private one (auth, player.clubs.join)', auth: 'user' },
        { path: '/api/v1/clubs/:id/leave', methods: ['POST'], description: 'Leave a club (host must delete instead)', auth: 'user' },
        { path: '/api/v1/clubs/:id/requests', methods: ['GET'], description: 'Pending join requests for a private club (host-only)', auth: 'user' },
        { path: '/api/v1/clubs/:id/requests/:reqId/approve', methods: ['POST'], description: 'Approve a join request — creates the membership (host-only)', auth: 'user' },
        { path: '/api/v1/clubs/:id/requests/:reqId/deny', methods: ['POST'], description: 'Deny a join request (host-only)', auth: 'user' },
        { path: '/api/v1/clubs/:id/feed', methods: ['GET'], description: 'Top-level posts, cursor-paginated newest-first (recursive ClubPost; private → 404 to non-members)' },
        { path: '/api/v1/clubs/:id/stream', methods: ['GET'], description: 'SSE realtime stream of feed events (post.created/updated/deleted, reaction.changed, member.joined). Auth via ?token= (EventSource can\'t send headers)' },
        { path: '/api/v1/clubs/:id/posts', methods: ['POST'], description: 'Create a post; body.parentPostId makes it a reply (a reply is a full post). Members only (auth, player.clubs.post)', auth: 'user' },
        { path: '/api/v1/clubs/:id/posts/:postId', methods: ['GET', 'PATCH', 'DELETE'], description: 'Single post + first page of replies (GET). PATCH author-only; DELETE author-or-host (soft delete)' },
        { path: '/api/v1/clubs/:id/posts/:postId/replies', methods: ['GET'], description: 'Replies to a post, cursor-paginated' },
        { path: '/api/v1/clubs/:id/posts/:postId/react', methods: ['POST', 'DELETE'], description: 'Like / unlike a post (toggle; auth, player.clubs.react)', auth: 'user' },
        { path: '/api/v1/clubs/:id/messages', methods: ['GET', 'POST'], description: 'Club member group chat (separate from the feed) — GET lists messages (members only); POST sends one (body { body }; member + player.clubs.chat) and realtime-fans-out club.message.created to the other members', auth: 'user' },
      ],
    },
    {
      name: 'Bookings & Payments',
      endpoints: [
        { path: '/api/v1/bookings', methods: ['GET', 'POST'], description: 'List / create bookings', auth: 'user' },
        { path: '/api/v1/bookings/:id', methods: ['GET', 'PATCH'], description: 'Single booking', auth: 'user' },
        { path: '/api/v1/bookings/:id/cancel', methods: ['POST'], description: 'Cancel a booking', auth: 'user' },
        { path: '/api/v1/payments', methods: ['GET', 'POST'], description: 'List / create payments', auth: 'user' },
        { path: '/api/v1/payments/checkout', methods: ['POST'], description: 'Pay for a booking (test mode auto-confirms; no real charge)', auth: 'user' },
        { path: '/api/v1/payments/:id', methods: ['GET', 'PATCH'], description: 'Single payment', auth: 'user' },
        { path: '/api/v1/payments/:id/verify', methods: ['POST'], description: 'Mark a payment as verified', auth: 'user' },
      ],
    },
    {
      name: 'Check-ins',
      endpoints: [
        { path: '/api/v1/check-ins/hotspot', methods: ['GET'], description: 'Busiest venue right now (powers the home who-is-playing banner)' },
        { path: '/api/v1/check-ins', methods: ['GET'], description: 'Players checked in at a venue (?venueId=slug|_id); flags whether you are' },
        { path: '/api/v1/check-ins', methods: ['POST', 'DELETE'], description: 'Check in / out at a venue (player.venues.checkin)', auth: 'user' },
      ],
    },
    {
      name: 'Settings',
      endpoints: [
        { path: '/api/v1/settings', methods: ['GET'], description: 'Public app settings (payment test mode, demo card, service-fee %, coach/organizer subscription price + term)' },
        { path: '/api/v1/settings', methods: ['PATCH'], description: 'Update app settings (payment test mode, service-fee %, coachSubscriptionPrice / organizerSubscriptionPrice / partnerSubscriptionDays)', auth: 'admin' },
        { path: '/api/v1/settings/test-email', methods: ['POST'], description: 'Send sample emails for selected templates to a test address', auth: 'admin' },
      ],
    },
    {
      name: 'Rosters (organizer player lists)',
      endpoints: [
        { path: '/api/v1/rosters', methods: ['GET', 'POST'], description: "Organizer's reusable player lists; POST creates one — body { name, description } (organizer.events.manage)", auth: 'user' },
        { path: '/api/v1/rosters/:id', methods: ['PATCH', 'DELETE'], description: 'Rename / delete a roster (owner)', auth: 'user' },
        { path: '/api/v1/rosters/:id/members', methods: ['POST'], description: 'Add a player — body { userId } or { name, email } (owner)', auth: 'user' },
        { path: '/api/v1/rosters/:id/members/:memberId', methods: ['DELETE'], description: 'Remove a player from the roster (owner)', auth: 'user' },
      ],
    },
    {
      name: 'Interactions (reviews, favorites, notifications)',
      endpoints: [
        { path: '/api/v1/venues/:id/reviews', methods: ['POST'], description: 'Post a venue review', auth: 'user' },
        { path: '/api/v1/reviews/:id', methods: ['PATCH', 'DELETE'], description: 'Edit / delete a review', auth: 'user' },
        { path: '/api/v1/reviews/:id/reply', methods: ['POST', 'PATCH', 'DELETE'], description: 'Owner reply on a review', auth: 'user' },
        { path: '/api/v1/reviews/:id/report', methods: ['POST'], description: 'Report a review', auth: 'user' },
        { path: '/api/v1/favorites', methods: ['GET', 'POST'], description: 'Favorites list / add', auth: 'user' },
        { path: '/api/v1/favorites/:id', methods: ['DELETE'], description: 'Remove a favorite', auth: 'user' },
        { path: '/api/v1/notifications', methods: ['GET'], description: 'Notifications inbox', auth: 'user' },
        { path: '/api/v1/notifications/unread-count', methods: ['GET'], description: 'Unread notification tally — cheap to poll for the live badge', auth: 'user' },
        { path: '/api/v1/notifications/mark-all-read', methods: ['PATCH'], description: 'Mark all as read', auth: 'user' },
        { path: '/api/v1/notifications/:id', methods: ['PATCH'], description: 'Mark single notification as read', auth: 'user' },
        { path: '/api/v1/me/stream', methods: ['GET'], description: 'Realtime per-user SSE stream — emits notification.created (any new notification) + message.created (incoming DM). Token via ?token= (EventSource-friendly)', auth: 'user' },
      ],
    },
    {
      name: 'Push (Web Push + FCM notifications)',
      endpoints: [
        { path: '/api/v1/push/public-key', methods: ['GET'], description: 'VAPID public key needed to subscribe' },
        { path: '/api/v1/push/subscribe', methods: ['POST'], description: 'Register this device for Web Push (VAPID) — body { endpoint, keys:{p256dh,auth}, userAgent? }', auth: 'user' },
        { path: '/api/v1/push/unsubscribe', methods: ['POST'], description: 'Remove a device subscription (VAPID) — body { endpoint }', auth: 'user' },
        { path: '/api/v1/push/fcm-subscribe', methods: ['POST'], description: 'Register an FCM device token (Google push, better Android delivery) — body { token, userAgent? }', auth: 'user' },
        { path: '/api/v1/push/fcm-unsubscribe', methods: ['POST'], description: 'Remove an FCM device token — body { token }', auth: 'user' },
      ],
    },
    {
      name: 'Messages (direct 1:1 chat)',
      endpoints: [
        { path: '/api/v1/messages/conversations', methods: ['GET', 'POST'], description: 'List my threads (with other participant + last message + unread). POST find-or-creates a 1:1 thread — body { userId } (user.messages.send)', auth: 'user' },
        { path: '/api/v1/messages/unread-count', methods: ['GET'], description: 'Total unread messages across threads', auth: 'user' },
        { path: '/api/v1/messages/conversations/:id', methods: ['GET', 'DELETE'], description: 'GET a thread (other participant + messages; marks read). DELETE soft-deletes it for you only (a new message un-hides it)', auth: 'user' },
        { path: '/api/v1/messages/conversations/:id/messages', methods: ['POST'], description: 'Send a message — body { body } — notifies the recipient (user.messages.send)', auth: 'user' },
        { path: '/api/v1/messages/conversations/:id/messages/:msgId', methods: ['DELETE'], description: 'Delete your own message (removed for both; recipient gets a realtime message.deleted)', auth: 'user' },
      ],
    },
    {
      name: 'Staff (owner sub-accounts)',
      endpoints: [
        { path: '/api/v1/staff', methods: ['GET', 'POST'], description: "Org-level staff accounts for the owner console. GET lists the owner's staff (admins may pass ?ownerUserId). POST creates a staff User (body { email, password, displayName, firstName?, lastName?, ownerUserId? (admins only) }) scoped via parentOwnerUserId — staff manage ALL of that owner's venues, bookings, and clubs but can't create staff or create/claim venues. Owner+admin only (owner.staff.manage)", auth: 'user' },
        { path: '/api/v1/staff/:id', methods: ['PATCH', 'DELETE'], description: 'Manage one staff account (creating owner or admin). PATCH updates name / resets password / toggles isActive. DELETE removes the account outright (the login is deleted, not just disabled; scoped to staff sub-accounts only)', auth: 'user' },
      ],
    },
    {
      name: 'Demand (capture + insights)',
      endpoints: [
        { path: '/api/v1/demand/events', methods: ['POST'], description: 'Record a demand signal — body { type: search|venue_view|booking_attempt|booking_completed|booking_cancelled|empty_slot, venueId?, courtId?, date?, startHour?, query?, meta? }. Public (optionalAuth attaches the actor). Best-effort capture, 202. booking_completed/cancelled/empty_slot are also auto-captured server-side by the booking flow' },
        { path: '/api/v1/demand/venues/:id', methods: ['GET'], description: 'Owner/manager demand report for a venue (?days=30) — signal totals, attempt→completion conversion, cancellation rate, demand-by-hour, and an empty-supply/occupancy read. Foundation for demand-based pricing', auth: 'user' },
        { path: '/api/v1/demand/venues/:id/suggested-pricing', methods: ['GET'], description: 'Demand-based pricing suggestions per day×hour — adjustments with confidence levels. Owner/manager only', auth: 'user' },
        { path: '/api/v1/demand/venues/:id/suggested-pricing/apply', methods: ['POST'], description: 'Apply selected pricing suggestions as SlotPriceOverrides for N weeks — body { suggestions: [{dow,hour,price}], weeks? }', auth: 'user' },
        { path: '/api/v1/demand/auto-dynamic-pricing', methods: ['POST'], description: 'Cron endpoint — runs the suggestion engine for all venues opted into autoDynamicPricing, applies high-confidence suggestions automatically. Admin only', auth: 'user' },
      ],
    },
    {
      name: 'Rental Inventory (Owner)',
      endpoints: [
        { path: '/api/v1/rental-inventory', methods: ['GET'], description: 'List rental inventory items (?category=&status=&search=&archived=&venueId=) — auth, owner.inventory.view (owner-scoped)', auth: 'user' },
        { path: '/api/v1/rental-inventory/stats', methods: ['GET'], description: 'Inventory summary stats (total/available/rented/lowStock) — auth, owner.inventory.view', auth: 'user' },
        { path: '/api/v1/rental-inventory/export/csv', methods: ['GET'], description: 'Export inventory CSV — auth, owner.inventory.export', auth: 'user' },
        { path: '/api/v1/rental-inventory', methods: ['POST'], description: 'Create rental inventory item — auth, owner.inventory.create', auth: 'user' },
        { path: '/api/v1/rental-inventory/:id', methods: ['GET', 'PATCH', 'DELETE'], description: 'Single item — GET (owner.inventory.view), PATCH (owner.inventory.update), DELETE (archive, owner.inventory.archive), owner-scoped', auth: 'user' },
      ],
    },
    {
      name: 'Media',
      endpoints: [
        { path: '/api/v1/media/upload', methods: ['POST'], description: 'Upload media (multipart)', auth: 'user' },
        { path: '/api/v1/media/:id', methods: ['GET'], description: 'Fetch single media metadata' },
      ],
    },
    {
      name: 'Subscriptions (newsletter)',
      endpoints: [
        { path: '/api/v1/subscriptions', methods: ['POST', 'DELETE'], description: 'Newsletter subscribe / unsubscribe' },
      ],
    },
    {
      name: 'Venue management',
      endpoints: [
        { path: '/api/v1/claims', methods: ['POST'], description: 'Submit a venue ownership claim for an unclaimed listing (owner.venues.claim) — proof + optional identity fields (claimantLegalName / claimantRole / claimantContact) for anti-fraud review', auth: 'user' },
        { path: '/api/v1/claims', methods: ['GET'], description: 'List all claims (moderation queue)', auth: 'admin' },
        { path: '/api/v1/claims/:id', methods: ['PATCH'], description: 'Approve / reject a claim', auth: 'admin' },
        { path: '/api/v1/venues/:id/suggested-edits', methods: ['POST'], description: 'Submit a venue edit suggestion', auth: 'user' },
        { path: '/api/v1/suggested-edits', methods: ['GET'], description: 'List all suggested edits', auth: 'admin' },
        { path: '/api/v1/suggested-edits/:id', methods: ['PATCH'], description: 'Approve / reject a suggested edit', auth: 'admin' },
        { path: '/api/v1/venue-approvals', methods: ['GET'], description: 'List venues awaiting approval (owner-created, pending)', auth: 'admin' },
        { path: '/api/v1/venue-approvals/:id', methods: ['PATCH'], description: 'Approve / reject a pending venue', auth: 'admin' },
      ],
    },
    {
      name: 'Friends',
      endpoints: [
        { path: '/api/v1/friends', methods: ['GET'], description: "List the current user's accepted friends", auth: 'user' },
        { path: '/api/v1/friends/pending', methods: ['GET'], description: 'List pending friend requests (sent + received)', auth: 'user' },
        { path: '/api/v1/friends/search', methods: ['GET'], description: 'Search for friendable users (player/coach/organizer, excludes existing + self) — ?q=search', auth: 'user' },
        { path: '/api/v1/friends/suggestions', methods: ['GET'], description: 'Suggested friendable users — ?lat=&lng= for nearby, else shared games/clubs, else random', auth: 'user' },
        { path: '/api/v1/friends/request', methods: ['POST'], description: 'Send a friend request to a user — body { userId }', auth: 'user' },
        { path: '/api/v1/friends/request/:id', methods: ['PATCH'], description: 'Accept or reject a friend request — body { accept: boolean }', auth: 'user' },
        { path: '/api/v1/friends/:id', methods: ['DELETE'], description: 'Remove a friend (either side)', auth: 'user' },
      ],
    },
    {
      name: 'Admin',
      endpoints: [
        { path: '/api/v1/admin/dashboard', methods: ['GET'], description: 'Admin dashboard summary', auth: 'admin' },
        { path: '/api/v1/admin/users', methods: ['GET'], description: 'List users (filters: role, search; pageSize up to 500)', auth: 'admin' },
        { path: '/api/v1/admin/users/:id', methods: ['PATCH'], description: 'Update user (role, status, …)', auth: 'admin' },
        { path: '/api/v1/admin/owners', methods: ['GET'], description: 'List venue owners with their venues', auth: 'admin' },
        { path: '/api/v1/admin/reviews', methods: ['GET'], description: 'Moderation queue for reviews', auth: 'admin' },
        { path: '/api/v1/admin/reviews/:id', methods: ['PATCH'], description: 'Approve / reject a review', auth: 'admin' },
        { path: '/api/v1/admin/reports', methods: ['GET'], description: 'Review reports queue', auth: 'admin' },
        { path: '/api/v1/admin/reports/:id', methods: ['PATCH'], description: 'Resolve a report', auth: 'admin' },
        { path: '/api/v1/admin/audit-logs', methods: ['GET'], description: 'Audit trail', auth: 'admin' },
        { path: '/api/v1/admin/subscriptions', methods: ['GET'], description: 'Newsletter subscribers list', auth: 'admin' },
        { path: '/api/v1/admin/roles', methods: ['GET'], description: 'List the fixed roles with their permissions and user counts', auth: 'admin' },
        { path: '/api/v1/admin/roles/:key', methods: ['PATCH'], description: 'Update a role\'s permissions and (coach) venue links (roles are a fixed set)', auth: 'admin' },
        { path: '/api/v1/admin/permissions', methods: ['GET'], description: 'Permission catalogue (labels, descriptions, groups)', auth: 'admin' },
      ],
    },
  ];

  const methodColor: Record<string, string> = {
    GET:    '#0ea5e9',
    POST:   '#22c55e',
    PATCH:  '#eab308',
    PUT:    '#a855f7',
    DELETE: '#ef4444',
  };

  function renderGroup(g: Group): string {
    const rows = g.endpoints.map((e) => {
      const badges = e.methods
        .map((m) => `<span class="m" style="background:${methodColor[m] || '#64748b'}">${m}</span>`)
        .join(' ');
      const supportsGet = e.methods.includes('GET');
      const isParameterized = e.path.includes(':');
      const isPublic = !e.auth;
      const href = e.path + (e.sampleQuery || '');
      const pathCell = (supportsGet && !isParameterized && isPublic)
        ? `<a href="${href}">${e.path}${e.sampleQuery ? `<span style="color:#94a3b8">${e.sampleQuery}</span>` : ''}</a>`
        : `<code>${e.path}</code>`;
      const lock = e.auth === 'admin'
        ? '<span class="lock">admin</span>'
        : e.auth === 'user'
        ? '<span class="lock">auth</span>'
        : '';
      return `<tr><td class="methods">${badges}</td><td class="path">${pathCell}${lock}</td><td class="desc">${e.description}</td></tr>`;
    }).join('\n');
    return `<tr class="group"><td colspan="3"><span class="label">${g.name}</span></td></tr>
${rows}`;
  }

  const body = `<table>
<thead><tr><th>Methods</th><th>Path</th><th>Description</th></tr></thead>
<tbody>
${groups.map(renderGroup).join('\n')}
</tbody>
</table>`;

  return c.html(htmlShell('Pickleballers API — Endpoints', `
<h1>Pickleballers API</h1>
<div class="sub">All endpoints, grouped by feature. <code>auth</code> = requires JWT; <code>admin</code> = requires admin role. Clickable paths are public GETs you can hit in the browser.</div>
${body}
`));
}
