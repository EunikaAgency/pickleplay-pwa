// Auth API client — connects the PWA to the Hono/MongoDB API.
//
// In dev, request paths are relative ('/api/v1/...') and Vite proxies them to
// the API on localhost:9002 (see vite.config.ts). In production the PWA and API
// live on different subdomains, so set VITE_API_BASE_URL to the API origin
// (e.g. https://pickleballer-api.eunika.xyz) — CORS already allows the PWA host.

import { DEFAULT_PREFERENCES, normalizeRole, resolveRolePermissions, resolveSubscriptionPermissions, type AppUser, type Gender, type Permission, type PrivacySetting, type UserPreferences } from './permissions';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
const AUTH_PREFIX = '/api/v1/auth';

/** Resolve an API path to a full URL using the same base as fetch requests
 *  (relative in dev so Vite proxies it; the API origin in prod). Used for
 *  EventSource, which needs an absolute URL in prod. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

// Image/asset files (e.g. "/images/venues/<slug>/court.jpg") are served by the
// API itself and are NOT proxied at the app's own origin (only `/api` is), so a
// relative path would 404 against the PWA. Resolve them against the API host —
// preferring VITE_API_BASE_URL, else the prod API origin (mirrors web's client).
const ASSET_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://pickleballer-api.eunika.xyz').replace(/\/+$/, '');

/** Resolve an API image path to an absolute URL; passes absolute URLs through, '' when empty. */
export function apiImageUrl(path?: string | null): string {
  if (!path) return '';
  const v = path.trim();
  // Guard against non-image junk in the seed data — placeholder text ("Unknown")
  // and social-media page links stored where an image URL was expected. Using
  // them as an <img src> just 404s / gets ORB-blocked, so fall back to the
  // gradient (empty) instead of spamming the console.
  if (!v || /^unknown$/i.test(v)) return '';
  if (/^https?:\/\/(www\.)?(instagram|facebook|fb|tiktok|twitter|x|youtube|youtu)\.[a-z.]+/i.test(v)) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `${ASSET_BASE}${v.startsWith('/') ? v : `/${v}`}`;
}

const ACCESS_TOKEN_KEY = 'pb-access-token';
const REFRESH_TOKEN_KEY = 'pb-refresh-token';
// The mapped AppUser is cached alongside the tokens so a page refresh can
// rehydrate the logged-in UI synchronously (no flash of guest/fallback state
// while /me revalidates in the background). Cleared whenever tokens are.
const USER_KEY = 'pb-user';

/* ─── Token storage ─────────────────────────────────────────── */

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setTokens(accessToken: string, refreshToken: string) {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch {
    // localStorage may be unavailable (private mode); the session just won't
    // survive a reload, which is acceptable.
  }
}

export function clearTokens() {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

// When a mid-session token refresh fails for good (the refresh token is gone or
// expired/revoked), we clear the tokens and fire this so the auth store can drop
// to guest — otherwise authed pollers (the notification badge) keep firing 401s
// on a loop against a dead session. Set by authStore on init (one-directional:
// authStore → api, so there's no circular import).
let sessionExpiredHandler: (() => void) | null = null;
export function onSessionExpired(handler: () => void): void {
  sessionExpiredHandler = handler;
}

/** Whether a stored access token exists — used to attempt session restore. */
export function hasStoredSession(): boolean {
  return getAccessToken() !== null;
}

/** Cache the mapped user for synchronous rehydration on the next cold start. */
function storeUser(user: AppUser) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // localStorage may be unavailable; we just lose the optimistic rehydrate.
  }
}

/**
 * The last-known user from a prior session, or null. Used to seed the auth store
 * on cold start so the logged-in UI renders immediately; `restore()` then
 * revalidates against /me and corrects/clears it. Only trusted when a token is
 * also present (the two are written and cleared together).
 */
export function getStoredUser(): AppUser | null {
  if (!hasStoredSession()) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

/* ─── Errors ────────────────────────────────────────────────── */

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/* ─── Low-level request ─────────────────────────────────────── */

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Attach `Authorization: Bearer <accessToken>`. */
  auth?: boolean;
  /** Abort the request when this signal fires (e.g. a superseded type-ahead lookup). */
  signal?: AbortSignal;
  /** Internal: set once a request has already been retried after a token refresh. */
  _retried?: boolean;
}

interface Envelope<T> {
  data?: T;
  meta?: { total?: number; cursor?: string | null };
  error?: { code?: string; message?: string };
}

// Core fetch: returns the full response envelope (so list callers can read
// `meta.cursor` for pagination). Throws ApiError on network failure or !ok.
async function rawRequest<T>(path: string, { method = 'GET', body, auth = false, signal, _retried = false }: RequestOptions = {}): Promise<Envelope<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    if (signal?.aborted) throw new ApiError('Request aborted.', 'ABORTED', 0);
    throw new ApiError('Network error — could not reach the server.', 'NETWORK', 0);
  }

  // Access token expired (15m TTL): transparently refresh using the stored
  // refresh token (valid 7d) and retry the original request once. This is what
  // keeps a session alive across reloads instead of dropping to logged-out.
  if (res.status === 401 && auth && !_retried) {
    const refreshed = await refreshSession();
    if (refreshed) return rawRequest<T>(path, { method, body, auth, signal, _retried: true });
  }

  const json = (await res.json().catch(() => null)) as Envelope<T> | null;

  if (!res.ok) {
    throw new ApiError(
      json?.error?.message || `Request failed (${res.status})`,
      json?.error?.code || 'ERROR',
      res.status,
    );
  }

  return json ?? {};
}

/** Like rawRequest but unwraps to just the `data` payload (the common case). */
async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const env = await rawRequest<T>(path, opts);
  return (env.data ?? null) as T;
}

/* ─── API user payload ──────────────────────────────────────── */

/** The user object the API returns from /login and /me (authUserPayload). */
export interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  roleDefault?: string | null;
  role?: string | null;
  roles?: string[];
  permissions?: string[];
  /** Per-account grants ALONE (not merged with role perms) — an owner can grant
   *  a staff member extra capabilities (e.g. pricing/analytics) from the Access
   *  panel. Layered on top of the client's own role-derived set in `toAppUser`. */
  grantedPermissions?: string[];
  skillLevel?: number | null;
  skillLevelLabel?: string | null;
  bio?: string | null;
  gender?: string | null;
  birthday?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  zipcode?: string | null;
  /** Coordinates of the saved address — restores the profile map's pin. */
  lat?: number | null;
  lng?: number | null;
  /** Whether the user has finished (or skipped) first-run onboarding. */
  hasOnboarded?: boolean | null;
  /** Whether the user has confirmed ownership of their email via the verify link. */
  isVerified?: boolean | null;
  preferences?: UserPreferences | null;
  privacySetting?: string | null;
  /** Live paid partner subscriptions — NOT the same as holding the role. */
  coachSubscriptionActive?: boolean | null;
  organizerSubscriptionActive?: boolean | null;
  /** Per-venue partner badges ("Coach at <venue>", "Organiser at <venue>"). */
  partnerRoles?: Array<{ role: string; venueId: string; venueName: string }>;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Map the API user payload onto the app's `AppUser`. We re-derive the role- and
 * subscription-based permissions from the app's own `resolveRolePermissions`
 * (so the client stays authoritative for those even if the two lists drift), and
 * we layer on the server's `grantedPermissions` — the per-account grants ALONE
 * (e.g. a staff member the owner granted `owner.pricing.manage`), which the
 * client can't reconstruct from roles. We deliberately do NOT trust the server's
 * merged `permissions` array: the DB role set can drift (e.g. the live staff role
 * carries `owner.analytics.view`), and honouring that would leak capabilities the
 * owner never granted per-staff. Grants are the only server-derived add-on.
 */
/** Coerce the API's free-string privacy field to a known value (default public). */
function normalizePrivacy(value?: string | null): PrivacySetting {
  return value === 'private' || value === 'friends' ? value : 'public';
}

/** Accounts predating the field have no gender — leave it unset rather than
 *  guessing one, so the profile editor can require the user to pick. */
function normalizeGender(value?: string | null): Gender | undefined {
  return value === 'male' || value === 'female' ? value : undefined;
}

export function toAppUser(api: ApiUser): AppUser {
  const sourceRoles = api.roles?.length ? api.roles : [api.roleDefault ?? api.role ?? 'player'];
  const roles = [...new Set(sourceRoles.map(normalizeRole))];
  return {
    id: String(api.id),
    email: api.email,
    displayName: api.displayName || api.email,
    firstName: api.firstName ?? undefined,
    // Stored as a relative '/uploads/<file>' path (served by the API host, not
    // the PWA origin), so resolve it to an absolute URL like venue images do —
    // otherwise a freshly cropped avatar 404s against the app origin.
    avatarUrl: apiImageUrl(api.avatarUrl) || undefined,
    skillLevel: typeof api.skillLevel === 'number' ? api.skillLevel : undefined,
    skillLevelLabel: api.skillLevelLabel ?? undefined,
    bio: api.bio ?? undefined,
    gender: normalizeGender(api.gender),
    birthday: api.birthday ?? undefined,
    address1: api.address1 ?? undefined,
    address2: api.address2 ?? undefined,
    city: api.city ?? undefined,
    province: api.province ?? undefined,
    zipcode: api.zipcode ?? undefined,
    lat: typeof api.lat === 'number' ? api.lat : undefined,
    lng: typeof api.lng === 'number' ? api.lng : undefined,
    hasOnboarded: api.hasOnboarded ?? false,
    isVerified: !!api.isVerified,
    preferences: api.preferences ?? DEFAULT_PREFERENCES,
    privacySetting: normalizePrivacy(api.privacySetting),
    coachSubscriptionActive: !!api.coachSubscriptionActive,
    organizerSubscriptionActive: !!api.organizerSubscriptionActive,
    roleDefault: normalizeRole(api.roleDefault ?? api.role),
    roles,
    // Role permissions PLUS whatever the user's live partner subscriptions
    // unlock — coach/organizer are no longer roles, so a subscribed partner is a
    // plain `player` and would otherwise resolve to zero partner permissions.
    // PLUS the per-account grants an owner set for this staff member (e.g.
    // `owner.pricing.manage`) — the ONLY server-derived add-on we trust, so a
    // drifted DB role can't leak capabilities the owner never granted.
    permissions: [...new Set([
      ...resolveRolePermissions(roles),
      ...resolveSubscriptionPermissions([
        ...(api.coachSubscriptionActive ? ['coach' as const] : []),
        ...(api.organizerSubscriptionActive ? ['organizer' as const] : []),
      ]),
      ...((api.grantedPermissions ?? []) as Permission[]),
    ])],
    partnerRoles: api.partnerRoles ?? [],
  };
}

/* ─── Auth operations ───────────────────────────────────────── */

/** Log in with email + password; stores tokens and returns the mapped user. */
export async function login(email: string, password: string): Promise<AppUser> {
  const data = await request<AuthTokens & { user: ApiUser }>(`${AUTH_PREFIX}/login`, {
    method: 'POST',
    body: { email, password },
  });
  setTokens(data.accessToken, data.refreshToken);
  const user = toAppUser(data.user);
  storeUser(user);
  return user;
}

/** Roles a user can self-select at sign-up. Only player and owner — coach and
 *  organizer are earned per-venue via application/approval, not chosen here;
 *  admin/moderator are admin-assigned. Mirrors the API's REGISTERABLE_ROLES. */
export type RegisterRole = 'player' | 'owner';

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  /** Defaults to `player` server-side when omitted. */
  role?: RegisterRole;
  gender?: Gender;
  /** `YYYY-MM-DD`. */
  birthday?: string;
}

/** Create a new account (role defaults to player), then sign in: stores tokens + returns the user. */
export async function register(payload: RegisterPayload): Promise<AppUser> {
  const data = await request<AuthTokens & { user: ApiUser }>(`${AUTH_PREFIX}/register`, {
    method: 'POST',
    body: payload,
  });
  setTokens(data.accessToken, data.refreshToken);
  const user = toAppUser(data.user);
  storeUser(user);
  return user;
}

/**
 * Exchange the stored refresh token for a fresh token pair. Returns true on
 * success. A 401 means the refresh token itself is invalid/expired → clear the
 * session; any other failure (network/server) is transient and leaves the
 * tokens in place so a later retry can still succeed. Declared as a hoisted
 * function so `rawRequest` can call it for its 401-retry.
 */
// Coalesce concurrent refreshes: when several authed requests 401 on the same
// tick (e.g. the badge poll + a club feed load), they must share ONE refresh —
// otherwise the first rotates the refresh token and the rest 401 on the now-stale
// one and spuriously tear down a session that was actually just renewed.
let refreshInFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefreshSession().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function doRefreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) { sessionExpiredHandler?.(); return false; }
  try {
    const data = await request<AuthTokens>(`${AUTH_PREFIX}/refresh`, {
      method: 'POST',
      body: { refreshToken },
    });
    if (data?.accessToken && data?.refreshToken) {
      setTokens(data.accessToken, data.refreshToken);
      return true;
    }
    // Malformed/empty refresh response — treat the session as over.
    clearTokens();
    sessionExpiredHandler?.();
    return false;
  } catch (err) {
    // Only a 401 means the refresh token itself is dead — clear + notify. Other
    // errors (network/server hiccup) are transient: keep the session, retry later.
    if (err instanceof ApiError && err.status === 401) {
      clearTokens();
      sessionExpiredHandler?.();
    }
    return false;
  }
}

/** Fetch the current user using the stored access token (for session restore). */
export async function fetchCurrentUser(): Promise<AppUser> {
  const apiUser = await request<ApiUser>(`${AUTH_PREFIX}/me`, { auth: true });
  const user = toAppUser(apiUser);
  storeUser(user);
  return user;
}

/**
 * The subset of profile fields the PWA lets a user edit on their own account.
 * `skillLevel` is sent as a string because the API's update schema declares it
 * as a string (the User model then coerces it back to a Number on save).
 */
export interface ProfileUpdate {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  gender?: Gender;
  /** `YYYY-MM-DD`; an empty string clears it. */
  birthday?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  zipcode?: string;
  /** Coordinates for the address above — saved so the profile map can restore the pin. */
  lat?: number;
  lng?: number;
  skillLevel?: string;
  skillLevelLabel?: string;
  hasOnboarded?: boolean;
  avatarUrl?: string;
  /** Profile visibility — public / friends / private. */
  privacySetting?: PrivacySetting;
  /** Partial preferences patch — merged into the saved preferences server-side. */
  preferences?: {
    notifications?: Partial<UserPreferences['notifications']>;
    units?: UserPreferences['units'];
    searchRadiusKm?: number;
  };
}

/**
 * Persist profile edits to the account (`PATCH /me`) and return the updated,
 * mapped user. Refreshes the cached user so a reload shows the saved values.
 */
export async function updateMe(patch: ProfileUpdate): Promise<AppUser> {
  const apiUser = await request<ApiUser>(`${AUTH_PREFIX}/me`, { method: 'PATCH', body: patch, auth: true });
  const user = toAppUser(apiUser);
  storeUser(user);
  return user;
}

/** Request a password-reset token for an email. In dev the response includes the
 *  token inline so the app can navigate straight to the reset screen; in prod it
 *  would be emailed. */
export async function forgotPassword(email: string): Promise<{ message: string; token?: string }> {
  return request<{ message: string; token?: string }>(`${AUTH_PREFIX}/forgot-password`, {
    method: 'POST',
    body: { email },
  });
}

/** Set a new password using a reset token. */
export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return request<{ message: string }>(`${AUTH_PREFIX}/reset-password`, {
    method: 'POST',
    body: { token, password },
  });
}

/** Confirm ownership of an email using the token from the verify link. Public —
 *  the link arrives by email and is opened before (or without) a session. */
export async function verifyEmail(token: string): Promise<{ message: string }> {
  return request<{ message: string }>(`${AUTH_PREFIX}/verify-email`, {
    method: 'POST',
    body: { token },
  });
}

/** Re-issue the verification email for the signed-in user. In dev (no email
 *  configured) the response carries the token inline so the flow is testable. */
export async function resendVerification(): Promise<{ message: string; token?: string }> {
  return request<{ message: string; token?: string }>(`${AUTH_PREFIX}/resend-verification`, {
    method: 'POST',
    body: {},
    auth: true,
  });
}

/** Best-effort server logout; always clears local tokens. */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    await request(`${AUTH_PREFIX}/logout`, {
      method: 'POST',
      body: refreshToken ? { refreshToken } : {},
      auth: true,
    });
  } catch {
    // Logout is best-effort — we drop local tokens regardless of the response.
  } finally {
    clearTokens();
  }
}

/* ─── Venues / courts ───────────────────────────────────────── */

const VENUES_PREFIX = '/api/v1/venues';

/** A venue as returned by the list endpoint (many fields are null in real data). */
/** A checkout payment option a venue can offer. */
export type PaymentOption = 'full' | 'deposit' | 'pay_at_venue';

export interface ApiVenue {
  id: string;
  slug: string;
  /** Optional owner-chosen vanity slug for the booking link (…/venues/<bookingSlug>). */
  bookingSlug?: string | null;
  displayName: string;
  area?: string | null;
  region?: string | null;
  city?: string | null;
  fullAddress?: string | null;
  /** Media-derived primary image (often empty — only ~20 venues have Media rows). */
  image?: string | null;
  /** Stored hero-image path (e.g. "/images/venues/<slug>/<file>.jpg"), served by the API. */
  mainImageUrl?: string | null;
  indoorOutdoor?: string | null;
  surfaceType?: string | null;
  courtCount?: number | null;
  priceFrom?: number | null;
  priceFromLabel?: string | null;
  pricingCurrency?: string | null;
  /** Booking policy: when true, bookings here need owner approval before payment. */
  requireBookingApproval?: boolean | null;
  /** Hours the player has to pay once the owner approves (request-to-book). */
  bookingPayWindowHours?: number | null;
  /** Ceiling on how long an unanswered request may hold a court. A ceiling, not
   *  a fixed window — short-notice bookings expire much sooner (the owner only
   *  gets a share of the time until play). Default 24. */
  approvalWindowHours?: number | null;
  /** Payment options offered at checkout (subset of full/deposit/pay_at_venue). Empty/unset → full only. */
  paymentOptions?: PaymentOption[] | null;
  /** Deposit size as a % of the total, when 'deposit' is offered. */
  depositPercent?: number | null;
  /** Day-based pricing: flat weekend (Sat/Sun) hourly rate override (₱). */
  weekendPrice?: number | string | null;
  /** Day-based pricing: flat holiday hourly rate override (₱), on `holidayDates`. */
  holidayPrice?: number | string | null;
  /** Dates (YYYY-MM-DD) treated as holidays for holiday pricing. */
  holidayDates?: string[] | null;
  /** Member pricing: % discount off the resolved rate for venue members (0 = none). */
  memberDiscountPercent?: number | null;
  statutoryDiscounts?: Array<{ category: 'senior' | 'pwd'; percent: number }> | null;
  /** Per-player surcharge: ₱ added per extra player beyond `perPlayerFeeThreshold`. */
  perPlayerFee?: number | string | null;
  /** Players included in the base rate before the per-player fee kicks in (default 1). */
  perPlayerFeeThreshold?: number | null;
  googleRating?: number | null;
  googleReviewCount?: number | null;
  amenityChips?: string[] | null;
  customAmenities?: string[] | null;
  hasParking?: boolean | null;
  hasToilets?: boolean | null;
  hasShowers?: boolean | null;
  hasFoodBeverage?: boolean | null;
  hasAc?: boolean | null;
  hasLighting?: boolean | null;
  hasSeating?: boolean | null;
  hasPaddleRental?: boolean | null;
  hasProShop?: boolean | null;
  hasOpenPlay?: boolean | null;
  /** Per-player price for open-play sessions at this venue (V3). */
  openPlayPrice?: number | string | null;
  /** Equipment/paddle rental add-on price (V2). */
  equipmentRentalPrice?: number | string | null;
  isBeginnerFriendly?: boolean | null;
  googleMapsUrl?: string | null;
  bookingUrl?: string | null;
  website?: string | null;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Present in the list projection so owners can filter to their own venues. */
  ownerUserId?: string | null;
  /** Claim lifecycle: 'claimed' | 'unclaimed'. */
  state?: string | null;
  isVerified?: boolean | null;
  /** Only present when fetched via listManagedVenues / owner detail — the
   *  viewer's role for this venue ('owner' > 'manager' > 'front_desk'). */
  viewerStaffRole?: VenueViewerRole | null;
}

/** A non-owner staff role on a venue. */
export type VenueStaffRole = 'manager' | 'front_desk';
/** The viewer's effective management role (owner outranks any staff role). */
export type VenueViewerRole = 'owner' | VenueStaffRole;

export interface ApiCourt {
  id: string;
  courtNumber: string;
  courtName?: string | null;
  /** Short owner-written blurb for this specific court. */
  description?: string | null;
  surfaceType?: string | null;
  indoor?: boolean | null;
  /** Sport played on this court (multi-sport venues mix these). Empty → pickleball. */
  sport?: string | null;
  /** Half-court / split-court: this court can be divided into `splitCount` sub-units. */
  isSplittable?: boolean | null;
  /** How many independently-playable units the court splits into (2–4). */
  splitCount?: number | null;
  /** Per-sub-unit hourly rates (PHP). Each sub-unit can override the court's base rate. */
  subUnitRates?: Array<{ index: number; hourlyRate: number }> | null;
  /** Per-court hourly rate (PHP). When set, it overrides the venue's flat
   *  priceFrom for bookings on this court; null/undefined → use the venue rate. */
  hourlyRate?: number | null;
  /** Per-court cover thumbnail (servable URL from the media library). */
  mainImageUrl?: string | null;
  /** The rest of the court's photo gallery (servable URLs). */
  galleryImageUrls?: string[] | null;
  /** Per-court override of the venue's booking-approval policy. 'inherit' (default)
   *  follows the venue; 'manual' forces request-to-book; 'auto' forces instant-book. */
  approvalMode?: 'inherit' | 'auto' | 'manual' | null;
  /** Optional turnover/buffer in minutes the court needs between bookings (0 = back-to-back). */
  turnoverMinutes?: number | null;
  /** ── Court profile ── owner-described physical attributes shown on the court page. */
  hasAircon?: boolean | null;
  highCeiling?: boolean | null;
  /** Run-off / clearance around the court, e.g. "3m". */
  spaceAroundCourt?: string | null;
  hasRefreshmentStand?: boolean | null;
  /** Floor finish, e.g. "Wood" / "Professional". */
  floorType?: string | null;
  /** Ball used on this court, e.g. "Indoor" / "Outdoor". */
  ballType?: string | null;
  /** This court's effective weekly hours (its own, or the inherited venue default),
   *  as a day→"06:00 - 22:00"/"Closed" dict. Present on the venue-detail projection. */
  hours?: Record<string, string> | null;
}

/** A single venue with the extra detail the get-by-id endpoint adds. */
export interface ApiVenueDetail extends ApiVenue {
  oneLineSummary?: string | null;
  description?: string | null;
  hours?: Record<string, string>;
  gallery?: string[];
  image?: string;
  courts?: ApiCourt[];
  /**
   * Platform-curated highlight badges, computed server-side from the venue's real
   * data + editorial (amenities, ratings, booking activity) — NOT owner-typed
   * claims. `bestFor` = use-case; `whatPlayersLike` = amenities/quality.
   */
  curatedHighlights?: { bestFor: string[]; whatPlayersLike: string[] } | null;
  /** Whether the signed-in player is a member of this venue (member pricing applies). */
  viewerIsMember?: boolean | null;
  /** The membership plan id the signed-in player joined here (null if not a member). */
  viewerMembershipTier?: string | null;
  /** ISO datetime when the player's membership expires (null if perpetual or not a member). */
  viewerMembershipExpiresAt?: string | null;
  /** If the viewer has a *pending* membership invite, its tier (null = no plan set
   *  yet — the app should show the plan picker before accepting). Undefined when the
   *  viewer has no pending invite at all. */
  viewerPendingMembershipTier?: string | null;
  /** FAQs for this venue. */
  faqs?: { id: string; question: string; answer: string }[];
}

export interface ListVenuesParams {
  search?: string;
  city?: string;
  indoorOutdoor?: 'Indoor' | 'Outdoor';
  hasOpenPlay?: boolean;
  isBeginnerFriendly?: boolean;
  sortBy?: 'displayName' | 'rating' | 'createdAt' | 'priceFrom';
  sortOrder?: 'asc' | 'desc';
  pageSize?: number;
  /** Opaque cursor from a previous page's `cursor`; omit for the first page. */
  cursor?: string;
  /** Server-side filter to a single owner's venues (used by the owner console). */
  ownerUserId?: string;
  /** Venues the current user manages — owned OR staffed. Self-only; each item
   *  comes back annotated with `viewerStaffRole`. Used by the owner/staff console. */
  managedByUserId?: string;
  /** Claim-lifecycle filter — 'unclaimed' drives the owner "claim a venue" search. */
  state?: 'claimed' | 'unclaimed';
  /** Also exclude venues that already have a pending ownership claim (claim search). */
  excludePendingClaims?: boolean;
}

/** One page of venues plus the cursor for the next page (null when exhausted). */
export interface VenuePage {
  items: ApiVenue[];
  cursor: string | null;
}

function toQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** List venues (the app's "Courts") — one page. Pass `cursor` to fetch the next. */
export async function listVenues(params: ListVenuesParams = {}): Promise<VenuePage> {
  // Send the token when present (safe for guests — the endpoint is optionalAuth).
  // The `managedByUserId` filter is self-only and 403s without it, so the owner/
  // staff console (which fetches its managed venues here) needs the header.
  const env = await rawRequest<ApiVenue[]>(`${VENUES_PREFIX}${toQuery({ pageSize: 20, ...params })}`, { auth: true });
  return { items: env.data ?? [], cursor: env.meta?.cursor ?? null };
}

/**
 * Fetch every venue across all pages, following the cursor. The Courts map
 * needs them all at once (it plots markers, which isn't tied to the list's
 * "Load more" paging); the dataset is small, so this is a couple of requests.
 */
export async function listAllVenues(params: ListVenuesParams = {}): Promise<ApiVenue[]> {
  const all: ApiVenue[] = [];
  let cursor: string | undefined = params.cursor;
  do {
    const page = await listVenues({ ...params, pageSize: 100, cursor });
    all.push(...page.items);
    cursor = page.cursor ?? undefined;
  } while (cursor);
  return all;
}

/** Fetch a single venue by `_id` or `slug`, with hours/courts/gallery/image. */
export async function getVenue(idOrSlug: string): Promise<ApiVenueDetail> {
  // `auth: true` so the server can identify the viewer and populate
  // viewerIsMember / viewerMembershipTier — without it the "Join Membership"
  // button never hides for logged-in members because the server sees a guest.
  return request<ApiVenueDetail>(`${VENUES_PREFIX}/${encodeURIComponent(idOrSlug)}`, { auth: true });
}

export interface VenueAvailability {
  date: string;
  /** Number of sub-units the availability covers — splitCount for splittable courts,
   *  or the venue pool when unscoped, or 1 for a non-splittable court. */
  capacity: number;
  /** Echoed back when the request was scoped to a single court. */
  courtId?: string;
  /** Whether the scoped court is splittable (sub-unit slots rather than one). */
  isSplittable?: boolean;
  /** Free-court count per clock-hour 0–23; a booking can start at `hour` when `free > 0`. */
  hours: { hour: number; free: number }[];
}

/**
 * Per-hour court availability for a venue on a date — powers the booking time
 * pickers (public). Pass `courtId` to scope it to one court (capacity 1), so the
 * picker greys the hours *that court* is taken rather than the whole venue pool.
 */
export async function getVenueAvailability(idOrSlug: string, date: string, courtId?: string): Promise<VenueAvailability> {
  return request<VenueAvailability>(`${VENUES_PREFIX}/${encodeURIComponent(idOrSlug)}/availability${toQuery({ date, courtId })}`);
}

export interface VenueDayAvailability {
  date: string;                 // YYYY-MM-DD
  openHours: number;            // bookable start-hours the venue is open that day
  freeHours: number;            // of those, how many still have a free court
  full: boolean;                // open that day but every open hour is taken
  closed: boolean;              // venue not open that day
}
export interface VenueAvailabilityRange {
  from: string;
  to: string;
  capacity: number;
  courtId?: string;
  days: VenueDayAvailability[];
}

/**
 * Per-DAY availability across a date range — powers the booking calendar's
 * fully-booked day markers (public). Pass `courtId` to scope "full" to one court.
 */
export async function getVenueAvailabilityRange(
  idOrSlug: string, from: string, to: string, courtId?: string,
): Promise<VenueAvailabilityRange> {
  return request<VenueAvailabilityRange>(
    `${VENUES_PREFIX}/${encodeURIComponent(idOrSlug)}/availability/range${toQuery({ from, to, courtId })}`,
  );
}

/* ─── Batch venue availability — powers the map date/time filter ─── */

export interface BatchVenueAvailability {
  date: string;
  venues: { venueId: string; freeByHour: number[] }[];
}

/**
 * Per-hour free-court counts for multiple venues on a single date — so the map
 * can filter to only venues with a court free at the player's chosen hour (public).
 * Max 200 venue IDs per request.
 */
export async function batchVenueAvailability(venueIds: string[], date: string): Promise<BatchVenueAvailability> {
  return request<BatchVenueAvailability>(`${VENUES_PREFIX}/availability/batch`, {
    method: 'POST',
    body: { venueIds, date },
  });
}

/* ─── Check-ins (live presence) ─────────────────────────────── */
//
// A check-in = a player marking themselves present at a venue ("I'm here now").
// Presence is time-bounded server-side (active for a few hours). Powers the home
// "who's playing" banner (hotspot) and the court page's check-in.

const CHECKINS_PREFIX = '/api/v1/check-ins';

export interface CheckInPlayer {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface CheckInHotspot {
  venueId: string;
  venueName: string;
  venueSlug: string | null;
  count: number;
  players: CheckInPlayer[];
}

export interface VenueCheckIns {
  venueId: string;
  venueName: string;
  count: number;
  players: CheckInPlayer[];
  /** Whether the current (signed-in) user is checked in here. */
  checkedIn: boolean;
}

/** The busiest venue right now (for the home banner); null when nobody's checked in. */
export async function getCheckInHotspot(): Promise<CheckInHotspot | null> {
  return request<CheckInHotspot | null>(`${CHECKINS_PREFIX}/hotspot`);
}

/** Who's checked in at a venue right now, plus whether you are. */
export async function getVenueCheckIns(idOrSlug: string): Promise<VenueCheckIns> {
  return request<VenueCheckIns>(`${CHECKINS_PREFIX}${toQuery({ venueId: idOrSlug })}`, { auth: true });
}

/** Check in at a venue (current user). */
export async function checkInToVenue(idOrSlug: string): Promise<{ venueId: string; checkedIn: boolean; count: number }> {
  return request(`${CHECKINS_PREFIX}`, { method: 'POST', body: { venueId: idOrSlug }, auth: true });
}

/** Check out — leave wherever you were. */
export async function checkOutOfVenue(idOrSlug?: string): Promise<{ checkedIn: boolean }> {
  return request(`${CHECKINS_PREFIX}`, { method: 'DELETE', body: idOrSlug ? { venueId: idOrSlug } : undefined, auth: true });
}

/* ─── Owner (venue management) ──────────────────────────────── */
//
// Everything below is gated server-side by `requireVenueOwner()` (owner-of-venue
// OR admin) except the read endpoints, which are public. The same endpoints back
// the web owner console (web/src/features/owner/api.js). All writes pass
// `auth: true` so the Bearer token rides along.

// Courts and FAQs are mutated via routes mounted under the venues router, so the
// real served paths are /api/v1/venues/courts/:id and /api/v1/venues/faqs/:id.
const COURTS_PREFIX = '/api/v1/venues/courts';
const FAQS_PREFIX = '/api/v1/venues/faqs';
const CLOSURES_PREFIX = '/api/v1/holiday-closures';
const REVIEWS_PREFIX = '/api/v1/reviews';

/** Read a Mongo doc id whether the API serialises it as `id` or `_id`. */
export function entityId(doc: { id?: string | null; _id?: string | null }): string {
  return String(doc.id ?? doc._id ?? '');
}

/**
 * The full editable venue document. The get-by-id endpoint returns far more than
 * the public `ApiVenueDetail` projection declares (pricing tiers, social URLs,
 * the full amenity set, raw media paths, claim state) — the owner editors read
 * those, so they're typed here. Everything is optional: real data is sparse.
 */
export interface OwnerVenueDetail extends ApiVenueDetail {
  _id?: string;
  ownerUserId?: string | null;
  // structured address (owner-editable in LocationEditorTab; area/region/fullAddress
  // come from ApiVenue). `cityName` is the free-text city the venue stores.
  cityName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  // contact + socials
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
  email?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  viberUrl?: string | null;
  // pricing (display-only, PHP)
  peakPrice?: number | string | null;
  offPeakPrice?: number | string | null;
  openPlayPrice?: number | string | null;
  equipmentRentalPrice?: number | string | null;
  priceNotes?: string | null;
  // Pricing display convention — "VAT inclusive" / "VAT exclusive" / custom.
  pricingTaxLabel?: string | null;
  // Automated dynamic pricing — owner opt-in, off by default.
  autoDynamicPricing?: boolean | null;
  autoDynamicPricingMinConfidence?: 'low' | 'medium' | 'high' | null;
  autoDynamicPricingMaxAdjustment?: number | null;
  // Cancellation & refund policy — owner-configurable per venue.
  cancellationWindowHours?: number | null;
  refundPercent?: number | null;
  noShowFee?: number | null;
  // curated chip arrays
  bestFor?: string[] | null;
  whatPlayersLike?: string[] | null;
  thingsToKnow?: string[] | null;
  // amenity booleans not on the public ApiVenue projection
  hasCourtRental?: boolean | null;
  hasCoaching?: boolean | null;
  // raw media paths (the resolved `image`/`gallery` URLs are what we display)
  mainImageUrl?: string | null;
  galleryImageUrls?: string[] | null;
}

export interface OwnerCourt extends ApiCourt {
  _id?: string;
  isActive?: boolean | null;
}

/** A weekly-hours row. `dayOfWeek` is 0=Sunday (the API convention). */
export interface OwnerHourEntry {
  dayOfWeek: number;
  isClosed: boolean;
  openTime?: string;
  closeTime?: string;
  /** Per-time-block rate (PHP/hr); a day can have several blocks each priced. Blank → court/venue rate. */
  price?: number | null;
}

export interface OwnerClosure {
  id?: string;
  _id?: string;
  closureDate: string;
  reason?: string | null;
  isClosedAllDay?: boolean;
}

export interface OwnerFaq {
  id?: string;
  _id?: string;
  question: string;
  answer: string;
  sortOrder?: number;
}

export interface OwnerReview {
  id?: string;
  _id?: string;
  rating: number;
  text?: string | null;
  visitDate?: string | null;
  status?: string | null;
}

export interface OwnerReviews {
  items: OwnerReview[];
  rating: number | null;
  count: number;
}

export interface ApiCity {
  id: string;
  name: string;
  region: string;
}

export interface GeocodeHit {
  lat: number;
  lng: number;
  label: string;
}

export interface UploadedMedia {
  url?: string;
  id?: string;
  _id?: string;
}

/* --- My venues ------------------------------------------------------------ */

/**
 * The venues this owner owns. The list endpoint applies the `ownerUserId` filter
 * server-side; we keep a defensive client-side filter (the list projection
 * carries `ownerUserId`) in case the param is ever ignored.
 */
export async function listOwnerVenues(ownerUserId: string): Promise<ApiVenue[]> {
  const page = await listVenues({ ownerUserId, pageSize: 100 });
  return page.items.filter((v) => String(v.ownerUserId ?? '') === String(ownerUserId));
}

/**
 * The venues the current user can manage — ones they OWN plus ones they're
 * active STAFF on. Each item carries `viewerStaffRole` ('owner'/'manager'/
 * 'front_desk') so the console can tailor what a staffer sees. Self-only on the
 * server, so pass the signed-in user's id.
 */
export async function listManagedVenues(userId: string): Promise<ApiVenue[]> {
  const page = await listVenues({ managedByUserId: userId, pageSize: 100 });
  return page.items;
}

/**
 * The full editable venue document (more fields than the public detail).
 * Sends auth: a freshly-created venue is `listingStatus:'pending'`, which the
 * API only returns to its authenticated owner/admin (anyone else gets a 404),
 * so the owner's token must ride along or they can't load their own new venue.
 */
export async function getOwnerVenue(idOrSlug: string): Promise<OwnerVenueDetail> {
  return request<OwnerVenueDetail>(`${VENUES_PREFIX}/${encodeURIComponent(idOrSlug)}`, { auth: true });
}

/** Patch listing fields. `courtCount` is server-derived — never send it. */
export async function updateVenue(venueId: string, body: Record<string, unknown>): Promise<OwnerVenueDetail> {
  return request<OwnerVenueDetail>(`${VENUES_PREFIX}/${venueId}`, { method: 'PATCH', body, auth: true });
}

export interface BookingSlugCheck {
  /** empty = blank (falls back to the system slug); the others are self-explanatory. */
  status: 'empty' | 'invalid' | 'taken' | 'available';
  available: boolean;
  /** Server-normalized form of the slug (what would actually be stored). */
  normalized: string;
}

/** Live availability check for a custom booking slug (owner-gated) — for typing feedback. */
export async function checkBookingSlug(venueId: string, slug: string): Promise<BookingSlugCheck> {
  return request<BookingSlugCheck>(`${VENUES_PREFIX}/${venueId}/booking-slug-available?slug=${encodeURIComponent(slug)}`, { auth: true });
}

/** Create a new owner-owned venue (live immediately, state='claimed'). */
export async function createVenue(body: Record<string, unknown>): Promise<OwnerVenueDetail> {
  return request<OwnerVenueDetail>(VENUES_PREFIX, { method: 'POST', body, auth: true });
}

/** Delete a venue the owner owns (it disappears from their console + all listings). */
export async function deleteVenue(idOrSlug: string): Promise<{ id: string; deleted: boolean }> {
  return request<{ id: string; deleted: boolean }>(`${VENUES_PREFIX}/${encodeURIComponent(idOrSlug)}`, { method: 'DELETE', auth: true });
}

/* ─── Venue staff ─────────────────────────────────────────────── */

export interface VenueStaffMember {
  id: string;
  userId: string;
  staffRole: 'manager' | 'front_desk';
  status: string;
  createdAt: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

/** List the active staff team for a venue you own (or are staff on). */
export async function listVenueStaff(venueId: string): Promise<VenueStaffMember[]> {
  const res = await request<VenueStaffMember[]>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/staff`, { auth: true });
  return res ?? [];
}

/** Add someone to the venue staff (owner-only, needs owner.staff.manage). */
export async function addVenueStaff(venueId: string, userId: string, staffRole: string): Promise<VenueStaffMember> {
  return request<VenueStaffMember>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/staff`, { method: 'POST', body: { userId, staffRole }, auth: true });
}

/** Remove a staff member (owner-only, needs owner.staff.manage). */
export async function removeVenueStaff(staffId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`${VENUES_PREFIX}/staff/${encodeURIComponent(staffId)}`, { method: 'DELETE', auth: true });
}

/* ─── Venue members (member pricing) ──────────────────────────── */

export interface VenueMember {
  id: string;
  userId: string;
  tier: string | null;
  status: string;
  createdAt: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

/** List the venue's members (owner/staff). Member bookings get the member rate. */
export async function listVenueMembers(venueId: string): Promise<VenueMember[]> {
  const res = await request<VenueMember[]>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/members`, { auth: true });
  return res ?? [];
}

/** Add a player as a venue member (owner/staff). */
export async function addVenueMember(venueId: string, userId: string, tier?: string): Promise<VenueMember> {
  return request<VenueMember>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/members`, { method: 'POST', body: { userId, tier }, auth: true });
}

/** Remove a venue member (owner/staff). */
export async function removeVenueMember(venueId: string, userId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE', auth: true });
}

/** Self-service: the signed-in player joins (or switches plans on) this venue's
 *  membership. Recorded as a VenueMember, so it shows in the owner's Members tab
 *  and member pricing applies. `planId` is the chosen membership plan (optional). */
export async function joinVenueMembership(venueId: string, planId?: string): Promise<VenueMember> {
  return request<VenueMember>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/membership`, { method: 'POST', body: { planId }, auth: true });
}

/** Self-service: the signed-in player cancels their own membership at this venue. */
export async function leaveVenueMembership(venueId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/membership`, { method: 'DELETE', auth: true });
}

/** The invited player accepts (or declines) an owner-sent membership invite.
 *  Accepting activates their membership; declining drops it from the owner's list.
 *  Pass `planId` to set the subscription tier on accept (the app shows a plan picker
 *  when the invite has no tier, then sends the player's choice here). */
export async function respondToVenueMembershipInvite(venueId: string, accept: boolean, planId?: string): Promise<{ accepted?: boolean }> {
  return request<{ accepted?: boolean }>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/membership/respond`, { method: 'POST', body: { accept, planId }, auth: true });
}

/* ─── Subscription plans (owner-defined membership tiers) ──────────── */

export interface ApiSubscriptionPlanVersion {
  id: string;
  planId: string;
  versionNumber: number;
  price: number;
  currency: string;
  billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'semiAnnual' | 'annual' | 'custom';
  customBillingDays: number | null;
  benefits: string[];
  maxMembers: number | null;
  freeTrialDays: number | null;
  autoRenew: boolean;
  createdAt: string;
}

export interface ApiSubscriptionPlan {
  id: string;
  venueId: string;
  name: string;
  description: string;
  status: 'active' | 'draft' | 'disabled';
  memberCount: number;
  currentVersion: ApiSubscriptionPlanVersion | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionPlanPayload {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  billingCycle: ApiSubscriptionPlanVersion['billingCycle'];
  customBillingDays?: number | null;
  benefits?: string[];
  maxMembers?: number | null;
  freeTrialDays?: number | null;
  autoRenew?: boolean;
  status?: 'active' | 'draft' | 'disabled';
}

export interface UpdateSubscriptionPlanPayload {
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  billingCycle?: ApiSubscriptionPlanVersion['billingCycle'];
  customBillingDays?: number | null;
  benefits?: string[];
  maxMembers?: number | null;
  freeTrialDays?: number | null;
  autoRenew?: boolean;
  status?: 'active' | 'draft' | 'disabled';
}

/** Owner/staff: list all subscription plans for a venue. */
export async function listSubscriptionPlans(venueId: string): Promise<ApiSubscriptionPlan[]> {
  const res = await request<ApiSubscriptionPlan[]>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/subscription-plans`, { auth: true });
  return res ?? [];
}

/** Owner/staff: create a subscription plan. */
export async function createSubscriptionPlan(venueId: string, body: CreateSubscriptionPlanPayload): Promise<ApiSubscriptionPlan> {
  return request<ApiSubscriptionPlan>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/subscription-plans`, { method: 'POST', body, auth: true });
}

/** Owner/staff: get a single subscription plan. */
export async function getSubscriptionPlan(planId: string): Promise<ApiSubscriptionPlan> {
  return request<ApiSubscriptionPlan>(`${VENUES_PREFIX}/subscription-plans/${encodeURIComponent(planId)}`, { auth: true });
}

/** Owner/staff: update a subscription plan (versioning: structural changes create new version). */
export async function updateSubscriptionPlan(planId: string, body: UpdateSubscriptionPlanPayload): Promise<ApiSubscriptionPlan> {
  return request<ApiSubscriptionPlan>(`${VENUES_PREFIX}/subscription-plans/${encodeURIComponent(planId)}`, { method: 'PATCH', body, auth: true });
}

/** Owner/staff: delete a subscription plan (only if no active subscribers). */
export async function deleteSubscriptionPlan(planId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`${VENUES_PREFIX}/subscription-plans/${encodeURIComponent(planId)}`, { method: 'DELETE', auth: true });
}

/** Owner/staff: duplicate a subscription plan. */
export async function duplicateSubscriptionPlan(planId: string): Promise<ApiSubscriptionPlan> {
  return request<ApiSubscriptionPlan>(`${VENUES_PREFIX}/subscription-plans/${encodeURIComponent(planId)}/duplicate`, { method: 'POST', auth: true });
}

/** Owner/staff: toggle a plan between active ↔ disabled. */
export async function toggleSubscriptionPlan(planId: string): Promise<ApiSubscriptionPlan> {
  return request<ApiSubscriptionPlan>(`${VENUES_PREFIX}/subscription-plans/${encodeURIComponent(planId)}/toggle`, { method: 'PATCH', auth: true });
}

/** Public: active subscription plans for a venue (players browsing). */
export async function listPublicPlans(venueId: string): Promise<ApiSubscriptionPlan[]> {
  const res = await request<ApiSubscriptionPlan[]>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/plans`);
  return res ?? [];
}

/** Self-service: the signed-in player subscribes to a plan. */
export async function subscribeToPlan(planId: string): Promise<{ id: string; venueMemberId: string }> {
  return request<{ id: string; venueMemberId: string }>(`${VENUES_PREFIX}/subscription-plans/${encodeURIComponent(planId)}/subscribe`, { method: 'POST', auth: true });
}

/* ─── Slot price overrides (manual surge) ─────────────────────── */

export interface SlotPriceOverride {
  id: string;
  venueId: string;
  courtId: string | null;
  date: string;        // YYYY-MM-DD
  startTime: string;   // "HH:MM"
  endTime: string;     // "HH:MM"
  price: number;       // absolute ₱/hr for the window
  note?: string | null;
  createdAt?: string;
}

/** Active slot price overrides for a venue (optionally one date). Public read. */
export async function listSlotOverrides(venueId: string, date?: string): Promise<SlotPriceOverride[]> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await request<SlotPriceOverride[]>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/slot-overrides${qs}`, { auth: true });
  return res ?? [];
}

/** Set a surge / discount rate for a date+time window (owner/staff). */
export async function createSlotOverride(
  venueId: string,
  body: { courtId?: string; date: string; startTime: string; endTime: string; price: number; note?: string },
): Promise<SlotPriceOverride> {
  return request<SlotPriceOverride>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/slot-overrides`, { method: 'POST', body, auth: true });
}

/** Remove a slot price override (owner/staff). */
export async function deleteSlotOverride(overrideId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`${VENUES_PREFIX}/slot-overrides/${encodeURIComponent(overrideId)}`, { method: 'DELETE', auth: true });
}

/* ─── Staff accounts (owner sub-accounts) ─────────────────────────
 * Org-level staff: an owner creates a login that manages ALL of their venues,
 * bookings, and clubs (scoped server-side by parentOwnerUserId). Distinct from
 * the per-venue VenueStaff above — this creates a brand-new account. Owner+admin
 * only (owner.staff.manage). */

const STAFF_PREFIX = '/api/v1/staff';

export interface StaffAccount {
  id: string;
  email: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  parentOwnerUserId: string | null;
  /** Permissions the creating owner has explicitly granted on top of the base staff-role set. */
  grantedPermissions: string[];
  createdAt: string;
  lastLoginAt: string | null;
}

export interface CreateStaffInput {
  email: string;
  password: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
}

/** List the staff accounts the current owner has created. */
export async function listStaffAccounts(): Promise<StaffAccount[]> {
  const res = await request<StaffAccount[]>(STAFF_PREFIX, { auth: true });
  return res ?? [];
}

/** Create a new staff account under the current owner. */
export async function createStaffAccount(input: CreateStaffInput): Promise<StaffAccount> {
  return request<StaffAccount>(STAFF_PREFIX, { method: 'POST', body: input, auth: true });
}

/** Update a staff account — rename, reset password, activate/deactivate, or set granted permissions. */
export async function updateStaffAccount(
  staffId: string,
  patch: { displayName?: string; firstName?: string; lastName?: string; password?: string; isActive?: boolean; grantedPermissions?: string[] },
): Promise<StaffAccount> {
  return request<StaffAccount>(`${STAFF_PREFIX}/${encodeURIComponent(staffId)}`, { method: 'PATCH', body: patch, auth: true });
}

/** Remove a staff account outright (the login is deleted). */
export async function removeStaffAccount(staffId: string): Promise<{ message: string; id: string }> {
  return request<{ message: string; id: string }>(`${STAFF_PREFIX}/${encodeURIComponent(staffId)}`, { method: 'DELETE', auth: true });
}

/** A submitted venue-ownership claim (status starts 'pending' → admin reviews). */
export interface VenueClaim {
  id?: string;
  _id?: string;
  venueId: string;
  /** Populated by getMyClaims / getClaim (not on submit response). */
  venueName?: string;
  venueSlug?: string;
  /** Populated by listClaims (admin) — the claimant's display name. */
  claimantName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_info';
  proofDescription: string;
  proofDocumentUrls?: string[];
  claimantLegalName?: string;
  claimantRole?: string;
  claimantContact?: string;
  reviewNotes?: string | null;
  createdAt?: string;
}

/**
 * Submit an ownership claim for an existing (unclaimed) directory venue. The
 * claim lands 'pending' for admin review; on approval the API sets the venue's
 * state to 'claimed' and links it to this owner. Gated by `owner.venues.claim`.
 * Throws ApiError CONFLICT if the venue is already claimed or the owner already
 * has a pending claim for it.
 */
export async function submitVenueClaim(body: {
  venueId: string;
  proofDescription: string;
  proofDocumentUrls?: string[];
  // Owner identity verification (anti-fraud) — who is making the claim.
  claimantLegalName?: string;
  claimantRole?: string;
  claimantContact?: string;
}): Promise<VenueClaim> {
  return request<VenueClaim>('/api/v1/claims', { method: 'POST', body, auth: true });
}

/** List the current user's own claims (V6). */
export async function getMyClaims(): Promise<VenueClaim[]> {
  const env = await rawRequest<VenueClaim[]>('/api/v1/claims/mine', { auth: true });
  return env.data ?? [];
}

/** Get a single claim by id — claimant or admin (V6). */
export async function getClaim(id: string): Promise<VenueClaim> {
  return request<VenueClaim>(`/api/v1/claims/${encodeURIComponent(id)}`, { auth: true });
}

