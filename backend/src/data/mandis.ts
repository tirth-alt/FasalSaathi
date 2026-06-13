/**
 * Curated mandi (agricultural market) reference data for the demo region — an
 * MP district cluster around Indore / Dewas / Ujjain. Lat/lng are plausible
 * real-ish coordinates spread across the three districts.
 *
 * This is a FIXTURE. It is served behind the MandiRepository interface
 * (see lib/repositories.ts) so a DB/CSV-backed implementation can swap in later
 * without touching routes. A matching Supabase migration + seed exists under
 * supabase/ as the documented future path, but is NOT required for tests/routes.
 */

export interface Mandi {
  mandi_id: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
}

const STATE = 'Madhya Pradesh';

/** ~10 mandis spread across the Indore/Dewas/Ujjain cluster. */
export const MANDIS: readonly Mandi[] = [
  { mandi_id: 'IND-001', name: 'Indore (Chhawni)', district: 'Indore', state: STATE, lat: 22.7196, lng: 75.8577 },
  { mandi_id: 'IND-002', name: 'Indore (Laxmibai Nagar)', district: 'Indore', state: STATE, lat: 22.7533, lng: 75.8723 },
  { mandi_id: 'IND-003', name: 'Mhow', district: 'Indore', state: STATE, lat: 22.5560, lng: 75.7610 },
  { mandi_id: 'IND-004', name: 'Sanwer', district: 'Indore', state: STATE, lat: 22.9740, lng: 75.8270 },
  { mandi_id: 'DEW-001', name: 'Dewas', district: 'Dewas', state: STATE, lat: 22.9623, lng: 76.0508 },
  { mandi_id: 'DEW-002', name: 'Sonkatch', district: 'Dewas', state: STATE, lat: 22.9760, lng: 76.3450 },
  { mandi_id: 'DEW-003', name: 'Bagli', district: 'Dewas', state: STATE, lat: 22.6420, lng: 76.3490 },
  { mandi_id: 'UJJ-001', name: 'Ujjain', district: 'Ujjain', state: STATE, lat: 23.1793, lng: 75.7849 },
  { mandi_id: 'UJJ-002', name: 'Tarana', district: 'Ujjain', state: STATE, lat: 23.3340, lng: 76.0420 },
  { mandi_id: 'UJJ-003', name: 'Mahidpur', district: 'Ujjain', state: STATE, lat: 23.4870, lng: 75.6080 },
];
