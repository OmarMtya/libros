import { config } from '../src/config';
import { cleanupAccount, confirmEmail, closePool, findAuthUserId } from '../src/db';

const args = process.argv.slice(2);
const confirmOnly = args.includes('--confirm-only');

async function main(): Promise<void> {
  if (confirmOnly) {
    const id = await findAuthUserId(config.email);
    if (!id) {
      console.log(`No existe ${config.email}; no hay nada que confirmar.`);
      return;
    }
    await confirmEmail(id);
    console.log(`Email confirmado para ${config.email} (${id}).`);
    return;
  }

  const { removed } = await cleanupAccount(config.email);
  console.log(removed
    ? `Cuenta y data de ${config.email} eliminadas.`
    : `No existía ${config.email}; nada que limpiar.`);
}

main()
  .catch((err) => {
    console.error('Error en cleanup:', err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
