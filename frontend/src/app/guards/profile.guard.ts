import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService } from '../api.service';
import { AuthService } from '../auth.service';

export const profileGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const api = inject(ApiService);
  await auth.whenReady();
  if (!auth.userId) return router.createUrlTree(['/app/login']);
  const sessions = await api.listSessions().catch(() => []);
  const completed = sessions.some((session) => session.status === 'completed');
  return completed ? true : router.createUrlTree(['/app/cuestionario']);
};
