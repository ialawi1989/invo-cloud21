import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { BillOfEntry, BillOfEntryLine } from '../../../models/bill-of-entry.model';

/**
 * The bill of entry drawn as a document: supplier, bill and payment method facts, then the lines with their
 * assessable value, duty and tax. It has no designer template, so the view puts this in the paper's place.
 */
@Component({
  selector: 'app-bill-of-entry-paper',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe],
  templateUrl: './bill-of-entry-paper.component.html',
  styleUrl: './bill-of-entry-paper.component.scss',
})
export class BillOfEntryPaperComponent {
  private company = inject(CompanyService);

  entry = input.required<BillOfEntry>();

  lines = computed<BillOfEntryLine[]>(() => (this.entry().lines as BillOfEntryLine[]).filter(l => !l.isDeleted));
  companyName = computed(() => this.company.currentCompany()?.name ?? '');
  logo = computed(() => {
    const c: any = this.company.currentCompany();
    return c?.mediaUrl?.defaultUrl || c?.logoUrl || c?.logo || '';
  });
}
