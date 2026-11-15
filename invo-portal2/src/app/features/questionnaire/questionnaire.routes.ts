import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

import './questionnaire-i18n';

// /questionnaire        -> list
// /questionnaire/new    -> create
// /questionnaire/:id    -> edit
const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('questionnaire');
  return true;
};

export const QUESTIONNAIRE_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded],
    loadComponent: () => import('./pages/questionnaire-list/questionnaire-list.component').then(m => m.QuestionnaireListComponent),
  },
  {
    path: 'new',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./pages/questionnaire-form/questionnaire-form.component').then(m => m.QuestionnaireFormComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./pages/questionnaire-form/questionnaire-form.component').then(m => m.QuestionnaireFormComponent),
  },
];
