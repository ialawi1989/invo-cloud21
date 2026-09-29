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
 * Async customer search (20 per page, next page loads on scroll),
 * emitting the picked customer or `undefined` when cleared.
 */
@Component({
  selector: 'app-customer-picker',
  standalone: true,
  imports: [TranslateModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cp-row">
    <app-search-dropdown
      [loadFn]="load"
      [pageSize]="20"
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
    @if (allowAdvanced()) {
      <button type="button" class="cp-adv" (click)="advancedSearch.emit()" [attr.aria-label]="'CUSTOMERS.SEARCH.TITLE' | translate">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
      </button>
    }
    </div>
  `,
  styles: [`
    .cp-row { display: flex; gap: 8px; align-items: stretch; }
    .cp-row > app-search-dropdown { flex: 1; min-width: 0; }
    .cp-adv { flex: 0 0 auto; width: 42px; border: 1px solid #2691a4; background: #2691a4; color: #fff; border-radius: 8px; cursor: pointer; display: grid; place-items: center; }
    .cp-adv:hover { background: #227d8d; }
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
  /** Shows a search button beside the dropdown for the advanced search dialog. */
  allowAdvanced = input<boolean>(false);
  advancedSearch = output<void>();

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
