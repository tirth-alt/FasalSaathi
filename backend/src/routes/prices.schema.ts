import { z } from 'zod';

/**
 * Query params for GET /prices/history.
 * `mandi_id` accepts a single id or a comma-separated list (F1 shows 8–10 mandis).
 */
export const priceHistoryQuerySchema = z.object({
  commodity: z.string().trim().min(1, 'commodity is required'),
  mandi_id: z
    .string()
    .trim()
    .min(1, 'mandi_id is required')
    .transform((s) =>
      s
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
    )
    .pipe(z.array(z.string().min(1)).min(1, 'at least one mandi_id is required')),
  days: z.coerce.number().int().positive().max(30).default(5),
});

export type PriceHistoryQuery = z.infer<typeof priceHistoryQuerySchema>;
