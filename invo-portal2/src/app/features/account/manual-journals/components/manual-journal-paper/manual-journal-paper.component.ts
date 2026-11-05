import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { Journal, calculateJournalTotals } from '../../services/manual-journals.types';

/**
 * The manual journal drawn as a document: company header, reference / date / branch / status facts,
 * notes, then the ledger lines with debit / credit totals. A journal has no designer template, so
 * the view puts this in the paper's place (same approach as the bill-of-entry paper).
 */
@Component({
  selector: 'app-manual-journal-paper',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe],
  templateUrl: './manual-journal-paper.component.html',
  styleUrl: './manual-journal-paper.component.scss',
})
export class ManualJournalPaperComponent {
  private company = inject(CompanyService);

  journal = input.required<Journal>();

  lines = computed(() => this.journal().lines.filter(l => !l.isVoided));
  totals = computed(() => calculateJournalTotals(this.journal().lines));
  companyName = computed(() => this.company.currentCompany()?.name ?? '');
  logo = computed(() => {
    const c: any = this.company.currentCompany();
    return c?.mediaUrl?.defaultUrl || c?.logoUrl || c?.logo || '';
  });
}
