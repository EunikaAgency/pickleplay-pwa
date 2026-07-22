# Ivan Report — 2026-07-01

## Part 1: Gmail OAuth, Email Templates, Password Reset & API Gaps

### 1. Password Reset Flow (Full-Stack)

**Before:** Dead "Forgot password?" link on LoginScreen (`href="#"`). No password reset flow existed.

**Now:** Complete forgot/reset password flow across API, PWA, and web.

#### What changed

| Layer | File | What |
|---|---|---|
| API | `auth.controller.ts` | `forgotPassword()` — generates 64-char crypto token, stores in `PasswordResetToken` (1h expiry), anti-enumeration (always 200). `resetPassword()` — validates token, hashes new password, marks token used |
| API | `auth.routes.ts` | `POST /auth/forgot-password`, `POST /auth/reset-password` |
| PWA | `ForgotPasswordScreen.tsx` | Email input → API call. If token returned (no email configured), auto-navigates to reset screen. Otherwise "check your email" |
| PWA | `ResetPasswordScreen.tsx` | Pre-filled token + new password + confirm → API call → success → "Sign in" |
| PWA | `LoginScreen.tsx` | Dead `<a href="#">` replaced with `onNavigate('forgot-password')` |
| PWA | `navigation.ts` | `forgot-password` + `reset-password` screens added |
| PWA | `App.tsx` | Both screens rendered full-bleed |
| PWA | `api.ts` | `forgotPassword(email)`, `resetPassword(token, password)` |

#### Verified
- ✅ Token generated & returned (dev mode)
- ✅ Reset password updates password
- ✅ Token reuse rejected (INVALID_TOKEN)
- ✅ Anti-enumeration (unknown email → 200, no token)
- ✅ Login with new password works

---

### 2. Email Verification Endpoints

**Before:** `EmailVerificationToken` model existed but no endpoints used it.

**Now:** Two new endpoints wired.

| Route | What |
|---|---|
| `POST /auth/verify-email` | Validates token, marks `isVerified: true` |
| `POST /auth/resend-verification` | Auth-gated, generates new 24h token |

---

### 3. Gmail API OAuth 2.0 Integration

**Before:** No email sending capability. Forgot password returned token inline (not secure for production).

**Now:** Full Gmail API integration via OAuth 2.0. The server can send real HTML emails.

#### What changed

| File | What |
|---|---|
| `api/src/shared/lib/gmail.ts` | Gmail API mailer — `getOAuthUrl()`, `exchangeCode()`, `sendEmail()`, auto token refresh, persistent storage in `.gmail-tokens.json` |
| `auth.controller.ts` | `gmailOAuthUrl()` — returns Google consent URL. `gmailCallback()` — handles redirect, exchanges code, stores refresh token. `gmailStatus()` — check auth state |
| `auth.routes.ts` | `GET /auth/gmail-oauth-url`, `GET /auth/gmail-callback`, `GET /auth/gmail-status` |
| `.env` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| `.gitignore` | `.gmail-tokens.json` added |

#### OAuth Flow
1. Admin visits `/api/v1/auth/gmail-oauth-url` → Google consent screen
2. Grants consent → Google redirects to `/api/v1/auth/gmail-callback?code=...`
3. Server exchanges code for tokens, stores refresh token
4. `sendEmail()` available — auto-refreshes access token

#### Verified
- ✅ OAuth URL generated with correct client ID + scopes
- ✅ Code exchange → tokens persisted
- ✅ `sendEmail()` sends via Gmail REST API
- ✅ Token auto-refresh on expiry
- ✅ Test email sent to info@eunika.agency

---

### 4. HTML Email Templates (7 Types)

**Before:** Plain-text only emails.

**Now:** Designed HTML emails with inline CSS (Gmail-safe).

#### Layout
- 🟢 **Header:** Lime green (`#b9e615`) background, "PickleBallers" wordmark
- ⬜ **Body:** White card with receipt-style layout, itemized breakdown, status badge
- ⬛ **Footer:** Dark navy (`#0b1220`) background, "sent from a court near you"
- **Outer:** Slate (`#64748b`) background, card max-width 600px

#### Templates

| Template | Use Case | Badge |
|---|---|---|
| `welcomeEmail` | Account created | — |
| `passwordResetEmail` | Forgot password | — |
| `bookingConfirmedReceipt` | Instant booking | 🟢 Confirmed |
| `bookingRequestedReceipt` | Request-to-book | 🟡 Pending |
| `bookingApprovedReceipt` | Owner approved | 🔵 Approved |
| `paymentReceipt` | Payment completed | 🟢 Paid |
| `cancellationReceipt` | Booking cancelled | 🔴 Cancelled |
| `membershipReceipt` | Membership joined | 🟢 Active |

