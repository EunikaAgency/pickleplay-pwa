// Auth API client — connects the PWA to the Hono/MongoDB API.
//
// In dev, request paths are relative ('/api/v1/...') and Vite proxies them to
// the API on localhost:9002 (see vite.config.ts). In production the PWA and API
// live on different subdomains, so set VITE_API_BASE_URL to the API origin
// (e.g. https://pickleballer-api.eunika.xyz) — CORS already allows the PWA host.

import { normalizeRole, resolveRolePermissions, type AppUser } from './permissions';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
const AUTH_PREFIX = '/api/v1/auth';

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
async function rawRequest<T>(path: string, { method = 'GET', body, auth = false, _retried = false }: RequestOptions = {}): Promise<Envelope<T>> {
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
    });
  } catch {
    throw new ApiError('Network error — could not reach the server.', 'NETWORK', 0);
  }

  // Access token expired (15m TTL): transparently refresh using the stored
  // refresh token (valid 7d) and retry the original request once. This is what
  // keeps a session alive across reloads instead of dropping to logged-out.
  if (res.status === 401 && auth && !_retried) {
    const refreshed = await refreshSession();
    if (refreshed) return rawRequest<T>(path, { method, body, auth, _retried: true });
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
export function toAppUser(api: ApiUser): AppUser {
  const sourceRoles = api.roles?.length ? api.roles : [api.roleDefault ?? api.role ?? 'player'];
  const roles = [...new Set(sourceRoles.map(normalizeRole))];
  return {
    id: String(api.id),
    displayName: api.displayName || api.email,
    firstName: api.firstName ?? undefined,
    avatarUrl: api.avatarUrl ?? undefined,
    skillLevel: typeof api.skillLevel === 'number' ? api.skillLevel : undefined,
    skillLevelLabel: api.skillLevelLabel ?? undefined,
    bio: api.bio ?? undefined,
    hasOnboarded: api.hasOnboarded ?? false,
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
export async function refreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const data = await request<AuthTokens>(`${AUTH_PREFIX}/refresh`, {
      method: 'POST',
      body: { refreshToken },
    });
    if (data?.accessToken && data?.refreshToken) {
      setTokens(data.accessToken, data.refreshToken);
      return true;
    }
    return false;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) clearTokens();
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
}

export interface ApiCourt {
  id: string;
  courtNumber: string;
  courtName?: string | null;
  surfaceType?: string | null;
  indoor?: boolean | null;
}

/** A single venue with the extra detail the get-by-id endpoint adds. */
export interface ApiVenueDetail extends ApiVenue {
  oneLineSummary?: string | null;
  description?: string | null;
  hours?: Record<string, string>;
  gallery?: string[];
  image?: string;
  courts?: ApiCourt[];
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

const COURTS_PREFIX = '/api/v1/courts';
const FAQS_PREFIX = '/api/v1/faqs';
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

/** The full editable venue document (more fields than the public detail). */
export async function getOwnerVenue(idOrSlug: string): Promise<OwnerVenueDetail> {
  return request<OwnerVenueDetail>(`${VENUES_PREFIX}/${encodeURIComponent(idOrSlug)}`);
}

/** Patch listing fields. `courtCount` is server-derived — never send it. */
export async function updateVenue(venueId: string, body: Record<string, unknown>): Promise<OwnerVenueDetail> {
  return request<OwnerVenueDetail>(`${VENUES_PREFIX}/${venueId}`, { method: 'PATCH', body, auth: true });
}

/** Create a new owner-owned venue (live immediately, state='claimed'). */
export async function createVenue(body: Record<string, unknown>): Promise<OwnerVenueDetail> {
  return request<OwnerVenueDetail>(VENUES_PREFIX, { method: 'POST', body, auth: true });
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
export async function uploadVenueMedia(venueId: string, file: File): Promise<UploadedMedia | null> {
  const fd = new FormData();
  fd.append('file', file);
  const token = getAccessToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/media/upload${toQuery({ ownerType: 'venue', ownerId: venueId })}`, {
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
  visibility?: string | null;
  status?: GameStatus | string | null;
  /** The host's court reservation, made + paid when the game was created. */
  bookingId?: string | null;
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

/** Delete a game the current user created (host-only). */
export async function deleteGame(id: string): Promise<void> {
  await request<{ id: string; deleted: boolean }>(`${GAMES_PREFIX}/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
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

/** Mark a single notification read. */
export async function markNotificationRead(id: string): Promise<void> {
  await request(`${NOTIFICATIONS_PREFIX}/${encodeURIComponent(id)}`, { method: 'PATCH', body: {}, auth: true });
}

/** Mark every unread notification read. */
export async function markAllNotificationsRead(): Promise<void> {
  await request(`${NOTIFICATIONS_PREFIX}/mark-all-read`, { method: 'PATCH', body: {}, auth: true });
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

export interface ApiClubPost {
  id: string;
  author: ClubPerson | null;
  body: string | null;
  reactionCount: number;
  replyCount: number;
  viewerReacted: boolean;
  isDeleted: boolean;
  createdAt?: string | null;
}

/** Clubs list — `mine` = clubs you're a member of; otherwise the public directory. */
export async function listClubs(params: { mine?: boolean } = {}): Promise<ApiClub[]> {
  const env = await rawRequest<ApiClub[]>(`${CLUBS_PREFIX}${toQuery({ ...params })}`, { auth: true });
  return env.data ?? [];
}

/** A single club (by slug or _id), with viewer membership flags. */
export async function getClub(idOrSlug: string): Promise<ApiClub> {
  return request<ApiClub>(`${CLUBS_PREFIX}/${encodeURIComponent(idOrSlug)}`, { auth: true });
}

export interface CreateClubPayload {
  name: string;
  description?: string;
  visibility?: 'public' | 'private';
}

/** Create a club (you become the host + first member). */
export async function createClub(body: CreateClubPayload): Promise<ApiClub> {
  return request<ApiClub>(CLUBS_PREFIX, { method: 'POST', body, auth: true });
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

/** Post to a club's feed. */
export async function createClubPost(id: string, body: string): Promise<ApiClubPost> {
  return request<ApiClubPost>(`${CLUBS_PREFIX}/${id}/posts`, { method: 'POST', body: { body }, auth: true });
}

/** Like / unlike a post. */
export async function reactClubPost(id: string, postId: string): Promise<unknown> {
  return request(`${CLUBS_PREFIX}/${id}/posts/${postId}/react`, { method: 'POST', body: {}, auth: true });
}
export async function unreactClubPost(id: string, postId: string): Promise<unknown> {
  return request(`${CLUBS_PREFIX}/${id}/posts/${postId}/react`, { method: 'DELETE', auth: true });
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
  status?: string | null;          // 'pending_approval' | 'confirmed' | 'paid' | 'cancelled'
  paymentMethod?: string | null;
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

// Bookings arrive already paid + confirmed, so the owner only ever cancels
// (or, for any legacy pending row, confirms). No 'paid' transition from the app.
export type BookingStatus = 'confirmed' | 'cancelled';

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

/* ─── App settings (payment mode) ───────────────────────────── */

export interface AppSettings {
  paymentTestMode: boolean;
  testCard: { number: string; expiry: string; cvc: string };
}

/** Public app settings — used by checkout to decide test vs live card UI. */
export async function getSettings(): Promise<AppSettings> {
  return request<AppSettings>('/api/v1/settings');
}
