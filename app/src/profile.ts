import AsyncStorage from '@react-native-async-storage/async-storage';

export type FarmSizeUnit = 'Acre' | 'Hectare' | 'Bigha' | 'Gaj';

export type FarmerProfile = {
  name: string;
  phone: string;
  aadhaar: string;
  village: string;
  district: string;
  state: string;
  coords?: { latitude: number; longitude: number };
  farmSize: string;
  farmSizeUnit: FarmSizeUnit;
  crop?: string;
};

const KEY = 'fasalsaathi.profile';

export async function loadProfile(): Promise<FarmerProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FarmerProfile) : null;
  } catch {
    return null;
  }
}

export async function saveProfile(p: FarmerProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // ignore write failures in the demo
  }
}

export async function clearProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
