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

  get googleAvatarUrl(): string | null {
    const metadata = this.session()?.user.user_metadata as Record<string, unknown> | undefined;
    const picture = metadata?.['avatar_url'] ?? metadata?.['picture'];
    return typeof picture === 'string' && picture && picture !== 'undefined' ? picture : null;
  }

  async updateName(fullName: string): Promise<void> {
    if (!this.client) throw new Error('Configura Supabase para editar tu nombre.');
    const name = fullName.trim();
    if (!name) throw new Error('Escribe un nombre.');
    const { error } = await this.client.auth.updateUser({ data: { full_name: name } });
    if (error) throw error;
    await this.client.auth.refreshSession();
  }

  async replaceAvatar(file: File): Promise<string> {
    if (!this.client) throw new Error('Configura Supabase para subir tu foto.');
    const userId = this.userId;
    if (!userId) throw new Error('Inicia sesión para subir tu foto.');
    const extension = this.avatarExtension(file.name);
    const path = `${userId}/avatar_${Date.now()}.${extension}`;
    const { error } = await this.client.storage.from('avatars').upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const { data: existing } = await this.client.storage.from('avatars').list(userId);
    const stale = (existing ?? [])
      .filter((item) => item.name !== path.split('/').pop())
      .map((item) => `${userId}/${item.name}`);
    if (stale.length > 0) await this.client.storage.from('avatars').remove(stale);
    const { data } = this.client.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  }

  private avatarExtension(name: string): string {
    const match = /\.([a-z0-9]{2,5})$/i.exec(name);
    const extension = (match?.[1] ?? 'png').toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp'].includes(extension) ? extension : 'png';
  }
}
