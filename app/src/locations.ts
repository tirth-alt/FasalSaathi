// Curated farm locations for the demo. A controlled list (no free-text) so the
// location is always valid and maps to a real coordinate near our mandi data.
// The demo home is Pimpalgaon Baswant, Nashik — Maharashtra's onion belt.
export type DemoLocation = {
  state: string;
  district: string;
  village: string;
  lat: number;
  lng: number;
};

export const LOCATIONS: DemoLocation[] = [
  // Maharashtra — Nashik (demo home + neighbours), near the Nashik APMC cluster.
  { state: 'Maharashtra', district: 'Nashik', village: 'Pimpalgaon Baswant', lat: 20.17, lng: 73.98 },
  { state: 'Maharashtra', district: 'Nashik', village: 'Dindori', lat: 20.202, lng: 73.833 },
  { state: 'Maharashtra', district: 'Nashik', village: 'Niphad', lat: 20.08, lng: 74.11 },
  { state: 'Maharashtra', district: 'Nashik', village: 'Lasalgaon', lat: 20.145, lng: 74.236 },
  { state: 'Maharashtra', district: 'Nashik', village: 'Chandwad', lat: 20.33, lng: 74.244 },
  { state: 'Maharashtra', district: 'Nashik', village: 'Sinnar', lat: 19.847, lng: 74.0 },
  // Madhya Pradesh — Indore belt (variety; maps to the MP mandi cluster).
  { state: 'Madhya Pradesh', district: 'Indore', village: 'Mhow', lat: 22.556, lng: 75.761 },
  { state: 'Madhya Pradesh', district: 'Dewas', village: 'Sonkatch', lat: 22.976, lng: 76.345 },
  { state: 'Madhya Pradesh', district: 'Ujjain', village: 'Tarana', lat: 23.334, lng: 76.042 },
];

export const DEFAULT_LOCATION = LOCATIONS[0]; // Pimpalgaon Baswant

export function states(): string[] {
  return [...new Set(LOCATIONS.map((l) => l.state))];
}

export function districts(state: string): string[] {
  return [...new Set(LOCATIONS.filter((l) => l.state === state).map((l) => l.district))];
}

export function villages(state: string, district: string): string[] {
  return LOCATIONS.filter((l) => l.state === state && l.district === district).map((l) => l.village);
}

export function findLocation(state: string, district: string, village: string): DemoLocation | undefined {
  return LOCATIONS.find((l) => l.state === state && l.district === district && l.village === village);
}
