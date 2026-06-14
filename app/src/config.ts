// Backend base URL. Override per-environment with EXPO_PUBLIC_API_URL.
// - Web preview + iOS simulator: http://localhost:8787 works.
// - Android emulator: use http://10.0.2.2:8787
// - Physical device (Expo Go): set EXPO_PUBLIC_API_URL to your machine's LAN IP,
//   e.g. http://192.168.1.42:8787  (phone + laptop on the same Wi-Fi).
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8787';

// Farmers log in with a phone number, but Supabase Auth is email/password. We map
// phone -> a synthetic email so the farmer never types an email. Keep in sync with
// any backend assumption (the backend only sees the email; phone is stored on the row).
export const PHONE_EMAIL_DOMAIN = 'fasalsaathi.app';

export function phoneToEmail(phone: string): string {
  return `${phone.replace(/\D/g, '')}@${PHONE_EMAIL_DOMAIN}`;
}

// Mandi/price fixtures are centred on the Indore (Madhya Pradesh) belt. If a farmer
// has no pinned GPS location yet, fall back to Indore so the demo still shows data.
export const FALLBACK_LAT = 22.7196;
export const FALLBACK_LNG = 75.8577;

export function farmerCoords(farmer: { farm_lat: number | null; farm_lng: number | null }): {
  lat: number;
  lng: number;
} {
  return {
    lat: farmer.farm_lat ?? FALLBACK_LAT,
    lng: farmer.farm_lng ?? FALLBACK_LNG,
  };
}