---

### 5. Email Triggers Wired

All 7 templates connected to actual business events:

| Trigger | Template | Controller |
|---|---|---|
| Register | Welcome | `auth.controller.ts` → `register()` |
| Forgot password | Password reset | `auth.controller.ts` → `forgotPassword()` |
| Book court (instant) | Booking confirmed | `bookings.controller.ts` → `createBooking()` |
| Book court (approval) | Booking requested | `bookings.controller.ts` → `createBooking()` |
| Owner approves | Booking approved | `venues.controller.ts` → `updateBookingStatus()` |
| Checkout (pay) | Payment receipt | `payments.controller.ts` → `checkout()` |
| Cancel booking | Cancellation | `bookings.controller.ts` → `cancelBooking()` |
| Join membership | Membership confirmed | `venues.controller.ts` → `joinVenueMembership()` / `subscribeToPlan()` |

All emails are **best-effort, non-blocking** — failures don't affect the API response.

---

### 6. Email BCC (Monitoring)

**Before:** No way to monitor outgoing emails.

**Now:** Admin-toggleable BCC — a copy of every transactional email goes to a monitoring address.

#### What changed

| Layer | File | What |
|---|---|---|
| API | `settings.model.ts` | `emailBccEnabled` (bool), `emailBccAddress` (string) |
| API | `settings.controller.ts` | `getEmailBcc()` server-side helper, `PATCH /settings` accepts BCC fields |
| API | `gmail.ts` | `sendEmail()` checks settings, adds `Bcc:` header when enabled |
| Web | `AdminSettingsPage.jsx` | "Email monitoring" section with BCC toggle + email input + Save |
| PWA | `SettingsScreenV2.tsx` | Same section under Settings (admin-only) |
| PWA | `SettingsScreen.tsx` (v1) | Same section (admin-only) |
| PWA | `api.ts` | `AppSettings` extended + `updateSettings()` added |

#### Toggle via API
```bash
# ON
PATCH /api/v1/settings { "emailBccEnabled": true, "emailBccAddress": "info@eunika.agency" }
# OFF
PATCH /api/v1/settings { "emailBccEnabled": false }
```

---

### 7. Other API Gaps Closed

| Gap | Resolution |
|---|---|
| **VenuePricing controller** | `GET /venues/:id/pricing` — public read-only, lists imported rich pricing rows |
| **Booking modify endpoint** | Already implemented — removed misleading "TBD" comment |
| **`/lists` catalogue** | Updated with 8 new routes: forgot-password, reset-password, verify-email, resend-verification, gmail-oauth-url, gmail-callback, gmail-status, venues/:id/pricing |

#### Skipped
- **EventRegistration join/leave** — `Event` model exists but events aren't part of current product surface
- **Pool-play bracket playoff seeding** (`bracketEngine.ts:443`) — complex, requires tournament workflow design

---

### 8. Refunds Automation

**Before:** `BookingRefundScreen` showed "Automatic refunds aren't available yet" — all refunds were manual.

**Now:** In test mode, refunds are processed automatically on cancellation.

#### What changed

| Layer | File | What |
|---|---|---|
| API | `bookings.controller.ts` | `cancelBooking()` — finds associated `Payment` record, auto-marks it `refunded` in test mode, sets `refundStatus` |
| PWA | `BookingRefundScreen.tsx` | Removed "not automated yet" notice. Test mode: shows "Booking cancelled & refunded" + "Your payment has been automatically refunded". Button says "Cancel booking & auto-refund". Live mode: shows "Any eligible refund will be reviewed". |

---

### 9. Web Forgot Password + Reset Pages

**Before:** No forgot password flow on web. PWA had it but web didn't.

**Now:** Full forgot/reset password pages on web frontend.

#### What changed

| File | What |
|---|---|
| `web/src/features/auth/ForgotPasswordPage.jsx` | (NEW) Email form → calls `POST /auth/forgot-password` |
| `web/src/features/auth/ResetPasswordPage.jsx` | (NEW) Token + new password form → calls `POST /auth/reset-password` |
| `web/src/features/auth/LoginPage.jsx` | "Forgot password?" link → navigates to `/forgot-password` |
| `web/src/router.jsx` | `lazy()` imports + routes for `/forgot-password` and `/reset-password` |

