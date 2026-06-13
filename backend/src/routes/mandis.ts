import { Hono } from 'hono';
import type { AppBindings } from '@/lib/types.ts';
import { jsonError } from '@/lib/errors.ts';
import { nearestByDistance } from '@/lib/geo.ts';
import type { MandiRepository } from '@/lib/repositories.ts';
import { nearbyMandisQuerySchema } from '@/routes/mandis.schema.ts';

/**
 * Mandi reference routes. PUBLIC (no auth): this is non-sensitive reference data
 * (market names + coordinates) the client needs at onboarding to compute the
 * farmer's stable "8–10 nearest mandis" set. No farmer data is read or written.
 */
export interface MandiDeps {
  mandis: MandiRepository;
}

export function createMandiRoutes(deps: MandiDeps): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  // GET /mandis/nearby?lat=&lng=&limit= — nearest N mandis to a point.
  app.get('/mandis/nearby', (c) => {
    const parsed = nearbyMandisQuerySchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    );
    if (!parsed.success) {
      return jsonError(c, 400, 'validation_error', 'Invalid query parameters', parsed.error.flatten());
    }

    const { lat, lng, limit } = parsed.data;
    const nearest = nearestByDistance(deps.mandis.listAll(), lat, lng, limit);

    return c.json({ mandis: nearest });
  });

  return app;
}
