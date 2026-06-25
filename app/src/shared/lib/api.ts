// Auth API client — connects the PWA to the Hono/MongoDB API.
//
// In dev, request paths are relative ('/api/v1/...') and Vite proxies them to
// the API on localhost:9002 (see vite.config.ts). In production the PWA and API
// live on different subdomains, so set VITE_API_BASE_URL to the API origin
// (e.g. https://pickleballer-api.eunika.xyz) — CORS already allows the PWA host.

import { DEFAULT_PREFERENCES, normalizeRole, resolveRolePermissions, type AppUser, type PrivacySetting, type UserPreferences } from './permissions';

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
  skillLevel?: number | null;
  skillLevelLabel?: string | null;
  bio?: string | null;
  /** Whether the user has finished (or skipped) first-run onboarding. */
  hasOnboarded?: boolean | null;
  preferences?: UserPreferences | null;
  privacySetting?: string | null;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Map the API user payload onto the app's `AppUser`. The API ships roles +
 * permissions, but we re-derive permissions from roles via the app's own
 * `resolveRolePermissions` so the client stays the single source of truth for
 * its permission gating (and stays correct even if the two lists drift).
 */
/** Coerce the API's free-string privacy field to a known value (default public). */
function normalizePrivacy(value?: string | null): PrivacySetting {
  return value === 'private' || value === 'friends' ? value : 'public';
}