#### Verified
- ✅ Build produces `ForgotPasswordPage-*.js` and `ResetPasswordPage-*.js` chunks
- ✅ LoginPage chunk includes "forgot-password" link
- ✅ Deployed and live at pickleballer.eunika.xyz/forgot-password

---

### 10. Test Email Tool (API)

**Before:** No way to preview email templates without triggering actual events.

**Now:** Admin-only endpoint to send sample emails for any template.

| Route | What |
|---|---|
| `POST /api/v1/settings/test-email` | Admin-gated. Body: `{ email, templates: ['password-reset', ...] }`. Sends sample of each selected template. |

Templates selectable: `welcome`, `password-reset`, `email-verification`, `booking-confirmed`, `booking-requested`, `booking-approved`, `payment-receipt`, `cancellation`, `membership`

#### Verified
- ✅ Password reset sample sent to info@eunika.agency

---

### 11. Test Email Tool (PWA UI)

Added admin-only "Test email tool" section in Settings, alongside the existing Email monitoring BCC section.

#### What changed

| Layer | File | What |
|---|---|---|
| PWA | `SettingsScreen.tsx` (v1) | "Test email tool" card — target email input, "Select all" checkbox, individual template checkboxes (all checked by default), "Send test emails" button, result feedback (green success / coral error) |
| PWA | `SettingsScreenV2.tsx` (v2) | Same tool in v2 design — uses `Toggle` switches per template instead of checkboxes, matching v2 Settings style |
| PWA | `api.ts` | `sendTestEmails(email, templates)` + `TestEmailTemplate` type + `TEST_EMAIL_TEMPLATES` const |
| API | `settings.controller.ts` | `sendTestEmail()` handler — validates templates, builds sample data for each, sends via Gmail, returns per-template results |
| API | `settings.routes.ts` | `POST /settings/test-email` route (auth-gated) |
| API | `root.controller.ts` | `/lists` entry for test-email |

#### Verified
- ✅ All 9 templates sent successfully from the PWA Settings
- ✅ Validation rejects invalid templates
- ✅ Auth required (401 without token)
- ✅ Template list has visible border (user feedback)

**Follow-up (same day):** Moved the test email tool to its own screen (see §11b).

---

### 11b. Test Email Tool — Moved to Separate Screen

**Before:** The test email tool was a large inline section inside both Settings screens (v1 `SettingsScreen.tsx` and v2 `SettingsScreenV2.tsx`), cluttering the settings page.

**Now:** Standalone screen at `/settings/test-email`, reachable via an "Admin tools" row in Settings.

#### What changed

| Layer | File | What |
|---|---|---|
| PWA | `TestEmailScreen.tsx` | (NEW) Standalone admin-only screen — recipient email input, template checkboxes (full height, no scroll limit), "Send test emails" button, result feedback. Uses `ScreenHeader` with back button |
| PWA | `navigation.ts` | `test-email` added to Screen union, path `/settings/test-email`, `deepLinkParent` → `settings` |
| PWA | `App.tsx` | Render case + `admin.access` permission gate |
| PWA | `SettingsScreen.tsx` (v1) | Removed inline test email tool (state, handlers, JSX). Added "Admin tools" section with link row → `test-email` |
| PWA | `SettingsScreenV2.tsx` (v2) | Same — removed inline tool, added "Admin tools" settings-list row. Also cleaned up unused `bccLoaded` state |
| PWA | `FILEMAP.md` | Updated profile slice entry |

#### Verified
- ✅ Build clean (no new TS errors)
- ✅ Template list renders full height (no `max-h` scroll clamp)
- ✅ Admin-gated via `admin.access` permission
- ✅ Back button returns to Settings

---

### 12. Forgot/Reset Password Screen Fixes

**Problem:** Both `ForgotPasswordScreen` and `ResetPasswordScreen` rendered a blank black screen on load. Root cause: `useForm` hook doesn't have `bind()` or `validateAll()` methods — calling `form.bind('email')` threw `TypeError`, crashing the component.

Also: `LoginScreen`'s "Forgot password?" button called `onNavigate('forgot-password')` but `onNavigate` was never passed as a prop.

#### What changed

