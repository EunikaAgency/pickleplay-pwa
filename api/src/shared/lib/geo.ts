/** Great-circle distance helpers. Framework-agnostic and pure — the Play feed's
 *  proximity signal ranks on these, so they live in shared/ rather than inside a
 *  feature slice. */

export type LatLng = [number, number];

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distance in kilometres between two [lat, lng] points. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
