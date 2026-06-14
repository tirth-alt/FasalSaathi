import { Hono } from 'hono';
import type { AppBindings } from '@/lib/types.ts';
import { jsonError } from '@/lib/errors.ts';
import type { MandiRepository, PriceRepository } from '@/lib/repositories.ts';
import { priceHistoryQuerySchema } from '@/routes/prices.schema.ts';

/**
 * Price-history routes. PUBLIC (no auth): mandi prices are public reference data
 * (no farmer data involved). Feeds F1's animated 5-day-per-mandi trend chart.
 */
export interface PriceDeps {
  prices: PriceRepository;
  mandis: MandiRepository;
}

export function createPriceRoutes(deps: PriceDeps): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  // GET /prices/history?commodity=&mandi_id=&days= — recent modal history per mandi.
  // mandi_id may be a single id or comma-separated list.
  app.get('/prices/history', (c) => {
    const parsed = priceHistoryQuerySchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    );
    if (!parsed.success) {
      return jsonError(c, 400, 'validation_error', 'Invalid query parameters', parsed.error.flatten());
    }

    const { commodity, mandi_id: mandiIds, days } = parsed.data;

    // Partition requested ids into known/unknown. Decision: if ALL requested ids
    // are unknown, return 400; otherwise return the known ones and report the
    // unknown ids so the caller can correct them.
    const known: string[] = [];
    const unknown: string[] = [];
    for (const id of mandiIds) {
      (deps.mandis.getById(id) ? known : unknown).push(id);
    }

    if (known.length === 0) {
      return jsonError(c, 400, 'unknown_mandi', 'No known mandi_id in request', {
        unknown_mandi_ids: unknown,
      });
    }

    const series = known.map((id) => ({
      mandi_id: id,
      commodity,
      series: deps.prices.getHistory(commodity, id, days),
    }));

    const body: {
      series: typeof series;
      unknown_mandi_ids?: string[];
    } = { series };
    if (unknown.length > 0) body.unknown_mandi_ids = unknown;

    return c.json(body);
  });

  return app;
}