| File | What |
|---|---|
| `ForgotPasswordScreen.tsx` | Replaced `form.bind('email')` → explicit `value`/`onChange`/`onBlur`/`error` props. Replaced `form.validateAll()` → `form.setTouched()` + `form.isValid`. Fixed `Button` — was using non-existent `label` prop → `children`. Changed `variant="secondary"` (invalid) → `"outline"`. Centered layout — icon + title + form in `max-w-[360px]` container. Added `bg-[var(--bg)]`. |
| `ResetPasswordScreen.tsx` | Same fixes as ForgotPasswordScreen for all 3 fields. Centered layout. Removed `label`/`onClick` props from `Button`. Added `bg-[var(--bg)]`. |
| `LoginScreen.tsx` | Added `onNavigate: Navigate` to props interface + destructure. |
| `App.tsx` | Pass `onNavigate={navigate}` to `LoginScreen`. Skip splash screen on `/reset-password` and `/forgot-password` paths (deep-link entry points from email — splash is for cold app launch). |

---

### 13. Edit Profile — Email Field

Added a disabled "Email" field on the Edit Profile screen so users can see which email is tied to their account.

**Problem:** `AppUser` interface had no `email` field even though `ApiUser` did — `toAppUser()` never mapped it.

#### What changed

| File | What |
|---|---|
| `permissions.ts` | Added `email: string` to `AppUser` interface |
| `api.ts` | Added `email: api.email` to `toAppUser()` mapping |
| `EditProfileScreen.tsx` | Disabled `FormField` with `trailingSlot` "Read-only" pill badge, hint "Contact support to change your email." |

---

### 14. Password Changed Notification Email

**Before:** No notification when a user's password was changed — only the reset-token email on forgot-password.

**Now:** After a successful password reset, the user receives a security notification email telling them their password was changed, with a warning if they didn't do it.

#### What changed

| File | What |
|---|---|
| `email-templates.ts` | NEW `passwordChangedEmail()` template — simple security notification: "Your password was changed. If this was you, no action needed. If not, reset immediately." |
| `auth.controller.ts` | `resetPassword()` now sends the notification email after marking the token used (same fire-and-forget pattern as `forgotPassword`) |

---

### 15. Sender Name "Pickleballers" on All Emails

**Before:** `From` header was bare email `noreply@pickleballer.eunika.xyz` — inbox showed "noreply" as sender.

**Now:** `From` header is `Pickleballers <noreply@pickleballer.eunika.xyz>` — inbox shows "Pickleballers" as sender. Respects `opts.from` and `EMAIL_FROM` env var if set.

| File | What |
|---|---|
| `gmail.ts` | Default `from` changed to include display name |

---

### 16. Monitoring Copy as Separate Email (Not BCC)

**Before:** The monitoring system used a `Bcc:` header on the original email — the monitoring inbox got an invisible copy with no context about who triggered it.

**Now:** `sendEmail()` sends a **separate** email to the monitoring address with an enriched subject: `[Juan Dela Cruz - player] Reset your PickleBallers password`. This also means the monitoring email appears as a direct message in the inbox, not as a blind copy.

#### What changed

| File | What |
|---|---|
| `gmail.ts` | Extracted `buildRawMessage()` helper. `sendEmail()` now sends the main email first, then a separate monitoring copy via a second `gmail.users.messages.send()` call. Added optional `userInfo` param for subject enrichment |
| `auth.controller.ts` | All three email call sites (register, forgot-password, reset-password) now pass `userInfo: \`${displayName} - ${role}\`` |

#### Monitoring subject format
- **With userInfo:** `[Juan Dela Cruz - player] Reset your PickleBallers password`
- **Without userInfo:** unchanged subject (for call sites not yet updated with user context)

---

### 17. Test Email Tool — `password-changed` Template Added

Added the new `password-changed` template to the test email tool's template selection so admins can preview it.

| File | What |
|---|---|
| `settings.controller.ts` | `password-changed` added to `TEMPLATE_KEYS`, `buildSample` case added, `passwordChangedEmail` imported |
| `api.ts` (app) | `password-changed` added to `TEST_EMAIL_TEMPLATES` const |
| `TestEmailScreen.tsx` | `'password-changed': 'Password changed notification'` added to `TEMPLATE_LABELS` |

---

### 18. Visible Borders on Email Input Fields

Added thicker, more visible borders on email input fields across the test email tool and email monitoring settings.

| File | Input | Change |
|---|---|---|
| `TestEmailScreen.tsx` | Recipient email | `border border-[var(--hairline)]` → `border-2 border-[var(--muted)] focus:border-[var(--lime)]` |
| `SettingsScreen.tsx` (v1) | BCC address | Same change |
| `SettingsScreenV2.tsx` (v2) | BCC address | `1px solid var(--hairline)` → `2px solid var(--muted)` (inline style) |

