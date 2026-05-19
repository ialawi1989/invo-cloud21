import { Routes } from '@angular/router';
import { MediaManagerComponent } from './pages/media-manager.component';

/**
 * Media Feature Routes
 */
export const MEDIA_ROUTES: Routes = [
  {
    path: '',
    component: MediaManagerComponent,
    data: { title: 'Media Manager' }
  },
  {
    path: 'manager',
    component: MediaManagerComponent,
    data: { title: 'Media Manager' }
  },
  {
    path: '**',
    redirectTo: ''
  }
];
