import { Hono } from 'hono';
import type { AppBindings } from '@/lib/types.ts';
import { jsonError } from '@/lib/errors.ts';
import { nearestByDistance } from '@/lib/geo.ts';
import type { WarehouseRepository } from '@/lib/repositories.ts';
import { warehousesQuerySchema } from '@/routes/warehouses.schema.ts';

/**
 * Warehouse reference routes. PUBLIC (no auth): curated WDRA/PACS storage data is
 * non-sensitive reference data. Feeds the storage leg of the hold/sell decision.
 */
export interface WarehouseDeps {
  warehouses: WarehouseRepository;
}

export function createWarehouseRoutes(deps: WarehouseDeps): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  // GET /warehouses?district=&lat=&lng=&limit=
  // - lat+lng given → sort by distance (distance_km attached)
  // - district given → filter by district
  // - both → filter by district, then sort by distance
  // - neither → full curated list
  app.get('/warehouses', (c) => {
    const parsed = warehousesQuerySchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    );
    if (!parsed.success) {
      return jsonError(c, 400, 'validation_error', 'Invalid query parameters', parsed.error.flatten());
    }

    const { district, lat, lng, limit } = parsed.data;

    let list = deps.warehouses.listAll();
    if (district) {
      const wanted = district.toLowerCase();
      list = list.filter((w) => w.district.toLowerCase() === wanted);
    }

    if (lat !== undefined && lng !== undefined) {
      const nearest = nearestByDistance(list, lat, lng, limit);
      return c.json({ warehouses: nearest });
    }

    return c.json({ warehouses: list.slice(0, limit) });
  });

  return app;
}
