-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;

-- AlterTable
ALTER TABLE "reader_profiles" ADD COLUMN "public_slug" VARCHAR(64),
ADD COLUMN "ai_description" VARCHAR(400),
ADD COLUMN "ai_description_status" VARCHAR(20) NOT NULL DEFAULT 'none',
ADD COLUMN "ai_description_generated_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX "reader_profiles_public_slug_key" ON "reader_profiles"("public_slug");
