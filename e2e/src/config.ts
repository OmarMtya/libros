import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa e2e/.env (ver e2e/.env.e2e.example).`);
  }
  return value;
}

export const config = {
  frontendUrl: required('FRONTEND_URL').replace(/\/$/, ''),
  apiUrl: (required('API_URL') + '/v1').replace(/\/$/, ''),
  email: required('E2E_EMAIL').toLowerCase(),
  password: required('E2E_PASSWORD'),
  fullName: process.env.E2E_FULL_NAME ?? 'Cuenta E2E',
  // Opcional: si no se define, las operaciones de DB (confirm/cleanup) se hacen fuera
  // (p. ej. vía MCP de Supabase en una corrida orquestada manualmente).
  databaseUrl: process.env.DATABASE_URL ?? null,
  hasDb: Boolean(process.env.DATABASE_URL),
};