---

### 19. Fixed Monitoring Copy Not Sending (DB Bug)

**Bug:** Despite `emailBccEnabled: true` and `emailBccAddress` appearing to be set in the API response, the monitoring copy was never sent. Root cause: `emailBccAddress` field was **missing from the MongoDB document** entirely. The `publicShape()` function masked it with `?? 'info@eunika.agency'`, but `getEmailBcc()` did a strict truthy check on the raw field (`s?.emailBccAddress`) which returned `undefined` → condition failed → returned `null`.

#### Fix

| File | What |
|---|---|
| `settings.controller.ts` | `getEmailBcc()` now uses `s.emailBccAddress \|\| 'info@eunika.agency'` as fallback, matching `publicShape`'s behavior |
| MongoDB | Backfilled `emailBccAddress: "info@eunika.agency"` on the existing `AppSettings` document |

#### Verified
- ✅ Monitoring copy now sent to `info@eunika.agency`
- ✅ Subject enriched: `[edu.eunika - player] Reset your PickleBallers password`

---

### 20. Renamed "BCC" Labels to "Email Monitoring"

**Before:** All user-facing labels said "BCC emails" — inaccurate since it's now a separate email, not a blind carbon copy.

**Now:** All user-facing text updated:
- "BCC a copy" → "Send a copy"
- "BCC emails" → "Email monitoring"
- "Copies sent to" → "Monitoring copies sent to"

| File | What |
|---|---|
| `SettingsScreen.tsx` (v1) | Labels updated |
| `SettingsScreenV2.tsx` (v2) | Labels, description, status text, and toggle label updated |

---

## Part 2: Staff Scope, Club Staff & Custom Amenities

### 1. Staff — Per-Venue Access Fix (Breaking Change)

**Before:** Staff accounts created at `/owner/staff` inherited the owner's full portfolio via `parentOwnerId` in the JWT. `effectiveOwnerId()` resolved to the owner's ID, granting staff access to ALL venues, bookings, clubs, and games — without any per-venue assignment.

**Now:** Staff accounts start with ZERO venue access. They must be explicitly added to individual venues through each venue's Staff tab, which creates `VenueStaff` rows. The `parentOwnerId` is removed from the JWT entirely — staff permissions come only from `VenueStaff` assignments.

#### What changed

| Layer | File | What |
|-------|------|------|
| API | `auth/auth.controller.ts` | Removed `parentOwnerId` from JWT payload (`tokenPayloadFor`). The field stays on the User doc only for `listStaff` queries |
| API | `staff/staff.controller.ts` | Updated module comment — no longer "manage ALL venues" |
| API | `permissions.ts` | `effectiveOwnerId()` now returns staff's own ID (no `parentOwnerId` in token) |
| PWA | `OwnerStaffScreen.tsx` | Updated subtitle, comment, and info banner — now says "add to specific venues" |
| PWA | `StaffEditorTab.tsx` | Search now uses `searchOwnerStaff` (owner-scoped) instead of `searchPlayers` (global) |

#### Verified
- ✅ Staff JWT has `parentOwnerId: null`
- ✅ `listVenues?managedByUserId=<staffId>` returns 0 venues for unassigned staff
- ✅ Staff can only access venues where they have a `VenueStaff` row
- ✅ Clubs: `isHostOf` returns false for staff without `parentOwnerId`
- ✅ Staff see public clubs normally (same as players)

---

### 2. Per-Venue Staff Tab — Staff-Only Search + On-Focus Suggestions

**Before:** The "Find a person" search in the Staff tab used `searchPlayers`, which returned ALL users in the system (players, coaches, anyone). No suggestions on focus.

**Now:** Search is scoped to staff accounts created by this owner only. On-focus auto-suggests all owner's staff.

#### What changed

| Layer | File | What |
|-------|------|------|
| API | `search/search.controller.ts` | Added `ownerUserId` query param. When set with `type=players`, filters to `roleDefault:'staff'` + `parentOwnerUserId` match. `q` made optional — empty query returns all staff of that owner (on-focus suggestions). Limit: 30 for staff search, 10 for regular. Added `isStaff` boolean to results |
| PWA | `api.ts` | Added `searchOwnerStaff(ownerUserId, q?)` function |
| PWA | `StaffEditorTab.tsx` | Uses `searchOwnerStaff` instead of `searchPlayers`. `onFocus` handler loads suggestions. Placeholder: "Search your staff accounts…". Empty state: "No matching staff found. Create staff accounts in Owner → Staff first." Added "No staff yet? Create one in Owner → Staff" link |
| PWA | `OwnerVenueScreen.tsx` | Passing `onNavigate` to `StaffEditorTab` for the link |

