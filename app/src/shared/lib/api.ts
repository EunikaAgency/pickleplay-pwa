// Auth API client — connects the PWA to the Hono/MongoDB API.
//
// In dev, request paths are relative ('/api/v1/...') and Vite proxies them to
// the API on localhost:9002 (see vite.config.ts). In production the PWA and API
// live on different subdomains, so set VITE_API_BASE_URL to the API origin
// (e.g. https://pickleballer-api.eunika.xyz) — CORS already allows the PWA host.

import { normalizeRole, resolveRolePermissions, type AppUser } from './permissions';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
const AUTH_PREFIX = '/api/v1/auth';

const ACCESS_TOKEN_KEY = 'pb-access-token';
const REFRESH_TOKEN_KEY = 'pb-refresh-token';

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
  } catch {
    // ignore
  }
}

/** Whether a stored access token exists — used to attempt session restore. */
export function hasStoredSession(): boolean {
  return getAccessToken() !== null;
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
}

interface Envelope<T> {
  data?: T;
  meta?: { total?: number; cursor?: string | null };
  error?: { code?: string; message?: string };
}

// Core fetch: returns the full response envelope (so list callers can read
// `meta.cursor` for pagination). Throws ApiError on network failure or !ok.
async function rawRequest<T>(path: string, { method = 'GET', body, auth = false }: RequestOptions = {}): Promise<Envelope<T>> {
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
  return toAppUser(data.user);
}

/** Fetch the current user using the stored access token (for session restore). */
export async function fetchCurrentUser(): Promise<AppUser> {
  const user = await request<ApiUser>(`${AUTH_PREFIX}/me`, { auth: true });
  return toAppUser(user);
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
  image?: string | null;
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

/** Fetch a single venue by `_id` or `slug`, with hours/courts/gallery/image. */
export async function getVenue(idOrSlug: string): Promise<ApiVenueDetail> {
  return request<ApiVenueDetail>(`${VENUES_PREFIX}/${encodeURIComponent(idOrSlug)}`);
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
