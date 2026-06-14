import { NativeModules, Platform } from 'react-native';

const PORT = 8787;

function hostFromScriptURL(): string | null {
  const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
  const host = scriptURL?.split('://')[1]?.split('/')[0]?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  return null;
}

/**
 * Resolve the backend base URL.
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_URL if set — UNLESS it's a localhost URL on a real device
 *    (localhost there means the phone itself, never the laptop), in which case we
 *    ignore it and auto-detect. This makes a stale inlined `localhost` harmless.
 * 2. Native (Expo Go / device / emulator): the Metro bundler host — the machine
 *    running `expo start`, which also runs the backend — so a phone reaches the
 *    laptop with NO manual IP.
 * 3. Web: the page's own hostname.
 */
function resolveApiBase(): string {
  const override = process.env.EXPO_PUBLIC_API_URL?.trim();
  const overrideIsLocalhost = !!override && /(localhost|127\.0\.0\.1)/.test(override);
  const onNative = Platform.OS !== 'web';

  if (override && !(onNative && overrideIsLocalhost)) {
    return override.replace(/\/$/, '');
  }

  if (onNative) {
    const host = hostFromScriptURL();
    if (host) return `http://${host}:${PORT}`;
    return `http://localhost:${PORT}`; // iOS simulator fallback
  }

  // Web
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:${PORT}`;
  }
  return `http://localhost:${PORT}`;
}

export const API_BASE_URL = resolveApiBase();

// Farmers log in with a phone number, but Supabase Auth is email/password. We map
// phone -> a synthetic email so the farmer never types an email.
export const PHONE_EMAIL_DOMAIN = 'fasalsaathi.app';

export function phoneToEmail(phone: string): string {
  return `${phone.replace(/\D/g, '')}@${PHONE_EMAIL_DOMAIN}`;
}

// Demo region is the Nashik onion belt (Pimpalgaon Baswant). If a farmer has no
// pinned location yet, fall back here so nearby mandis resolve to the Nashik APMCs.
export const FALLBACK_LAT = 20.17;
export const FALLBACK_LNG = 73.98;

export function farmerCoords(farmer: { farm_lat: number | null; farm_lng: number | null }): {
  lat: number;
  lng: number;
} {
  return {
    lat: farmer.farm_lat ?? FALLBACK_LAT,
    lng: farmer.farm_lng ?? FALLBACK_LNG,
  };
}
