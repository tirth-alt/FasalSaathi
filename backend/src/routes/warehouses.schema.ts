import { z } from 'zod';

/**
 * Query params for GET /warehouses. Either lat+lng (sort by distance) or district
 * (filter). All optional; if lat/lng are given they must come as a pair.
 */
export const warehousesQuerySchema = z
  .object({
    district: z.string().trim().min(1).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    limit: z.coerce.number().int().positive().max(50).default(10),
  })
  .refine((q) => (q.lat === undefined) === (q.lng === undefined), {
    message: 'lat and lng must be provided together',
    path: ['lat'],
  });

export type WarehousesQuery = z.infer<typeof warehousesQuerySchema>;
