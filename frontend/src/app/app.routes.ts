import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./screens/home').then((m) => m.Home) },
  { path: 'cuestionario', loadComponent: () => import('./screens/questionnaire').then((m) => m.Questionnaire), canActivate: [authGuard] },
  { path: 'perfil', loadComponent: () => import('./screens/profile').then((m) => m.ProfileScreen), canActivate: [authGuard] },
  { path: 'mi-paquete', loadComponent: () => import('./screens/mi-paquete').then((m) => m.MiPaquete), canActivate: [authGuard] },
  { path: 'lectores', loadComponent: () => import('./screens/readers').then((m) => m.Readers), canActivate: [authGuard, adminGuard] },
  { path: 'admin', loadComponent: () => import('./screens/admin').then((m) => m.AdminScreen), canActivate: [authGuard, adminGuard] },
  { path: 'admin/clasificacion/:id', loadComponent: () => import('./screens/classification-editor').then((m) => m.ClassificationEditorScreen), canActivate: [authGuard, adminGuard] },
  { path: 'feedback/:token', loadComponent: () => import('./screens/feedback-token').then((m) => m.FeedbackToken) },
  { path: '**', redirectTo: '' },
];
