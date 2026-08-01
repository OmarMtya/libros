-- AlterTable: Stripe Payment Links collect a standard shipping address
-- without phone, separate exterior number, or neighborhood.
ALTER TABLE "order_shipping_addresses" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "order_shipping_addresses" ALTER COLUMN "exterior_number" DROP NOT NULL;
ALTER TABLE "order_shipping_addresses" ALTER COLUMN "neighborhood" DROP NOT NULL;