/** Resubmit a claim that is in 'needs_info' state (V6). */
export async function resubmitClaim(id: string, body: { proofDescription?: string; proofDocumentUrls?: string[] }): Promise<VenueClaim> {
  return request<VenueClaim>(`/api/v1/claims/${encodeURIComponent(id)}/resubmit`, { method: 'PATCH', body, auth: true });
}

/**
 * Admin: list submitted venue-ownership claims, newest first (server caps at 50).
 * Optional `status` filter; omit for all. Gated by `admin.moderation.manage`.
 */
export async function listClaims(status?: VenueClaim['status']): Promise<VenueClaim[]> {
  const env = await rawRequest<VenueClaim[]>(`/api/v1/claims${toQuery({ status })}`, { auth: true });
  return env.data ?? [];
}

/**
 * Admin: review a pending claim — `approved` links the venue to the claimant,
 * `rejected` declines it, `needs_info` asks the claimant to resubmit. The server
 * notifies the claimant on every outcome and 409s if the claim isn't pending.
 * Gated by `admin.moderation.manage`.
 */
export async function reviewClaim(id: string, body: { status: 'approved' | 'rejected' | 'needs_info'; reviewNotes?: string }): Promise<VenueClaim> {
  return request<VenueClaim>(`/api/v1/claims/${encodeURIComponent(id)}`, { method: 'PATCH', body, auth: true });
}

/** A reported PickleFeed post, as the admin moderation queue sees it — the
 *  reported post (body/author/deleted) + who reported it + the chosen reason. */
export interface AdminFeedReport {
  id: string;
  reason: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt?: string | null;
  reporter: { id: string; displayName: string | null } | null;
  post: {
    id: string;
    body: string | null;
    isDeleted: boolean;
    hasMedia: boolean;
    author: { id: string; displayName: string | null } | null;
    createdAt?: string | null;
  } | null;
}

/** Admin: list reported PickleFeed posts by status. Gated by `admin.moderation.manage`. */
export async function listAdminFeedReports(status: 'pending' | 'resolved' | 'dismissed' = 'pending'): Promise<AdminFeedReport[]> {
  const env = await rawRequest<AdminFeedReport[]>(`/api/v1/admin/feed-reports${toQuery({ status })}`, { auth: true });
  return env.data ?? [];
}

/** Admin: resolve or dismiss a reported post. Gated by `admin.moderation.manage`. */
export async function resolveAdminFeedReport(id: string, status: 'resolved' | 'dismissed'): Promise<void> {
  await request(`/api/v1/admin/feed-reports/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status }, auth: true });
}

/* ─── Admin console ──────────────────────────────────────────────
 * The mobile Admin console (a port of the website's `/admin/*` pages).
 * Every call is `auth: true` and gated server-side by the matching admin.*
 * permission; the app additionally gates each screen via SCREEN_PERMISSIONS.
 * The endpoints are the same ones the website's admin dashboard uses.
 */

/** A directory account as the admin Players/Users list sees it. */
export interface AdminUser {
  _id?: string;
  id?: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  roleDefault?: string;
  isVerified?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string | null;
}

/** Admin: list accounts. Defaults to a high pageSize so the directory loads whole. Gated by `admin.users.manage`. */
export async function listAdminUsers(params?: { pageSize?: number; role?: string; search?: string }): Promise<AdminUser[]> {
  const env = await rawRequest<AdminUser[]>(
    `/api/v1/admin/users${toQuery({ pageSize: params?.pageSize ?? 500, role: params?.role, search: params?.search })}`,
    { auth: true },
  );
  return env.data ?? [];
}

/** A venue owner + the venues they own (admin Owners list). */
export interface AdminOwner {
  id?: string;
  _id?: string;
  email?: string;
  displayName?: string;
  isVerified?: boolean;
  createdAt?: string | null;
  venues?: { id: string; name: string; slug: string }[];
}

/** Admin: list venue owners with their owned venues. Gated by `admin.venues.manage`. */
export async function listAdminOwners(search?: string): Promise<AdminOwner[]> {
  const env = await rawRequest<AdminOwner[]>(`/api/v1/admin/owners${toQuery({ search })}`, { auth: true });
  return env.data ?? [];
}

/** A booking row in the admin Bookings report. */
export interface AdminBooking {
  _id?: string;
  id?: string;
  referenceCode?: string;
  bookingType?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  venueName?: string;
  venueId?: string;
  userName?: string;
  userId?: string;
  playerCount?: number;
  amount?: number;
  status?: string;
  /** 'owner_rejected' marks a cancelled row as a decline rather than a cancellation. */
  cancellationType?: string;
}

/** Admin: list bookings across the platform. Gated by `admin.bookings.manage`. */
export async function listAdminBookings(params?: { limit?: number; status?: string }): Promise<AdminBooking[]> {
  const env = await rawRequest<AdminBooking[]>(
    `/api/v1/bookings${toQuery({ limit: params?.limit ?? 500, status: params?.status })}`,
    { auth: true },
  );
  return env.data ?? [];
}

/** A venue/coach review awaiting moderation (admin Reviews queue). */
export interface AdminReview {
  _id?: string;
  id?: string;
  rating?: number;
  text?: string;
  venueId?: string;
  userId?: string;
  status?: string;
  createdAt?: string | null;
}

/** Admin: list reviews by moderation status. Gated by `admin.moderation.manage`. */
export async function listAdminReviews(status: string = 'pending_moderation', limit = 100): Promise<AdminReview[]> {
  const env = await rawRequest<AdminReview[]>(`/api/v1/admin/reviews${toQuery({ status, limit })}`, { auth: true });
  return env.data ?? [];
}

/** Admin: approve/reject/hide a review. Gated by `admin.moderation.manage`. */
export async function moderateAdminReview(id: string, status: 'approved' | 'rejected' | 'hidden'): Promise<void> {
  await request(`/api/v1/admin/reviews/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status }, auth: true });
}

/** A user-flagged review awaiting triage (admin Review reports). */
export interface AdminReviewReport {
  _id?: string;
  id?: string;
  reason?: string;
  details?: string;
  reviewId?: string;
  reporterUserId?: string;
  createdAt?: string | null;
}

/** Admin: list open review reports. Gated by `admin.moderation.manage`. */
export async function listAdminReviewReports(limit = 100): Promise<AdminReviewReport[]> {
  const env = await rawRequest<AdminReviewReport[]>(`/api/v1/admin/reports${toQuery({ limit })}`, { auth: true });
  return env.data ?? [];
}

/** Admin: resolve or dismiss a review report. Gated by `admin.moderation.manage`. */
export async function resolveAdminReviewReport(id: string, status: 'resolved' | 'dismissed'): Promise<void> {
  await request(`/api/v1/admin/reports/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status }, auth: true });
}

/** A user-submitted venue correction (admin Suggested edits). */
export interface AdminSuggestedEdit {
  _id?: string;
  id?: string;
  venueId?: string | { displayName?: string };
  venueName?: string;
  editType?: string;
  payloadJson?: unknown;
  suggestedByUserId?: string | { displayName?: string };
  submitterName?: string;
  status?: string;
  createdAt?: string | null;
}

/** Admin: list suggested venue edits. Gated by `admin.moderation.manage`. */
export async function listAdminSuggestedEdits(limit = 100): Promise<AdminSuggestedEdit[]> {
  const env = await rawRequest<AdminSuggestedEdit[]>(`/api/v1/suggested-edits${toQuery({ limit })}`, { auth: true });
  return env.data ?? [];
}

/** Admin: accept or reject a suggested edit. Gated by `admin.moderation.manage`. */
export async function reviewSuggestedEdit(id: string, status: 'accepted' | 'rejected'): Promise<void> {
  await request(`/api/v1/suggested-edits/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status }, auth: true });
}

/** An owner-submitted venue awaiting listing approval (admin Venue approvals). */
export interface PendingVenue {
  _id?: string;
  id?: string;
  displayName?: string;
  oneLineSummary?: string;
  ownerName?: string;
  ownerEmail?: string;
  area?: string;
  cityName?: string;
  listingStatus?: 'pending' | 'published' | 'rejected';
  createdAt?: string | null;
}

/** Admin: list venues awaiting approval. Gated by `admin.moderation.manage`. */
export async function listPendingVenues(): Promise<PendingVenue[]> {
  const env = await rawRequest<PendingVenue[]>('/api/v1/venue-approvals', { auth: true });
  return env.data ?? [];
}

/** Admin: approve (publish) or reject a pending venue. Gated by `admin.moderation.manage`. */
export async function reviewVenueApproval(id: string, status: 'approved' | 'rejected'): Promise<void> {
  await request(`/api/v1/venue-approvals/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status }, auth: true });
}

/** A role and its permission grant (admin Roles & permissions). */
export interface AdminRole {
  key: string;
  label?: string;
  description?: string;
  permissions?: string[];
  venues?: string[];
  userCount?: number;
}

/** One entry in the code-defined permission catalogue. */
export interface PermissionDef {
  key: string;
  label?: string;
  description?: string;
  group?: string;
}

/** Admin: list roles. Gated by `admin.settings.manage`. */
export async function listAdminRoles(): Promise<AdminRole[]> {
  const env = await rawRequest<AdminRole[]>('/api/v1/admin/roles', { auth: true });
  return env.data ?? [];
}

/** Admin: the full permission catalogue (grouped by `group`). Gated by `admin.settings.manage`. */
export async function listPermissionCatalogue(): Promise<PermissionDef[]> {
  const env = await rawRequest<PermissionDef[]>('/api/v1/admin/permissions', { auth: true });
  return env.data ?? [];
}

/** Admin: update a role's permissions (and, for coach, linked venues). Gated by `admin.settings.manage`. */
export async function updateAdminRole(key: string, body: { permissions: string[]; venues?: string[] }): Promise<AdminRole> {
  return request<AdminRole>(`/api/v1/admin/roles/${encodeURIComponent(key)}`, { method: 'PATCH', body, auth: true });
}

/* --- Create-form helpers -------------------------------------------------- */

export async function fetchCities(): Promise<ApiCity[]> {
  const env = await rawRequest<Array<{ id?: string; _id?: string; name: string; region?: string }>>(
    `/api/v1/cities${toQuery({ limit: 300 })}`,
  );
  return (env.data ?? []).map((c) => ({ id: entityId(c), name: c.name, region: c.region ?? '' }));
}

/** Forward-geocode a place/address to coordinates (API proxies OSM Nominatim). */
export async function geocodePlace(query: string, country?: string): Promise<GeocodeHit | null> {
  const q = query.trim();
  if (!q) return null;
  return request<GeocodeHit | null>(`/api/v1/geocode${toQuery({ q, country })}`);
}

/** One type-ahead address suggestion (coords + parsed address pieces). */
export interface GeocodeSuggestion {
  lat: number;
  lng: number;
  /** Full display name, e.g. "SM Mall of Asia, …, Pasay, Metro Manila". */
  label: string;
  city: string | null;
  region: string | null;
  /** Sub-city locality (suburb/neighbourhood). */
  area: string | null;
  /** Street line (house number + road), for "Address line 1". */
  line1: string | null;
  /** Postal code, for the "Postcode" field. */
  postcode: string | null;
}

/**
 * Type-ahead address suggestions for the owner console (API proxies OSM
 * Nominatim, returning a ranked list). Pass an `AbortSignal` so a screen can
 * cancel the in-flight lookup when the query changes.
 */
export async function suggestPlaces(
  query: string,
  opts: { country?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<GeocodeSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await request<GeocodeSuggestion[] | null>(
    `/api/v1/geocode/suggest${toQuery({ q, country: opts.country, limit: opts.limit })}`,
    { signal: opts.signal },
  );
  return res ?? [];
}

export interface ReverseGeocodeHit {
  lat: number;
  lng: number;
  label: string;
  /** Populated-place name (city/town/municipality), if Nominatim resolved one. */
  city: string | null;
  region: string | null;
  /** Street line (house number + road), for "Address line 1". */
  line1: string | null;
  /** Postal code, for the "Postcode" field. */
  postcode: string | null;
}

/** Reverse-geocode coordinates to a place + nearest city (API proxies OSM Nominatim). */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeHit | null> {
  return request<ReverseGeocodeHit | null>(`/api/v1/geocode/reverse${toQuery({ lat, lng })}`);
}

/* --- Courts --------------------------------------------------------------- */

export async function listCourts(venueId: string): Promise<OwnerCourt[]> {
  return (await request<OwnerCourt[]>(`${VENUES_PREFIX}/${venueId}/courts`)) ?? [];
}
export async function createCourt(venueId: string, body: Record<string, unknown>): Promise<OwnerCourt> {
  return request<OwnerCourt>(`${VENUES_PREFIX}/${venueId}/courts`, { method: 'POST', body, auth: true });
}
export async function updateCourt(courtId: string, body: Record<string, unknown>): Promise<OwnerCourt> {
  return request<OwnerCourt>(`${COURTS_PREFIX}/${courtId}`, { method: 'PATCH', body, auth: true });
}
export async function deleteCourt(courtId: string): Promise<void> {
  await request<void>(`${COURTS_PREFIX}/${courtId}`, { method: 'DELETE', auth: true });
}

/* --- Operating hours (full-replace weekly grid) --------------------------- */

export async function getHours(venueId: string): Promise<OwnerHourEntry[]> {
  return (await request<OwnerHourEntry[]>(`${VENUES_PREFIX}/${venueId}/hours`)) ?? [];
}
export async function putHours(venueId: string, entries: OwnerHourEntry[]): Promise<OwnerHourEntry[]> {
  return (await request<OwnerHourEntry[]>(`${VENUES_PREFIX}/${venueId}/hours`, { method: 'PUT', body: entries, auth: true })) ?? [];
}
// Per-court operating hours. A court with no rows of its own returns the inherited
// venue default (so the editor opens on sensible times); saving makes them the
// court's own. Same `OwnerHourEntry[]` shape as the venue-wide hours.
export async function getCourtHours(courtId: string): Promise<OwnerHourEntry[]> {
  return (await request<OwnerHourEntry[]>(`${COURTS_PREFIX}/${courtId}/hours`)) ?? [];
}
export async function putCourtHours(courtId: string, entries: OwnerHourEntry[]): Promise<OwnerHourEntry[]> {
  return (await request<OwnerHourEntry[]>(`${COURTS_PREFIX}/${courtId}/hours`, { method: 'PUT', body: entries, auth: true })) ?? [];
}

/* --- Holiday closures ----------------------------------------------------- */

export async function getClosures(venueId: string): Promise<OwnerClosure[]> {
  return (await request<OwnerClosure[]>(`${VENUES_PREFIX}/${venueId}/holiday-closures`)) ?? [];
}
export async function createClosure(
  venueId: string,
  body: { closureDate: string; reason?: string; isClosedAllDay?: boolean },
): Promise<OwnerClosure> {
  return request<OwnerClosure>(`${VENUES_PREFIX}/${venueId}/holiday-closures`, { method: 'POST', body, auth: true });
}
export async function deleteClosure(closureId: string): Promise<void> {
  await request<void>(`${CLOSURES_PREFIX}/${closureId}`, { method: 'DELETE', auth: true });
}

/* --- FAQs ----------------------------------------------------------------- */

export async function listFaqs(venueId: string): Promise<OwnerFaq[]> {
  return (await request<OwnerFaq[]>(`${VENUES_PREFIX}/${venueId}/faqs`)) ?? [];
}
export async function createFaq(venueId: string, body: { question: string; answer: string; sortOrder?: number }): Promise<OwnerFaq> {
  return request<OwnerFaq>(`${VENUES_PREFIX}/${venueId}/faqs`, { method: 'POST', body, auth: true });
}
export async function updateFaq(faqId: string, body: { question: string; answer: string }): Promise<OwnerFaq> {
  return request<OwnerFaq>(`${FAQS_PREFIX}/${faqId}`, { method: 'PATCH', body, auth: true });
}
export async function deleteFaq(faqId: string): Promise<void> {
  await request<void>(`${FAQS_PREFIX}/${faqId}`, { method: 'DELETE', auth: true });
}

/* --- Reviews + owner replies ---------------------------------------------- */

export async function getReviews(venueId: string): Promise<OwnerReviews> {
  const data = await request<{ items?: OwnerReview[]; rating?: number | null; count?: number } | OwnerReview[]>(
    `${VENUES_PREFIX}/${venueId}/reviews`,
  );
  if (Array.isArray(data)) return { items: data, rating: null, count: data.length };
  return {
    items: data?.items ?? [],
    rating: data?.rating ?? null,
    count: data?.count ?? data?.items?.length ?? 0,
  };
}
export async function createReviewReply(reviewId: string, text: string): Promise<unknown> {
  return request<unknown>(`${REVIEWS_PREFIX}/${reviewId}/reply`, { method: 'POST', body: { text }, auth: true });
}
export async function updateReviewReply(reviewId: string, text: string): Promise<unknown> {
  return request<unknown>(`${REVIEWS_PREFIX}/${reviewId}/reply`, { method: 'PATCH', body: { text }, auth: true });
}
export async function deleteReviewReply(reviewId: string): Promise<void> {
  await request<void>(`${REVIEWS_PREFIX}/${reviewId}/reply`, { method: 'DELETE', auth: true });
}

/* --- Media upload --------------------------------------------------------- */

/**
 * Upload a venue photo. Multipart, so it bypasses the JSON `request()` wrapper
 * and sets the Authorization header manually. Note: there's no owner endpoint to
 * attach the upload as hero / reorder / delete yet — this only creates the Media
 * record (same gap as the web console).
 */
async function uploadMedia(ownerType: string, ownerId: string, file: File): Promise<UploadedMedia | null> {
  const fd = new FormData();
  fd.append('file', file);
  const token = getAccessToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/media/upload${toQuery({ ownerType, ownerId })}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
  } catch {
    throw new ApiError('Network error — could not upload.', 'NETWORK', 0);
  }
  const json = (await res.json().catch(() => null)) as Envelope<UploadedMedia> | null;
  if (!res.ok) {
    throw new ApiError(json?.error?.message || `Upload failed (${res.status})`, json?.error?.code || 'ERROR', res.status);
  }
  return json?.data ?? null;
}

export function uploadVenueMedia(venueId: string, file: File): Promise<UploadedMedia | null> {
  return uploadMedia('venue', venueId, file);
}

/**
 * Upload a photo for a single court. Tagged `ownerType: 'court'` so it never
 * feeds the venue's hero/gallery resolution (which only reads venue-owned media)
 * — the returned URL is stored on the court via updateCourt({ mainImageUrl }).
 */
export function uploadCourtMedia(courtId: string, file: File): Promise<UploadedMedia | null> {
  return uploadMedia('court', courtId, file);
}

/** Upload a proof document for a venue claim (V5). Tagged `ownerType: 'claim'`. */
export function uploadClaimMedia(file: File): Promise<UploadedMedia | null> {
  return uploadMedia('claim', '', file);
}

/** Upload a (cropped) avatar image for the current user; returns its URL. */
export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const m = await uploadMedia('user', userId, file);
  return m?.url ?? null;
}

/**
 * Upload an optional banner image for a tournament; returns its servable URL.
 * Stored on the tournament via updateTournament({ bannerUrl }). Optional —
 * tournaments without one fall back to the trophy placeholder in the UI.
 */
export async function uploadTournamentMedia(tournamentId: string, file: File): Promise<string | null> {
  const m = await uploadMedia('tournament', tournamentId, file);
  return m?.url ?? null;
}

/** Upload a photo/GIF to attach to a club feed post; returns its servable URL. */
export async function uploadClubMedia(clubId: string, file: File): Promise<string | null> {
  const m = await uploadMedia('club', clubId, file);
  return m?.url ?? null;
}

/**
 * Upload a photo/GIF to attach to a PickleFeed post or comment; returns its
 * servable URL. Tagged `ownerType: 'post'` with no owner id (the post doesn't
 * exist yet at upload time — mirrors the claim-media pattern).
 */
export async function uploadFeedMedia(file: File): Promise<string | null> {
  const m = await uploadMedia('post', '', file);
  return m?.url ?? null;
}

/* ─── Games (open-play) ─────────────────────────────────────── */
//
// Player-created open-play games. Browse + detail are public (guests can
// window-shop); create/join/leave require auth. The server derives `spotsLeft`
// and `participantCount`, so the app never computes capacity itself.

const GAMES_PREFIX = '/api/v1/games';

