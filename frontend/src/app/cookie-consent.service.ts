import { Injectable, signal } from '@angular/core';
import { loadMetaPixel } from './meta-pixel';

export type CookieConsent = 'undecided' | 'accepted' | 'rejected';

export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_STORAGE_KEY = 'mls:cookie-consent';

interface StoredConsent {
  version: number;
  choice: CookieConsent;
}

@Injectable({ providedIn: 'root' })
export class CookieConsentService {
  readonly consent = signal<CookieConsent>(this.read());

  constructor() {
    if (this.consent() === 'accepted') loadMetaPixel();
  }

  accept(): void {
    this.save('accepted');
  }

  reject(): void {
    this.save('rejected');
  }

  reset(): void {
    try {
      localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    } catch {
      // almacenamiento no disponible
    }
    this.consent.set('undecided');
  }

  private save(choice: CookieConsent): void {
    const stored: StoredConsent = { version: COOKIE_CONSENT_VERSION, choice };
    try {
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // almacenamiento no disponible
    }
    this.consent.set(choice);
    if (choice === 'accepted') loadMetaPixel();
  }

  private read(): CookieConsent {
    try {
      const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      if (!raw) return 'undecided';
      const stored = JSON.parse(raw) as StoredConsent;
      if (stored.version !== COOKIE_CONSENT_VERSION) return 'undecided';
      return stored.choice === 'accepted' || stored.choice === 'rejected' ? stored.choice : 'undecided';
    } catch {
      return 'undecided';
    }
  }
}
