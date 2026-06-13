/**
 * Domain types shared across the backend. The `farmers` table is the source of
 * truth (see supabase/migrations). These types mirror that schema.
 */

export type FarmAreaUnit = 'acre' | 'hectare' | 'bigha';

/** Full farmer row as stored in Postgres. Includes the encrypted Aadhaar — this
 * shape must NEVER be returned to clients directly. Use SafeFarmer for responses. */
export interface FarmerRow {
  id: string;
  created_at: string;
  updated_at: string;
  full_name: string | null;
  phone: string | null;
  preferred_language: string;
  aadhaar_enc: string | null;
  aadhaar_last4: string | null;
  farm_lat: number | null;
  farm_lng: number | null;
  farm_district: string | null;
  farm_state: string | null;
  farm_village: string | null;
  farm_area_value: number | null;
  farm_area_unit: FarmAreaUnit | null;
  primary_crops: string[] | null;
  land_record_id: string | null;
  onboarding_complete: boolean;
}

/** Client-safe projection of a farmer. Exposes aadhaar_last4 only; the encrypted
 * value and any plaintext are stripped. This is the ONLY farmer shape returned by routes. */
export interface SafeFarmer {
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
  farm_area_unit: FarmAreaUnit | null;
  primary_crops: string[] | null;
  land_record_id: string | null;
  onboarding_complete: boolean;
}

/** Strip sensitive fields, producing the client-safe projection. */
export function toSafeFarmer(row: FarmerRow): SafeFarmer {
  // Destructure out the sensitive field so it can never leak into the response.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { aadhaar_enc, ...rest } = row;
  return rest;
}

/** Context values attached by the auth middleware after JWT verification. */
export interface AuthContext {
  userId: string;
  email: string | null;
  farmer: FarmerRow;
}

/** Hono context variable map. */
export type AppBindings = {
  Variables: {
    auth: AuthContext;
  };
};