export interface ApiGamePerson {
  id: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface ApiGameVenue {
  id: string;
  displayName?: string;
  slug?: string;
  area?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  priceFrom?: number | null;
  priceFromLabel?: string | null;
  image?: string | null;
}

/** Game status. A game is created at a fixed venue and is immediately joinable. */
export type GameStatus = 'published' | 'full' | 'cancelled';

/** Who a game admits: everyone, or only players whose profile gender matches. */
export type GenderPolicy = 'all' | 'men' | 'women';

export interface ApiGame {
  id: string;
  title?: string | null;
  description?: string | null;
  gameType?: string | null;        // 'singles' | 'doubles' | 'open' | 'public'
  /** Competitive format for a public game (null otherwise). */
  format?: 'bracketing' | 'round_robin' | 'mini_tournament' | string | null;
  /** Host-set vibe — casual drop-in or competitive session. */
  vibe?: 'casual' | 'competitive' | string | null;
  /** Who the host admits. Matched against the player's profile gender when they
   *  join (or show interest); games created before the field read as 'all'. */
  genderPolicy?: GenderPolicy | string | null;
  skillLabel?: string | null;
  /** Numeric band parsed from `skillLabel` ('3.0–3.5' → 3.0 / 3.5). `skillMax` is
   *  absent for open-ended labels like '4.0+'. Drives skill-match ranking. */
  skillMin?: number | null;
  skillMax?: number | null;
  whenLabel?: string | null;
  timeLabel?: string | null;
  durationLabel?: string | null;
  date?: string | null;            // YYYY-MM-DD (best-effort)
  /** Sortable 24h 'HH:MM', materialized from the linked booking (or parsed from
   *  `timeLabel`). Null when the game carries no knowable start time. */
  startTime?: string | null;
  createdAt?: string | null;
  capacity?: number | null;
  spotsLeft?: number | null;
  participantCount?: number | null;
  participants?: ApiGamePerson[];
  /** Open Play interest (gameType 'open'): who tapped "I'm Interested" + the count.
   *  `viewerInterested` is derived client-side from `interestedUsers` vs the user id. */
  interestedUsers?: ApiGamePerson[];
  interestedCount?: number | null;
  /** Lobby size for open play — a cap: once the lobby is full, no one else joins. */
  targetPlayers?: number | null;
  /** When the lobby became full (ISO) — starts the 1h free-leave window. */
  fullAt?: string | null;
  /** Players awaiting host approval to leave a locked (full, window-closed) lobby. */
  pendingLeaveUsers?: ApiGamePerson[];
  pendingLeaveCount?: number | null;
  /** Host-gated joining: a join becomes a request the host must approve. */
  requiresApproval?: boolean;
  /** Open Play entrance fee per player, in pesos. 0 = free to join. Only a live
   *  organizer subscriber's game ever carries one; they collect it at the venue. */
  joinFee?: number | null;
  /** Players who asked to join and are waiting on the host. They hold no seat, so
   *  they're absent from `participants` and don't reduce `spotsLeft`. Deliberately
   *  non-empty even on a full lobby — that's the waiting list. */
  pendingJoinUsers?: ApiGamePerson[];
  pendingJoinCount?: number | null;
  /** Whether the viewer's own join request is waiting on the host. */
  viewerPendingJoin?: boolean;
  /** How many times the viewer has left this lobby (drives the re-join cooldown). */
  viewerLeaves?: number | null;
  creator?: ApiGamePerson | null;
  creatorId?: string | null;
  venue?: ApiGameVenue | null;
  venueId?: string | null;
  venueName?: string | null;       // free-text fallback when no venue link
  /** The host's booked court photo (servable path); cards prefer it over the venue image. */
  courtImage?: string | null;
  visibility?: string | null;
  status?: GameStatus | string | null;
  /** The host's court reservation, made + paid when the game was created. */
  bookingId?: string | null;
  /** Players invited + who invited them: `{ user, invitedBy }`. */
  invitedUserIds?: { user: string; invitedBy?: ApiGamePerson | null }[];
}

/** A player result from people/invite search (`/search?type=players`). */
export interface ApiPlayer {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  skillLevel?: number | null;
  skillLevelLabel?: string | null;
  lastActiveAt?: string | null;
  /** True when the result came from an owner-scoped staff search. */
  isStaff?: boolean;
}

export interface ListGamesParams {
  status?: string;
  venueId?: string;
  date?: string;
  /** "My Games" — games the current user created or joined (needs auth). */
  mine?: boolean;
  /** "My Invites" — games the current user was invited to (needs auth). */
  invited?: boolean;
  /** Max rows (1–100, default 50). The server truncates by `date`, so a caller
   *  that ranks on another key only ranks within the soonest `pageSize` rows. */
  pageSize?: number;
}

export interface CreateGamePayload {
  title?: string;
  description?: string;
  venueId?: string;
  venueName?: string;
  gameType: 'singles' | 'doubles' | 'open' | 'public';
  /** Competitive format — required for a public game, ignored otherwise. */
  format?: 'bracketing' | 'round_robin' | 'mini_tournament';
  /** Host-set vibe — casual or competitive (any type). */
  vibe?: 'casual' | 'competitive';
  /** Who can play. Omitted reads as 'all' server-side. */
  genderPolicy?: GenderPolicy;
  skillLabel?: string;
  whenLabel?: string;
  timeLabel?: string;
  durationLabel?: string;
  /** Explicit YYYY-MM-DD from the date picker; overrides the derived date. */
  date?: string;
  /** Player cap for every game type. Optional — the server defaults it to 4. */
  capacity?: number;
  /** LEGACY soft headcount goal for open play ("aiming for 8"). Never a cap —
   *  `capacity` is the cap. Kept for old rows; new games shouldn't set it. */
  targetPlayers?: number;
  /** Host-gated joining: joins become requests the host approves. Defaults false.
   *  Forced false server-side when the admin switch is off. */
  requiresApproval?: boolean;
  /** Open Play entrance fee per player. 0 = free. Only a live organizer
   *  subscriber can store a non-zero value — the server forces 0 otherwise. */
  joinFee?: number;
  visibility: 'public' | 'invite';
  /** The host's court reservation (created + paid via the booking flow) to link. */
  bookingId?: string;
}

/** List games — public browse, or the current user's games via `mine`. */
export async function listGames(params: ListGamesParams = {}): Promise<ApiGame[]> {
  // `mine` needs the token; for plain browse we still send it (optionalAuth)
  // so the server can resolve join-state, but it's harmless when absent.
  const env = await rawRequest<ApiGame[]>(`${GAMES_PREFIX}${toQuery({ ...params })}`, { auth: true });
  return env.data ?? [];
}

/** Fetch a single game with creator, participants, venue, and spots-left. */
export async function getGame(id: string): Promise<ApiGame> {
  return request<ApiGame>(`${GAMES_PREFIX}/${encodeURIComponent(id)}`, { auth: true });
}

/** Create (post) a game; the creator is auto-added as the first participant. */
export async function createGame(body: CreateGamePayload): Promise<ApiGame> {
  return request<ApiGame>(GAMES_PREFIX, { method: 'POST', body, auth: true });
}

/** Edit a game's details the current user created (host-only). */
export async function updateGame(id: string, body: Partial<CreateGamePayload>): Promise<ApiGame> {
  return request<ApiGame>(`${GAMES_PREFIX}/${encodeURIComponent(id)}`, { method: 'PATCH', body, auth: true });
}

/**
 * Delete a game the current user created (host-only). By default the linked court
 * reservation is cancelled (the hour frees up). Pass `{ keepBooking: true }` to
 * remove only the lobby and keep the court reserved — the reservation becomes a
 * normal court booking and its `bookingId` comes back so the caller can route to
 * the refund/cancel flow.
 */
export async function deleteGame(
  id: string,
  opts: { keepBooking?: boolean } = {},
): Promise<{ id: string; deleted: boolean; bookingId: string | null }> {
  const qs = opts.keepBooking ? '?keepBooking=true' : '';
  return request<{ id: string; deleted: boolean; bookingId: string | null }>(
    `${GAMES_PREFIX}/${encodeURIComponent(id)}${qs}`,
    { method: 'DELETE', auth: true },
  );
}

/** Join a game — server enforces capacity + one-per-player. */
export async function joinGame(id: string): Promise<ApiGame> {
  return request<ApiGame>(`${GAMES_PREFIX}/${id}/join`, { method: 'POST', body: {}, auth: true });
}

/** Leave a game (re-opens it if it was full). */
export async function leaveGame(id: string): Promise<ApiGame> {
  return request<ApiGame>(`${GAMES_PREFIX}/${id}/leave`, { method: 'POST', body: {}, auth: true });
}

/** Toggle "I'm Interested" on an Open Play game (gameType 'open'). Idempotent —
 *  taps interest in if absent, out if present. Returns the updated game. */
export async function toggleGameInterest(id: string): Promise<ApiGame> {
  return request<ApiGame>(`${GAMES_PREFIX}/${id}/interest`, { method: 'POST', body: {}, auth: true });
}

/** Ask the host for permission to leave a FULL lobby whose 1-hour free-leave
 *  window has closed. Adds the caller to `pendingLeaveUsers` + notifies the host. */
export async function requestLeaveGame(id: string): Promise<ApiGame> {
  return request<ApiGame>(`${GAMES_PREFIX}/${id}/request-leave`, { method: 'POST', body: {}, auth: true });
}

/** Host approves a pending leave request — removes that player from the roster. */
export async function approveLeaveGame(id: string, userId: string): Promise<ApiGame> {
  return request<ApiGame>(`${GAMES_PREFIX}/${id}/approve-leave`, { method: 'POST', body: { userId }, auth: true });
}

/** Host admits a player waiting on an approval-gated lobby. There's no matching
 *  `requestJoinGame`: on such a lobby `joinGame` IS the request — the server
 *  branches and returns the game with the caller in `pendingJoinUsers`. */
export async function approveJoinGame(id: string, userId: string): Promise<ApiGame> {
  return request<ApiGame>(`${GAMES_PREFIX}/${id}/approve-join`, { method: 'POST', body: { userId }, auth: true });
}

/** Host declines a pending join request — drops them from the queue, no seat. */
export async function rejectJoinGame(id: string, userId: string): Promise<ApiGame> {
  return request<ApiGame>(`${GAMES_PREFIX}/${id}/reject-join`, { method: 'POST', body: { userId }, auth: true });
}

/** Pending player withdraws their OWN join request (mirrors the host's reject,
 *  but self-service). No seat was held, so this just drops them from the queue. */
export async function cancelJoinGame(id: string): Promise<ApiGame> {
  return request<ApiGame>(`${GAMES_PREFIX}/${id}/join`, { method: 'DELETE', auth: true });
}

/** Host removes a player from the roster. */
export async function kickPlayer(id: string, userId: string): Promise<ApiGame> {
  return request<ApiGame>(`${GAMES_PREFIX}/${id}/kick`, { method: 'POST', body: { userId }, auth: true });
}

/* ─── Game group chat (roster) ───────────────────────────────── */

/** One message in a game's group chat. Carries the sender's name/avatar since a
 *  group thread has many senders (unlike the 1:1 ApiChatMessage). */
export interface ApiGameMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  body: string;
  createdAt: string;
  mine: boolean;
}

/** Load a game's group chat (roster only). Returns the game's title (for the
 *  chat header) alongside the messages. */
export async function listGameMessages(gameId: string): Promise<{ title: string | null; messages: ApiGameMessage[] }> {
  const env = await rawRequest<{ title?: string | null; messages?: ApiGameMessage[] }>(`${GAMES_PREFIX}/${encodeURIComponent(gameId)}/messages`, { auth: true });
  return { title: env.data?.title ?? null, messages: env.data?.messages ?? [] };
}

/** Post to a game's group chat — realtime-fans-out to the other roster members. */
export async function sendGameMessage(gameId: string, body: string): Promise<ApiGameMessage> {
  return request<ApiGameMessage>(`${GAMES_PREFIX}/${encodeURIComponent(gameId)}/messages`, { method: 'POST', body: { body }, auth: true });
}

/**
 * Search players by name, for invites/people search. Excludes the current user.
 *
 * Pass `invitable` from a game-invite surface: game invites only ever target
 * players, so owner/staff/organizer accounts are dropped from the results (an
 * owner can invite a player, but nobody invites an owner). Plain people-search —
 * starting a DM, an owner adding a member — leaves it off and sees everyone.
 */
export async function searchPlayers(q: string, opts?: { invitable?: boolean }): Promise<ApiPlayer[]> {
  const env = await rawRequest<{ players?: ApiPlayer[] }>(
    `/api/v1/search${toQuery({ q, type: 'players', invitable: opts?.invitable ? '1' : undefined })}`,
    { auth: true },
  );
  return env.data?.players ?? [];
}

/**
 * Staff-only search for the per-venue Staff tab. Returns only staff accounts
 * created by the given owner (roleDefault:'staff' + parentOwnerUserId match).
 * Pass an empty q to get all staff (for on-focus suggestions).
 */
export async function searchOwnerStaff(ownerUserId: string, q?: string): Promise<ApiPlayer[]> {
  const params: Record<string, string> = { type: 'players', ownerUserId };
  if (q && q.trim()) params.q = q.trim();
  const env = await rawRequest<{ players?: ApiPlayer[] }>(
    `/api/v1/search${toQuery(params)}`,
    { auth: true },
  );
  return env.data?.players ?? [];
}

/**
 * Owner-scoped player search: returns only players who have booked at or are
 * members of any venue the current owner manages. Deduplicates by userId and
 * filters locally by the query string. Falls back to empty if the owner has no
 * venues or all parallel fetches fail.
 */
export async function searchOwnerPlayers(q: string, userId: string): Promise<ApiPlayer[]> {
  const venues = await listManagedVenues(userId);
  const venueIds = venues.map((v) => (v as any)._id ?? v.id).filter(Boolean) as string[];
  if (!venueIds.length) return [];

  // Fetch bookings + members for all managed venues in parallel. Each request
  // is allowed to fail independently so one broken venue doesn't block the rest.
  const [bookingSets, memberSets] = await Promise.all([
    Promise.all(venueIds.map((vid) => getVenueBookings(vid).catch(() => [] as ApiBooking[]))),
    Promise.all(venueIds.map((vid) => listVenueMembers(vid).catch(() => [] as VenueMember[]))),
  ]);

  const seen = new Map<string, ApiPlayer>();
  const add = (id: string, displayName: string, avatarUrl?: string | null) => {
    if (!id || seen.has(id)) return;
    seen.set(id, { id, displayName, avatarUrl: avatarUrl ?? null });
  };

  for (const bookings of bookingSets) {
    for (const b of bookings) {
      if (b.userId && b.userName) add(b.userId, b.userName, b.userAvatarUrl);
    }
  }
  for (const members of memberSets) {
    for (const m of members) {
      if (m.userId) add(m.userId, m.displayName ?? m.email ?? 'Player', m.avatarUrl);
    }
  }

  const lowerQ = q.toLowerCase();
  return [...seen.values()]
    .filter((p) => p.displayName.toLowerCase().includes(lowerQ))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** A player suggestion for the owner's "New message" list — a player who has
 *  booked at or is a member of the owner's venue(s), with their latest booking
 *  context so the owner knows who they're messaging. */
export interface OwnerPlayerSuggestion {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** The most recent booking (by createdAt) — null if member-only, no booking. */
  latestBooking: {
    bookingId: string;
    createdAt: string;
    date: string;
    startTime: string;
    venueName: string;
    venueId: string;
  } | null;
  /** The venue id for conversation context when there's no booking. */
  memberVenueId: string | null;
  /** True when this player also has an active membership at one of the venues. */
  isMember: boolean;
  lastActiveAt?: string | null;
}

/**
 * Pre-fetched suggestion list for the owner's "New message" screen — every
 * player who has booked or is a member across all venues the owner manages,
 * sorted by recency (most recent booking first, then members). No query filter;
 * the caller does local filtering when the owner types.
 */
export async function getOwnerPlayerSuggestions(userId: string): Promise<OwnerPlayerSuggestion[]> {
  const venues = await listManagedVenues(userId);
  const venueIds = venues.map((v) => (v as any)._id ?? v.id).filter(Boolean) as string[];
  if (!venueIds.length) return [];

  const [bookingSets, memberSets] = await Promise.all([
    Promise.all(venueIds.map((vid) => getVenueBookings(vid).catch(() => [] as ApiBooking[]))),
    Promise.all(venueIds.map((vid) => listVenueMembers(vid).catch(() => [] as VenueMember[]))),
  ]);

  // Build a map: for each player, keep the most-recently-created booking and a
  // flag for whether they're also a member.
  const map = new Map<string, OwnerPlayerSuggestion>();

  for (const bookings of bookingSets) {
    for (const b of bookings) {
      if (!b.userId || !b.userName) continue;
      const key = String(b.userId);
      const cur = map.get(key);
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      const curCreated = cur?.latestBooking?.createdAt
        ? new Date(cur.latestBooking.createdAt).getTime()
        : -1;

      if (bCreated > curCreated || !cur) {
        map.set(key, {
          id: key,
          displayName: b.userName,
          avatarUrl: b.userAvatarUrl ?? null,
          latestBooking: {
            bookingId: b.id,
            createdAt: b.createdAt ?? '',
            date: b.date ?? '',
            startTime: b.startTime ?? '',
            venueName: b.venueName ?? '',
            venueId: b.venueId ?? '',
          },
          memberVenueId: cur?.memberVenueId ?? null,
          isMember: cur?.isMember ?? false,
        });
      }
    }
  }

  // Layer in members (they may already be in the map from a booking). Track the
  // venue so we can scope the conversation when the player has no booking.
  for (let i = 0; i < memberSets.length; i++) {
    const vid = venueIds[i];
    for (const m of memberSets[i]) {
      if (!m.userId) continue;
      const key = String(m.userId);
      const cur = map.get(key);
      if (cur) {
        cur.isMember = true;
        if (!cur.memberVenueId) cur.memberVenueId = vid;
      } else {
        map.set(key, {
          id: key,
          displayName: m.displayName ?? m.email ?? 'Player',
          avatarUrl: m.avatarUrl ?? null,
          latestBooking: null,
          memberVenueId: vid,
          isMember: true,
        });
      }
    }
  }

  // Sort: players with bookings first (most recent), then member-only.
  return [...map.values()].sort((a, b) => {
    const aTs = a.latestBooking?.createdAt ? new Date(a.latestBooking.createdAt).getTime() : 0;
    const bTs = b.latestBooking?.createdAt ? new Date(b.latestBooking.createdAt).getTime() : 0;
    if (bTs !== aTs) return bTs - aTs;
    return a.displayName.localeCompare(b.displayName);
  });
}

/* ─── Cross-entity search (global search screen) ─────────────── */
//
// One call (`?type=all`) fans out across courts/games/clubs/players and returns
// a normalized, render-ready shape the SearchScreen groups into sections. Sent
// with the token so the signed-in user is excluded from their own people search.

export type SearchResultKind = 'court' | 'game' | 'club' | 'player';

/** A single normalized search hit — `id` + the action target depends on `kind`. */
export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  name: string;
  subtitle: string;
}

export interface CrossSearchResults {
  courts: SearchResult[];
  games: SearchResult[];
  clubs: SearchResult[];
  players: SearchResult[];
}

// Raw rows from `/search?type=all`. Venues keep the legacy full-doc shape
// (`_id`); games/clubs are the lean card shapes the search controller returns.
interface RawSearchVenue { id?: string; _id?: string; slug?: string; displayName?: string; area?: string; courtCount?: number }
interface RawSearchGame { id: string; title?: string; gameType?: string | null; skillLabel?: string | null; whenLabel?: string | null; timeLabel?: string | null; date?: string | null; venueName?: string | null; capacity?: number; spotsLeft?: number }
interface RawSearchClub { id: string; name: string; memberCount?: number; visibility?: string; coverImageUrl?: string | null }

interface RawSearchResponse {
  venues?: RawSearchVenue[];
  games?: RawSearchGame[];
  clubs?: RawSearchClub[];
  players?: ApiPlayer[];
}

function gameSubtitle(g: RawSearchGame): string {
  const when = [g.whenLabel, g.timeLabel].filter(Boolean).join(' · ');
  const spots = g.capacity ? `${g.spotsLeft ?? 0}/${g.capacity} open` : null;
  return [when || g.date, g.skillLabel, spots].filter(Boolean).join(' · ') || 'Open play';
}

function courtSubtitle(v: RawSearchVenue): string {
  const courts = v.courtCount ? `${v.courtCount} court${v.courtCount === 1 ? '' : 's'}` : null;
  return [v.area, courts].filter(Boolean).join(' · ') || 'Court';
}

/** Search every entity at once for the global search screen. */
export async function crossSearch(q: string): Promise<CrossSearchResults> {
  const env = await rawRequest<RawSearchResponse>(
    `/api/v1/search${toQuery({ q, type: 'all' })}`,
    { auth: true },
  );
  const data = env.data ?? {};
  return {
    courts: (data.venues ?? []).map((v) => ({
      kind: 'court' as const,
      id: v.slug || String(v.id ?? v._id),
      name: v.displayName || 'Court',
      subtitle: courtSubtitle(v),
    })),
    games: (data.games ?? []).map((g) => ({
      kind: 'game' as const,
      id: String(g.id),
      name: g.title || 'Pickleball game',
      subtitle: gameSubtitle(g),
    })),
    clubs: (data.clubs ?? []).map((c) => ({
      kind: 'club' as const,
      id: String(c.id),
      name: c.name,
      subtitle: c.memberCount != null ? `${c.memberCount} member${c.memberCount === 1 ? '' : 's'}` : 'Club',
    })),
    players: (data.players ?? []).map((p) => ({
      kind: 'player' as const,
      id: String(p.id),
      name: p.displayName,
      subtitle: p.skillLevelLabel || (p.skillLevel != null ? `Skill ${p.skillLevel}` : 'Player'),
    })),
  };
}

/** Host invites players to a game — each gets an in-app notification + push. */
export async function inviteToGame(id: string, userIds: string[]): Promise<{ invited: number }> {
  return request<{ invited: number }>(`${GAMES_PREFIX}/${id}/invite`, { method: 'POST', body: { userIds }, auth: true });
}

export async function declineGameInvite(id: string): Promise<{ declined: boolean }> {
  return request<{ declined: boolean }>(`${GAMES_PREFIX}/${id}/invite`, { method: 'DELETE', auth: true });
}

/* ─── Notifications (inbox) ──────────────────────────────────── */
//
// The current user's notification feed (e.g. "your lobby is full"). All routes
// are self-scoped (`requireAuth`); the server stamps `createdAt`/`isRead`.

const NOTIFICATIONS_PREFIX = '/api/v1/notifications';

export interface ApiNotification {
  id: string;
  type?: string | null;
  title: string;
  body: string;
  icon?: string | null;
  /** A relative app path (e.g. "/games/<id>") the client maps to a screen. */
  linkUrl?: string | null;
  /** Opaque tag for grouping related notifications (e.g. friend-request-<id>). */
  tag?: string | null;
  isRead: boolean;
  createdAt?: string;
}

/** The current user's notifications, newest first (server caps at 50). */
export async function listNotifications(): Promise<ApiNotification[]> {
  const env = await rawRequest<ApiNotification[]>(NOTIFICATIONS_PREFIX, { auth: true });
  return env.data ?? [];
}

/** Unread notification count — cheap to poll for the live badge. */
export async function getUnreadNotificationCount(): Promise<number> {
  const env = await rawRequest<{ count: number }>(`${NOTIFICATIONS_PREFIX}/unread-count`, { auth: true });
  return env.data?.count ?? 0;
}

/** Mark a single notification read. */
export async function markNotificationRead(id: string): Promise<void> {
  await request(`${NOTIFICATIONS_PREFIX}/${encodeURIComponent(id)}`, { method: 'PATCH', body: {}, auth: true });
}

/** Mark every unread notification read. */
export async function markAllNotificationsRead(): Promise<void> {
  await request(`${NOTIFICATIONS_PREFIX}/mark-all-read`, { method: 'PATCH', body: {}, auth: true });
}

