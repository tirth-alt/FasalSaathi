import { serve } from '@hono/node-server';
import { loadConfig } from '@/config/env.ts';
import { buildApp, buildDepsFromConfig } from '@/app.ts';

/**
 * Entry point: validate env (fail fast), wire real dependencies, build the app,
 * and start the HTTP server. Secret values are never logged.
 */
function main(): void {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'Failed to load configuration');
    process.exit(1);
  }

  const deps = buildDepsFromConfig(config);
  const app = buildApp(deps);

  serve({ fetch: app.fetch, port: config.PORT }, (info) => {
    console.info(`[${config.NODE_ENV}] fasalsaathi-backend listening on http://localhost:${info.port}`);
  });
}

main();
