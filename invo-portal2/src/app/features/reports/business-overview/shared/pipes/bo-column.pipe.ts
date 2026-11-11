import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { periodHeaderLabel } from '../accounting.utils';

const KEYS: Record<string, string> = {
  'Total': 'REPORTS.BO.COLUMNS.TOTAL',
  'Net Debit': 'REPORTS.BO.COLUMNS.NET_DEBIT',
  'Net Credit': 'REPORTS.BO.COLUMNS.NET_CREDIT',
};

/**
 * Label for a backend column / sub-column name. The fixed names (Total, Net
 * Debit, Net Credit) are translated; period and branch names pass through.
 */
@Pipe({ name: 'boColumn', standalone: true, pure: false })
export class BoColumnPipe implements PipeTransform {
  private t = inject(TranslateService);
  transform(name: string | null | undefined): string {
    if (!name) return '';
    const key = KEYS[name];
    return key ? this.t.instant(key) : periodHeaderLabel(name);
  }
}
