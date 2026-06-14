// Mirrors the backend "safe farmer" shape (docs/api.md GET /me).
export type AreaUnit = 'acre' | 'hectare' | 'bigha';

export type SafeFarmer = {
  id: string;
  created_at: string;
  updated_at: string;
  full_name: string | null;
  phone: string | null;
  preferred_language: string;
  aadhaar_last4: string | null;
  farm_lat: number | null;
  farm_lng: number | null;
  farm_district: string | null;
  farm_state: string | null;
  farm_village: string | null;
  farm_area_value: number | null;
  farm_area_unit: AreaUnit | null;
  primary_crops: string[] | null;
  land_record_id: string | null;
  onboarding_complete: boolean;
};

export type SessionResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number | null;
};

export type AuthResponse = { user: SafeFarmer; session: SessionResponse };

// --- Mandis / prices ---
export type Mandi = {
  mandi_id: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  distance_km: number;
};

export type PricePoint = {
  date: string;
  modal_price: number;
  min_price: number;
  max_price: number;
};

export type PriceSeries = {
  mandi_id: string;
  commodity: string;
  series: PricePoint[];
};

// --- Decision (F2) — per-mandi card matching output_format.md ---
export type DecisionCard = {
  mandi_id: string;
  mandi_name: string;
  district: string;
  state: string;
  distance_km: number | null;
  decision: 'HOLD' | 'SELL';
  wait_days: { best: number; range: [number, number] };
  good_sale_window_day: number;
  max_hold_days: number;
  quantity_qtl: number;
  confidence: 'high' | 'low';
  per_quintal: {
    sell_now: number;
    expected_at_D: { mid: number; range: [number, number] };
    storage_cost: number;
    expected_gain: number;
  };
  total: {
    sell_now: number;
    expected_at_D: { mid: number; range: [number, number] };
    storage_cost: number;
    expected_gain: number;
  };
  curve: { day: number; price: number; low: number; high: number }[];
};

// --- Jaaniye (F3) ---
export type AskResponse = {
  answer: string;
  has_image: boolean;
  disclaimer: string;
  stub: boolean;
};
