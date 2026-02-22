import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: 'auth', loadComponent: () => import('./pages/auth/auth').then(m => m.Auth) },
    { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.DashboardComponent) },
    { path: '', redirectTo: 'auth', pathMatch: 'full' },
    { path: '**', redirectTo: 'auth' }
];
