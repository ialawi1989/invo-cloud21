import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: ':parent/product/:id',
    renderMode: RenderMode.Server
  },
  {
    path: 'order/**',
    renderMode: RenderMode.Client
  },
  {
    path: 'checkout',
    renderMode: RenderMode.Client
  },
  {
    path: 'account',
    renderMode: RenderMode.Client
  },
  {
    path: 'cart',
    renderMode: RenderMode.Client
  },
  {
    path: 'wishlist',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