#### Verified
- ✅ On-focus with empty field: returns all staff of this owner
- ✅ Typed search: returns only matching staff of this owner
- ✅ Regular users/players never appear in results

---

### 3. Club Staff — Per-Club Staff Assignment

**Before:** No per-club staff assignment existed. Staff inherited the owner's full club portfolio via `parentOwnerId` → `isHostOf`.

**Now:** Club hosts can assign staff to specific clubs as moderators. Club staff can moderate posts and members but cannot delete the club or manage other staff.

#### What changed

| Layer | File | What |
|-------|------|------|
| API | `clubs/clubs.model.ts` | New `ClubStaff` model: `clubId`, `userId`, `staffRole` (default: 'moderator'), `status`. Unique index on `(clubId, userId)` |
| API | `clubs/clubs.controller.ts` | Added `isClubStaff()`, `canModerateClub()` (host OR staff). Added `getClubStaff`, `addClubStaff`, `removeClubStaff` handlers. Updated `listClubs` `mine` to include ClubStaff clubs. Updated `serializeClub` to include `isStaff`. Updated moderation gates: edit club, remove member, moderate posts now allow ClubStaff. Delete club and manage staff remain host-only |
| API | `clubs/clubs.routes.ts` | Added `GET/POST /:id/staff`, `DELETE /staff/:id` (declared before bare `/:id`) |
| PWA | `api.ts` | New `ApiClubStaff` type. `isStaff` on `ApiClub`. `listClubStaff`, `addClubStaff`, `removeClubStaff` functions |
| PWA | `ClubDetailsScreen.tsx` | Staff section in About tab (host-only): list current staff with role badges + Remove, search owner's staff accounts via `searchOwnerStaff` with focus suggestions, add as moderator |

#### API routes
| Method | Path | Gate |
|--------|------|------|
| GET | `/clubs/:id/staff` | Host only |
| POST | `/clubs/:id/staff` | Host or `owner.staff.manage` |
| DELETE | `/clubs/staff/:id` | Host or `owner.staff.manage` |

#### Verified
- ✅ Host creates club → adds staff → staff appears in list
- ✅ Staff's `mine: true` clubs list includes assigned club with `isStaff: True`
- ✅ Staff can moderate posts/remove members (via `canModerateClub`)
- ✅ Staff cannot delete club (host-only gate preserved)
- ✅ Staff cannot view/manage other staff (host-only gate preserved)
- ✅ Duplicate add blocked (409)
- ✅ Reactivating inactive staff assignment works

---

### 4. Custom Amenities — ListingEditorTab

**Before:** 13 preset amenity toggles only. No way to add custom amenities.

**Now:** Custom amenities TagField below presets in the Amenities section.

#### What changed

| Layer | File | What |
|-------|------|------|
| API | `venues/venues.model.ts` | Added `customAmenities: [String]` to Venue interface + schema |
| API | `venues/venues.controller.ts` | Added `customAmenities: z.array(z.string()).max(20).optional()` to `updateVenueSchema` |
| PWA | `api.ts` | Added `customAmenities?: string[] \| null` on `ApiVenue` |
| PWA | `venueDisplay.ts` | `venueAmenities()` now merges boolean flags + `customAmenities` (not override) |
| PWA | `ListingEditorTab.tsx` | `TagField` for custom amenities below preset chips. Placeholder: "e.g. Ball machine, Locker room, etc." Updated description |

#### Verified
- ✅ Custom amenities saved and returned in venue detail
- ✅ Player-facing Court Details shows custom amenities alongside presets
- ✅ 20-item max enforced by Zod schema

---

### 5. CSV & Test Guide Updates

| File | Change |
|------|--------|
| `TASKS/Copy of Standardised Pickleballers - Pickleballers Questions.csv` | Row 43 (curated highlights) → Done. Row 49 formatting fixed. Row 53 removed |
| `TASKS/test-guide.md` | Added test paths for custom amenities, staff per-venue, staff tab search, club staff |
| `TASKS/demo-tour-guide.md` | Added sections 28 (staff per-venue), 29 (club staff), 30 (custom amenities) |

---

*Generated 2026-07-01. Covers all changes across both sessions.*
