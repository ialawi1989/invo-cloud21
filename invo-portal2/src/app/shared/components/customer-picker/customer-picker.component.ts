import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { ApiService } from '@core/http/api.service';
import { SearchDropdownComponent, } from '@shared/components/dropdown/search-dropdown.component';

/** Row returned by `accounts/getCustomerMiniList`. */
export interface CustomerMini {
  id: string;
  name: string;
  phone: string;
  email: string;
  paymentTerm?: any;
  saluation?: string;
  /** Display name — salutation + name, same as the legacy `Customer.getName`. */
  displayName: string;
}

/**
 * Async customer search (5 per page like the legacy `invo-customer-select-textbox`),
 * emitting the picked customer or `undefined` when cleared.
 */
@Component({
  selector: 'app-customer-picker',
  standalone: true,
  imports: [TranslateModule, SearchDropdownComponent],
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
      (valueChange)="onChange($any($event))">
      @if (allowCreate()) {
        <ng-template #footer>
          <button type="button" class="cp-new" (mousedown)="$event.preventDefault()" (click)="createNew.emit()">
            <span class="cp-new__plus">+</span> {{ 'CUSTOMERS.FORM.NEW_CUSTOMER' | translate }}
          </button>
        </ng-template>
      }
    </app-search-dropdown>
  `,
  styles: [`
    .cp-new { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; border: 0; background: none; color: #227d8d; font-weight: 500; cursor: pointer; text-align: start; }
    .cp-new:hover { background: #f1f5f9; }
    .cp-new__plus { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: #227d8d; color: #fff; font-size: 14px; line-height: 1; }
  `],
})
export class CustomerPickerComponent {
  private api = inject(ApiService);

  value = input<CustomerMini | null>(null);
  placeholder = input<string>('');
  /** Shows a sticky "New Customer" action at the bottom of the list. */
  allowCreate = input<boolean>(false);
  valueChange = output<CustomerMini | undefined>();
  createNew = output<void>();

  load = async (params: { page: number; pageSize: number; search: string }) => {
    const res = await this.api.request(
      this.api.post('accounts/getCustomerMiniList', {
        page: params.page,
        limit: params.pageSize,
        searchTerm: params.search,
      }),
    );
    const data: any = res?.data ?? {};
    const list: any[] = data.list ?? [];
    const items: CustomerMini[] = list.map(c => ({
      ...c,
      displayName: c.saluation ? `${c.saluation} ${c.name}` : c.name,
    }));
    return { items, hasMore: list.length >= params.pageSize };
  };

  display = (c: CustomerMini) => (c ? `${c.displayName} - ${c.phone ?? ''}` : '');
  compare = (a: CustomerMini, b: CustomerMini) => a?.id === b?.id;

  onChange(item: CustomerMini | null): void {
    this.valueChange.emit(item ?? undefined);
  }
}
