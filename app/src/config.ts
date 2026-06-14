import { NativeModules, Platform } from 'react-native';

const PORT = 8787;

/**
 * Resolve the backend base URL.
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_URL if explicitly set (manual override).
 * 2. Web: the page's own hostname (localhost or a LAN IP) + :8787.
 * 3. Native (Expo Go / device / emulator): the Metro bundler's host — i.e. the
 *    machine running `npx expo start`, which is also where the backend runs — + :8787.
 *    This makes a physical phone reach the laptop with NO manual IP config.
 */
function resolveApiBase(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override && override.trim()) return override.replace(/\/$/, '');

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `${window.location.protocol}//${window.location.hostname}:${PORT}`;
    }
    return `http://localhost:${PORT}`;
  }

  // Native: derive the dev-machine host from the Metro script URL.
  const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
  const host = scriptURL?.split('://')[1]?.split('/')[0]?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${PORT}`;
  }
  // iOS simulator / fallback.
  return `http://localhost:${PORT}`;
}

export const API_BASE_URL = resolveApiBase();

// Farmers log in with a phone number, but Supabase Auth is email/password. We map
// phone -> a synthetic email so the farmer never types an email.
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
