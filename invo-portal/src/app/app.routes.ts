import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    // Login - Full page, no layout wrapper
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    loadComponent: () => import('./core/layouts/main-layout.component').then(m => m.MainLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      // Add more feature routes here (products, orders, customers, etc.)
    ]
  },
  {
    // Website Builder - Full page, no layout wrapper
    path: 'website-builder',
    loadComponent: () => import('./features/website-builder/website-builder.component').then(m => m.WebsiteBuilderComponent)
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];