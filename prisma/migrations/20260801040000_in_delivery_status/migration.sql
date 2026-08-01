-- Agrega el estado "in_delivery" (en proceso de entrega) entre shipped y delivered
ALTER TYPE "FulfillmentStatus" ADD VALUE 'in_delivery';
