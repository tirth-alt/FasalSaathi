/**
 * Geo helpers: great-circle distance + nearest-N selection. Pure functions, no
 * I/O — used by the mandi-nearby and warehouse lookups.
 */

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two lat/lng points in kilometres (haversine).
 */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Any record carrying a lat/lng we can sort by distance. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Sort items ascending by distance from (lat, lng) and return the nearest
 * `limit`, each augmented with `distance_km` (rounded to 1 decimal).
 */
export function nearestByDistance<T extends GeoPoint>(
  items: readonly T[],
  lat: number,
  lng: number,
  limit: number,
): (T & { distance_km: number })[] {
  return items
    .map((item) => ({
      ...item,
      distance_km: Math.round(haversineKm(lat, lng, item.lat, item.lng) * 10) / 10,
    }))
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, limit);
}
