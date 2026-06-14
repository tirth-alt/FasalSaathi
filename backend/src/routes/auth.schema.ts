import { z } from 'zod';

/**
 * Validation schemas for the email/password auth routes.
 *
 * Passwords are validated for FORMAT only here; they are never logged and never
 * echoed back. Supabase Auth stores the password hash — we never persist it.
 */

// Minimum password length. Stricter than Supabase's default minimum (6) to give
// the demo a sensible baseline; tune in env/config later if real users arrive.
const PASSWORD_MIN_LENGTH = 8;

// Basic Indian phone format: optional +91 / 0 prefix, 10 digits starting 6-9.
// Mirrors the rule in profile.schema.ts so the two write paths stay consistent.
const phoneRegex = /^(?:\+91|0)?[6-9]\d{9}$/;

/** POST /auth/signup payload. */
export const signupSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
  full_name: z.string().trim().min(1).optional(),
  phone: z.string().regex(phoneRegex, 'Invalid Indian phone number').optional(),
});

/** POST /auth/login payload. */
export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  // No length rule on login — we only check credentials, not policy.
  password: z.string().min(1, 'Password is required'),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
