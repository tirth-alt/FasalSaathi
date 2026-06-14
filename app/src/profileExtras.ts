import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AreaUnit } from './api/types';

// The backend has no PIN-code column and only supports acre|hectare|bigha (no Gaj).
// We keep the farmer's PIN and their originally-chosen size/unit on-device so the
// UI can show exactly what they entered, while the backend stores a supported unit.
export type ProfileExtras = {
  pincode?: string;
  displaySize?: string;
  displayUnit?: string; // 'Acre' | 'Hectare' | 'Bigha' | 'Gaj'
};

const KEY = 'fasalsaathi.profileExtras';

export async function loadExtras(): Promise<ProfileExtras> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProfileExtras) : {};
  } catch {
    return {};
  }
}

export async function saveExtras(e: ProfileExtras): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(e));
  } catch {
    // ignore
  }
}

// UI units the farmer can pick.
export type DisplayUnit = 'Acre' | 'Hectare' | 'Bigha' | 'Gaj';

// 1 acre ≈ 4840 gaj (sq yard). Backend stores acre|hectare|bigha, so Gaj is
// converted to its acre equivalent before sending.
const GAJ_PER_ACRE = 4840;

/** Map the farmer's chosen display unit + value to a backend-supported unit/value. */
export function toBackendArea(value: number, unit: DisplayUnit): { value: number; unit: AreaUnit } {
  switch (unit) {
    case 'Acre':
      return { value, unit: 'acre' };
    case 'Hectare':
      return { value, unit: 'hectare' };
    case 'Bigha':
      return { value, unit: 'bigha' };
    case 'Gaj':
      return { value: Number((value / GAJ_PER_ACRE).toFixed(4)), unit: 'acre' };
  }
}
