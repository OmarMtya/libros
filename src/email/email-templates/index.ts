import { DeliveredVars, renderDelivered } from './delivered';
import { OrderConfirmationVars, renderOrderConfirmation } from './order-confirmation';
import { renderShipped, ShippedVars } from './shipped';

export type EmailTemplateMap = {
  'order-confirmation': OrderConfirmationVars;
  shipped: ShippedVars;
  delivered: DeliveredVars;
};

export type EmailTemplateKey = keyof EmailTemplateMap;

export type RenderedEmail = { subject: string; html: string };

type Renderer<K extends EmailTemplateKey> = (vars: EmailTemplateMap[K]) => RenderedEmail;

export const EMAIL_TEMPLATES: { [K in EmailTemplateKey]: Renderer<K> } = {
  'order-confirmation': renderOrderConfirmation,
  shipped: renderShipped,
  delivered: renderDelivered,
};

export function renderEmail<K extends EmailTemplateKey>(key: K, vars: EmailTemplateMap[K]): RenderedEmail {
  return EMAIL_TEMPLATES[key](vars);
}
