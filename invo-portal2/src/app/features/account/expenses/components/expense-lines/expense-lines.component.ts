import '../../../account-i18n';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { Expense, ExpenseLine } from '../../../models/expense.model';
import { DocumentLineEditor } from '../../../services/document-line-editor';
import { DocLinesTableComponent } from '../../../components/doc-lines-table/doc-lines-table.component';
import { DocLinesConfig } from '../../../components/doc-lines-table/doc-lines.types';

/**
 * The lines of an expense (and of a recurring expense's template) in the shared document lines table - an expense
 * account, a note, an amount and a tax per line, like every other document - with the notes box and the totals
 * under it. It edits the expense in place through the given line editor and raises `changed`.
 */
@Component({
  selector: 'app-expense-lines',
  standalone: true,
  imports: [FormsModule, TranslateModule, MycurrencyPipe, DocLinesTableComponent],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    @let e = expense();
    <app-doc-lines-table [doc]="e" [editor]="editor()" [config]="config" [formStatus]="formStatus()" title="EXPENSES.FORM.LINES" (changed)="changed.emit()">
      <div class="ex-foot">
        <div class="ex-notes">
          <label>{{ 'EXPENSES.FORM.NOTES' | translate }}</label>
          <textarea rows="3" [ngModel]="e.note" (ngModelChange)="e.note = $event; changed.emit()"></textarea>
        </div>
        <div class="ex-sum">
          <div class="ex-row"><span>{{ 'DOC_FORM.SUB_TOTAL' | translate }}</span><b>{{ e.itemTotalWithoutTax | mycurrency }}</b></div>
          <div class="ex-row"><span>{{ 'DOC_FORM.TAX_TOTAL' | translate }}</span><b>{{ e.invoiceTaxTotal | mycurrency }}</b></div>
          @if (e.roundingTotal) { <div class="ex-row"><span>{{ 'DOC_FORM.ROUNDING' | translate }}</span><b>{{ e.roundingTotal | mycurrency }}</b></div> }
          <div class="ex-row ex-row--total"><span>{{ 'DOC_FORM.TOTAL' | translate }}</span><b>{{ e.total | mycurrency }}</b></div>
        </div>
      </div>
    </app-doc-lines-table>
  `,
  styles: [`
    .ex-foot { display: grid; gap: 24px; grid-template-columns: 1fr; margin-top: 16px; }
    @media (min-width: 900px) { .ex-foot { grid-template-columns: 1fr 1fr; } }
    .ex-notes { display: flex; flex-direction: column; gap: 6px; }
    .ex-notes label { font-size: 13.5px; color: #0f172a; }
    .ex-notes textarea { background: #fff; border: 1px solid #d0d5dd; border-radius: 6px; padding: 9px 12px; font: inherit; resize: vertical; }
    .ex-sum { background: #fff; border: 1px solid #e4e7ec; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
    .ex-row { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; color: #334155; }
    .ex-row--total { border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 18px; color: #0f172a; }
  `],
})
export class ExpenseLinesComponent {
  expense = input.required<Expense>();
  editor = input.required<DocumentLineEditor>();
  formStatus = input<string>('new');
  changed = output<void>();

  readonly config: DocLinesConfig = {
    columns: [
      { key: 'account', type: 'account', label: 'EXPENSES.FORM.EXPENSE_ACCOUNT', field: 'accountId', required: true, width: '300px' },
      { key: 'note', type: 'text', label: 'DOC_LINES.DESCRIPTION', field: 'note' },
      { key: 'amount', type: 'money', label: 'EXPENSES.FORM.AMOUNT', field: 'amount', width: '150px', required: true, min: 0.001 },
      { key: 'tax', type: 'tax', label: 'DOC_LINES.COL_TAX', width: '190px' },
      { key: 'total', type: 'amount', label: 'EXPENSES.FORM.LINE_TOTAL', width: '130px' },
    ],
    itemSearch: async () => ({ list: [], hasNext: false }),
    isBlank: l => !l.accountId && !(l.amount > 0),
    canRemove: () => this.expense().liveLines.length > 1,
  };
}
