import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService } from '../api.service';
import { AuthService } from '../auth.service';
import { SessionStore } from '../session-store';

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const api = inject(ApiService);
  const store = inject(SessionStore);
  await auth.whenReady();
  if (!auth.userId) return router.createUrlTree(['/']);
  const role = await api.getMe().then((user) => user.role).catch(() => 'customer' as const);
  store.isAdmin.set(role === 'admin');
  return role === 'admin' ? true : router.createUrlTree(['/']);
};
