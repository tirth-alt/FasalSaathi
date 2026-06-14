/**
 * Live external-API check (run on demand): `npm run check:external`.
 *
 * ACTUALLY CALLS each external API over the network and prints what comes back,
 * so we have real evidence of which sources return live data. This is NOT part of
 * `npm test` (that stays deterministic with mocks) — it hits the public internet.
 *
 * Expected as of 2026-06-13:
 *   - Open-Meteo  : LIVE — real Indore forecast + derived quality_risk.
 *   - Agmarknet   : DOWN — HTTP 502 / unavailable (graceful, no throw).
 *   - CEDA Ashoka : host up; reports whether an OpenAPI spec JSON is reachable
 *                   and, if so, the endpoint paths it exposes.
 */

import { OpenMeteoWeatherProvider } from '@/lib/external/weather.ts';
import { AgmarknetClient, DATA_GOV_IN_SAMPLE_KEY } from '@/lib/external/agmarknet.ts';
import { CedaClient } from '@/lib/external/ceda.ts';

// Indore coordinates (demo region).
const INDORE = { lat: 22.7196, lng: 75.8577 };

function line(): void {
  console.info('─'.repeat(72));
}

async function checkOpenMeteo(): Promise<void> {
  line();
  console.info('OPEN-METEO (weather) — expected: LIVE');
  const provider = new OpenMeteoWeatherProvider();
  try {
    const fc = await provider.getForecast(INDORE.lat, INDORE.lng);
    console.info(`  RESULT: LIVE ✔  ${fc.daily.length}-day forecast for Indore`);
    console.info(`  rain_3d_mm = ${fc.rain_3d_mm}   quality_risk = ${fc.quality_risk}`);
    console.info('  daily:');
    for (const d of fc.daily) {
      console.info(`    ${d.date}  rain=${d.precipitation_mm}mm  tmax=${d.temp_max}°C`);
    }
  } catch (err) {
    console.info(`  RESULT: FAILED  ${err instanceof Error ? err.message : 'unknown'}`);
  }
}

async function checkAgmarknet(): Promise<void> {
  line();
  console.info('AGMARKNET (data.gov.in) — expected: 502 / unavailable');
  const apiKey = process.env.DATA_GOV_IN_API_KEY ?? DATA_GOV_IN_SAMPLE_KEY;
  // Allow a longer probe timeout on demand to capture the true upstream status
  // (the gateway can be slow as well as down): AGMARKNET_PROBE_TIMEOUT_MS.
  const timeoutMs = Number(process.env.AGMARKNET_PROBE_TIMEOUT_MS) || undefined;
  const client = new AgmarknetClient(timeoutMs ? { apiKey, timeoutMs } : { apiKey });
  const health = await client.checkHealth();
  console.info(`  health: up=${health.up}${health.status ? ` status=${health.status}` : ''} — ${health.detail}`);
  const result = await client.getPrices({ commodity: 'Soybean', state: 'Madhya Pradesh', limit: 3 });
  if (result.available) {
    console.info(`  RESULT: LIVE ✔  ${result.records.length} record(s) returned`);
    for (const r of result.records.slice(0, 3)) {
      console.info(`    ${r.market} (${r.district}) ${r.commodity}: modal ₹${r.modal_price} on ${r.arrival_date}`);
    }
  } else {
    console.info(`  RESULT: UNAVAILABLE (as expected) — ${result.reason}`);
  }
}

async function checkCeda(): Promise<void> {
  line();
  console.info('CEDA ASHOKA (historical monthly prices) — expected: host up, endpoint TBD');
  const client = new CedaClient();
  const spec = await client.fetchSpec();
  if (spec.available) {
    console.info(`  spec: FOUND at ${spec.specPath} — ${spec.paths.length} path(s)`);
    for (const p of spec.paths.slice(0, 40)) console.info(`    ${p}`);
    if (spec.paths.length > 40) console.info(`    … and ${spec.paths.length - 40} more`);
  } else {
    console.info(`  spec: NOT MACHINE-READABLE — ${spec.reason}`);
  }
  const trend = await client.getMonthlyTrend('soybean', 'Indore');
  console.info(
    trend.available
      ? `  getMonthlyTrend: LIVE ✔  ${trend.points.length} month(s)`
      : `  getMonthlyTrend: not wired — ${trend.reason}`,
  );
}

async function main(): Promise<void> {
  console.info('FasalSaathi — live external-API check');
  console.info(`run at: ${new Date().toISOString()}`);
  await checkOpenMeteo();
  await checkAgmarknet();
  await checkCeda();
  line();
  console.info('done.');
}

main().catch((err) => {
  console.error('check-external crashed:', err);
  process.exit(1);
});
