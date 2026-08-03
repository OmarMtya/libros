import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';
import { profileGuard } from './guards/profile.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./screens/landing').then((m) => m.Landing) },
  { path: 'app/login', loadComponent: () => import('./screens/login').then((m) => m.Login) },
  { path: 'app', redirectTo: 'app/perfil', pathMatch: 'full' },
  { path: 'app/cuestionario', loadComponent: () => import('./screens/questionnaire').then((m) => m.Questionnaire), canActivate: [authGuard] },
  { path: 'app/experiencia', loadComponent: () => import('./screens/experience').then((m) => m.Experience), canActivate: [authGuard] },
  { path: 'app/perfil', loadComponent: () => import('./screens/profile').then((m) => m.ProfileScreen), canActivate: [authGuard, profileGuard] },
  { path: 'app/mi-paquete', loadComponent: () => import('./screens/mi-paquete').then((m) => m.MiPaquete), canActivate: [authGuard] },
  { path: 'app/lectores', loadComponent: () => import('./screens/readers').then((m) => m.Readers), canActivate: [authGuard, adminGuard] },
  { path: 'app/admin', loadComponent: () => import('./screens/admin').then((m) => m.AdminScreen), canActivate: [authGuard, adminGuard] },
  { path: 'app/admin/clasificacion/:id', loadComponent: () => import('./screens/classification-editor').then((m) => m.ClassificationEditorScreen), canActivate: [authGuard, adminGuard] },
  { path: 'feedback/:token', loadComponent: () => import('./screens/feedback-token').then((m) => m.FeedbackToken) },
  { path: 'terminos-y-condiciones', loadComponent: () => import('./screens/terminos').then((m) => m.Terminos) },
  { path: 'aviso-de-privacidad', loadComponent: () => import('./screens/aviso-privacidad').then((m) => m.AvisoPrivacidad) },
  { path: 'eliminacion-de-cuenta-y-datos', loadComponent: () => import('./screens/eliminacion').then((m) => m.Eliminacion) },
  { path: 'contacto', loadComponent: () => import('./screens/contacto').then((m) => m.Contacto) },
  { path: '**', redirectTo: '' },
];
