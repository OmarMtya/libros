import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  readonly isAdmin = signal(false);
  readonly authenticated = computed(() => Boolean(this.auth.userId));

  constructor() {
    effect(() => {
      if (!this.auth.session()) {
        this.isAdmin.set(false);
        return;
      }
      void this.api.getMe().then((user) => this.isAdmin.set(user.role === 'admin')).catch(() => this.isAdmin.set(false));
    });
  }

  readerName(): string {
    const user = this.auth.session()?.user;
    const name = user?.user_metadata?.['full_name'];
    return typeof name === 'string' && name.trim() ? name : user?.email ?? 'lector';
  }

  async signIn(): Promise<void> { await this.auth.signInWithGoogle(); }
  async signInWithEmail(email: string, password: string): Promise<void> { await this.auth.signInWithPassword(email, password); }
  async signUpWithEmail(email: string, password: string, fullName: string): Promise<{ needsConfirmation: boolean }> {
    return this.auth.signUpWithEmail(email, password, fullName);
  }
  async signOut(): Promise<void> { await this.auth.signOut(); }
}