export function toAppUser(api: ApiUser): AppUser {
  const sourceRoles = api.roles?.length ? api.roles : [api.roleDefault ?? api.role ?? 'player'];
  const roles = [...new Set(sourceRoles.map(normalizeRole))];
  return {
    id: String(api.id),
    displayName: api.displayName || api.email,
    firstName: api.firstName ?? undefined,
    // Stored as a relative '/uploads/<file>' path (served by the API host, not
    // the PWA origin), so resolve it to an absolute URL like venue images do —
    // otherwise a freshly cropped avatar 404s against the app origin.
    avatarUrl: apiImageUrl(api.avatarUrl) || undefined,
    skillLevel: typeof api.skillLevel === 'number' ? api.skillLevel : undefined,
    skillLevelLabel: api.skillLevelLabel ?? undefined,
    bio: api.bio ?? undefined,
    hasOnboarded: api.hasOnboarded ?? false,
    preferences: api.preferences ?? DEFAULT_PREFERENCES,
    privacySetting: normalizePrivacy(api.privacySetting),
    roleDefault: normalizeRole(api.roleDefault ?? api.role),
    roles,
    permissions: resolveRolePermissions(roles),
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

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
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
  googleRating?: number | null;
  googleReviewCount?: number | null;
  amenityChips?: string[] | null;
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
  const env = await rawRequest<ApiVenue[]>(`${VENUES_PREFIX}${toQuery({ pageSize: 20, ...params })}`);
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
  return request<ApiVenueDetail>(`${VENUES_PREFIX}/${encodeURIComponent(idOrSlug)}`);
}

export interface VenueAvailability {
  date: string;
  /** Number of courts the availability covers — the venue pool, or 1 when scoped to a court. */
  capacity: number;
  /** Echoed back when the request was scoped to a single court. */
  courtId?: string;
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
const STAFF_PREFIX = '/api/v1/venues/staff';
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

/** A submitted venue-ownership claim (status starts 'pending' → admin reviews). */
export interface VenueClaim {
  id?: string;
  _id?: string;
  venueId: string;
  status: 'pending' | 'approved' | 'rejected';
  proofDescription: string;
  proofDocumentUrls?: string[];
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

export interface ApiGame {
  id: string;
  title?: string | null;
  gameType?: string | null;        // 'singles' | 'doubles' | 'open'
  skillLabel?: string | null;
  whenLabel?: string | null;
  timeLabel?: string | null;
  durationLabel?: string | null;
  date?: string | null;            // YYYY-MM-DD (best-effort)
  capacity?: number | null;
  spotsLeft?: number | null;
  participantCount?: number | null;
  participants?: ApiGamePerson[];
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
  /** Player ids the host has invited (notified) but who haven't joined yet. */
  invitedUserIds?: string[];
}

/** A player result from people/invite search (`/search?type=players`). */
export interface ApiPlayer {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  skillLevel?: number | null;
  skillLevelLabel?: string | null;
}

export interface ListGamesParams {
  status?: string;
  venueId?: string;
  date?: string;
  /** "My Games" — games the current user created or joined (needs auth). */
  mine?: boolean;
}

export interface CreateGamePayload {
  title?: string;
  venueId?: string;
  venueName?: string;
  gameType: 'singles' | 'doubles' | 'open';
  skillLabel?: string;
  whenLabel?: string;
  timeLabel?: string;
  durationLabel?: string;
  /** Explicit YYYY-MM-DD from the date picker; overrides the derived date. */
  date?: string;
  capacity: number;
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

/** Search players by name, for invites/people search. Excludes the current user. */
export async function searchPlayers(q: string): Promise<ApiPlayer[]> {
  const env = await rawRequest<{ players?: ApiPlayer[] }>(
    `/api/v1/search${toQuery({ q, type: 'players' })}`,
    { auth: true },
  );
  return env.data?.players ?? [];
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
}

export interface ApiConversationSummary {
  id: string;
  otherParticipant: ApiChatParticipant | null;
  lastBody?: string | null;
  lastSenderId?: string | null;
  lastAt?: string | null;
  unread: number;
}

export interface ApiChatMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt?: string;
  mine: boolean;
}

export interface ApiConversation {
  id: string;
  otherParticipant: ApiChatParticipant | null;
  messages: ApiChatMessage[];
}

/** The current user's conversation threads, newest first. */
export async function listConversations(): Promise<ApiConversationSummary[]> {
  const env = await rawRequest<ApiConversationSummary[]>(`${MESSAGES_PREFIX}/conversations`, { auth: true });
  return env.data ?? [];
}

/** Find or create a 1:1 thread with another user. */
export async function startConversation(userId: string): Promise<{ id: string; otherParticipant: ApiChatParticipant | null }> {
  return request<{ id: string; otherParticipant: ApiChatParticipant | null }>(
    `${MESSAGES_PREFIX}/conversations`, { method: 'POST', body: { userId }, auth: true },
  );
}

/** Load a thread (other participant + messages); marks it read. */
export async function getConversation(id: string): Promise<ApiConversation> {
  return request<ApiConversation>(`${MESSAGES_PREFIX}/conversations/${encodeURIComponent(id)}`, { auth: true });
}

/** Send a message in a thread — notifies the recipient. */
export async function sendMessage(id: string, body: string): Promise<ApiChatMessage> {
  return request<ApiChatMessage>(`${MESSAGES_PREFIX}/conversations/${encodeURIComponent(id)}/messages`, { method: 'POST', body: { body }, auth: true });
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
  joinRequestStatus: string | null;
}

export interface ApiClubMember {
  id: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'host' | 'member';
  joinedAt?: string | null;
}

/** A photo/GIF attached to a club post (url is raw — wrap with apiImageUrl to render). */
export interface ClubAttachment {
  type: 'image' | 'gif';
  url: string;
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
  createdAt: string;
  mine: boolean;
}

/** Load a club's member chat (members only). Returns the club name (for the chat
 *  header) alongside the messages. */
export async function listClubMessages(id: string): Promise<{ title: string | null; messages: ApiClubMessage[] }> {
  const env = await rawRequest<{ title?: string | null; messages?: ApiClubMessage[] }>(`${CLUBS_PREFIX}/${id}/messages`, { auth: true });
  return { title: env.data?.title ?? null, messages: env.data?.messages ?? [] };
}

/** Post to a club's member chat — realtime-fans-out to the other members. */
export async function sendClubMessage(id: string, body: string): Promise<ApiClubMessage> {
  return request<ApiClubMessage>(`${CLUBS_PREFIX}/${id}/messages`, { method: 'POST', body: { body }, auth: true });
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
  courtNumber?: string | null;     // populated by the owner bookings endpoint
  courtName?: string | null;       // populated by the owner bookings endpoint
  date?: string | null;            // YYYY-MM-DD
  startTime?: string | null;       // "18:30"
  endTime?: string | null;
  playerCount?: number | null;
  amount?: number | null;
  // 'pending_approval' (awaiting owner) | 'awaiting_payment' (approved; pay by
  // paymentDueAt) | 'confirmed' | 'paid' | 'cancelled'.
  status?: string | null;
  paymentMethod?: string | null;
  /** Deadline to pay once the owner approves a request-to-book (else it expires). */
  paymentDueAt?: string | null;
  /** Masked card captured at request time (so paying after approval is one tap). */
  savedCard?: { brand?: string | null; last4?: string | null } | null;
  cancellationReason?: string | null;
  createdAt?: string | null;
  userName?: string | null;        // populated by the owner bookings endpoint only
  userAvatarUrl?: string | null;   // populated by the owner bookings endpoint only
}

export interface CreateBookingPayload {
  venueId: string;
  courtId?: string;
  date: string;                    // YYYY-MM-DD
  startTime?: string;              // "18:30"
  endTime?: string;
  playerCount?: number;
  amount: number;
  paymentMethod?: string;
  notes?: string;
  /** Masked card stored on an approval-required request, for pay-after-approval. */
  card?: { brand?: string; last4?: string };
}

/** The current user's bookings, newest first (optionally filtered by status). */
export async function listBookings(params: { status?: string } = {}): Promise<ApiBooking[]> {
  const env = await rawRequest<ApiBooking[]>(`${BOOKINGS_PREFIX}${toQuery({ ...params })}`, { auth: true });
  return env.data ?? [];
}

/** Create a booking. Auto-confirmed on creation — no venue-owner approval step. */
export async function createBooking(body: CreateBookingPayload): Promise<ApiBooking> {
  return request<ApiBooking>(BOOKINGS_PREFIX, { method: 'POST', body, auth: true });
}

/** Fetch a single booking. */
export async function getBooking(id: string): Promise<ApiBooking> {
  return request<ApiBooking>(`${BOOKINGS_PREFIX}/${encodeURIComponent(id)}`, { auth: true });
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
}

export interface CheckoutPayload {
  bookingId?: string;
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

/** The current user's payments, newest first (optionally filtered by status). */
export async function listPayments(params: { status?: string } = {}): Promise<ApiPayment[]> {
  const env = await rawRequest<ApiPayment[]>(`${PAYMENTS_PREFIX}${toQuery({ ...params })}`, { auth: true });
  return env.data ?? [];
}

/* ─── App settings (payment mode) ───────────────────────────── */

export interface AppSettings {
  paymentTestMode: boolean;
  testCard: { number: string; expiry: string; cvc: string };
}

/** Public app settings — used by checkout to decide test vs live card UI. */
export async function getSettings(): Promise<AppSettings> {
  return request<AppSettings>('/api/v1/settings');
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
  venueName?: string;
  venueSlug?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  capacity?: number;
  joinedCount?: number;
  price?: number;
  levelLabel?: string;
  status?: string;
}

export interface ApiOpenPlayMine {
  series: ApiOpenPlaySeries[];
  sessions: ApiOpenPlaySession[];
}

/** The organizer's open-play series + every generated session instance. */
export async function getMyOpenPlay(): Promise<ApiOpenPlayMine> {
  const d = await request<{ series?: ApiOpenPlaySeries[]; sessions?: Record<string, unknown>[] }>(`${OPEN_PLAY_PREFIX}/mine`, { auth: true });
  return {
    series: (d?.series ?? []).map((s) => { const r = s as unknown as Record<string, unknown>; return { ...s, id: String(r.id ?? r._id ?? '') }; }),
    sessions: (d?.sessions ?? []).map((s) => ({ ...s, id: String(s.id ?? s._id ?? ''), seriesId: s.seriesId ? String(s.seriesId) : null })) as ApiOpenPlaySession[],
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
