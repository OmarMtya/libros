import { Injectable, signal } from '@angular/core';
import { Session, createClient } from '@supabase/supabase-js';

type RuntimeConfig = { apiUrl?: string; supabaseUrl?: string; supabasePublishableKey?: string };

declare global {
  interface Window { LIBROS_CONFIG?: RuntimeConfig }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly session = signal<Session | null>(null);
  readonly configured = Boolean(window.LIBROS_CONFIG?.supabaseUrl && window.LIBROS_CONFIG?.supabasePublishableKey);
  private readonly client = this.configured
    ? createClient(window.LIBROS_CONFIG!.supabaseUrl!, window.LIBROS_CONFIG!.supabasePublishableKey!)
    : null;

  constructor() {
    if (!this.client) return;
    void this.client.auth.getSession().then(({ data }) => this.session.set(data.session));
    this.client.auth.onAuthStateChange((_event, session) => this.session.set(session));
  }

  get accessToken(): string | null { return this.session()?.access_token ?? null; }
  get userId(): string | null { return this.session()?.user.id ?? null; }

  async signInWithGoogle(): Promise<void> {
    if (!this.client) throw new Error('Configura Supabase para habilitar el inicio de sesión.');
    const { error } = await this.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }
}