/** Delete a single notification. */
export async function deleteNotification(id: string): Promise<void> {
  await request(`${NOTIFICATIONS_PREFIX}/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

/* ─── Direct messages (1:1 chat) ─────────────────────────────── */
//
// Player ↔ player threads (e.g. "message the organizer" of a game). Each send
// also raises a `message` notification, so arrivals show in the notification
// inbox + push + the live unread badge; these endpoints back the chat UI.

const MESSAGES_PREFIX = '/api/v1/messages';

export interface ApiChatParticipant {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  /** ISO timestamp of the user's last activity (used for presence dot). */
  lastActiveAt?: string | null;
}

export interface ApiConversationSummary {
  id: string;
  otherParticipant: ApiChatParticipant | null;
  lastBody?: string | null;
  lastSenderId?: string | null;
  /** Set when the last message was deleted — the senderId of the user who deleted it. */
  lastDeletedBy?: string | null;
  lastAt?: string | null;
  unread: number;
  /** When the conversation was started from a venue page. */
  contextType?: string | null;
  contextId?: string | null;
  /** Resolved label — venue name, or "VenueName · Date" for bookings. null = direct message. */
  contextLabel?: string | null;
  /** Venue image URL (when contextType is 'venue'). Raw path — wrap with apiImageUrl. */
  contextImageUrl?: string | null;
  /** True when the viewer works this venue (owner or staff) — they see the player's
   *  name + avatar, so they know WHO messaged. Players see the venue. */
  viewerIsVenueSide?: boolean;
}

export interface ApiChatMessage {
  id: string;
  senderId: string;
  senderName?: string;
  body: string;
  createdAt?: string;
  mine: boolean;
  /** Sent by the venue (owner or staff). Staff render these as outgoing — the venue
   *  inbox is shared, so a colleague's reply is still the venue speaking. */
  fromVenueSide?: boolean;
  deleted?: boolean;
  replyToMessageId?: string | null;
  replyTo?: ApiChatMessage | null;
  readByOther?: boolean;
  readAtByOther?: string | null;
}

export interface ApiConversation {
  id: string;
  otherParticipant: ApiChatParticipant | null;
  messages: ApiChatMessage[];
  /** When the conversation was started from a venue page. */
  contextType?: string | null;
  contextId?: string | null;
  /** Resolved venue name. null = direct message. */
  contextLabel?: string | null;
  /** Venue image URL (when contextType is 'venue'). Raw path — wrap with apiImageUrl. */
  contextImageUrl?: string | null;
  /** True when the viewer works this venue (owner or staff) — they see the player,
   *  the player sees the venue. */
  viewerIsVenueSide?: boolean;
}

export interface ApiVenueConversation {
  id: string;
  otherParticipant: ApiChatParticipant | null;
  contextType: string;
  contextId: string;
  contextLabel: string | null;
}

/** The current user's conversation threads, newest first. */
export async function listConversations(): Promise<ApiConversationSummary[]> {
  const env = await rawRequest<ApiConversationSummary[]>(`${MESSAGES_PREFIX}/conversations`, { auth: true });
  return env.data ?? [];
}

/** Find or create a 1:1 thread with another user. Optionally scoped to a venue
 *  so the "Message venue" button always lands on the same thread. */
export async function startConversation(
  userId: string,
  context?: { contextType: string; contextId: string },
): Promise<{ id: string; otherParticipant: ApiChatParticipant | null }> {
  return request<{ id: string; otherParticipant: ApiChatParticipant | null }>(
    `${MESSAGES_PREFIX}/conversations`, { method: 'POST', body: { userId, ...context }, auth: true },
  );
}

/** Find-or-create the venue-scoped conversation between the current user and the
 *  venue owner. Returns the conversation id + venue name — the "Message venue"
 *  button navigates to the existing chat screen with this id. */
export async function getVenueConversation(venueId: string): Promise<ApiVenueConversation> {
  return request<ApiVenueConversation>(`${MESSAGES_PREFIX}/venue/${encodeURIComponent(venueId)}`, { auth: true });
}

/** Load a thread (other participant + messages); marks it read. */
export async function getConversation(id: string): Promise<ApiConversation> {
  return request<ApiConversation>(`${MESSAGES_PREFIX}/conversations/${encodeURIComponent(id)}`, { auth: true });
}

/** Send a message in a thread — notifies the recipient. Pass replyToMessageId to thread a reply. */
export async function sendMessage(id: string, body: string, replyToMessageId?: string | null): Promise<ApiChatMessage> {
  return request<ApiChatMessage>(`${MESSAGES_PREFIX}/conversations/${encodeURIComponent(id)}/messages`, { method: 'POST', body: { body, replyToMessageId: replyToMessageId ?? null }, auth: true });
}

/** Mark an open thread read without reloading the whole conversation. */
export async function markConversationRead(id: string): Promise<{ readAt?: string }> {
  return request<{ readAt?: string }>(`${MESSAGES_PREFIX}/conversations/${encodeURIComponent(id)}/read`, { method: 'POST', auth: true });
}

/** Broadcast a typing indicator to the other participant (debounced by the caller). */
export async function sendTyping(id: string): Promise<void> {
  await request(`${MESSAGES_PREFIX}/conversations/${encodeURIComponent(id)}/typing`, { method: 'POST', auth: true });
}

/** Total unread messages across the user's threads. */
export async function getUnreadMessageCount(): Promise<number> {
  const env = await rawRequest<{ count: number }>(`${MESSAGES_PREFIX}/unread-count`, { auth: true });
  return env.data?.count ?? 0;
}

/** Delete a thread for the current user only (the other side keeps it). */
export async function deleteConversation(id: string): Promise<void> {
  await request(`${MESSAGES_PREFIX}/conversations/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

/** Delete one of your own messages (removed for both participants). */
export async function deleteMessage(conversationId: string, messageId: string): Promise<void> {
  await request(`${MESSAGES_PREFIX}/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE', auth: true });
}

/* ─── Friends ────────────────────────────────────────────────── */
//
// Player-to-player social connections. Send/accept/reject friend requests;
// list friends; search for friendable users. Only users with role player/coach/
// organizer can be friended (enforced server-side).

const FRIENDS_PREFIX = '/api/v1/friends';

export interface ApiFriendProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  roleDefault: string;
  bio: string | null;
  skillLevel: number | null;
  skillLevelLabel: string | null;
  /** For friend suggestions: how many friends you share (friend-of-friend tier). */
  mutualCount?: number;
  /** Up to 3 mutual friends for the Facebook-style avatar stack. */
  mutualFriends?: { id: string; displayName: string; avatarUrl: string | null }[];
}

export interface ApiFriend {
  id: string;
  friend: ApiFriendProfile;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt?: string;
  sentByMe: boolean;
}

/** List the current user's accepted friends. */
export async function listFriends(): Promise<ApiFriend[]> {
  const env = await rawRequest<ApiFriend[]>(FRIENDS_PREFIX, { auth: true });
  return env.data ?? [];
}

/** List pending friend requests (sent + received). */
export async function listPendingFriendRequests(): Promise<ApiFriend[]> {
  const env = await rawRequest<ApiFriend[]>(`${FRIENDS_PREFIX}/pending`, { auth: true });
  return env.data ?? [];
}

/** Suggested friendable users — nearby (when lat/lng passed) → shared games/clubs → random. */
export async function suggestFriends(lat?: number | null, lng?: number | null): Promise<(ApiFriendProfile & { distanceKm?: number })[]> {
  const params: Record<string, string> = {};
  if (lat != null && lng != null) { params.lat = String(lat); params.lng = String(lng); }
  const env = await rawRequest<(ApiFriendProfile & { distanceKm?: number })[]>(`${FRIENDS_PREFIX}/suggestions${toQuery(params)}`, { auth: true });
  return env.data ?? [];
}

/** Search for friendable users (player/coach/organizer, excludes existing + self). */
export async function searchFriendableUsers(q: string): Promise<ApiFriendProfile[]> {
  const env = await rawRequest<ApiFriendProfile[]>(`${FRIENDS_PREFIX}/search${toQuery({ q })}`, { auth: true });
  return env.data ?? [];
}

/** Send a friend request to a user. */
export async function sendFriendRequest(userId: string): Promise<{ id: string; status: string; sentByMe: boolean }> {
  return request<{ id: string; status: string; sentByMe: boolean }>(`${FRIENDS_PREFIX}/request`, { method: 'POST', body: { userId }, auth: true });
}

/** Accept or reject a friend request. */
export async function respondToFriendRequest(requestId: string, accept: boolean): Promise<{ id: string; status: string }> {
  return request<{ id: string; status: string }>(`${FRIENDS_PREFIX}/request/${encodeURIComponent(requestId)}`, { method: 'PATCH', body: { accept }, auth: true });
}

/** Remove a friend (either side can do this). */
export async function removeFriend(friendshipId: string): Promise<{ id: string; removed: boolean }> {
  return request<{ id: string; removed: boolean }>(`${FRIENDS_PREFIX}/${encodeURIComponent(friendshipId)}`, { method: 'DELETE', auth: true });
}

/* ─── Web Push (OS notifications) ────────────────────────────── */
//
// Device-level push so the user is alerted even with the app closed. The browser
// subscription is registered with the API, which signs + sends via VAPID.

const PUSH_PREFIX = '/api/v1/push';

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

/** The VAPID public key the browser needs to create a push subscription. */
export async function getPushPublicKey(): Promise<{ publicKey: string | null }> {
  return request<{ publicKey: string | null }>(`${PUSH_PREFIX}/public-key`);
}

/** Register (or refresh) this device's push subscription. */
export async function subscribePush(sub: PushSubscriptionPayload): Promise<void> {
  await request(`${PUSH_PREFIX}/subscribe`, { method: 'POST', body: sub, auth: true });
}

/** Drop this device's subscription server-side (logout / turn-off). */
export async function unsubscribePush(endpoint: string): Promise<void> {
  await request(`${PUSH_PREFIX}/unsubscribe`, { method: 'POST', body: { endpoint }, auth: true });
}

/* ─── FCM token registration ──────────────────────────────────── */

export interface FcmTokenPayload {
  token: string;
  userAgent?: string;
}

/** Register an FCM token for this device (Google push, better Android delivery). */
export async function subscribeFcmToken(body: FcmTokenPayload): Promise<void> {
  await request(`${PUSH_PREFIX}/fcm-subscribe`, { method: 'POST', body, auth: true });
}

/** Remove an FCM token server-side (logout / disable push). */
export async function unsubscribeFcmToken(token: string): Promise<void> {
  await request(`${PUSH_PREFIX}/fcm-unsubscribe`, { method: 'POST', body: { token }, auth: true });
}

/* ─── Clubs (communities + feed) ─────────────────────────────── */
//
// A club is a community with members and a Facebook-style post feed. Browse +
// detail + feed are public; joining, posting, and reacting require auth (gated by
// player.clubs.* permissions server-side too).

const CLUBS_PREFIX = '/api/v1/clubs';

export interface ClubPerson {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ApiClub {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  visibility: 'public' | 'private';
  /** Max members (null = unlimited). */
  joinLimit?: number | null;
  memberCount: number;
  postCount: number;
  host: ClubPerson | null;
  isMember: boolean;
  isHost: boolean;
  /** True when the viewer is an assigned club staff (moderator). */
  isStaff?: boolean;
  joinRequestStatus: string | null;
  /** Up to 3 member avatars for the Facebook-style stack in Discover cards. */
  memberAvatars?: { id: string; displayName: string; avatarUrl: string | null }[];
}

export interface ApiClubStaff {
  id: string;
  userId: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  staffRole: string;
  createdAt: string;
}

export interface ApiClubMember {
  id: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'host' | 'member';
  joinedAt?: string | null;
}

/** A photo, GIF, or rich game share card attached to a club post.
 *  `url` is raw — wrap with apiImageUrl to render. */
export interface ClubAttachment {
  type: 'image' | 'gif' | 'game_link';
  url?: string;          // required for image/gif; optional thumbnail for game_link
  // ── game_link fields ──────────────────────────────────────────
  gameId?: string;       // the game to navigate to / join
  title?: string;        // card headline
  subtitle?: string;     // fallback detail line
  gameType?: string;     // "Doubles" / "Singles" / "Open Play"
  skillLabel?: string;   // "3.0–3.5" / "All levels"
  dateTime?: string;     // "Today · 6:30 PM"
  venue?: string;        // "The Dink Lab · Makati"
  spotsLeft?: number;    // remaining spots
  capacity?: number;     // total spots
}

export interface ApiClubPost {
  id: string;
  author: ClubPerson | null;
  body: string | null;
  attachments?: ClubAttachment[];
  reactionCount: number;
  replyCount: number;
  viewerReacted: boolean;
  isDeleted: boolean;
  createdAt?: string | null;
}

/** One page of clubs + the cursor for the next page (null = no more). */
export interface ClubPage {
  items: ApiClub[];
  cursor: string | null;
}

/**
 * Clubs list (cursor-paginated). `mine` = clubs you're a member of; otherwise
 * the public directory. `search` filters server-side (so matches aren't limited
 * to the first page); pass `cursor` for the next page.
 */
export async function listClubs(params: { mine?: boolean; search?: string; cursor?: string; pageSize?: number } = {}): Promise<ClubPage> {
  const env = await rawRequest<ApiClub[]>(`${CLUBS_PREFIX}${toQuery({ pageSize: 20, ...params })}`, { auth: true });
  return { items: env.data ?? [], cursor: env.meta?.cursor ?? null };
}

/** A single club (by slug or _id), with viewer membership flags. */
export async function getClub(idOrSlug: string): Promise<ApiClub> {
  return request<ApiClub>(`${CLUBS_PREFIX}/${encodeURIComponent(idOrSlug)}`, { auth: true });
}

export interface CreateClubPayload {
  name: string;
  description?: string;
  visibility?: 'public' | 'private';
  coverImageUrl?: string;
  joinLimit?: number;
}

/** Create a club (you become the host + first member). */
export async function createClub(body: CreateClubPayload): Promise<ApiClub> {
  return request<ApiClub>(CLUBS_PREFIX, { method: 'POST', body, auth: true });
}

export interface UpdateClubPayload {
  name?: string;
  description?: string;
  visibility?: 'public' | 'private';
  /** New cover URL, or '' to clear it (the server maps a falsy value to none). */
  coverImageUrl?: string;
  joinLimit?: number | null;
}

/** Edit a club (host-only; server enforces host-or-moderate). */
export async function updateClub(id: string, body: UpdateClubPayload): Promise<ApiClub> {
  return request<ApiClub>(`${CLUBS_PREFIX}/${id}`, { method: 'PATCH', body, auth: true });
}

/** Join a club → `{ status: 'member' | 'pending' }` (private clubs request approval). */
export async function joinClub(id: string): Promise<{ status: string }> {
  return request<{ status: string }>(`${CLUBS_PREFIX}/${id}/join`, { method: 'POST', body: {}, auth: true });
}

/** Leave a club. */
export async function leaveClub(id: string): Promise<{ left: boolean }> {
  return request<{ left: boolean }>(`${CLUBS_PREFIX}/${id}/leave`, { method: 'POST', body: {}, auth: true });
}

/** Delete a club (host-only; cascades members/posts/reactions server-side). */
export async function deleteClub(id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`${CLUBS_PREFIX}/${id}`, { method: 'DELETE', auth: true });
}

/** A club's assigned staff (host-only). */
export async function listClubStaff(clubId: string): Promise<ApiClubStaff[]> {
  const env = await rawRequest<ApiClubStaff[]>(`${CLUBS_PREFIX}/${clubId}/staff`, { auth: true });
  return env.data ?? [];
}

/** Add a staff member to a club (host-only). */
export async function addClubStaff(clubId: string, userId: string, staffRole?: string): Promise<ApiClubStaff> {
  return request<ApiClubStaff>(`${CLUBS_PREFIX}/${clubId}/staff`, { method: 'POST', body: { userId, staffRole }, auth: true });
}

/** Remove a staff member from a club (host-only). */
export async function removeClubStaff(staffId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`${CLUBS_PREFIX}/staff/${staffId}`, { method: 'DELETE', auth: true });
}

/** A club's members. */
export async function listClubMembers(id: string): Promise<ApiClubMember[]> {
  const env = await rawRequest<ApiClubMember[]>(`${CLUBS_PREFIX}/${id}/members`, { auth: true });
  return env.data ?? [];
}

/** A club's top-level feed posts (newest first). */
export async function listClubFeed(id: string): Promise<ApiClubPost[]> {
  const env = await rawRequest<ApiClubPost[]>(`${CLUBS_PREFIX}/${id}/feed`, { auth: true });
  return env.data ?? [];
}

/** A single post (for the permalink/single-post view) — `GET /:id/posts/:postId`
 *  returns `{ post, replies }`; we return just the post (replies via listClubReplies). */
export async function getClubPost(id: string, postId: string): Promise<ApiClubPost> {
  const env = await rawRequest<{ post: ApiClubPost; replies?: ApiClubPost[] }>(`${CLUBS_PREFIX}/${id}/posts/${postId}`, { auth: true });
  return (env.data?.post ?? null) as ApiClubPost;
}

/**
 * Post to a club's feed. Pass `parentPostId` to make it a comment/reply on a
 * post, and `attachments` (uploaded via uploadClubMedia) for photos/GIFs. A post
 * needs text OR at least one attachment.
 */
export async function createClubPost(id: string, body: string, parentPostId?: string, attachments?: ClubAttachment[]): Promise<ApiClubPost> {
  const payload: Record<string, unknown> = { body };
  if (parentPostId) payload.parentPostId = parentPostId;
  if (attachments && attachments.length) payload.attachments = attachments;
  return request<ApiClubPost>(`${CLUBS_PREFIX}/${id}/posts`, { method: 'POST', body: payload, auth: true });
}

/** Comments on a post (newest-first from the API), up to 50. */
export async function listClubReplies(id: string, postId: string): Promise<ApiClubPost[]> {
  const env = await rawRequest<ApiClubPost[]>(`${CLUBS_PREFIX}/${id}/posts/${postId}/replies${toQuery({ pageSize: 50 })}`, { auth: true });
  return env.data ?? [];
}

/** Like / unlike a post. */
export async function reactClubPost(id: string, postId: string): Promise<unknown> {
  return request(`${CLUBS_PREFIX}/${id}/posts/${postId}/react`, { method: 'POST', body: {}, auth: true });
}
export async function unreactClubPost(id: string, postId: string): Promise<unknown> {
  return request(`${CLUBS_PREFIX}/${id}/posts/${postId}/react`, { method: 'DELETE', auth: true });
}

/** Edit a post or comment (author-only; server enforces it). */
export async function editClubPost(id: string, postId: string, body: string): Promise<ApiClubPost> {
  return request<ApiClubPost>(`${CLUBS_PREFIX}/${id}/posts/${postId}`, { method: 'PATCH', body: { body }, auth: true });
}

/** Soft-delete a post or comment (author or host; server enforces it). */
export async function deleteClubPost(id: string, postId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`${CLUBS_PREFIX}/${id}/posts/${postId}`, { method: 'DELETE', auth: true });
}

/* ─── Club member group chat ─────────────────────────────────────── */

/** One message in a club's member chat (host + members), separate from the feed.
 *  Mirrors ApiGameMessage / ApiTournamentMessage — many senders, so it carries
 *  the sender's name/avatar. */
export interface ApiClubMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  body: string;
  card?: GameLinkCard | null;
  createdAt: string;
  mine: boolean;
}

/** A rich game share card embedded in a club chat message or post attachment. */
export interface GameLinkCard {
  gameId: string;
  title?: string;
  subtitle?: string;
  gameType?: string;
  skillLabel?: string;
  dateTime?: string;
  venue?: string;
  imageUrl?: string;
  spotsLeft?: number;
  capacity?: number;
}

/** Load a club's member chat (members only). Returns the club name (for the chat
 *  header) alongside the messages. */
export async function listClubMessages(id: string): Promise<{ title: string | null; messages: ApiClubMessage[] }> {
  const env = await rawRequest<{ title?: string | null; messages?: ApiClubMessage[] }>(`${CLUBS_PREFIX}/${id}/messages`, { auth: true });
  return { title: env.data?.title ?? null, messages: env.data?.messages ?? [] };
}

/** Post to a club's member chat — realtime-fans-out to the other members.
 *  Pass an optional `card` to embed a rich game share card in the message. */
export async function sendClubMessage(id: string, body: string, card?: GameLinkCard): Promise<ApiClubMessage> {
  const payload: Record<string, unknown> = { body };
  if (card) payload.card = card;
  return request<ApiClubMessage>(`${CLUBS_PREFIX}/${id}/messages`, { method: 'POST', body: payload, auth: true });
}

/** Edit your own club chat message (body only; sender-only). */
export async function editClubMessage(clubId: string, msgId: string, body: string): Promise<ApiClubMessage> {
  return request<ApiClubMessage>(`${CLUBS_PREFIX}/${clubId}/messages/${msgId}`, { method: 'PATCH', body: { body }, auth: true });
}

/** Delete your own club chat message (sender-only). */
export async function deleteClubMessage(clubId: string, msgId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`${CLUBS_PREFIX}/${clubId}/messages/${msgId}`, { method: 'DELETE', auth: true });
}

/** Remove a member from a club (host-only; can't remove the host). */
export async function removeClubMember(id: string, userId: string): Promise<{ removed: boolean }> {
  return request<{ removed: boolean }>(`${CLUBS_PREFIX}/${id}/members/${userId}`, { method: 'DELETE', auth: true });
}

/** A pending join request on a private club (host-only view). */
export interface ApiClubRequest {
  id: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  message: string | null;
  createdAt?: string | null;
}

/** Pending join requests for a private club (host-only; server enforces it). */
export async function listClubRequests(id: string): Promise<ApiClubRequest[]> {
  const env = await rawRequest<ApiClubRequest[]>(`${CLUBS_PREFIX}/${id}/requests`, { auth: true });
  return env.data ?? [];
}

/** Approve a join request → creates the membership (host-only). */
export async function approveClubRequest(id: string, reqId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`${CLUBS_PREFIX}/${id}/requests/${reqId}/approve`, { method: 'POST', body: {}, auth: true });
}

/** Deny a join request (host-only). */
export async function denyClubRequest(id: string, reqId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`${CLUBS_PREFIX}/${id}/requests/${reqId}/deny`, { method: 'POST', body: {}, auth: true });
}

/* ─── PickleFeed (global player newsfeed) ────────────────────── */
//
// The global feed — Threads/Facebook-style. Mirrors the club feed client, but
// unscoped: posts belong to everyone. Read is public; write needs auth and is
// author-scoped. See api/src/features/feed.

const FEED_PREFIX = '/api/v1/feed';

/** A share card on a feed post — a public game, open-play session, or club.
 *  Tap it (via `refId`) to open + join that entity. `imageUrl` is raw — wrap
 *  with apiImageUrl to render. */
export interface FeedAttachment {
  type: 'game' | 'open_play' | 'club' | 'image' | 'gif';
  /** Share cards only — the game/session/club to open. Null for media. */
  refId: string | null;
  /** Media only — the uploaded photo/GIF path (wrap with apiImageUrl). Null for share cards. */
  url: string | null;
  title: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  gameType: string | null;
  skillLabel: string | null;
  dateTime: string | null;
  venue: string | null;
  spotsLeft: number | null;
  capacity: number | null;
  memberCount: number | null;
}

/** A shallow snapshot of a reposted post (one level deep — never nested). */
export interface FeedSharedPost {
  id: string;
  author: ClubPerson | null;
  authorId: string;
  body: string | null;
  attachments: FeedAttachment[];
  isDeleted: boolean;
  createdAt?: string | null;
}

export interface ApiFeedPost {
  id: string;
  parentPostId: string | null;
  rootPostId: string | null;
  authorId: string;
  author: ClubPerson | null;
  body: string | null;
  attachments: FeedAttachment[];
  sharedPostId: string | null;
  sharedPost: FeedSharedPost | null;
  reactionCount: number;
  replyCount: number;
  viewerReacted: boolean;
  /** The viewer's per-author feed preference (null = none). */
  viewerAuthorSignal?: 'interested' | 'not_interested' | null;
  /** Whether the viewer gets notified on new comments to this post. */
  viewerNotify?: boolean;
  isDeleted: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** One page of feed posts + the cursor for the next page (null = no more). */
export interface FeedPage {
  items: ApiFeedPost[];
  cursor: string | null;
}

/** The global feed's top-level posts (cursor-paginated, newest first). */
export async function listFeed(params: { cursor?: string; pageSize?: number } = {}): Promise<FeedPage> {
  const env = await rawRequest<ApiFeedPost[]>(`${FEED_PREFIX}${toQuery({ pageSize: 20, ...params })}`, { auth: true });
  return { items: env.data ?? [], cursor: env.meta?.cursor ?? null };
}

/** A single post (permalink). `GET /posts/:postId` returns `{ post, replies }`;
 *  we return just the post (replies via listFeedReplies). */
export async function getFeedPost(postId: string): Promise<ApiFeedPost> {
  const env = await rawRequest<{ post: ApiFeedPost; replies?: ApiFeedPost[] }>(`${FEED_PREFIX}/posts/${postId}`, { auth: true });
  return (env.data?.post ?? null) as ApiFeedPost;
}

export interface CreateFeedPostPayload {
  body?: string;
  /** Makes the post a comment on this post. */
  parentPostId?: string;
  /** Makes the post a repost (quote) of this post. */
  sharedPostId?: string;
  /** A share card — the server enriches the display fields from the entity. */
  attachment?: { type: 'game' | 'open_play' | 'club'; refId: string };
  /** Uploaded photos/GIFs (via uploadFeedMedia). Photos anywhere; GIFs only on
   *  comments. `caption` is an optional per-photo label (read back as `title`). */
  media?: { type: 'image' | 'gif'; url: string; caption?: string }[];
}

/** Create a post / comment / repost / share card. Needs text, an attachment, or a repost. */
export async function createFeedPost(payload: CreateFeedPostPayload): Promise<ApiFeedPost> {
  return request<ApiFeedPost>(`${FEED_PREFIX}/posts`, { method: 'POST', body: payload, auth: true });
}

/** Comments on a post (newest-first from the API), up to 50. */
export async function listFeedReplies(postId: string): Promise<ApiFeedPost[]> {
  const env = await rawRequest<ApiFeedPost[]>(`${FEED_PREFIX}/posts/${postId}/replies${toQuery({ pageSize: 50 })}`, { auth: true });
  return env.data ?? [];
}

/** Like a post (idempotent). */
export async function reactFeedPost(postId: string): Promise<{ reacted: boolean; reactionCount: number }> {
  return request(`${FEED_PREFIX}/posts/${postId}/react`, { method: 'POST', body: {}, auth: true });
}
/** Unlike a post. */
export async function unreactFeedPost(postId: string): Promise<{ reacted: boolean; reactionCount: number }> {
  return request(`${FEED_PREFIX}/posts/${postId}/react`, { method: 'DELETE', auth: true });
}

/** Edit a post/comment body (author-only; server enforces it). */
export async function editFeedPost(postId: string, body: string): Promise<ApiFeedPost> {
  return request<ApiFeedPost>(`${FEED_PREFIX}/posts/${postId}`, { method: 'PATCH', body: { body }, auth: true });
}

/** Soft-delete a post/comment (author-only; server enforces it). */
export async function deleteFeedPost(postId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`${FEED_PREFIX}/posts/${postId}`, { method: 'DELETE', auth: true });
}

/** Set (or clear) the viewer's per-author feed preference. `interested` surfaces
 *  more of that author (floated + de-clustered); `not_interested` mutes them. */
export async function setFeedSignal(authorId: string, type: 'interested' | 'not_interested' | 'clear'): Promise<{ authorId: string; type: string | null }> {
  return request(`${FEED_PREFIX}/signals`, { method: 'POST', body: { authorId, type }, auth: true });
}

/** Hide a post from the viewer's feed for 24 hours. */
export async function hideFeedPost(postId: string): Promise<{ hidden: boolean }> {
  return request(`${FEED_PREFIX}/posts/${postId}/hide`, { method: 'POST', body: {}, auth: true });
}

/** Report a post for moderation review. */
export async function reportFeedPost(postId: string, reason?: string): Promise<{ reported: boolean }> {
  return request(`${FEED_PREFIX}/posts/${postId}/report`, { method: 'POST', body: { reason }, auth: true });
}

/** Turn comment notifications on/off for a post. */
export async function subscribeFeedPost(postId: string): Promise<{ subscribed: boolean }> {
  return request(`${FEED_PREFIX}/posts/${postId}/notify`, { method: 'POST', body: {}, auth: true });
}
export async function unsubscribeFeedPost(postId: string): Promise<{ subscribed: boolean }> {
  return request(`${FEED_PREFIX}/posts/${postId}/notify`, { method: 'DELETE', auth: true });
}

/* ─── Bookings + checkout ───────────────────────────────────── */
//
// A booking is a court reservation. It is created `pending_approval`; paying for
// it via checkout (test mode) flips it to `confirmed`. All endpoints require auth.

const BOOKINGS_PREFIX = '/api/v1/bookings';
const PAYMENTS_PREFIX = '/api/v1/payments';

export interface ApiBooking {
  id: string;
  venueId?: string | null;
  venueName?: string | null;
  venueSlug?: string | null;
  courtId?: string | null;
  /** 'open_play' = a courtless per-session drop-in (V3); 'game' = a game's court hold; else a normal court booking. */
  bookingType?: string | null;
  /** Half-court sub-unit index (0-based) when this booking occupies a split-court sub-unit. */
  subUnitIndex?: number | null;
  courtNumber?: string | null;     // populated by the owner bookings endpoint
  courtName?: string | null;       // populated by the owner bookings endpoint
  // Linked game metadata — only on bookingType 'game', from the owner bookings endpoint.
  gameType?: string | null;        // 'singles' | 'doubles' | 'open' | 'public'
  gameVisibility?: string | null;  // 'public' | 'invite'
  gameTitle?: string | null;
  gameFormat?: string | null;      // public game: 'bracketing' | 'round_robin' | 'mini_tournament'
  date?: string | null;            // YYYY-MM-DD
  startTime?: string | null;       // "18:30"
  endTime?: string | null;
  playerCount?: number | null;
  amount?: number | null;
  // 'pending_approval' (awaiting owner) | 'awaiting_payment' (approved; pay by
  // paymentDueAt) | 'confirmed' | 'paid' | 'cancelled'.
  status?: string | null;
  paymentMethod?: string | null;
  /** Latest checkout payment on owner booking responses; used for manual GCash reconciliation. */
  paymentId?: string | null;
  paymentStatus?: string | null;
  /** Deadline to pay once the owner approves a request-to-book (else it expires). */
  paymentDueAt?: string | null;
  /** When an unanswered request-to-book auto-cancels and the slot goes back on
   *  sale. Absent on instant-book bookings and on rows predating the feature. */
  approvalDeadline?: string | null;
  /** Masked card captured at request time (so paying after approval is one tap). */
  savedCard?: { brand?: string | null; last4?: string | null } | null;
  cancellationReason?: string | null;
  /** Why a cancelled booking was cancelled — 'owner_rejected' (declined) vs
   *  'player_cancelled' / 'system_expired' / 'owner_removed'. Absent unless cancelled. */
  cancellationType?: string | null;
  /** Equipment rental add-on (V2). */
  hasEquipmentRental?: boolean | null;
  equipmentRentalAmount?: number | null;
  /** Free-text note (player request or front-desk remark). */
  notes?: string | null;
  /** Payment breakdown: 7% platform fee, how the player paid, what's owed at the venue. */
  serviceFeeAmount?: number | null;
  paymentOption?: PaymentOption | null;
  amountPaid?: number | null;
  balanceDue?: number | null;
  /** Pricing audit trail — which rate source resolved the amount + the breakdown. */
  rateSource?: string | null;         // 'surge'|'timeBlock'|'holiday'|'weekend'|'subUnit'|'court'|'venue'|'manual'
  overrideId?: string | null;        // SlotPriceOverride _id when rateSource='surge'
  baseRate?: number | null;          // resolved rate before member discount
  memberDiscountPercent?: number | null;  // 0–100
  customerCategory?: 'none' | 'senior' | 'pwd' | null;
  discountPercent?: number | null;
  discountAmount?: number | null;
  discountIdNumber?: string | null;
  preDiscountSubtotal?: number | null;
  /** Owner-entered bookings: off-platform customer + source, or a slot-block reason. */
  customerName?: string | null;
  customerPhone?: string | null;
  bookingSource?: string | null;   // 'walk_in' | 'phone' | 'messenger' | 'instagram' | 'other'
  blockReason?: string | null;
  createdAt?: string | null;
  userId?: string | null;          // the booker's id — populated by the owner bookings endpoint only
  userName?: string | null;        // populated by the owner bookings endpoint only
  userAvatarUrl?: string | null;   // populated by the owner bookings endpoint only
}

export interface CreateBookingPayload {
  venueId: string;
  /** 'open_play' = courtless per-session drop-in (V3, priced from openPlayPrice). Omit for a normal court booking. */
  bookingType?: string;
  courtId?: string;
  /** Half-court sub-unit index (0-based) when booking a split-court sub-unit. */
  subUnitIndex?: number;
  date: string;                    // YYYY-MM-DD
  startTime?: string;              // "18:30"
  endTime?: string;
  playerCount?: number;
  amount: number;
  paymentMethod?: string;
  notes?: string;
  /** Masked card stored on an approval-required request, for pay-after-approval. */
  card?: { brand?: string; last4?: string };
  /** Equipment rental add-on (V2). */
  hasEquipmentRental?: boolean;
  equipmentRentalAmount?: number;
  /** Payment breakdown (deposit / full / pay-at-venue + 7% service fee). */
  serviceFeeAmount?: number;
  paymentOption?: PaymentOption;
  amountPaid?: number;
  balanceDue?: number;
  customerCategory?: 'none' | 'senior' | 'pwd';
  discountIdNumber?: string;
  /** Repeat this same slot on these weekdays (0=Sun…6=Sat) for the next `weeks`.
   *  The primary is paid now; each occurrence is held awaiting_payment (pay lazily
   *  from My Bookings as its date nears). Server returns `recurrenceCount`. */
  recurrence?: { daysOfWeek: number[]; weeks: number };
}

/** The current user's bookings, newest first (optionally filtered by status). */
export async function listBookings(params: { status?: string } = {}): Promise<ApiBooking[]> {
  const env = await rawRequest<ApiBooking[]>(`${BOOKINGS_PREFIX}${toQuery({ ...params })}`, { auth: true });
  return env.data ?? [];
}

/** Create a booking. Instant-book courts come back 'confirmed'; courts needing
 *  owner approval come back 'pending_approval' with an `approvalDeadline` after
 *  which the request auto-cancels and the slot is released. */
export async function createBooking(body: CreateBookingPayload): Promise<ApiBooking> {
  return request<ApiBooking>(BOOKINGS_PREFIX, { method: 'POST', body, auth: true });
}

/** Fetch a single booking. */
export async function getBooking(id: string): Promise<ApiBooking> {
  return request<ApiBooking>(`${BOOKINGS_PREFIX}/${encodeURIComponent(id)}`, { auth: true });
}

/** What the player gets back if they cancel this booking now (3-day-window policy).
 *  Fetched by the refund screen so it can show the real figure before confirming. */
export interface RefundQuote {
  paid: number;
  refund: number;
  feeDeducted: number;
  feePercent: number;
  withinWindow: boolean;
  daysUntil: number;
  freeWindowDays: number;
}

export async function getRefundQuote(id: string): Promise<RefundQuote> {
  return request<RefundQuote>(`${BOOKINGS_PREFIX}/${encodeURIComponent(id)}/refund-quote`, { auth: true });
}

/** Cancel a booking. */
export async function cancelBooking(id: string, cancellationReason?: string): Promise<ApiBooking> {
  return request<ApiBooking>(`${BOOKINGS_PREFIX}/${id}/cancel`, { method: 'POST', body: { cancellationReason }, auth: true });
}

/* ─── Owner: bookings inbox + analytics ─────────────────────────── */
//
// Owner-gated views over a venue the current user owns. `getVenueBookings`
// returns every booking for the venue (newest first, capped server-side) with
// the player's `userName` populated; `updateBookingStatus` drives the inbox
// actions; `getVenueAnalytics` returns aggregated business metrics for the
// dashboard. All require auth + venue ownership (or admin).

// Owner inbox transitions: approve a request-to-book ('awaiting_payment' — the
// player then pays to confirm), cancel/decline ('cancelled'), or confirm a legacy
// pending row directly. No 'paid' transition from the app.
export type BookingStatus = 'confirmed' | 'cancelled' | 'awaiting_payment';

/** All bookings for a venue the user owns (optionally filtered by status). */
export async function getVenueBookings(venueId: string, status?: string): Promise<ApiBooking[]> {
  const env = await rawRequest<ApiBooking[]>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/bookings${toQuery({ status })}`, { auth: true });
  return env.data ?? [];
}

/** Confirm / cancel a booking on a venue the user owns. */
export async function updateBookingStatus(
  venueId: string,
  bookingId: string,
  body: { status: BookingStatus; cancellationReason?: string },
): Promise<ApiBooking> {
  return request<ApiBooking>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/bookings/${encodeURIComponent(bookingId)}`, { method: 'PATCH', body, auth: true });
}

/** Owner/staff-entered booking: a 'manual' off-platform reservation (phone /
 *  Messenger / IG / walk-in) or a 'blocked' slot. POST /venues/:id/bookings —
 *  gated server-side to the owner or any active staff (front-desk included). */
export interface VenueBookingPayload {
  bookingType: 'manual' | 'blocked';
  courtId?: string;
  subUnitIndex?: number;
  date: string;                    // YYYY-MM-DD
  startTime: string;               // "18:00"
  endTime: string;
  // Manual booking fields.
  customerName?: string;
  customerPhone?: string;
  bookingSource?: 'walk_in' | 'phone' | 'messenger' | 'instagram' | 'other';
  amount?: number;
  paymentMethod?: string;
  notes?: string;
  customerCategory?: 'none' | 'senior' | 'pwd';
  discountIdNumber?: string;
  // Slot-block field.
  blockReason?: string;
}

export async function createVenueBooking(venueId: string, body: VenueBookingPayload): Promise<ApiBooking> {
  return request<ApiBooking>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/bookings`, { method: 'POST', body, auth: true });
}

/* ─── Recurring bookings (weekly regulars / leagues) ──────────────── */

export interface RecurringBookingPayload {
  bookingType?: 'manual' | 'blocked';
  courtId?: string;
  subUnitIndex?: number;
  startDate: string;     // YYYY-MM-DD (first occurrence)
  startTime: string;     // "18:00"
  endTime: string;
  weeks: number;         // 2–52
  weeklyInterval?: number; // every N weeks (default 1)
  customerName?: string;
  customerPhone?: string;
  bookingSource?: 'walk_in' | 'phone' | 'messenger' | 'instagram' | 'other';
  amount?: number;
  customerCategory?: 'none' | 'senior' | 'pwd';
  discountIdNumber?: string;
  notes?: string;
  blockReason?: string;
}

export interface RecurringSeries {
  recurringId: string;
  bookingType: 'manual' | 'blocked';
  courtId: string | null;
  courtName: string;
  label: string;
  startTime: string;
  endTime: string;
  amount?: number;
  dates: string[];
  firstDate: string;
  lastDate: string;
  dayOfWeek: number | null;
  upcomingCount: number;
  totalCount: number;
}

/** Create a recurring weekly booking series (owner/staff). Returns created + skipped weeks. */
export async function createRecurringBooking(
  venueId: string,
  body: RecurringBookingPayload,
): Promise<{ recurringId: string; created: ApiBooking[]; skipped: { date: string; reason: string }[]; createdCount: number; skippedCount: number }> {
  return request(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/recurring-bookings`, { method: 'POST', body, auth: true });
}

/** List the venue's recurring series (owner/staff). */
export async function listRecurringBookings(venueId: string): Promise<RecurringSeries[]> {
  const res = await request<RecurringSeries[]>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/recurring-bookings`, { auth: true });
  return res ?? [];
}

/** Cancel a recurring series' future instances (owner/staff). */
export async function cancelRecurringBooking(recurringId: string): Promise<{ cancelled: number }> {
  return request(`${VENUES_PREFIX}/recurring-bookings/${encodeURIComponent(recurringId)}`, { method: 'DELETE', auth: true });
}

export interface OwnerAnalytics {
  kpis: {
    revenue: { today: number; week: number; month: number; prevMonth: number; momChangePct: number };
    bookings: { today: number; pending: number; upcoming: number; week: number; prevWeek: number };
    occupancyPct: { week: number; prevWeek: number };
  };
  revenueDaily: { date: string; amount: number; bookings: number }[];
  bookingsDaily: { date: string; confirmed: number; paid: number; pending: number; cancelled: number }[];
  byCourt: { courtId: string; courtNumber: string | number; amount: number; bookings: number }[];
  peakHours: { dayOfWeek: number; hour: number; bookings: number }[];
  topCustomers: { userId: string; name: string; bookings: number; spend: number }[];
}

/** Aggregated business analytics for a venue the user owns (default 90-day window). */
export async function getVenueAnalytics(venueId: string, days?: number): Promise<OwnerAnalytics> {
  return request<OwnerAnalytics>(`${VENUES_PREFIX}/${encodeURIComponent(venueId)}/analytics${toQuery({ days })}`, { auth: true });
}

export interface CheckoutCard {
  number?: string;
  expiry?: string;
  cvc?: string;
  /** Cardholder + billing details. Collected by the subscription payment form;
   *  optional so booking checkout (which doesn't collect them) is unaffected.
   *  Never stored or charged. */
  name?: string;
  billingAddress1?: string;
  billingAddress2?: string;
  billingCity?: string;
  billingProvince?: string;
  billingZip?: string;
}

export interface CheckoutPayload {
  bookingId: string;
  amount: number;
  currency?: string;
  method?: string;
  card?: CheckoutCard;
}

export interface CheckoutResult {
  payment: { id: string; status?: string | null; amount?: number | null };
  booking: ApiBooking | null;
  /** Whether the server processed this in demo (no-charge) mode. */
  testMode: boolean;
}

/** Pay for a booking. In test mode this completes instantly and confirms it. */
export async function checkout(body: CheckoutPayload): Promise<CheckoutResult> {
  return request<CheckoutResult>(`${PAYMENTS_PREFIX}/checkout`, { method: 'POST', body, auth: true });
}

/* ─── Payment history ───────────────────────────────────────── */
//
// Every checkout records a Payment row scoped to the current user (court
// bookings and the court a game host pays for). The list is self-scoped server
// side — `GET /api/v1/payments` only ever returns the caller's own payments —
// so it powers the player's spend report. Gated in the UI by player.payments.view.

export interface ApiPayment {
  id: string;
  bookingId?: string | null;
  amount: number;
  currency?: string | null;
  method?: string | null;
  provider?: string | null;
  status?: string | null;          // 'pending' | 'completed' | 'failed' | 'refunded'
  notes?: string | null;
  createdAt?: string | null;
}

/** Owner/admin reconciliation primitive. Owners are server-scoped to bookings
 * at their own venues; only admins can activate partner-subscription payments. */
export async function verifyPayment(
  id: string,
  status: 'completed' | 'failed' | 'refunded' = 'completed',
  notes?: string,
): Promise<ApiPayment> {
  return request<ApiPayment>(`${PAYMENTS_PREFIX}/${encodeURIComponent(id)}/verify`, {
    method: 'POST', body: { status, notes }, auth: true,
  });
}

/** The current user's payments, newest first (optionally filtered by status). */
export async function listPayments(params: { status?: string } = {}): Promise<ApiPayment[]> {
  const env = await rawRequest<ApiPayment[]>(`${PAYMENTS_PREFIX}${toQuery({ ...params })}`, { auth: true });
  return env.data ?? [];
}

/* ─── Demand data capture (searches, views, booking lifecycle) ── */

export interface DemandEventPayload {
  type: 'search' | 'venue_view' | 'booking_attempt' | 'booking_completed' | 'booking_cancelled' | 'empty_slot' | 'checkout_started' | 'checkout_abandoned' | 'booking_link_shared';
  venueId?: string;
  courtId?: string;
  date?: string;        // YYYY-MM-DD
  startHour?: string | number;  // "HH:00" or hour number
  query?: string;
  meta?: Record<string, unknown>;
}

/** Fire-and-forget demand signal (best-effort; always 202). OptionalAuth — guests
 *  browsing the directory are captured too. */
export async function recordDemandEvent(payload: DemandEventPayload): Promise<void> {
  try {
    // The API expects startHour as a raw hour number (0–23), but callers pass
    // time strings like "14:00". Normalize here so every call site benefits.
    if (typeof payload.startHour === 'string') {
      const h = parseInt(payload.startHour, 10);
      if (!Number.isNaN(h)) payload.startHour = h;
    }
    await rawRequest('/api/v1/demand/events', {
      method: 'POST',
      body: payload as unknown as Record<string, unknown>,
      // Send the token when present so the server can attach the actor; guests
      // are also captured (the endpoint is optionalAuth).
      auth: true,
    });
  } catch {
    // Fire-and-forget — never surface errors to the user.
  }
}

/** Booking-funnel leakage report for a venue (owner/manager). */
export interface VenueLeakageReport {
  days: number;
  funnel: {
    views: number;
    uniqueViewers: number;
    bookingStarts: number;
    checkoutStarts: number;
    checkoutAbandoned: number;
    onlineBookings: number;
    manualBookings: number;
    linksShared: number;
  };
  leakageRate: number | null;
  checkoutDropoff: number | null;
  daily: { date: string; views: number; starts: number; checkouts: number; online: number }[];
}

/** Owner/manager leakage report for a venue over the last N days. */
export async function getVenueLeakageReport(venueId: string, days?: number): Promise<VenueLeakageReport> {
  return request<VenueLeakageReport>(
    `/api/v1/demand/venues/${encodeURIComponent(venueId)}/leakage${toQuery(days != null ? { days: String(days) } : {})}`,
    { auth: true },
  );
}

/* ─── Demand report (owner-facing demand signals summary) ─────── */

export interface VenueDemandReport {
  days: number;
  totals: Record<string, number>;
  conversionPct: number | null;
  cancelRate: number;
  liveBookings: number;
  demandByHour: number[];
  supply: { openCourtHours: number; bookedCourtHours: number; emptyCourtHours: number; occupancyPct: number };
}

/** Aggregate demand signals for a venue over the last N days (owner/manager). */
export async function getVenueDemand(venueId: string, days?: number): Promise<VenueDemandReport> {
  return request<VenueDemandReport>(
    `/api/v1/demand/venues/${encodeURIComponent(venueId)}${toQuery(days != null ? { days: String(days) } : {})}`,
    { auth: true },
  );
}

/* ─── Suggested dynamic pricing ────────────────────────────────── */

export interface PricingSuggestion {
  dow: number;              // 0=Sun … 6=Sat
  hour: number;             // 0–23
  bookings: number;
  emptySlotEvents: number;
  waitlistCount: number;
  occupancyPct: number;
  currentPrice: number;
  suggestedPrice: number;
  adjustmentPct: number;    // e.g. +20 or -15
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
}

export interface SuggestedPricingReport {
  venueId: string;
  days: number;
  baseRate: number;
  courtCount: number;
  suggestions: PricingSuggestion[];
  summary: { total: number; highDemand: number; lowDemand: number };
}

/** Get suggested price adjustments based on demand patterns (owner/manager). */
export async function getSuggestedPricing(venueId: string, days?: number): Promise<SuggestedPricingReport> {
  return request<SuggestedPricingReport>(
    `/api/v1/demand/venues/${encodeURIComponent(venueId)}/suggested-pricing${toQuery(days != null ? { days: String(days) } : {})}`,
    { auth: true },
  );
}

/** Apply selected pricing suggestions as SlotPriceOverrides for N weeks. */
export async function applySuggestedPricingOverrides(
  venueId: string,
  suggestions: { dow: number; hour: number; price: number }[],
  weeks?: number,
): Promise<{ created: number; weeks: number }> {
  return request(
    `/api/v1/demand/venues/${encodeURIComponent(venueId)}/suggested-pricing/apply`,
    { method: 'POST', body: { suggestions, weeks: weeks ?? 4 }, auth: true },
  );
}

/* ─── App settings (payment mode) ───────────────────────────── */

export interface AppSettings {
  paymentTestMode: boolean;
  /** Platform service-fee % charged to the player on top of the venue price (default 7). */
  serviceFeePercent: number;
  /** Platform transaction-fee % charged per transaction (default 0). */
  transactionFeePercent?: number;
  testCard: { number: string; expiry: string; cvc: string };
  /** BCC every transactional email to this address (admin toggle). */
  emailBccEnabled?: boolean;
  emailBccAddress?: string;
  /** Pricing mode: 'start' = rate based on booking start time (default); 'blend' = per-hour resolution. */
  pricingMode?: 'start' | 'blend';
  /** Admin kill switches for player capabilities, both default true. Use them to
   *  hide the matching controls — the server gates independently, so a stale or
   *  missing value here can't let anything through. */
  allowNonOrganizerEvents?: boolean;
  allowPlayerApprovalLobbies?: boolean;
  /** Price + term of the paid coach/organizer subscriptions. */
  partnerSubscription?: {
    coach: number;
    organizer: number;
    durationDays: number;
    currency: string;
    coachTiers: PartnerPlanTier[];
    organizerTiers: PartnerPlanTier[];
  };
}

/** Public app settings — used by checkout to decide test vs live card UI. */
export async function getSettings(): Promise<AppSettings> {
  return request<AppSettings>('/api/v1/settings');
}

/** Admin-only: update app settings. */
export async function updateSettings(patch: Partial<Pick<AppSettings, 'paymentTestMode' | 'serviceFeePercent' | 'emailBccEnabled' | 'emailBccAddress' | 'pricingMode' | 'allowNonOrganizerEvents' | 'allowPlayerApprovalLobbies'>> & { coachPlanTiers?: PartnerPlanTier[]; organizerPlanTiers?: PartnerPlanTier[] }): Promise<AppSettings> {
  return request<AppSettings>('/api/v1/settings', { method: 'PATCH', body: patch, auth: true });
}

/** Template keys for the test-email tool. */
export const TEST_EMAIL_TEMPLATES = [
  'welcome',
  'password-reset',
  'password-changed',
  'email-verification',
  'booking-confirmed',
  'booking-requested',
  'booking-approved',
  'payment-receipt',
  'cancellation',
  'membership',
] as const;

export type TestEmailTemplate = (typeof TEST_EMAIL_TEMPLATES)[number];

export interface TestEmailResult {
  status: 'ok' | 'partial' | 'error';
  sent: { template: string; messageId: string }[];
  errors: { template: string; error: string }[];
}

/** Admin-only: send sample emails for the selected templates to a test address. */
export async function sendTestEmails(email: string, templates: TestEmailTemplate[]): Promise<TestEmailResult> {
  return request<TestEmailResult>('/api/v1/settings/test-email', { method: 'POST', body: { email, templates }, auth: true });
}

/* ─── Organizer: tournaments, brackets, open play, rosters, venue requests ──
 *
 * The organizer console (app `features/organizer/`) talks to the same endpoints
 * the website uses — no new routes. Writes are gated server-side by
 * `organizer.tournaments.manage` / `organizer.brackets.manage` /
 * `organizer.events.manage`; the app additionally gates the screens via
 * SCREEN_PERMISSIONS + `organizer.access`. All calls pass `auth: true`. */

const TOURNAMENTS_PREFIX = '/api/v1/tournaments';
const OPEN_PLAY_PREFIX = '/api/v1/open-play';
const ROSTERS_PREFIX = '/api/v1/rosters';
const TOURNAMENT_APPLICATIONS_PREFIX = '/api/v1/tournament-applications';

const tBase = (idOrSlug: string) => `${TOURNAMENTS_PREFIX}/${encodeURIComponent(idOrSlug)}`;

/* ---- Tournaments ---- */

export type TournamentStatus =
  | 'draft' | 'pending_venue_approval' | 'approved' | 'registration_open'
  | 'ongoing' | 'completed' | 'cancelled' | 'rejected'
  // Legacy/seed statuses the API still treats as public: `open` = joinable,
  // `closed` = registration ended.
  | 'open' | 'closed';

export interface ApiTournament {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  status: TournamentStatus;
  visibility?: string;
  tournamentType?: string;
  skillLevel?: string;
  ageDivision?: string;
  genderDivision?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  registrationOpenDate?: string;
  registrationCloseDate?: string;
  checkInTime?: string;
  matchStartTime?: string;
  courtsRequired?: number | string;
  maxPlayers?: number | string;
  price?: number | string;
  allowWaitlist?: boolean;
  format?: string;
  matchFormat?: string;
  pointsPerGame?: number | string;
  prizeChampion?: string;
  prizeRunnerUp?: string;
  prizeThird?: string;
  organizerName?: string;
  organizerPhone?: string;
  contactEmail?: string;
  rules?: string;
  refundPolicy?: string;
  bannerUrl?: string;
  venueId?: string | null;
  venueName?: string;
  venueSlug?: string;
  registeredCount?: number;
  registeredPlayers?: number;
  createdAt?: string;
}

function normalizeTournament(t: Record<string, unknown> | null): ApiTournament | null {
  if (!t) return null;
  const venueIdRaw = t.venueId as { _id?: string } | string | null | undefined;
  return {
    ...(t as object),
    id: String(t.id ?? t._id ?? ''),
    name: (t.name as string) ?? '',
    status: (t.status as TournamentStatus) ?? 'draft',
    bannerUrl: apiImageUrl((t.bannerUrl as string) || (t.imageUrl as string)),
    venueId: (typeof venueIdRaw === 'object' ? venueIdRaw?._id : venueIdRaw) ?? null,
  } as ApiTournament;
}

/** The current organizer's tournaments, newest first. */
export async function listMyTournaments(): Promise<ApiTournament[]> {
  const env = await rawRequest<Record<string, unknown>[]>(`${TOURNAMENTS_PREFIX}/mine`, { auth: true });
  return (env.data ?? []).map(normalizeTournament).filter(Boolean) as ApiTournament[];
}

/** A single tournament by _id or slug. */
export async function getTournament(idOrSlug: string): Promise<ApiTournament> {
  return normalizeTournament(await request<Record<string, unknown>>(tBase(idOrSlug), { auth: true })) as ApiTournament;
}

export async function createTournament(body: Record<string, unknown>): Promise<ApiTournament> {
  return normalizeTournament(await request<Record<string, unknown>>(TOURNAMENTS_PREFIX, { method: 'POST', body, auth: true })) as ApiTournament;
}

export async function updateTournament(id: string, body: Record<string, unknown>): Promise<ApiTournament> {
  return normalizeTournament(await request<Record<string, unknown>>(tBase(id), { method: 'PATCH', body, auth: true })) as ApiTournament;
}

export async function cancelTournament(id: string): Promise<unknown> {
  return request(`${tBase(id)}/cancel`, { method: 'PATCH', body: {}, auth: true });
}

/** Open registration on an approved tournament (approved → registration_open). */
export async function openTournamentRegistration(id: string): Promise<unknown> {
  return request(`${tBase(id)}/open-registration`, { method: 'PATCH', body: {}, auth: true });
}

/* ---- Player-facing tournament discovery + registration ----
 * The public browse + join half (organizer endpoints above create/manage them).
 * `GET /tournaments` is public; register/withdraw require `player.tournaments.join`.
 */

/** Publicly-visible tournaments for the player Tournament tab, soonest first. */
export async function listPublicTournaments(params: { status?: TournamentStatus; venueId?: string } = {}): Promise<ApiTournament[]> {
  const qs = new URLSearchParams({ pageSize: '100' });
  if (params.status) qs.set('status', params.status);
  if (params.venueId) qs.set('venueId', params.venueId);
  const env = await rawRequest<Record<string, unknown>[]>(`${TOURNAMENTS_PREFIX}?${qs.toString()}`);
  return (env.data ?? []).map(normalizeTournament).filter(Boolean) as ApiTournament[];
}

/** The player's own registration on a tournament (or null) — drives the Join button. */
export async function getMyTournamentRegistration(id: string): Promise<{ id: string; status: string } | null> {
  return request<{ id: string; status: string } | null>(`${tBase(id)}/my-registration`, { auth: true });
}

/** Every tournament the current user has registered for — one call, used by the
 *  player Tournament tab to fill the "Joined" tab and exclude joined/own events
 *  from "Open" (replaces probing my-registration tournament-by-tournament). */
export async function listMyTournamentRegistrations(): Promise<{ tournamentId: string; status: string }[]> {
  const env = await rawRequest<{ tournamentId: string; status: string }[]>(`${TOURNAMENTS_PREFIX}/registrations/mine`, { auth: true });
  return (env.data ?? []) as { tournamentId: string; status: string }[];
}

/** Register the current player for a tournament (registration must be open). */
export async function registerForTournament(id: string): Promise<{ id: string; status: string }> {
  return request<{ id: string; status: string }>(`${tBase(id)}/register`, { method: 'POST', body: {}, auth: true });
}

/** Withdraw the current player's registration. */
export async function withdrawFromTournament(id: string): Promise<unknown> {
  return request(`${tBase(id)}/withdraw`, { method: 'POST', body: {}, auth: true });
}

/* ---- Tournament participant group chat ---- */

/** One message in a tournament's participant chat (organizer + registrants).
 *  Mirrors ApiGameMessage — many senders, so it carries name/avatar. */
export interface ApiTournamentMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  body: string;
  createdAt: string;
  mine: boolean;
}

