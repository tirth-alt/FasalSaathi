/**
 * Curated mandi (agricultural market) reference data for the demo.
 *
 * Two clusters:
 *   1. MP cluster (IND-* / DEW-* / UJJ-*) — Indore / Dewas / Ujjain. Retained
 *      from the original fixture so existing tests keep resolving.
 *   2. Nashik-district (Maharashtra) APMC mandis (NSK-*) — the demo farmer's
 *      home region (village = Pimpalgaon Baswant). Real-ish APMC coordinates;
 *      great-circle distance from the farm is computed by lib/geo, so the
 *      distances come out convincing automatically.
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
const MAHARASHTRA = 'Maharashtra';
const NASHIK = 'Nashik';

/**
 * Mandis across two clusters: the original MP cluster (Indore/Dewas/Ujjain) and
 * the Nashik-district (Maharashtra) APMC cluster around the demo farmer's home
 * village, Pimpalgaon Baswant.
 */
export const MANDIS: readonly Mandi[] = [
  // --- MP cluster (Indore / Dewas / Ujjain) ---------------------------------
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

  // --- Nashik-district (Maharashtra) APMC cluster ---------------------------
  { mandi_id: 'NSK-PIM', name: 'Pimpalgaon Baswant', district: NASHIK, state: MAHARASHTRA, lat: 20.170, lng: 73.980 },
  { mandi_id: 'NSK-DIN', name: 'Dindori', district: NASHIK, state: MAHARASHTRA, lat: 20.202, lng: 73.833 },
  { mandi_id: 'NSK-NIP', name: 'Niphad', district: NASHIK, state: MAHARASHTRA, lat: 20.080, lng: 74.110 },
  { mandi_id: 'NSK-NSK', name: 'Nashik (Nimani)', district: NASHIK, state: MAHARASHTRA, lat: 19.998, lng: 73.790 },
  { mandi_id: 'NSK-LAS', name: 'Lasalgaon', district: NASHIK, state: MAHARASHTRA, lat: 20.145, lng: 74.236 },
  { mandi_id: 'NSK-DEO', name: 'Deola', district: NASHIK, state: MAHARASHTRA, lat: 20.430, lng: 74.012 },
  { mandi_id: 'NSK-CHA', name: 'Chandwad', district: NASHIK, state: MAHARASHTRA, lat: 20.330, lng: 74.244 },
  { mandi_id: 'NSK-UMR', name: 'Umrane', district: NASHIK, state: MAHARASHTRA, lat: 20.398, lng: 74.205 },
  { mandi_id: 'NSK-SIN', name: 'Sinnar', district: NASHIK, state: MAHARASHTRA, lat: 19.847, lng: 74.000 },
  { mandi_id: 'NSK-MAN', name: 'Manmad', district: NASHIK, state: MAHARASHTRA, lat: 20.252, lng: 74.438 },
  { mandi_id: 'NSK-YEO', name: 'Yeola', district: NASHIK, state: MAHARASHTRA, lat: 20.043, lng: 74.489 },
  { mandi_id: 'NSK-SAT', name: 'Satana', district: NASHIK, state: MAHARASHTRA, lat: 20.589, lng: 74.203 },
];
