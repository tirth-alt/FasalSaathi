import { z } from 'zod';

/**
 * Environment schema. Validated once at startup; fail fast with a clear message
 * if anything required is missing. Secret VALUES are never logged — only the
 * names of missing/invalid vars.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),

  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // AES-256-GCM key, base64-encoded 32 bytes. Length is validated in crypto.ts
  // (decoding there) but we ensure it is present here.
  AADHAAR_ENC_KEY: z.string().min(1, 'AADHAAR_ENC_KEY is required'),

  // Optional: only used by the self-guarded RLS integration test. Absent in unit runs.
  SUPABASE_DB_URL: z.string().url().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | null = null;

/**
 * Parse and validate process.env. Throws a readable error listing the offending
 * variable names (never their values) so misconfiguration is obvious at boot.
 */
export function loadConfig(
  source: Record<string, string | undefined> = process.env,
): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

/**
 * Memoized config accessor for app/runtime code. Tests can pass an explicit
 * config object into factories instead of relying on this singleton.
 */
export function getConfig(): AppConfig {
  if (!cached) {
    cached = loadConfig();
  }
  return cached;
}

/** Test helper: reset the memoized config so a fresh env can be loaded. */
export function resetConfigCache(): void {
  cached = null;
}