/** Load a tournament's roster chat (organizer + registrants only). Returns the
 *  tournament's name (for the chat header) alongside the messages. */
export async function listTournamentMessages(id: string): Promise<{ title: string | null; messages: ApiTournamentMessage[] }> {
  const env = await rawRequest<{ title?: string | null; messages?: ApiTournamentMessage[] }>(`${tBase(id)}/messages`, { auth: true });
  return { title: env.data?.title ?? null, messages: env.data?.messages ?? [] };
}

/** Post to a tournament's roster chat — realtime-fans-out to the other members. */
export async function sendTournamentMessage(id: string, body: string): Promise<ApiTournamentMessage> {
  return request<ApiTournamentMessage>(`${tBase(id)}/messages`, { method: 'POST', body: { body }, auth: true });
}

/* ---- Registrations (participants) ---- */

export interface ApiRegistrationPlayer {
  userId?: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface ApiTournamentRegistration {
  id: string;
  status: string;               // 'pending' | 'registered' | 'waitlisted' | 'declined' | ...
  attended: boolean;
  paid?: boolean;
  paymentNote?: string;
  createdAt?: string;
  player: ApiRegistrationPlayer | null;
}

function normalizeRegistration(r: Record<string, unknown>): ApiTournamentRegistration {
  const p = r.player as Record<string, unknown> | null;
  return {
    id: String(r.id ?? r._id ?? ''),
    status: (r.status as string) ?? 'pending',
    attended: !!r.attended,
    paid: !!r.paid,
    paymentNote: (r.paymentNote as string) ?? '',
    createdAt: r.createdAt as string,
    player: p
      ? { userId: p.userId as string, name: (p.name as string) ?? '', email: (p.email as string) ?? '', avatar: apiImageUrl(p.avatar as string) }
      : null,
  };
}

export async function getTournamentRegistrations(id: string): Promise<ApiTournamentRegistration[]> {
  const env = await rawRequest<Record<string, unknown>[]>(`${tBase(id)}/registrations`, { auth: true });
  return (env.data ?? []).map(normalizeRegistration);
}

/** Manage one registration: `{action:'approve'|'decline'}` | `{attended}` | `{paid, paymentNote}`. */
export type ManageRegistrationBody =
  | { action: 'approve' | 'decline' }
  | { attended: boolean }
  | { paid: boolean; paymentNote?: string };

export async function manageTournamentRegistration(id: string, regId: string, body: ManageRegistrationBody): Promise<unknown> {
  return request(`${tBase(id)}/registrations/${encodeURIComponent(regId)}`, { method: 'PATCH', body, auth: true });
}

/* ---- Announcements (organizer → registrants) ---- */

export interface ApiAnnouncement {
  id: string;
  kind: 'general' | 'schedule' | 'venue';
  title: string;
  body: string;
  recipientCount: number;
  createdAt?: string;
}

export async function sendTournamentAnnouncement(
  id: string,
  body: { title: string; body: string; kind: 'general' | 'schedule' | 'venue' },
): Promise<{ recipientCount?: number }> {
  return request<{ recipientCount?: number }>(`${tBase(id)}/announcements`, { method: 'POST', body, auth: true });
}

export async function getTournamentAnnouncements(id: string): Promise<ApiAnnouncement[]> {
  const env = await rawRequest<ApiAnnouncement[]>(`${tBase(id)}/announcements`, { auth: true });
  return env.data ?? [];
}

/* ---- Recurring open play ---- */

export interface ApiOpenPlaySeries {
  id: string;
  title: string;
  venueId?: string | null;
  venueName?: string;
  venueSlug?: string;
  daysOfWeek: number[];
  startTime?: string;
  endTime?: string;
  levelLabel?: string;
  price?: number;
  capacity?: number;
  weeksAhead?: number;
  description?: string;
  status?: string;
  createdAt?: string;
}

export interface ApiOpenPlaySession {
  id: string;
  seriesId: string | null;
  title: string;
  venueId?: string | null;
  venueName?: string;
  venueSlug?: string;
  /** Venue location + pricing, mirroring ApiGame.venue so the Play feed can rank
   *  and render sessions and games alike. Null when the session came from a
   *  surface that populates a narrower venue select (e.g. the organizer console). */
  venueArea?: string | null;
  venueCity?: string | null;
  venueLat?: number | null;
  venueLng?: number | null;
  venueImage?: string | null;
  priceFrom?: number | null;
  priceFromLabel?: string | null;
  date?: string;
  startTime?: string;
  endTime?: string;
  capacity?: number;
  /** Interest count (interest-based Open Play — everyone who tapped "I'm Interested"). */
  joinedCount?: number;
  price?: number;
  levelLabel?: string;
  /** Numeric skill band, the session-side counterpart of ApiGame.skillMin/Max. */
  skillLevelMin?: number | null;
  skillLevelMax?: number | null;
  status?: string;
  organizerName?: string;
  description?: string;
  createdAt?: string | null;
  /** Present on the detail (getOpenPlaySession): who tapped "I'm Interested" + the count. */
  interestedUsers?: ApiGamePerson[];
  interestedCount?: number;
  myRegistrationStatus?: string | null;
  /** Detail only: the viewer runs this session (organizers never "join" their own). */
  viewerIsOrganizer?: boolean;
}

export interface ApiOpenPlayMine {
  series: ApiOpenPlaySeries[];
  sessions: ApiOpenPlaySession[];
}

function normalizeOpenPlaySession(s: Record<string, unknown>): ApiOpenPlaySession {
  const venueIdRaw = s.venueId as { _id?: string } | string | null | undefined;
  return {
    ...(s as object),
    id: String(s.id ?? s._id ?? ''),
    seriesId: s.seriesId ? String(s.seriesId) : null,
    venueId: (typeof venueIdRaw === 'object' ? venueIdRaw?._id : venueIdRaw) ?? null,
  } as ApiOpenPlaySession;
}

/** Public Open Play sessions, soonest first. */
export async function listOpenPlaySessions(params: { venueId?: string; date?: string; pageSize?: number } = {}): Promise<ApiOpenPlaySession[]> {
  // Server truncates by `date`, so a caller that ranks on another key should ask
  // for the whole upcoming window rather than a page of it.
  const env = await rawRequest<Record<string, unknown>[]>(`${OPEN_PLAY_PREFIX}${toQuery({ pageSize: 100, ...params })}`, { auth: true });
  return (env.data ?? []).map(normalizeOpenPlaySession);
}

const PLAY_PREFIX = '/api/v1/play';

/* ── The Play tab's Discover feed ──────────────────────────────────────────────
 * Ranking lives on the SERVER (api/src/features/play/). It used to run here, which
 * meant two players could see the same sessions in a different order, and retuning
 * the weights meant shipping an app release. These are the wire types it returns;
 * `features/games/playRanking.ts` re-exports them for the cards and filters. */

export type PlayKind = 'game' | 'session';

/** How full a listing is. Sessions and lobby games have a hard `capacity`;
 *  interest-based open games have none — only a count against an optional target. */
export type PlayFill =
  | { mode: 'capacity'; joined: number; cap: number }
  | { mode: 'interest'; count: number; target: number | null };

/** A game or session, normalised onto one shape so the feed can rank and render
 *  both alike. */
export interface PlayItem {
  kind: PlayKind;
  id: string;
  title: string;
  date: string | null;
  startTime: string | null;
  venueName: string;
  venueLoc: string;
  coords: [number, number] | null;
  /** [min, max]; max is Infinity for an open-ended band like '4.0+' (the server
   *  sends null there, since JSON has no Infinity — `getPlayDiscover` restores it). */
  skillBand: [number, number] | null;
  skillLabel: string | null;
  fill: PlayFill;
  host: string | null;
  priceLabel: string | null;
  /** What it costs the VIEWER to join. 0 = free, >0 = a real fee, null = this kind of
   *  listing has no join fee at all (a player-hosted game: the host paid the court and
   *  the app cannot charge a joiner). `priceLabel` can't answer this — on a game it is
   *  the venue's hourly rate, so a Free/Paid filter built on it would be wrong. */
  joinFee: number | null;
  visibility: 'public' | 'invite';
  isRecurring: boolean;
  image: string | null;
  createdAt: string | null;
  source: ApiGame | ApiOpenPlaySession;
}

export interface ScoredPlayItem extends PlayItem {
  score: number;
  distanceKm: number | null;
  /** Short, human reasons this ranked where it did — rendered as a card chip. */
  why: string[];
}

/** What the ranking actually saw, and which signals were live for this viewer. */
export interface PlayDiscoverMeta {
  section: 'open-play' | 'events';
  candidates: number;
  truncated: boolean;
  signals: { timeFit: boolean; fillPressure: boolean; proximity: boolean; skillFit: boolean; social: boolean };
}

export interface PlayDiscoverResult {
  items: ScoredPlayItem[];
  meta: PlayDiscoverMeta;
}

/** The ranked Discover feed. The viewer's coordinates are passed in (only the
 *  browser has them); skill and friends are read from the token server-side. */
export async function getPlayDiscover(
  params: { section?: 'open-play' | 'events'; lat?: number; lng?: number; pageSize?: number } = {},
): Promise<PlayDiscoverResult> {
  const env = await rawRequest<Record<string, unknown>[]>(`${PLAY_PREFIX}/discover${toQuery({ ...params })}`, { auth: true });
  const items = (env.data ?? []).map((raw) => {
    const i = raw as unknown as ScoredPlayItem & { skillBand: [number, number | null] | null };
    return {
      ...i,
      // Restore the open-ended upper bound JSON could not carry. Without this the
      // skill filter reads `null` as an upper bound and drops every '4.0+' listing.
      skillBand: i.skillBand ? [i.skillBand[0], i.skillBand[1] ?? Infinity] : null,
      source: i.kind === 'session'
        ? normalizeOpenPlaySession(i.source as unknown as Record<string, unknown>)
        : (i.source as ApiGame),
    } as ScoredPlayItem;
  });
  return { items, meta: (env as unknown as { meta: PlayDiscoverMeta }).meta };
}

export async function getOpenPlaySession(id: string): Promise<ApiOpenPlaySession> {
  return normalizeOpenPlaySession(await request<Record<string, unknown>>(`${OPEN_PLAY_PREFIX}/${encodeURIComponent(id)}`, { auth: true }));
}

export async function listMyOpenPlayRegistrations(): Promise<{ sessionId: string; status: string }[]> {
  const env = await rawRequest<{ sessionId: string; status: string }[]>(`${OPEN_PLAY_PREFIX}/registrations/mine`, { auth: true });
  return env.data ?? [];
}

export async function joinOpenPlaySession(id: string): Promise<{ id: string; status: string }> {
  return request<{ id: string; status: string }>(`${OPEN_PLAY_PREFIX}/${encodeURIComponent(id)}/join`, { method: 'POST', body: {}, auth: true });
}

export async function leaveOpenPlaySession(id: string): Promise<unknown> {
  return request(`${OPEN_PLAY_PREFIX}/${encodeURIComponent(id)}/leave`, { method: 'POST', body: {}, auth: true });
}

/** Load an open-play session's group chat (roster only: organizer + joined
 *  players). Returns the session title for the chat header. Message shape is
 *  identical to the game chat, so both feed the shared ChatThread. */
export async function listOpenPlayMessages(id: string): Promise<{ title: string | null; messages: ApiGameMessage[] }> {
  const env = await rawRequest<{ title?: string | null; messages?: ApiGameMessage[] }>(`${OPEN_PLAY_PREFIX}/${encodeURIComponent(id)}/messages`, { auth: true });
  return { title: env.data?.title ?? null, messages: env.data?.messages ?? [] };
}

/** Post to an open-play session's group chat — realtime-fans-out to the roster. */
export async function sendOpenPlayMessage(id: string, body: string): Promise<ApiGameMessage> {
  return request<ApiGameMessage>(`${OPEN_PLAY_PREFIX}/${encodeURIComponent(id)}/messages`, { method: 'POST', body: { body }, auth: true });
}

/** The organizer's open-play series + every generated session instance. */
export async function getMyOpenPlay(): Promise<ApiOpenPlayMine> {
  const d = await request<{ series?: ApiOpenPlaySeries[]; sessions?: Record<string, unknown>[] }>(`${OPEN_PLAY_PREFIX}/mine`, { auth: true });
  return {
    series: (d?.series ?? []).map((s) => { const r = s as unknown as Record<string, unknown>; return { ...s, id: String(r.id ?? r._id ?? '') }; }),
    sessions: (d?.sessions ?? []).map((s) => normalizeOpenPlaySession(s as Record<string, unknown>)),
  };
}

/** Create a recurring series; the API stamps out the session instances. */
export async function createOpenPlaySeries(body: Record<string, unknown>): Promise<unknown> {
  return request(OPEN_PLAY_PREFIX, { method: 'POST', body, auth: true });
}

export async function cancelOpenPlaySeries(id: string): Promise<unknown> {
  return request(`${OPEN_PLAY_PREFIX}/series/${encodeURIComponent(id)}/cancel`, { method: 'PATCH', body: {}, auth: true });
}

export async function cancelOpenPlaySession(id: string): Promise<unknown> {
  return request(`${OPEN_PLAY_PREFIX}/${encodeURIComponent(id)}/cancel`, { method: 'PATCH', body: {}, auth: true });
}

export async function getOpenPlayRegistrations(id: string): Promise<ApiTournamentRegistration[]> {
  const env = await rawRequest<Record<string, unknown>[]>(`${OPEN_PLAY_PREFIX}/${encodeURIComponent(id)}/registrations`, { auth: true });
  return (env.data ?? []).map(normalizeRegistration);
}

export async function manageOpenPlayRegistration(id: string, regId: string, body: ManageRegistrationBody): Promise<unknown> {
  return request(`${OPEN_PLAY_PREFIX}/${encodeURIComponent(id)}/registrations/${encodeURIComponent(regId)}`, { method: 'PATCH', body, auth: true });
}

/* ---- Reusable player rosters ---- */

export interface ApiRosterMember {
  id: string;
  userId?: string | null;
  name: string;
  email?: string;
}

export interface ApiRoster {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  members: ApiRosterMember[];
  createdAt?: string;
}

function normalizeRoster(r: Record<string, unknown> | null): ApiRoster | null {
  if (!r) return null;
  const members = (r.members as Record<string, unknown>[] | undefined) ?? [];
  return {
    id: String(r.id ?? r._id ?? ''),
    name: (r.name as string) ?? '',
    description: (r.description as string) ?? '',
    memberCount: (r.memberCount as number) ?? members.length,
    members: members.map((m) => ({
      id: String(m.id ?? m._id ?? ''),
      userId: (m.userId as string) ?? null,
      name: (m.name as string) ?? '',
      email: (m.email as string) ?? '',
    })),
    createdAt: r.createdAt as string,
  };
}

export async function listRosters(): Promise<ApiRoster[]> {
  const env = await rawRequest<Record<string, unknown>[]>(ROSTERS_PREFIX, { auth: true });
  return (env.data ?? []).map(normalizeRoster).filter(Boolean) as ApiRoster[];
}

export async function createRoster(body: { name: string; description?: string }): Promise<ApiRoster> {
  return normalizeRoster(await request<Record<string, unknown>>(ROSTERS_PREFIX, { method: 'POST', body, auth: true })) as ApiRoster;
}

export async function updateRoster(id: string, body: { name?: string; description?: string }): Promise<ApiRoster> {
  return normalizeRoster(await request<Record<string, unknown>>(`${ROSTERS_PREFIX}/${encodeURIComponent(id)}`, { method: 'PATCH', body, auth: true })) as ApiRoster;
}

export async function deleteRoster(id: string): Promise<unknown> {
  return request(`${ROSTERS_PREFIX}/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

export async function addRosterMember(id: string, body: { name: string; email?: string; userId?: string }): Promise<ApiRoster> {
  return normalizeRoster(await request<Record<string, unknown>>(`${ROSTERS_PREFIX}/${encodeURIComponent(id)}/members`, { method: 'POST', body, auth: true })) as ApiRoster;
}

export async function removeRosterMember(id: string, memberId: string): Promise<ApiRoster> {
  return normalizeRoster(await request<Record<string, unknown>>(`${ROSTERS_PREFIX}/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`, { method: 'DELETE', auth: true })) as ApiRoster;
}

/* ---- Venue requests (tournament applications) ---- */

export interface ApiTournamentApplication {
  id: string;
  status: string;               // 'pending' | 'approved' | 'rejected' | 'cancelled'
  requestedStartDate?: string;
  requestedEndDate?: string;
  timeSlotStart?: string;
  timeSlotEnd?: string;
  courtsRequired?: number;
  message?: string;
  remarks?: string;
  createdAt?: string;
  decidedAt?: string | null;
  tournament?: { id: string; name: string; slug?: string; status?: string } | null;
  venue?: { id: string; name: string; slug?: string; location?: string; image?: string; courtCount?: number } | null;
}

function normalizeApplication(a: Record<string, unknown>): ApiTournamentApplication {
  const v = a.venue as Record<string, unknown> | null;
  return {
    ...(a as object),
    id: String(a.id ?? a._id ?? ''),
    status: (a.status as string) ?? 'pending',
    venue: v ? { ...(v as object), id: String(v.id ?? v._id ?? ''), name: (v.name as string) ?? '', image: apiImageUrl(v.image as string) } as ApiTournamentApplication['venue'] : null,
  } as ApiTournamentApplication;
}

export async function getMyVenueRequests(): Promise<ApiTournamentApplication[]> {
  const env = await rawRequest<Record<string, unknown>[]>(`${TOURNAMENT_APPLICATIONS_PREFIX}/mine`, { auth: true });
  return (env.data ?? []).map(normalizeApplication);
}

export async function submitVenueRequest(body: {
  tournamentId: string; venueId: string; requestedStartDate: string; requestedEndDate: string;
  timeSlotStart: string; timeSlotEnd: string; courtsRequired: number; message?: string;
}): Promise<unknown> {
  return request(TOURNAMENT_APPLICATIONS_PREFIX, { method: 'POST', body, auth: true });
}

export async function cancelVenueRequest(id: string): Promise<unknown> {
  return request(`${TOURNAMENT_APPLICATIONS_PREFIX}/${encodeURIComponent(id)}/cancel`, { method: 'PATCH', body: {}, auth: true });
}

/* ---- Bracket: entrants, generation, results, standings ---- */

export interface ApiEntrant {
  id: string;
  displayName: string;
  seed?: number | null;
  players?: { name: string; userId?: string }[];
  withdrawn?: boolean;
}

export interface ApiMatch {
  id: string;
  round: number;
  slot?: number;
  bracket?: string;            // 'winners' | 'losers' | 'main' | pool id
  entrantA?: { id: string; displayName: string } | null;
  entrantB?: { id: string; displayName: string } | null;
  games?: { a: number; b: number }[];
  winner?: 'A' | 'B' | null;
  walkover?: 'A' | 'B' | null;
  status?: string;
}

export interface ApiStanding {
  rank?: number;
  entrantId?: string;
  displayName: string;
  wins?: number;
  losses?: number;
  points?: number;
}

export interface ApiBracketData {
  bracket: Record<string, unknown> | null;
  entrants: ApiEntrant[];
  matches: ApiMatch[];
  standings: ApiStanding[];
}

export type BracketFormat = 'single_elimination' | 'double_elimination' | 'round_robin' | 'pool_play';
export type MatchFormat = 'bo1' | 'bo3' | 'bo5';

export async function getEntrants(tid: string): Promise<ApiEntrant[]> {
  const env = await rawRequest<ApiEntrant[]>(`${tBase(tid)}/entrants`, { auth: true });
  return env.data ?? [];
}

/** Build entrants from approved registrations. mode 'auto' (singles) | 'pairs' (doubles). */
export async function buildEntrants(tid: string, body: { mode: 'auto' | 'pairs'; pairs?: string[][] }): Promise<ApiEntrant[]> {
  const env = await rawRequest<ApiEntrant[]>(`${tBase(tid)}/entrants/build`, { method: 'POST', body, auth: true });
  return env.data ?? [];
}

export async function addEntrant(tid: string, body: { displayName: string; players?: { name: string; userId?: string }[] }): Promise<unknown> {
  return request(`${tBase(tid)}/entrants`, { method: 'POST', body, auth: true });
}

export async function updateEntrant(tid: string, entrantId: string, body: { seed?: number; displayName?: string; withdrawn?: boolean }): Promise<unknown> {
  return request(`${tBase(tid)}/entrants/${encodeURIComponent(entrantId)}`, { method: 'PATCH', body, auth: true });
}

export async function removeEntrant(tid: string, entrantId: string): Promise<unknown> {
  return request(`${tBase(tid)}/entrants/${encodeURIComponent(entrantId)}`, { method: 'DELETE', auth: true });
}

export async function seedEntrants(tid: string, body: { method: 'auto' | 'manual'; seeds?: { entrantId: string; seed: number }[] }): Promise<ApiEntrant[]> {
  const env = await rawRequest<ApiEntrant[]>(`${tBase(tid)}/entrants/seed`, { method: 'POST', body, auth: true });
  return env.data ?? [];
}

/** Full bracket — meta + entrants + matches + standings (or null when none). */
export async function getBracket(tid: string): Promise<ApiBracketData | null> {
  return request<ApiBracketData | null>(`${tBase(tid)}/bracket`, { auth: true });
}

export async function generateBracket(tid: string, body: { format: BracketFormat; matchFormat: MatchFormat; poolCount?: number; advancersPerPool?: number }): Promise<unknown> {
  return request(`${tBase(tid)}/bracket`, { method: 'POST', body, auth: true });
}

export async function deleteBracket(tid: string): Promise<unknown> {
  return request(`${tBase(tid)}/bracket`, { method: 'DELETE', auth: true });
}

export async function swapEntrants(tid: string, body: { a: { matchId: string; slot: 'A' | 'B' }; b: { matchId: string; slot: 'A' | 'B' } }): Promise<unknown> {
  return request(`${tBase(tid)}/bracket/swap`, { method: 'POST', body, auth: true });
}

export async function getStandings(tid: string): Promise<ApiStanding[]> {
  const env = await rawRequest<ApiStanding[]>(`${tBase(tid)}/standings`, { auth: true });
  return env.data ?? [];
}

/** Enter a match result: `{games:[{a,b}]}` or `{walkover:'A'|'B'}`. */
export async function submitMatchResult(tid: string, matchId: string, body: { games: { a: number; b: number }[] } | { walkover: 'A' | 'B' }): Promise<unknown> {
  return request(`${tBase(tid)}/matches/${encodeURIComponent(matchId)}/result`, { method: 'POST', body, auth: true });
}

export async function clearMatchResult(tid: string, matchId: string): Promise<unknown> {
  return request(`${tBase(tid)}/matches/${encodeURIComponent(matchId)}/result`, { method: 'DELETE', auth: true });
}

/* ─── Booking modification ─────────────────────────────────────── */

export interface ModifyBookingPayload {
  date?: string;       // YYYY-MM-DD
  startTime?: string;  // HH:MM
  endTime?: string;    // HH:MM
  courtId?: string | null;
}

export interface ModifyBookingResult {
  id: string;
  changes: Record<string, [string, string]>;
  modificationCount: number;
}

/** Reschedule or change the court of an upcoming booking (max 3 times). */
export async function modifyBooking(id: string, body: ModifyBookingPayload): Promise<ModifyBookingResult> {
  return request<ModifyBookingResult>(`${BOOKINGS_PREFIX}/${encodeURIComponent(id)}/modify`, { method: 'PATCH', body, auth: true });
}

/* ─── Waitlist ─────────────────────────────────────────────────── */

export interface ApiWaitlistEntry {
  id: string;
  venueId?: string | null;
  venueName?: string | null;
  courtId?: string | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  playerCount?: number | null;
  status?: string | null;        // 'waiting' | 'promoted' | 'claimed' | 'expired' | 'cancelled'
  claimExpiresAt?: string | null;
  createdAt?: string | null;
}

export interface JoinWaitlistPayload {
  venueId: string;
  courtId?: string;
  date: string;
  startTime: string;
  endTime: string;
  playerCount?: number;
}

/** Join the waitlist for a fully-booked slot. */
export async function joinWaitlist(body: JoinWaitlistPayload): Promise<ApiWaitlistEntry> {
  return request<ApiWaitlistEntry>('/api/v1/waitlist', { method: 'POST', body, auth: true });
}

/** List the current user's waitlist entries. */
export async function listMyWaitlist(): Promise<ApiWaitlistEntry[]> {
  const env = await rawRequest<ApiWaitlistEntry[]>('/api/v1/waitlist/mine', { auth: true });
  return env.data ?? [];
}

/** Leave a waitlist entry (soft-delete). */
export async function leaveWaitlist(id: string): Promise<void> {
  await rawRequest(`/api/v1/waitlist/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

/** Claim a promoted waitlist slot (creates a confirmed booking). */
export async function claimWaitlistSlot(id: string): Promise<{ bookingId: string; status: string }> {
  return request(`/api/v1/waitlist/${encodeURIComponent(id)}/claim`, { method: 'POST', auth: true });
}

/* ─── Owner: settlements & payout methods ──────────────────────── */

export interface ApiSettlement {
  id: string;
  settlementRef: string;         // SET-{year}-{seq}
  venueId?: string | null;
  venueName?: string | null;
  ownerUserId?: string | null;
  periodStart: string;
  periodEnd: string;
  totalBookings: number;
  grossRevenue: number;
  platformFees: number;
  netPayout: number;
  status: string;                // draft | pending | processing | paid | disputed
  payoutMethod?: string | null;
  payoutRef?: string | null;
  notes?: string | null;
  paidAt?: string | null;
  createdAt?: string | null;
}

export interface ApiOwnerBalance {
  venueId: string;
  venueName?: string | null;
  unsenttledRevenue: number;
  unsenttledFees: number;
  unsenttledNet: number;
  bookingCount: number;
}

export interface ApiPayoutMethod {
  id: string;
  venueId?: string | null;
  method: string;                // bank_transfer | gcash | maya | other
  accountName: string;
  accountNumber: string;
  bankName?: string | null;
  isDefault?: boolean;
}

export interface CreatePayoutMethodPayload {
  venueId: string;
  method: string;
  accountName: string;
  accountNumber: string;
  bankName?: string;
}

/** List settlements for venues the current user owns. */
export async function listOwnerSettlements(params?: { venueId?: string }): Promise<ApiSettlement[]> {
  const env = await rawRequest<ApiSettlement[]>(`/api/v1/payments/owner/settlements${toQuery(params ?? {})}`, { auth: true });
  return env.data ?? [];
}

/** Get the current owner's unsenttled balance. */
export async function getOwnerBalance(): Promise<ApiOwnerBalance[]> {
  const env = await rawRequest<ApiOwnerBalance[]>('/api/v1/payments/owner/settlements/balance', { auth: true });
  return env.data ?? [];
}

/** List payout methods for venues the current user owns. */
export async function listPayoutMethods(): Promise<ApiPayoutMethod[]> {
  const env = await rawRequest<ApiPayoutMethod[]>('/api/v1/payments/owner/payout-methods', { auth: true });
  return env.data ?? [];
}

/** Add a payout method for a venue. */
export async function createPayoutMethod(body: CreatePayoutMethodPayload): Promise<ApiPayoutMethod> {
  return request<ApiPayoutMethod>('/api/v1/payments/owner/payout-methods', { method: 'POST', body, auth: true });
}

/** Remove a payout method. */
export async function deletePayoutMethod(id: string): Promise<void> {
  await rawRequest(`/api/v1/payments/owner/payout-methods/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

/* ─── Official receipts (BIR-compliant) ────────────────────────── */

export interface ApiOfficialReceipt {
  id: string;
  receiptNumber: string;         // OR-{venueCode}-{year}-{seq}
  bookingId?: string | null;
  paymentId?: string | null;
  userId?: string | null;
  venueId?: string | null;
  venueName?: string | null;
  payorName?: string | null;
  payorTIN?: string | null;
  payorAddress?: string | null;
  amount: number;
  vatAmount?: number;
  vatRate?: number;
  netAmount?: number;
  discountAmount?: number;
  discountCategory?: 'senior' | 'pwd' | null;
  discountIdNumber?: string | null;
  vatExempt?: boolean;
  description?: string | null;
  status: string;                // draft | issued | voided
  issuedAt?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  createdAt?: string | null;
}

export interface UpdateReceiptPayload {
  payorName?: string;
  payorTIN?: string;
  payorAddress?: string;
  status?: 'issued' | 'voided';
  voidReason?: string;
}

/** List the current user's official receipts. */
export async function listMyReceipts(): Promise<ApiOfficialReceipt[]> {
  const env = await rawRequest<ApiOfficialReceipt[]>('/api/v1/payments/receipts/mine', { auth: true });
  return env.data ?? [];
}

/** Get a single official receipt. */
export async function getReceipt(id: string): Promise<ApiOfficialReceipt> {
  return request<ApiOfficialReceipt>(`/api/v1/payments/receipts/${encodeURIComponent(id)}`, { auth: true });
}

/** Update a receipt (payor details, issue, or void). */
export async function updateReceipt(id: string, body: UpdateReceiptPayload): Promise<ApiOfficialReceipt> {
  return request<ApiOfficialReceipt>(`/api/v1/payments/receipts/${encodeURIComponent(id)}`, { method: 'PATCH', body, auth: true });
}

/* ─── Partners (owner ↔ coach/organizer applications) ───────────── */

export type PartnerKind = 'coach' | 'organizer';
export type PartnerApplicationStatus = 'pending' | 'approved' | 'rejected' | 'removed';

/** A partner's real, server-computed track record. `null` means the API has no
 *  data for it — render nothing, never a placeholder or a made-up value. */
export interface PartnerStats {
  specialty: string | null;
  certification: string | null;
  rating: number | null;
  reviewCount: number;
  /** Coaches: lessons completed. */
  sessions: number | null;
  /** Organizers: tournaments run. */
  eventCount: number | null;
  /** Completed lessons / paid tournament entries. ₱0 until they earn something. */
  revenue: number;
}

/** One coach/organizer application row in the owner Partners feed. */
export interface ApiPartnerApplication {
  id: string;
  kind: PartnerKind;
  status: PartnerApplicationStatus;
  createdAt: string;
  decidedAt: string | null;
  applicant: { userId: string; name: string; slug: string | null; avatar: string | null };
  venue: { id: string; name: string; slug: string; location: string; image: string | null } | null;
  stats: PartnerStats;
}

/** KPI counts for the Partners screen's summary cards. */
export interface OwnerPartnersKpis {
  activeCoaches: number;
  activeOrganizers: number;
  pendingReview: number;
}

export interface OwnerPartnersFeed {
  partners: ApiPartnerApplication[];
  kpis: OwnerPartnersKpis;
  venues: Array<{ id: string; name: string; slug: string }>;
}

/** Coach + organizer applications across every venue the owner owns, tagged
 *  `kind`, plus KPI counts. Pass `venueId` to filter to one venue. */
export async function getOwnerPartners(venueId?: string): Promise<OwnerPartnersFeed> {
  const qs = venueId ? `?venueId=${encodeURIComponent(venueId)}` : '';
  return request<OwnerPartnersFeed>('/api/v1/partners/owner' + qs, { auth: true });
}

/** Approve a pending coach application at one of the owner's venues. */
export async function approveCoachApplication(id: string): Promise<{ id: string; status: string; decidedAt: string }> {
  return request(`/api/v1/coach-applications/${encodeURIComponent(id)}/approve`, { method: 'PATCH', auth: true });
}

/** Reject a pending coach application. */
export async function rejectCoachApplication(id: string): Promise<{ id: string; status: string; decidedAt: string }> {
  return request(`/api/v1/coach-applications/${encodeURIComponent(id)}/reject`, { method: 'PATCH', auth: true });
}

/** Remove an approved coach from the venue. */
export async function removeCoachApplication(id: string): Promise<{ id: string; status: string; decidedAt: string }> {
  return request(`/api/v1/coach-applications/${encodeURIComponent(id)}/remove`, { method: 'PATCH', auth: true });
}

/** Apply to coach at a venue (player-only gate — requires player.dashboard.access). */
export async function submitCoachApplication(venueId: string, message?: string): Promise<{ id: string; status: string; venueId: string; createdAt: string }> {
  return request('/api/v1/coach-applications', { method: 'POST', body: { venueId, message }, auth: true });
}

/** The current player's coach application for one venue (or null) — drives the Apply button state. */
export async function getMyCoachApplicationForVenue(venueId: string): Promise<{ id: string; status: string; createdAt: string; decidedAt: string | null } | null> {
  const res = await rawRequest<{ id: string; status: string; createdAt: string; decidedAt: string | null } | null>(
    '/api/v1/coach-applications/for-venue/' + encodeURIComponent(venueId), { auth: true },
  );
  return res.data ?? null;
}

/** Withdraw the current player's own pending coach application. */
export async function cancelCoachApplication(id: string): Promise<{ id: string; cancelled: boolean }> {
  return request(`/api/v1/coach-applications/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

/* ─── Organizer applications (player ↔ venue owner) ──────────────── */

/** Apply to organise at a venue (player-only gate — requires player.dashboard.access). */
export async function submitOrganizerApplication(venueId: string, message?: string): Promise<{ id: string; status: string; venueId: string; createdAt: string }> {
  return request('/api/v1/organizer-applications', { method: 'POST', body: { venueId, message }, auth: true });
}

/** The current player's own organiser applications, newest first. */
export async function getMyOrganizerApplications(): Promise<Array<{ id: string; status: string; createdAt: string; decidedAt: string | null; venue: { id: string; name: string; slug: string; location: string; image: string | null } | null }>> {
  return request('/api/v1/organizer-applications/mine', { auth: true });
}

/** The current player's organiser application for one venue (or null). */
export async function getMyOrganizerApplicationForVenue(venueId: string): Promise<{ id: string; status: string; createdAt: string; decidedAt: string | null } | null> {
  const res = await rawRequest<{ id: string; status: string; createdAt: string; decidedAt: string | null } | null>(
    '/api/v1/organizer-applications/for-venue/' + encodeURIComponent(venueId), { auth: true },
  );
  return res.data ?? null;
}

/** Withdraw the current player's own pending organiser application. */
export async function cancelOrganizerApplication(id: string): Promise<{ id: string; cancelled: boolean }> {
  return request(`/api/v1/organizer-applications/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

/** Approve a pending organiser application at one of the owner's venues. */
export async function approveOrganizerApplication(id: string): Promise<{ id: string; status: string; decidedAt: string }> {
  return request(`/api/v1/organizer-applications/${encodeURIComponent(id)}/approve`, { method: 'PATCH', auth: true });
}

/** Reject a pending organiser application. */
export async function rejectOrganizerApplication(id: string): Promise<{ id: string; status: string; decidedAt: string }> {
  return request(`/api/v1/organizer-applications/${encodeURIComponent(id)}/reject`, { method: 'PATCH', auth: true });
}

/** Remove an approved organiser from the venue. */
export async function removeOrganizerApplication(id: string): Promise<{ id: string; status: string; decidedAt: string }> {
  return request(`/api/v1/organizer-applications/${encodeURIComponent(id)}/remove`, { method: 'PATCH', auth: true });
}

// ── Rental Inventory ────────────────────────────────────────────────────────

export interface ApiRentalInventoryItem {
  id: string;
  venueId?: string | null;
  ownerId: string;
  name: string;
  brand?: string;
  sku: string;
  category: 'paddle' | 'ball' | 'gear' | 'apparel' | 'other';
  description?: string;
  imageUrl?: string;
  rentalPricePerHour: number;
  totalStock: number;
  availableStock: number;
  rentedCount: number;
  lowStockThreshold: number;
  condition: 'excellent' | 'good' | 'fair' | 'needs_repair' | 'retired';
  status: 'available' | 'partially_rented' | 'fully_rented' | 'maintenance' | 'retired';
  notes?: string;
  isArchived: boolean;
  salePrice?: number | null;
  isForSale?: boolean;
  ecommerceEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RentalInventoryStats {
  totalStock: number;
  availableStock: number;
  rentedCount: number;
  lowStockCount: number;
}

export interface RentalInventoryFilters {
  category?: string;
  status?: string;
  search?: string;
  archived?: boolean;
  venueId?: string;
}

export async function listRentalInventory(filters?: RentalInventoryFilters): Promise<ApiRentalInventoryItem[]> {
  const sp = new URLSearchParams();
  if (filters?.category) sp.set('category', filters.category);
  if (filters?.status) sp.set('status', filters.status);
  if (filters?.search) sp.set('search', filters.search);
  if (filters?.archived) sp.set('archived', '1');
  if (filters?.venueId) sp.set('venueId', filters.venueId);
  const qs = sp.toString();
  return request<ApiRentalInventoryItem[]>(`/api/v1/rental-inventory${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function getRentalInventoryItem(id: string): Promise<ApiRentalInventoryItem> {
  return request<ApiRentalInventoryItem>(`/api/v1/rental-inventory/${encodeURIComponent(id)}`, { auth: true });
}

export async function createRentalInventoryItem(data: Record<string, unknown>): Promise<ApiRentalInventoryItem> {
  return request<ApiRentalInventoryItem>('/api/v1/rental-inventory', { method: 'POST', body: JSON.stringify(data), auth: true });
}

export async function updateRentalInventoryItem(id: string, data: Record<string, unknown>): Promise<ApiRentalInventoryItem> {
  return request<ApiRentalInventoryItem>(`/api/v1/rental-inventory/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data), auth: true });
}

export async function archiveRentalInventoryItem(id: string): Promise<ApiRentalInventoryItem> {
  return request<ApiRentalInventoryItem>(`/api/v1/rental-inventory/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

export async function getRentalInventoryStats(filters?: { venueId?: string }): Promise<RentalInventoryStats> {
  const sp = new URLSearchParams();
  if (filters?.venueId) sp.set('venueId', filters.venueId);
  const qs = sp.toString();
  return request<RentalInventoryStats>(`/api/v1/rental-inventory/stats${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function exportRentalInventoryCsv(filters?: RentalInventoryFilters): Promise<string> {
  const sp = new URLSearchParams();
  if (filters?.category) sp.set('category', filters.category);
  if (filters?.status) sp.set('status', filters.status);
  if (filters?.search) sp.set('search', filters.search);
  if (filters?.venueId) sp.set('venueId', filters.venueId);
  const qs = sp.toString();
  const url = apiUrl(`/api/v1/rental-inventory/export/csv${qs ? `?${qs}` : ''}`);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: 'Export failed' } }));
    throw err;
  }
  return res.text();
}

/* ─── Partner subscriptions (paid coach / organizer plans) ──────── */

export type PartnerPlan = 'coach' | 'organizer';
export type PartnerSubscriptionStatus = 'pending' | 'active' | 'expired' | 'cancelled';

export interface PartnerSubscription {
  id: string;
  plan: PartnerPlan;
  status: PartnerSubscriptionStatus;
  priceAmount: number;
  currency: string;
  tierKey: string | null;
  durationDays: number | null;
  startedAt: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  /** Cancellation is scheduled: access runs until `expiresAt`, then lapses. */
  cancelAtPeriodEnd: boolean;
  /** When cancellation was REQUESTED — not when access ends. */
  cancelledAt: string | null;
  /** Server-derived: status is active AND the term hasn't lapsed. */
  isActive: boolean;
}

export interface PartnerSubscriptionState {
  subscriptions: PartnerSubscription[];
  /** The live coach subscription, or null. */
  coach: PartnerSubscription | null;
  organizer: PartnerSubscription | null;
  pricing: { coach: number; organizer: number; durationDays: number; currency: string; coachTiers: PartnerPlanTier[]; organizerTiers: PartnerPlanTier[] };
  /** False when the profile is missing address fields required to subscribe. */
  addressComplete: boolean;
  missingAddressFields: string[];
}

/** A selectable term tier configured via AdminSettings. */
export interface PartnerPlanTier {
  key: string;
  label: string;
  durationDays: number;
  price: number;
  enabled: boolean;
}

/** The signed-in user's coach/organizer subscription state + current pricing. */
export async function getMyPartnerSubscriptions(): Promise<PartnerSubscriptionState> {
  return request<PartnerSubscriptionState>('/api/v1/partner-subscriptions/me', { auth: true });
}

/** Buy a term. The `card` is collected at the payment step and gated on the
 *  demo card in test mode (never stored/charged). When the admin has configured
 *  selectable tiers for this plan, pass `tierKey` to choose one — otherwise the
 *  base plan price + `partnerSubscriptionDays` apply.
 *  Throws ApiError `ADDRESS_REQUIRED` (400), `CARD_DECLINED` (402),
 *  `INVALID_TIER` (400), or `ALREADY_SUBSCRIBED` (409). */
export async function subscribeToPartnerPlan(
  plan: PartnerPlan,
  opts?: { autoRenew?: boolean; tierKey?: string; card?: CheckoutCard },
): Promise<PartnerSubscription> {
  return request<PartnerSubscription>('/api/v1/partner-subscriptions', {
    method: 'POST', body: { plan, autoRenew: opts?.autoRenew, tierKey: opts?.tierKey, card: opts?.card }, auth: true,
  });
}

/** Schedule cancellation for the END of the paid term. Access and the coach role
 *  survive until `expiresAt`; nothing is revoked today and nothing is refunded. */
export async function cancelPartnerSubscription(id: string): Promise<PartnerSubscription> {
  return request<PartnerSubscription>(`/api/v1/partner-subscriptions/${id}`, { method: 'DELETE', auth: true });
}

/** Undo a scheduled cancellation while the term is still running. */
export async function resumePartnerSubscription(id: string): Promise<PartnerSubscription> {
  return request<PartnerSubscription>(`/api/v1/partner-subscriptions/${id}/resume`, { method: 'POST', auth: true });
}

/* ─── Coaches (browse + book) ───────────────────────────────────── */

export interface ApiCoach {
  id: string;
  slug?: string | null;
  displayName: string;
  specialty?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  experienceYears?: number | null;
  /** Coach's skill level from their user account. */
  skillLevel?: number | null;
  skillLevelLabel?: string | null;
  /** How many unique players have completed a coaching session. */
  studentCount?: number;
  /** Total completed coaching sessions. */
  completedSessionCount?: number;
  languages?: string[];
  certifications?: string[];
  cityPrimary?: string | null;
  location?: string | null;
  pricePrivatePerHour?: number | null;
  priceGroupPerPlayer?: number | null;
  priceCurrency?: string | null;
  /** Legacy flat rate on imported directory rows; fallback for pricePrivatePerHour. */
  rateFrom?: number | null;
  bookingLeadTimeHours?: number | null;
  isVerified?: boolean | null;
  userId?: string | null;
  /** Rates pinned to specific venues; a venue absent here bills at the global rate. */
  venueRates?: ApiCoachVenueRate[];
}

/** A coach's rate at one venue. Overrides `pricePrivatePerHour` for sessions
 *  booked at that venue; only venues the coach is approved at are accepted. */
export interface ApiCoachVenueRate {
  venueId: string;
  pricePrivatePerHour?: number | null;
  priceGroupPerPlayer?: number | null;
}

export interface ApiCoachService {
  id: string;
  name?: string | null;
  durationMinutes?: number | null;
  price: number;
  description?: string | null;
  maxStudents?: number | null;
  isActive?: boolean;
}

export interface ApiCoachDetail extends ApiCoach {
  services: ApiCoachService[];
  venues: Array<{ id: string; name: string; slug?: string; location?: string }>;
}

/** Browse coaches. `subscribed: true` is what Find Coach passes — it returns
 *  only coaches holding a live subscription, so imported directory rows drop out. */
export async function listCoaches(params?: {
  subscribed?: boolean; search?: string; specialty?: string; venueId?: string; minRating?: number;
}): Promise<ApiCoach[]> {
  const q = new URLSearchParams();
  if (params?.subscribed) q.set('subscribed', 'true');
  if (params?.search) q.set('search', params.search);
  if (params?.specialty) q.set('specialty', params.specialty);
  if (params?.venueId) q.set('venueId', params.venueId);
  if (params?.minRating !== undefined) q.set('minRating', String(params.minRating));
  const qs = q.toString();
  return request<ApiCoach[]>(`/api/v1/coaches${qs ? `?${qs}` : ''}`);
}

/** Coaches attached to a venue — the ones an owner approved to coach there.
 *  Unlike `listCoaches({ venueId })` this also picks up approved applications
 *  whose coach row isn't linked to the venue yet. */
export async function listVenueCoaches(venueId: string): Promise<ApiCoach[]> {
  return request<ApiCoach[]>(`/api/v1/venues/${venueId}/coaches`);
}

/** One coach by slug or id, with their bookable services + venues. */
export async function getCoach(id: string): Promise<ApiCoachDetail> {
  return request<ApiCoachDetail>(`/api/v1/coaches/${id}`);
}

/** The signed-in user's own coach profile (404 when they have none). */
export async function getMyCoach(): Promise<ApiCoachDetail> {
  return request<ApiCoachDetail>('/api/v1/coaches/me', { auth: true });
}

/** Create the signed-in user's coach profile. Requires a live coach
 *  subscription server-side (402 `SUBSCRIPTION_REQUIRED` otherwise). */
export async function createMyCoach(body: {
  displayName?: string; specialty?: string; bio?: string;
  pricePrivatePerHour?: number; priceGroupPerPlayer?: number; experienceYears?: number;
}): Promise<ApiCoachDetail> {
  return request<ApiCoachDetail>('/api/v1/coaches', { method: 'POST', body, auth: true });
}

/** Update the signed-in user's own coach profile. The public `/coaches/:slug`
 *  card reads the same document, so profile edits show up there immediately.
 *  `venueRates` is sent whole — a venue left out is cleared back to the global rate. */
export async function updateMyCoach(body: {
  displayName?: string; coachRoleLabel?: string | null; specialty?: string | null; bio?: string | null;
  experienceYears?: number | null;
  cityPrimary?: string | null;
  languages?: string[];
  certifications?: string[];
  pricePrivatePerHour?: number | null;
  priceGroupPerPlayer?: number | null;
  priceCurrency?: string | null;
  bookingLeadTimeHours?: number | null;
  venueRates?: ApiCoachVenueRate[];
}): Promise<ApiCoachDetail> {
  return request<ApiCoachDetail>('/api/v1/coaches/me', { method: 'PATCH', body, auth: true });
}

/* ─── Coach bookings (a player books a session) ─────────────────── */

export type CoachBookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';

export interface ApiCoachBooking {
  id: string;
  coachId: string;
  coach: { id: string; name: string; slug?: string; avatarUrl?: string | null; specialty?: string | null } | null;
  player: { id: string; name: string; avatarUrl?: string | null } | null;
  serviceId?: string | null;
  venueId?: string | null;
  date: string;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  amount: number;
  currency: string;
  status: CoachBookingStatus;
  notes?: string | null;
  declineReason?: string | null;
  createdAt: string;
}

/** Request a coaching session. The price is derived server-side from the chosen
 *  service (or the coach's hourly rate) — never sent by the client. */
export async function createCoachBooking(body: {
  coachId: string; date: string; startTime: string;
  serviceId?: string; venueId?: string; endTime?: string; durationMinutes?: number; notes?: string;
}): Promise<ApiCoachBooking> {
  return request<ApiCoachBooking>('/api/v1/coach-bookings', { method: 'POST', body, auth: true });
}

/** Sessions the signed-in player requested. */
export async function listMyCoachBookings(): Promise<ApiCoachBooking[]> {
  return request<ApiCoachBooking[]>('/api/v1/coach-bookings/mine', { auth: true });
}

/** The signed-in coach's incoming session requests. */
export async function listCoachInbox(): Promise<ApiCoachBooking[]> {
  return request<ApiCoachBooking[]>('/api/v1/coach-bookings/coach', { auth: true });
}

export async function acceptCoachBooking(id: string): Promise<ApiCoachBooking> {
  return request<ApiCoachBooking>(`/api/v1/coach-bookings/${id}/accept`, { method: 'PATCH', auth: true });
}

export async function declineCoachBooking(id: string, reason?: string): Promise<ApiCoachBooking> {
  return request<ApiCoachBooking>(`/api/v1/coach-bookings/${id}/decline`, { method: 'PATCH', body: { reason }, auth: true });
}

/** Either party calls the session off. */
export async function cancelCoachBooking(id: string): Promise<ApiCoachBooking> {
  return request<ApiCoachBooking>(`/api/v1/coach-bookings/${id}/cancel`, { method: 'PATCH', auth: true });
}

/* ─── Public player profile ─────────────────────────────────────── */

export interface PublicUser {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  isVerified: boolean;
  bio?: string | null;
  skillLevel?: number | null;
  skillLevelLabel?: string | null;
  city?: string | null;
  province?: string | null;
  roles: string[];
  partnerRoles: Array<{ role: string; venueId: string; venueName: string }>;
  /** True only while the coach subscription is LIVE — drives the "Coach" badge. */
  isCoach: boolean;
  isOrganizer: boolean;
  coach: {
    id: string; slug?: string; specialty?: string | null;
    rating: number; reviewCount: number;
    pricePrivatePerHour?: number | null; priceCurrency: string;
  } | null;
  privacySetting: string;
  memberSince: string;
}

/** Another player's public profile card. Open to guests. */
export async function getPublicUser(id: string): Promise<PublicUser> {
  return request<PublicUser>(`/api/v1/users/${id}`);
}
