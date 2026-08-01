export function assertTestDatabase(url: string | undefined): void {
  if (!url) return;
  const database = new URL(url).pathname.replace(/^\//, '').split('?')[0] ?? '';
  if (!database.toLowerCase().includes('test')) {
    throw new Error(
      `Refusing to run integration tests against database '${database}': ` +
        `TEST_DATABASE_URL must point to a database whose name contains 'test' (e.g. 'libros_test') ` +
        `to avoid wiping the local development database. ` +
        `Create it with: createdb libros_test && npx prisma migrate deploy && npx prisma db seed.`,
    );
  }
}
