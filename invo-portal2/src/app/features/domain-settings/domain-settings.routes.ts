import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';

import './domain-settings-i18n';

// ── URL pattern ──────────────────────────────────────────────────────────────
// /domain-settings → the three-step wizard (register → verify DNS → connect)
// ─────────────────────────────────────────────────────────────────────────────

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('domain-settings');
  return true;
};

export const DOMAIN_SETTINGS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () => import('./pages/domain-settings/domain-settings.component').then(m => m.DomainSettingsComponent),
    data: { permissionPath: 'DomainSettingsSecurity.actions.view.access' },
  },
];
