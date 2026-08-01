import { Injectable, signal } from '@angular/core';
import { Session, createClient } from '@supabase/supabase-js';

type RuntimeConfig = { apiUrl?: string; supabaseUrl?: string; supabasePublishableKey?: string };

declare global {
  interface Window { LIBROS_CONFIG?: RuntimeConfig }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly session = signal<Session | null>(null);
  readonly ready = signal(false);
  readonly configured = Boolean(window.LIBROS_CONFIG?.supabaseUrl && window.LIBROS_CONFIG?.supabasePublishableKey);
  private readonly client = this.configured
    ? createClient(window.LIBROS_CONFIG!.supabaseUrl!, window.LIBROS_CONFIG!.supabasePublishableKey!)
    : null;
  private readonly readyPromise = this.init();

  constructor() {
    void this.readyPromise;
  }

  get accessToken(): string | null { return this.session()?.access_token ?? null; }
  get userId(): string | null { return this.session()?.user.id ?? null; }

  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  private async init(): Promise<void> {
    if (!this.client) {
      this.ready.set(true);
      return;
    }
    try {
      const { data } = await this.client.auth.getSession();
      this.session.set(data.session);
    } finally {
      this.ready.set(true);
    }
    this.client.auth.onAuthStateChange((_event, session) => this.session.set(session));
  }

  async signInWithGoogle(): Promise<void> {
    if (!this.client) throw new Error('Configura Supabase para habilitar el inicio de sesión.');
    const { error } = await this.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/app` } });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }
}
