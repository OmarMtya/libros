declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: ((...args: unknown[]) => void) | null;
  queue: unknown[][];
  push: unknown;
  loaded?: boolean;
  version?: string;
};

const PIXEL_ID = '1530075444912040';
const PIXEL_SCRIPT = 'https://connect.facebook.net/en_US/fbevents.js';

let loaded = false;

export function loadMetaPixel(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;

  const existing = window._fbq as Fbq | undefined;
  if (existing?.callMethod) {
    window.fbq?.('init', PIXEL_ID);
    window.fbq?.('track', 'PageView');
    return;
  }

  const queue: unknown[][] = existing?.queue ?? [];
  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) {
      fbq.callMethod.apply(fbq, args);
    } else {
      queue.push(args);
    }
  }) as Fbq;
  fbq.queue = queue;
  fbq.push = queue.push.bind(queue);
  fbq.loaded = true;
  fbq.version = '2.0';

  window._fbq = fbq;
  window.fbq = fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = PIXEL_SCRIPT;
  document.body.appendChild(script);

  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');
}

export function trackMetaEvent(eventName: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.fbq) return;
  if (params) window.fbq('track', eventName, params);
  else window.fbq('track', eventName);
}
