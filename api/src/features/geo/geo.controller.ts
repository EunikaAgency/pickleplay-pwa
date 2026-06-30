import { z } from 'zod';

// Forward-geocoding proxy.
//
// The owner console needs to turn a typed address/place into coordinates. We
// proxy OpenStreetMap's Nominatim service here (server-side) rather than calling
// it from the browser because:
//   1. Nominatim's usage policy requires a descriptive User-Agent identifying
//      the app — a header browsers refuse to let JS set.
//   2. Its cached GET responses don't reliably carry CORS headers, so a direct
//      browser fetch gets blocked.
// Doing it here also lets us add a small cache and keep within the ≤1 req/sec
// fair-use guidance.

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'PickleBallers/1.0 (+https://pickleballer.eunika.xyz; venue owner console geocoding)';

const geocodeQuery = z.object({
  q: z.string().trim().min(2).max(200),
  // Optional ISO country-code bias (e.g. "ph"); narrows ambiguous results.
  country: z.string().trim().length(2).optional(),
});

// Tiny in-memory cache so repeated lookups of the same string don't re-hit the
// upstream (also softens accidental rapid clicks against the fair-use limit).
const cache = new Map<string, { at: number; value: unknown }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1h

export async function geocode(c: any) {
  const { q, country } = geocodeQuery.parse(c.req.query());
  const key = `${country || ''}|${q.toLowerCase()}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return c.json({ data: hit.value });
  }

  const params = new URLSearchParams({ format: 'jsonv2', limit: '1', addressdetails: '0', q });
  if (country) params.set('countrycodes', country.toLowerCase());

  let upstream: Response;
  try {
    upstream = await fetch(`${NOMINATIM}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return c.json({ error: { code: 'GEOCODE_UNAVAILABLE', message: 'Geocoding service unreachable' } }, 502);
  }
  if (!upstream.ok) {
    return c.json({ error: { code: 'GEOCODE_FAILED', message: `Upstream returned ${upstream.status}` } }, 502);
  }

  const rows = (await upstream.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const first = Array.isArray(rows) ? rows[0] : undefined;
  const value = first
    ? { lat: parseFloat(first.lat), lng: parseFloat(first.lon), label: first.display_name }
    : null;

  cache.set(key, { at: Date.now(), value });
  return c.json({ data: value });
}

// Type-ahead suggestions: a *list* of candidate places for an address being
// typed in the owner console. Same Nominatim proxy as forward geocoding, but
// returns several ranked hits (with address parts) so the UI can show a
// dropdown and, on pick, drop the pin + auto-fill city/area in one tap.
const suggestQuery = z.object({
  q: z.string().trim().min(2).max(200),
  country: z.string().trim().length(2).optional(),
  // How many suggestions to return (UI shows a short list).
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

export async function suggest(c: any) {
  const { q, country, limit } = suggestQuery.parse(c.req.query());
  const n = limit ?? 6;
  const key = `sug|${country || ''}|${n}|${q.toLowerCase()}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return c.json({ data: hit.value });
  }

  const params = new URLSearchParams({ format: 'jsonv2', limit: String(n), addressdetails: '1', q });
  if (country) params.set('countrycodes', country.toLowerCase());

  let upstream: Response;
  try {
    upstream = await fetch(`${NOMINATIM}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return c.json({ error: { code: 'GEOCODE_UNAVAILABLE', message: 'Geocoding service unreachable' } }, 502);
  }
  if (!upstream.ok) {
    return c.json({ error: { code: 'GEOCODE_FAILED', message: `Upstream returned ${upstream.status}` } }, 502);
  }

  const rows = (await upstream.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    address?: Record<string, string>;
  }>;
  const value = (Array.isArray(rows) ? rows : []).map((r) => {
    const a = r.address ?? {};
    return {
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      label: r.display_name,
      city: a.city || a.town || a.municipality || a.village || a.county || null,
      region: a.state || a.region || a.province || null,
      // Sub-city locality (kept for callers that still want it).
      area: a.suburb || a.neighbourhood || a.quarter || a.city_district || null,
      // Structured pieces for an address form: street line + postal code.
      line1: [a.house_number, a.road].filter(Boolean).join(' ') || null,
      postcode: a.postcode || null,
    };
  });

  cache.set(key, { at: Date.now(), value });
  return c.json({ data: value });
}

// Reverse-geocoding proxy: coordinates → place. Used by the venue owner console
// so dropping a map pin can auto-fill the nearest city. Same Nominatim fair-use
// constraints as forward geocoding (server-side UA + cache), see above.
const reverseQuery = z.object({
  lat: z.coerce.number().gte(-90).lte(90),
  lng: z.coerce.number().gte(-180).lte(180),
});

export async function reverseGeocode(c: any) {
  const { lat, lng } = reverseQuery.parse(c.req.query());
  // Round to ~100m so nearby pins share a cache entry.
  const key = `rev|${lat.toFixed(3)},${lng.toFixed(3)}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return c.json({ data: hit.value });
  }

  const params = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', lat: String(lat), lon: String(lng) });

  let upstream: Response;
  try {
    upstream = await fetch(`${NOMINATIM_REVERSE}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return c.json({ error: { code: 'GEOCODE_UNAVAILABLE', message: 'Geocoding service unreachable' } }, 502);
  }
  if (!upstream.ok) {
    return c.json({ error: { code: 'GEOCODE_FAILED', message: `Upstream returned ${upstream.status}` } }, 502);
  }

  const body = (await upstream.json()) as {
    display_name?: string;
    address?: Record<string, string>;
  };
  const a = body.address ?? {};
  // Nominatim spreads the populated-place name across several keys depending on
  // locale/admin level — take the first that's present.
  const city = a.city || a.town || a.municipality || a.village || a.county || null;
  const region = a.state || a.region || a.province || null;
  // Structured pieces for an address form: street line + postal code.
  const line1 = [a.house_number, a.road].filter(Boolean).join(' ') || null;
  const postcode = a.postcode || null;
  const value = body.display_name
    ? { lat, lng, label: body.display_name, city, region, line1, postcode }
    : null;

  cache.set(key, { at: Date.now(), value });
  return c.json({ data: value });
}
