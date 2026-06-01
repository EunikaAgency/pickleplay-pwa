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
