// Applies Prisma migrations and seeds the database for local Aspire development.
// Runs automatically before the `api` resource starts.
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const command of ['npx prisma migrate deploy', 'npx prisma db seed']) {
  execSync(command, { cwd: repoRoot, stdio: 'inherit', env: process.env });
}
