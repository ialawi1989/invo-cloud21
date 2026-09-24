import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { InvoiceInfo, PromotionsAccountingService } from '../../services/promotions-accounting.service';

/**
 * Async invoice search (5 per page, optionally narrowed to one customer's
 * phone) — the legacy `invo-invoice-select-textbox`.
 */
@Component({
  selector: 'app-invoice-picker',
  standalone: true,
  imports: [SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-search-dropdown
      [loadFn]="load"
      [pageSize]="5"
      [displayWith]="display"
      [compareWith]="compare"
      [clearable]="true"
      [searchable]="true"
      [placeholder]="placeholder()"
      [value]="value()"
      (valueChange)="onChange($any($event))"/>
  `,
})
export class InvoicePickerComponent {
  private accounting = inject(PromotionsAccountingService);

  phoneNumber = input<string>('');
  value = input<InvoiceInfo | null>(null);
  placeholder = input<string>('');
  valueChange = output<InvoiceInfo | undefined>();

  load = async (params: { page: number; pageSize: number; search: string }) => {
    const items = await this.accounting.getInvoicesByCustomer(this.phoneNumber() ?? '', params.search, {
      page: 1,
      limit: 5,
      count: 1,
      startIndex: 0,
      lastIndex: 4,
    });
    return { items: items ?? [], hasMore: false };
  };

  display = (i: InvoiceInfo) => i?.invoiceNumber ?? '';
  compare = (a: InvoiceInfo, b: InvoiceInfo) => a?.id === b?.id;

  onChange(item: InvoiceInfo | null): void {
    this.valueChange.emit(item ?? undefined);
  }
}
