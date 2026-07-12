import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

import { MultilingualLandingComponent } from './components/multilingual-landing/multilingual-landing.component';
import { TranslationsShellComponent } from './components/translations-shell/translations-shell.component';
import { TranslationsStore } from './services/translations.store';
import { FIRST_TRANSLATION_ENTITY, TRANSLATION_ENTITIES } from './translations.config';

/**
 * Multilingual / Translation Manager.
 *
 * URL pattern
 *   /settings/translations                  → Multilingual landing
 *                                             (languages + progress)
 *   /settings/translations/:lang            → editor for that language,
 *                                             redirects to first group
 *   /settings/translations/:lang/:group     → editable grid for a group
 *
 * The landing lists the site's languages; picking one opens the editor
 * shell (sidebar + toolbar) scoped to that `:lang`, with a child route per
 * entity group so switching groups triggers the unsaved-changes guard.
 * `TranslationsStore` is provided at the feature root so the landing and
 * editor share one instance.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('settings/translations');
  return true;
};

export const TRANSLATIONS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded],
    providers: [TranslationsStore],
    children: [
      { path: '', component: MultilingualLandingComponent },

      {
        path: ':lang',
        component: TranslationsShellComponent,
        children: [
          { path: '', redirectTo: FIRST_TRANSLATION_ENTITY, pathMatch: 'full' },

          ...TRANSLATION_ENTITIES.map(entity => ({
            path: entity.id,
            canDeactivate: [unsavedChangesGuard],
            data: { entityId: entity.id },
            loadComponent: () =>
              import('./components/translation-group/translation-group.component')
                .then(m => m.TranslationGroupComponent),
          })),

          { path: '**', redirectTo: FIRST_TRANSLATION_ENTITY },
        ],
      },
    ],
  },
];
