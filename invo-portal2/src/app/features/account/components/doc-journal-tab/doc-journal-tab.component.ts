import '../../account-i18n';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

/** One row of `getInvoiceJournal` / `getEstimateJournal` etc — `defaultJournals[]`. */
export interface DocJournalRow {
  accountType: string;
  debit?: number | null;
  credit?: number | null;
}

/**
 * "Journal" tab under a document's paper: the accounting entries it posted (account / debit /
 * credit), totalled, in the company's base currency. Generic — any document view can drop this in
 * as long as it has rows shaped `{accountType, debit, credit}` (invoice, bill, credit note, …).
 */
@Component({
  selector: 'app-doc-journal-tab',
  standalone: true,
  imports: [TranslateModule, MycurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './doc-journal-tab.component.scss',
  template: `
    <div class="jt">
      <p class="jt__note">
        {{ 'DOC_VIEW.JOURNAL_CURRENCY_NOTE' | translate }}
        <span class="jt__currency">{{ currencyCode() }}</span>
      </p>
      <h3 class="jt__heading">{{ heading() }}</h3>
      <table class="jt__table">
        <thead>
          <tr><th>{{ 'DOC_VIEW.ACCOUNT' | translate }}</th><th class="end">{{ 'DOC_VIEW.DEBIT' | translate }}</th><th class="end">{{ 'DOC_VIEW.CREDIT' | translate }}</th></tr>
        </thead>
        <tbody>
          @for (r of rows(); track $index) {
            <tr><td>{{ r.accountType }}</td><td class="end">{{ r.debit || 0 | mycurrency }}</td><td class="end">{{ r.credit || 0 | mycurrency }}</td></tr>
          } @empty {
            <tr><td colspan="3" class="jt__empty">{{ 'DOC_VIEW.NO_DATA' | translate }}</td></tr>
          }
        </tbody>
        @if (rows().length) {
          <tfoot>
            <tr><td>{{ 'DOC_VIEW.TOTAL' | translate }}</td><td class="end">{{ totalDebit() | mycurrency }}</td><td class="end">{{ totalCredit() | mycurrency }}</td></tr>
          </tfoot>
        }
      </table>
    </div>
  `,
})
export class DocJournalTabComponent {
  private company = inject(CompanyService);

  rows = input<DocJournalRow[]>([]);
  /** Document-type heading above the table (e.g. "Invoice", "Estimate"). */
  heading = input<string>('');

  currencyCode = computed(() => this.company.settings()?.settings?.currencySymbol ?? '');
  totalDebit = computed(() => this.rows().reduce((s, r) => s + (Number(r.debit) || 0), 0));
  totalCredit = computed(() => this.rows().reduce((s, r) => s + (Number(r.credit) || 0), 0));
}
