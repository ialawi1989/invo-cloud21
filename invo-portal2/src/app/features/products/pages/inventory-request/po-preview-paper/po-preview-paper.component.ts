import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { LocalizedNamePipe } from '@core/pipes/localized-name.pipe';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { InventoryRequestLine, calcLine } from '../../../services/inventory-request.service';

/** One supplier's slice of a request — the purchase order that conversion will create for them. */
export interface SupplierGroup {
  /** `''` for lines with no supplier assigned. */
  supplierId: string;
  supplierName: string;
  lines: InventoryRequestLine[];
}

/** Legacy `_(lines).groupBy(supplierId|supplierName)`, preserving first-seen order. */
export function groupBySupplier(lines: InventoryRequestLine[]): SupplierGroup[] {
  const groups = new Map<string, SupplierGroup>();
  for (const l of lines) {
    const g = groups.get(l.supplierId) ?? { supplierId: l.supplierId, supplierName: l.supplierName, lines: [] };
    g.lines.push(l);
    groups.set(l.supplierId, g);
  }
  return [...groups.values()];
}

/**
 * Read-only preview of the purchase order a supplier's lines will become (legacy
 * `purchase-order-paper`, minus the document-template builder which the new app drives separately).
 * Printing shows only this element.
 */
@Component({
  selector: 'app-po-preview-paper',
  standalone: true,
  imports: [CommonModule, TranslateModule, LocalizedNamePipe, MycurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './po-preview-paper.component.html',
  styleUrl: './po-preview-paper.component.scss',
})
export class PoPreviewPaperComponent {
  private company = inject(CompanyService);

  group = input.required<SupplierGroup>();
  branchName = input<string>('');
  employeeName = input<string>('');
  zoom = input<number>(100);

  companyName = computed(() => this.company.currentCompanyName());
  logo = computed(() => {
    const s = this.company.settings();
    return s?.mediaUrl?.thumbnail ?? s?.mediaUrl?.defaultUrl ?? s?.logo ?? null;
  });
  today = new Date();

  rows = computed(() => this.group().lines.map((l) => ({ line: l, ...calcLine(l) })));
  subTotal = computed(() => this.rows().reduce((s, r) => s + r.subTotal, 0));
  taxTotal = computed(() => this.rows().reduce((s, r) => s + r.taxTotal, 0));
  total = computed(() => this.rows().reduce((s, r) => s + r.total, 0));
}
