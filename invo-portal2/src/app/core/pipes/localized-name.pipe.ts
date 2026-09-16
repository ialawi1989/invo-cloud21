import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { LocalizableRow, resolveLocalizedName } from '@shared/utils/localized-name';

/**
 * Renders an entity's name in the active UI language, falling back to the
 * plain (untranslated) field when the active language has no override
 * stored for it.
 *
 *   {{ product | localizedName }}
 *   {{ branch | localizedName }}
 *   {{ category | localizedName:'title' }}
 *
 * Products, branches, categories, departments, etc. all carry the same
 * `translation` shape (`{ <field>: { <langCode>: text } }`), so this one
 * pipe covers every list/dropdown/picker instead of each feature growing
 * its own `resolveName()`/`flattenName()` helper — see `resolveLocalizedName`
 * for the shared logic and for use in non-template contexts (a
 * `displayWith` adapter, a loader mapping rows before a component ever
 * sees them).
 *
 * Impure, like ngx-translate's own `translate` pipe: the output depends on
 * the active language, which isn't one of the pipe's arguments — a pure
 * pipe would keep showing whichever language was active when the row was
 * first rendered and never update on a switch. The work per call is a
 * couple of optional property reads, so no result cache is worth its own
 * correctness risk.
 */
@Pipe({ name: 'localizedName', standalone: true, pure: false })
export class LocalizedNamePipe implements PipeTransform, OnDestroy {
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);

  // Impure pipes re-run on every check anyway; this is what makes an OnPush
  // host schedule that check when the language, and nothing else, changes.
  private langChange: Subscription = this.translate.onLangChange.subscribe(
    () => this.cdr.markForCheck(),
  );

  transform(value: LocalizableRow | null | undefined, field: string = 'name'): string {
    return resolveLocalizedName(value, this.translate.currentLang, field);
  }

  ngOnDestroy(): void {
    this.langChange.unsubscribe();
  }
}
