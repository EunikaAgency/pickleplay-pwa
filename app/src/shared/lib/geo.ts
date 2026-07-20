// Distance helpers for location-based court sorting. Coordinates are `[lat, lng]`
// in decimal degrees (the same shape `venueCoords` returns); distances come back
// in kilometres. Kept dependency-free (the type-only import below adds no
// runtime edge) so the Courts screen can sort/format client-side without
// touching the API.

import type { AppUser } from './permissions';

export type LatLng = [number, number];

/**
 * The account's saved home coordinates — captured during onboarding, editable on
 * the profile map. Null unless both halves are on file. Lets a screen sort by
 * distance immediately, instead of blocking on a live device fix that may be
 * slow, refused, or unavailable.
 */
export function homeCoords(user: AppUser | null): LatLng | null {
  return user?.lat != null && user?.lng != null ? [user.lat, user.lng] : null;
}

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance between two `[lat, lng]` points, in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A short human label for a distance in km: "850 m", "4.3 km", "23 km". */
export function formatDistance(km: number | null): string {
  if (km == null || !Number.isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/**
 * Promise wrapper over the browser geolocation API. Resolves to `[lat, lng]`,
 * or rejects with a short, user-facing message (no permission, denied, timeout).
 * A fresh array is returned each call so callers can use reference identity to
 * detect a re-locate (e.g. to recenter the map).
 */
export function getCurrentLocation(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location isn’t available on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
      (err) => {
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              // Browsers won't re-show the prompt once blocked — point the user
              // at the address-bar permission icon so they can re-allow it.
              ? 'Location is blocked. Tap the lock/location icon in your address bar, allow Location, then press the button again.'
              : 'Couldn’t get your location. Try again.',
          ),
        );
      },
      // maximumAge:0 → every press does a fresh GPS read (never a cached fix), so
      // the button re-asks the device for the current location each time.
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}
