import { Injectable, signal } from '@angular/core';
import { Session, createClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly session = signal<Session | null>(null);
  readonly ready = signal(false);
  readonly configured = Boolean(environment.supabaseUrl && environment.supabasePublishableKey);
  private readonly client = this.configured
    ? createClient(environment.supabaseUrl!, environment.supabasePublishableKey!)
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

  async signInWithPassword(email: string, password: string): Promise<void> {
    if (!this.client) throw new Error('Configura Supabase para habilitar el inicio de sesión.');
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signUpWithEmail(email: string, password: string, fullName: string): Promise<{ needsConfirmation: boolean }> {
    if (!this.client) throw new Error('Configura Supabase para habilitar el registro.');
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    return { needsConfirmation: !data.session };
  }

  async signOut(): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }
}
