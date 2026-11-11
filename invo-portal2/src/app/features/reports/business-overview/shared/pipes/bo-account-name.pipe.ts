import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { accountTypeKey } from '../../../../settings/chart-of-accounts/utils/account-types';

/**
 * Translate a system account / type name (Cash, Bank, Operating Income…) with
 * the chart-of-accounts dictionary; user-created names pass through unchanged.
 * Legacy `AccountService.prepareToTranslateAccount`.
 */
export function accountLabel(t: TranslateService, name: string | null | undefined): string {
  if (!name) return '';
  const key = accountTypeKey(name);
  const label = t.instant(key);
  return label && label !== key ? label : name;
}

@Pipe({ name: 'boAccountName', standalone: true, pure: false })
export class BoAccountNamePipe implements PipeTransform {
  private t = inject(TranslateService);
  transform(name: string | null | undefined): string { return accountLabel(this.t, name); }
}
