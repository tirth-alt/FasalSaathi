import { z } from 'zod';

/** Body for POST /decision (auth-protected). */
export const decisionBodySchema = z.object({
  commodity: z.string().trim().min(1, 'commodity is required'),
  quantity_quintal: z.number().positive('quantity_quintal must be positive'),
  /** Optional: which mandis to price against. If absent, derived from the
   *  farmer's farm_lat/farm_lng nearest mandis. */
  mandi_ids: z.array(z.string().trim().min(1)).min(1).optional(),
  /** Optional immediate cash need (₹). Can force a sell. */
  cash_need_inr: z.number().nonnegative().optional(),
  /** Forecast horizon; defaults to 4 weeks. */
  horizon_weeks: z.number().int().positive().max(52).default(4),
});

export type DecisionBody = z.infer<typeof decisionBodySchema>;
