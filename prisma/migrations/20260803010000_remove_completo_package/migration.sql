-- Retire the "Experiencia completa" package: remove the catalog row and its enum value.
-- PostgreSQL does not implement ALTER TYPE ... DROP VALUE, so we recreate the enum
-- without the removed value. Verified: only product_packages references the value
-- (orders and recommendations have 0 rows with it).
DELETE FROM "product_packages" WHERE "key" = 'libro_sorpresa_completo';

ALTER TYPE "ProductPackageKey" RENAME TO "ProductPackageKey_old";
CREATE TYPE "ProductPackageKey" AS ENUM ('libro_sorpresa_fisico');
ALTER TABLE "product_packages" ALTER COLUMN "key" TYPE "ProductPackageKey" USING "key"::text::"ProductPackageKey";
ALTER TABLE "orders" ALTER COLUMN "package_key" TYPE "ProductPackageKey" USING "package_key"::text::"ProductPackageKey";
ALTER TABLE "recommendations" ALTER COLUMN "package_key" TYPE "ProductPackageKey" USING "package_key"::text::"ProductPackageKey";
DROP TYPE "ProductPackageKey_old";
