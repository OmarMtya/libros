import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService } from '../api.service';
import { AuthService } from '../auth.service';

export const profileGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const api = inject(ApiService);
  await auth.whenReady();
  if (!auth.userId) return router.createUrlTree(['/app/login']);
  const sessions = await api.listSessions().catch(() => []);
  const completed = sessions.some((session) => session.status === 'completed');
  if (completed) return true;
  return router.createUrlTree(['/app/cuestionario'], { queryParams: { from: redirectSource(state.url) } });
};

function redirectSource(url: string): string {
  if (url.includes('/app/experiencia')) return 'experiencia';
  if (url.includes('/app/perfil')) return 'perfil';
  return 'unknown';
}
