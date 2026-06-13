import { z } from 'zod';

/** Query params for GET /mandis/nearby. Coerce numbers from the query string. */
export const nearbyMandisQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export type NearbyMandisQuery = z.infer<typeof nearbyMandisQuerySchema>;
