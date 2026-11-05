import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { LocalizedNamePipe } from '@core/pipes/localized-name.pipe';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { MynumberPipe } from '@core/pipes/mynumber.pipe';

import { InventoryRequestLine } from '../../../services/inventory-request.service';

export interface InventoryRequestPaperData {
  id: string;
  status: string;
  createdAt: string | Date;
  branchName: string;
  employeeName: string;
  lines: InventoryRequestLine[];
}

/**
 * The printable inventory request (legacy `inventory-request-paper`): company header, status,
 * branch / employee / date, and the Product / Qty / Unit cost / Total table with a grand total.
 * Printing shows only this element (see the `@media print` block in the stylesheet).
 */
@Component({
  selector: 'app-inventory-request-paper',
  standalone: true,
  imports: [StatusBadgeComponent, CommonModule, TranslateModule, LocalizedNamePipe, MycurrencyPipe, MynumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './inventory-request-paper.component.html',
  styleUrl: './inventory-request-paper.component.scss',
})
export class InventoryRequestPaperComponent {
  private company = inject(CompanyService);

  data = input.required<InventoryRequestPaperData>();
  /** On-screen preview zoom (percent); has no effect when printing. */
  zoom = input<number>(100);

  companyName = computed(() => this.company.currentCompanyName());
  logo = computed(() => {
    const s = this.company.settings();
    return s?.mediaUrl?.thumbnail ?? s?.mediaUrl?.defaultUrl ?? s?.logo ?? null;
  });

  /** Saved, product-selected lines only. */
  lines = computed(() => (this.data().lines ?? []).filter((l) => !!l.productId));
  total = computed(() => this.lines().reduce((s, l) => s + (l.unitCost || 0) * (l.qty || 0), 0));

  lineTotal(l: InventoryRequestLine): number { return (l.unitCost || 0) * (l.qty || 0); }
}
