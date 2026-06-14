import { z } from 'zod';

/**
 * Validation schemas for farmer profile writes.
 *
 * Aadhaar: validated as exactly 12 digits for FORMAT only. The value is never
 * logged and never echoed back; on write it is encrypted and only last-4 is kept.
 */

const farmAreaUnit = z.enum(['acre', 'hectare', 'bigha']);

// Basic Indian phone format: optional +91 / 0 prefix, 10 digits starting 6-9.
const phoneRegex = /^(?:\+91|0)?[6-9]\d{9}$/;

const aadhaarSchema = z
  .string()
  .regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits');

/** Full profile create/complete payload (POST /me/profile). */
export const createProfileSchema = z.object({
  full_name: z.string().trim().min(1, 'full_name is required'),
  phone: z.string().regex(phoneRegex, 'Invalid Indian phone number').optional(),
  preferred_language: z.string().trim().min(1).default('hi'),
  aadhaar: aadhaarSchema.optional(),
  farm_lat: z.number().min(-90).max(90).optional(),
  farm_lng: z.number().min(-180).max(180).optional(),
  farm_district: z.string().trim().min(1).optional(),
  farm_state: z.string().trim().min(1).optional(),
  farm_village: z.string().trim().min(1).optional(),
  farm_area_value: z.number().positive('farm_area_value must be positive').optional(),
  farm_area_unit: farmAreaUnit.optional(),
  primary_crops: z.array(z.string().trim().min(1)).optional(),
  land_record_id: z.string().trim().min(1).optional(),
});

/** Partial update payload (PUT /me/profile) — every field optional. */
export const updateProfileSchema = createProfileSchema.partial();

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Fields that constitute a "complete" onboarding. When all are present (either
 * already on the row or in the incoming payload), onboarding_complete is set true.
 */
export const REQUIRED_ONBOARDING_FIELDS = [
  'full_name',
  'farm_district',
  'farm_state',
  'farm_area_value',
  'farm_area_unit',
  'primary_crops',
] as const;
