import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';

export const perfilGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  if (auth.userId) return true;
  const slug = route.paramMap.get('slug') ?? '';
  return router.createUrlTree(['/perfil', slug]);
};
