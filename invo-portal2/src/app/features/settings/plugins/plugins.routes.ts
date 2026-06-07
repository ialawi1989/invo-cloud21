import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

/**
 * URL pattern
 *   /settings/plugins                  → grouped catalogue list
 *   /settings/plugins/:slug/:id        → per-plugin configuration form
 *                                        (id = '0' for not-yet-saved)
 *
 * Privilege gate maps to `pluginsSecurity.actions.*` on the settings
 * tile that surfaces this feature.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('settings/plugins');
  return true;
};

export const PLUGINS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded],
    loadComponent: () =>
      import('./pages/list/plugins-list.component').then(m => m.PluginsListComponent),
  },

  // ── WhatsApp ─────────────────────────────────────────────────────────
  {
    path: 'whatsapp-notifications/:id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/forms/whatsapp-notifications.component').then(m => m.WhatsappNotificationsComponent),
  },
  {
    path: 'whatsapp-infobip/:id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/forms/whatsapp-infobip.component').then(m => m.WhatsappInfobipComponent),
  },
  {
    path: 'whatsapp-wasender/:id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/forms/whatsapp-wasender.component').then(m => m.WhatsappWasenderComponent),
  },

  // ── SMS ──────────────────────────────────────────────────────────────
  {
    path: 'sms-infobip/:id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/forms/sms-infobip.component').then(m => m.SmsInfobipComponent),
  },
  {
    path: 'sms-bareedsms/:id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/forms/sms-bareedsms.component').then(m => m.SmsBareedsmsComponent),
  },

  // ── Email ────────────────────────────────────────────────────────────
  {
    path: 'email-smtp/:id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/forms/email-smtp.component').then(m => m.EmailSmtpComponent),
  },

  // ── Utilities ────────────────────────────────────────────────────────
  {
    path: 'moic/:id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/forms/moic.component').then(m => m.MoicComponent),
  },
  {
    path: 'footfallcam/:id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/forms/footfallcam.component').then(m => m.FootfallcamComponent),
  },
  {
    path: 'grub-tech/:id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/forms/grubtech.component').then(m => m.GrubtechComponent),
  },
  {
    path: 'zatca/:id',
    canActivate: [translationsLoaded],
    loadComponent: () =>
      import('./pages/forms/zatca.component').then(m => m.ZatcaComponent),
  },
  {
    path: 'jordanfatoorah/:id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/forms/jordanfatoorah.component').then(m => m.JordanFatoorahComponent),
  },

  // ── Analytics ────────────────────────────────────────────────────────
  {
    path: 'google-setup',
    canActivate: [translationsLoaded],
    loadComponent: () =>
      import('./pages/forms/google-setup-guide.component').then(m => m.GoogleSetupGuideComponent),
  },
  {
    path: 'google-analytics-ga4/:id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/forms/google-analytics-ga4.component').then(m => m.GoogleAnalyticsGa4Component),
  },
  {
    path: 'google-search-console/:id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/forms/google-search-console.component').then(m => m.GoogleSearchConsoleComponent),
  },

  // ── AI ───────────────────────────────────────────────────────────────
  {
    path: 'content-ai/:id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/forms/content-ai.component').then(m => m.ContentAiComponent),
  },
];
