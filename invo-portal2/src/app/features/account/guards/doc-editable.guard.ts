import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

import { LanguageService } from '@core/i18n/language.service';
import { ToastService } from '@shared/components/toast/toast.service';

/** What a document type contributes to the edit guard. */
export interface DocEditRule<S> {
  /** Loads the document being opened for edit. */
  load(id: string): Promise<S>;
  /**
   * Why the document's STATE forbids editing, as an i18n key, or null when it
   * may be edited. Refresh anything the rule needs (the accounting-period lock)
   * in here. Permissions are not part of this.
   */
  block(doc: S): Promise<string | null> | string | null;
}

/**
 * Route guard for a document's edit URL (`:id`).
 *
 * The list greys out Edit for a document that is locked, reconciled, closed and
 * so on, and says why. This makes the URL obey the same rule: typing the id by
 * hand lands on the read-only view with the same explanation, instead of an
 * editable form.
 *
 * New (`0`) and clone (`?cloned=yes`) are not edits and pass straight through.
 * A failed lookup also passes: the form itself reports a missing document, and a
 * guard that blocks on a network blip would strand the user.
 *
 * `setup` runs synchronously in the injection context, so it is where a
 * document type injects its service and actions; the returned rule keeps them.
 *
 * This is a UI rule, not a security boundary: the save endpoint must enforce the
 * same state on the server.
 *
 * @param viewBase  The read-only route to land on, e.g. `/account/bills/view`.
 */
export function docEditableGuard<S>(setup: () => DocEditRule<S>, viewBase: string): CanActivateFn {
  return async (route: ActivatedRouteSnapshot) => {
    const id = route.paramMap.get('id');
    if (!id || id === '0' || route.queryParamMap.get('cloned') === 'yes') return true;

    const router = inject(Router);
    const toast = inject(ToastService);
    const lang = inject(LanguageService);
    const rule = setup();

    try {
      const doc = await rule.load(id);
      const why = await rule.block(doc);
      if (!why) return true;
      // The shared explanations live in the document-form bundle; make sure it is loaded.
      await lang.loadFeature('account/components/doc-lines-table');
      toast.error('COMMON.OPS', lang.instant(why));
      return router.createUrlTree([viewBase, id]);
    } catch {
      return true;
    }
  };
}
