import { cleanupAccount, closePool, dbAvailable } from '../src/db';
import { config } from '../src/config';

/**
 * globalTeardown: el "catch" que garantiza la eliminación de la cuenta y TODA su data
 * al terminar la última prueba, aunque alguna falle. Playwright lo ejecuta siempre.
 * Con DATABASE_URL borra aquí; sin ella, la corrida orquestada borra vía MCP después.
 */
export default async function globalTeardown(): Promise<void> {
  if (!dbAvailable()) return;
  try {
    const { removed } = await cleanupAccount(config.email);
    console.log(removed
      ? `[teardown] Cuenta y data de ${config.email} eliminadas.`
      : `[teardown] No existía ${config.email}.`);
  } catch (err) {
    console.error('[teardown] Falló el cleanup:', err);
  } finally {
    await closePool();
  }
}
