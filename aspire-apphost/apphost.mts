// Aspire TypeScript AppHost
// For more information, see: https://aspire.dev

import { readFileSync, existsSync } from 'node:fs';
import { createBuilder } from './.aspire/modules/aspire.mjs';

const builder = await createBuilder();

// Loads the repository root .env so the AppHost can pass the same
// configuration the docker-compose stack used to receive.
function loadDotEnv(path: string): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!existsSync(path)) return vars;
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (key) vars[key] = value;
  }
  return vars;
}

const env = loadDotEnv('../.env');

// PostgreSQL server managed by Aspire, with a named database and persistent data.
const postgres = await builder.addPostgres('postgres').withDataVolume();
const librosDb = await postgres.addDatabase('libros');

// Applies Prisma migrations and seeds the database before the API starts.
const dbSetup = await builder
  .addNodeApp('db-setup', '.', 'db-setup.mjs')
  .withEnvironment('DATABASE_URL', await librosDb.uriExpression())
  .waitFor(librosDb);

// NestJS API (the docker-compose `api` service equivalent).
const api = await builder
  .addJavaScriptApp('api', '..', { runScriptName: 'start:dev' })
  .withHttpEndpoint({ port: 3000, env: 'PORT' })
  .withHttpHealthCheck({ path: '/v1/packages', statusCode: 200 })
  .withEnvironment('DATABASE_URL', await librosDb.uriExpression())
  .withEnvironment('CORS_ORIGIN', env.CORS_ORIGIN ?? 'http://localhost:4200')
  .withEnvironment('APP_URL', env.APP_URL ?? 'http://localhost:4200')
  .withEnvironment('INVITATION_SIGNING_SECRET', env.INVITATION_SIGNING_SECRET ?? '')
  .withEnvironment('SUPABASE_JWT_ISSUER', env.SUPABASE_JWT_ISSUER ?? '')
  .withEnvironment('SUPABASE_JWKS_URL', env.SUPABASE_JWKS_URL ?? '')
  .withEnvironment('SUPABASE_JWT_AUDIENCE', env.SUPABASE_JWT_AUDIENCE ?? 'authenticated')
  .withEnvironment('ADMIN_EMAILS', env.ADMIN_EMAILS ?? '')
  .withEnvironment('STRIPE_SECRET_KEY', env.STRIPE_SECRET_KEY ?? '')
  .withEnvironment('STRIPE_WEBHOOK_SECRET', env.STRIPE_WEBHOOK_SECRET ?? '')
  .withEnvironment('DEEPSEEK_API_KEY', env.DEEPSEEK_API_KEY ?? '')
  .withEnvironment('GOOGLE_BOOKS_API_KEY', env.GOOGLE_BOOKS_API_KEY ?? '')
  .withEnvironment('META_PIXEL_ID', env.META_PIXEL_ID ?? '')
  .withEnvironment('META_CAPI_ACCESS_TOKEN', env.META_CAPI_ACCESS_TOKEN ?? '')
  .withEnvironment('META_CAPI_GRAPH_VERSION', env.META_CAPI_GRAPH_VERSION ?? 'v23.0')
  .waitFor(dbSetup);

// Angular frontend (the docker-compose `frontend` service equivalent).
const frontend = await builder
  .addJavaScriptApp('frontend', '../frontend', { runScriptName: 'serve' })
  .withHttpEndpoint({ port: 4200, env: 'PORT' })
  .waitFor(api);

await builder.build().run();
