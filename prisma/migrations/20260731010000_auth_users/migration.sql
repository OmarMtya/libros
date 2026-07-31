-- Public user records mirror Supabase Auth identities. The FK to auth.users is
-- added when the Supabase project is provisioned, after any legacy-user audit.
CREATE TYPE "UserRole" AS ENUM ('customer', 'admin');

ALTER TABLE "users"
  ADD COLUMN "email" VARCHAR(320),
  ADD COLUMN "display_name" TEXT,
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'customer',
  ADD COLUMN "last_signed_in_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
