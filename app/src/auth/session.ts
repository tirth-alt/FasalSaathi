import AsyncStorage from '@react-native-async-storage/async-storage';

/** Persisted Supabase session (subset the backend returns). */
export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number | null;
};

const KEY = 'fasalsaathi.session';

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export async function saveSession(s: Session): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore write failures in the demo
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
