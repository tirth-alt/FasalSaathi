import { z } from 'zod';

/** Query params for GET /weather. Coerce numbers from the query string. */
export const weatherQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export type WeatherQuery = z.infer<typeof weatherQuerySchema>;
