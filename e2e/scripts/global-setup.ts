import { cleanupAccount, dbAvailable } from '../src/db';
import { config } from '../src/config';

export default async function globalSetup(): Promise<void> {
  if (!dbAvailable()) return; // corrida orquestada (confirm/cleanup vía MCP)
  // No cerramos el pool aquí: globalTeardown reutiliza el mismo pool para el cleanup final.
  const { removed } = await cleanupAccount(config.email);
  console.log(removed ? `[setup] Data previa de ${config.email} eliminada.` : `[setup] Sin data previa de ${config.email}.`);
}
