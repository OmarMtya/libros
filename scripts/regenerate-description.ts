import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DeepseekClient } from '../src/ai/deepseek.client';
import { ProfileDescriptionService } from '../src/profile/profile-description.service';

for (const rawLine of readFileSync(resolve(process.cwd(), '.env'), 'utf8').split(/\r?\n/)) {
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
  if (key && process.env[key] === undefined) process.env[key] = value;
}

const userIds = process.argv.slice(2).filter(Boolean);
if (userIds.length === 0) {
  console.error('Uso: npx tsx scripts/regenerate-description.ts <userId...>');
  process.exit(1);
}

const prisma = new PrismaClient();
const deepseek = new DeepseekClient(process.env.DEEPSEEK_API_KEY ?? '');
const service = new ProfileDescriptionService(prisma as never, deepseek);

async function main() {
  for (const userId of userIds) {
    const result = await service.generate(userId);
    console.log(
      `${userId} -> ${result.status}${result.description ? ` (${result.description.length} chars): ${result.description}` : ''}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
