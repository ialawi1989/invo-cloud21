import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';

const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('tracking-map');
  return true;
};

/** Live driver tracking. Mounted at `/tracking-map`, gated by `mapTrackingSecurity.actions.view.access`. */
export const TRACKING_MAP_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'mapTrackingSecurity.actions.view.access' },
    loadComponent: () => import('./pages/overview/tracking-map.component').then(m => m.TrackingMapComponent),
  },
];
