import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';

import './feedbacks-i18n';

// /feedbacks  -> list (rating stats + filter, comment popup, settings popup)
const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('feedbacks');
  return true;
};

export const FEEDBACKS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () => import('./pages/feedbacks-list/feedbacks-list.component').then(m => m.FeedbacksListComponent),
    data: { permissionPath: 'feedbacksSecurity.actions.view.access' },
  },
];
