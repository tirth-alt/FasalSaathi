import { apiRequest } from './client';
import { phoneToEmail } from '../config';
import type {
  AuthResponse,
  SafeFarmer,
  Mandi,
  PriceSeries,
  DecisionCard,
  AskResponse,
  AreaUnit,
} from './types';

// ---------- Auth ----------
export function signup(input: {
  phone: string;
  password: string;
  full_name?: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: {
      email: phoneToEmail(input.phone),
      password: input.password,
      full_name: input.full_name,
      phone: input.phone,
    },
  });
}

export function login(input: { phone: string; password: string }): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email: phoneToEmail(input.phone), password: input.password },
  });
}

// ---------- Profile ----------
export function getMe(token: string): Promise<{ farmer: SafeFarmer }> {
  return apiRequest<{ farmer: SafeFarmer }>('/me', { token });
}

export type ProfilePayload = {
  full_name: string;
  phone?: string;
  preferred_language?: string;
  aadhaar?: string;
  farm_lat?: number;
  farm_lng?: number;
  farm_district?: string;
  farm_state?: string;
  farm_village?: string;
  farm_area_value?: number;
  farm_area_unit?: AreaUnit;
  primary_crops?: string[];
};

export async function saveProfile(token: string, payload: ProfilePayload): Promise<SafeFarmer> {
  const res = await apiRequest<{ farmer: SafeFarmer }>('/me/profile', {
    method: 'POST',
    token,
    body: payload,
  });
  return res.farmer;
}

// ---------- Mandis / prices (public) ----------
export function nearbyMandis(lat: number, lng: number, limit = 10): Promise<{ mandis: Mandi[] }> {
  return apiRequest<{ mandis: Mandi[] }>('/mandis/nearby', { query: { lat, lng, limit } });
}

export function priceHistory(
  commodity: string,
  mandiIds: string[],
  days = 7,
): Promise<{ series: PriceSeries[]; unknown_mandi_ids?: string[] }> {
  return apiRequest('/prices/history', {
    query: { commodity, mandi_id: mandiIds.join(','), days },
  });
}

// ---------- Decision (F2, auth) ----------
export function decisionPerMandi(
  token: string,
  input: {
    commodity: string;
    quantity_quintal: number;
    mandi_ids: string[];
    cash_need_inr?: number;
    horizon_weeks?: number;
  },
): Promise<{ cards: DecisionCard[] }> {
  return apiRequest<{ cards: DecisionCard[] }>('/decision', {
    method: 'POST',
    token,
    body: { ...input, per_mandi: true },
  });
}

// ---------- Jaaniye (F3, public stub) ----------
export function ask(input: {
  question: string;
  lang?: 'hi' | 'en';
  image_base64?: string;
}): Promise<AskResponse> {
  return apiRequest<AskResponse>('/ask', { method: 'POST', body: input });
}
