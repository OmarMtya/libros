import { environment } from '../environments/environment';

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
const META_ATTRIBUTION_STORAGE_KEY = 'mls:meta-attribution';
const META_FBC_REFERENCE_MARKER = '_meta_fbc_';
const MAX_ATTRIBUTION_AGE_MS = 90 * 24 * 60 * 60 * 1000;

let loaded = false;

type StoredMetaAttribution = {
  fbc: string;
  capturedAt: number;
};

export function captureMetaAttribution(): void {
  if (typeof window === 'undefined') return;

  const current = readStoredMetaAttribution();
  const fbclid = new URLSearchParams(window.location.search).get('fbclid');
  const fbc = fbclid ? `fb.1.${Date.now()}.${fbclid}` : readCookie('_fbc') ?? current;
  if (!fbc || !isValidFbc(fbc)) return;

  try {
    localStorage.setItem(META_ATTRIBUTION_STORAGE_KEY, JSON.stringify({ fbc, capturedAt: Date.now() } satisfies StoredMetaAttribution));
  } catch {
    // almacenamiento no disponible
  }
}

export function getMetaFbc(): string | null {
  return typeof window === 'undefined' ? null : readStoredMetaAttribution();
}

export function encodeMetaFbcForReference(fbc: string): string | null {
  if (!isValidFbc(fbc)) return null;
  const encoded = btoa(fbc).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return `${META_FBC_REFERENCE_MARKER}${encoded}`;
}

function readStoredMetaAttribution(): string | null {
  try {
    const raw = localStorage.getItem(META_ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredMetaAttribution>;
    if (typeof stored.fbc !== 'string' || typeof stored.capturedAt !== 'number' || Date.now() - stored.capturedAt > MAX_ATTRIBUTION_AGE_MS || !isValidFbc(stored.fbc)) {
      localStorage.removeItem(META_ATTRIBUTION_STORAGE_KEY);
      return null;
    }
    return stored.fbc;
  } catch {
    return null;
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return null;
  const value = match.slice(name.length + 1);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isValidFbc(value: string): boolean {
  return value.startsWith('fb.1.') && value.length <= 200;
}

export function loadMetaPixel(): void {
  if (!environment.production || loaded || typeof window === 'undefined') return;
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
  if (!environment.production || typeof window === 'undefined' || !window.fbq) return;
  if (params) window.fbq('track', eventName, params);
  else window.fbq('track', eventName);
}
