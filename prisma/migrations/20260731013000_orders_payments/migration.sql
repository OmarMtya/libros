CREATE TYPE "ProductPackageKey" AS ENUM ('libro_sorpresa_fisico', 'libro_sorpresa_completo');
CREATE TYPE "OrderStatus" AS ENUM ('pending_payment', 'paid', 'curation_pending', 'fulfilling', 'fulfilled', 'cancelled', 'refunded');
CREATE TYPE "PaymentProvider" AS ENUM ('stripe');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'cancelled', 'refunded');
CREATE TYPE "FulfillmentStatus" AS ENUM ('curation_pending', 'preparing', 'shipped', 'delivered');

CREATE TABLE "product_packages" (
  "id" UUID NOT NULL,
  "key" "ProductPackageKey" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price_cents" INTEGER NOT NULL,
  "shipping_cents" INTEGER NOT NULL DEFAULT 0,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'MXN',
  "included_formats" JSONB NOT NULL DEFAULT '[]',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "product_packages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_packages_key_key" ON "product_packages"("key");

CREATE TABLE "orders" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "package_id" UUID NOT NULL,
  "package_key" "ProductPackageKey" NOT NULL,
  "package_name" TEXT NOT NULL,
  "subtotal_cents" INTEGER NOT NULL,
  "shipping_cents" INTEGER NOT NULL DEFAULT 0,
  "total_cents" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'pending_payment',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paid_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

CREATE TABLE "order_shipping_addresses" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "recipient_name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "street" TEXT NOT NULL,
  "exterior_number" TEXT NOT NULL,
  "interior_number" TEXT,
  "neighborhood" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "postal_code" VARCHAR(10) NOT NULL,
  "country" CHAR(2) NOT NULL DEFAULT 'MX',
  "references" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_shipping_addresses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "order_shipping_addresses_order_id_key" ON "order_shipping_addresses"("order_id");

CREATE TABLE "payments" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "external_session_id" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
  "provider_payload" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payments_external_session_id_key" ON "payments"("external_session_id");
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

CREATE TABLE "payment_events" (
  "id" UUID NOT NULL,
  "payment_id" UUID,
  "provider_event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_events_provider_event_id_key" ON "payment_events"("provider_event_id");

CREATE TABLE "fulfillments" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "status" "FulfillmentStatus" NOT NULL DEFAULT 'curation_pending',
  "book_title" TEXT,
  "book_author" TEXT,
  "isbn" VARCHAR(20),
  "cover_url" TEXT,
  "internal_notes" TEXT,
  "tracking_number" TEXT,
  "ebook_storage_path" TEXT,
  "audio_storage_path" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "fulfillments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fulfillments_order_id_key" ON "fulfillments"("order_id");

ALTER TABLE "reading_feedback" ADD COLUMN "order_id" UUID;

ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "product_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_shipping_addresses" ADD CONSTRAINT "order_shipping_addresses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reading_feedback" ADD CONSTRAINT "reading_feedback_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
