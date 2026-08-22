import { AdminFeedbackNotificationVars, renderAdminFeedbackNotification } from './admin-feedback-notification';
import { AdminNewReaderVars, renderAdminNewReader } from './admin-new-reader';
import { AdminOrderNotificationVars, renderAdminOrderNotification } from './admin-order-notification';
import { DeliveredVars, renderDelivered } from './delivered';
import { GoodreadsImportedVars, renderGoodreadsImported } from './goodreads-imported';
import { OrderConfirmationVars, renderOrderConfirmation } from './order-confirmation';
import { renderShipped, ShippedVars } from './shipped';

export type EmailTemplateMap = {
  'order-confirmation': OrderConfirmationVars;
  'admin-order-notification': AdminOrderNotificationVars;
  'admin-new-reader': AdminNewReaderVars;
  'admin-feedback-notification': AdminFeedbackNotificationVars;
  shipped: ShippedVars;
  delivered: DeliveredVars;
  'goodreads-imported': GoodreadsImportedVars;
};

export type EmailTemplateKey = keyof EmailTemplateMap;

export type RenderedEmail = { subject: string; html: string };

type Renderer<K extends EmailTemplateKey> = (vars: EmailTemplateMap[K]) => RenderedEmail;

export const EMAIL_TEMPLATES: { [K in EmailTemplateKey]: Renderer<K> } = {
  'order-confirmation': renderOrderConfirmation,
  'admin-order-notification': renderAdminOrderNotification,
  'admin-new-reader': renderAdminNewReader,
  'admin-feedback-notification': renderAdminFeedbackNotification,
  shipped: renderShipped,
  delivered: renderDelivered,
  'goodreads-imported': renderGoodreadsImported,
};

export function renderEmail<K extends EmailTemplateKey>(key: K, vars: EmailTemplateMap[K]): RenderedEmail {
  return EMAIL_TEMPLATES[key](vars);
}
