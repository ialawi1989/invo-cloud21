import '../../account-i18n';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { ApiService } from '@core/http/api.service';
import { SearchDropdownComponent } from '@shared/components/dropdown';

/** Row returned by `accounts/getSupplierMiniList`. */
export interface SupplierMini {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  country?: string;
  costCenter?: string | null;
  allowBillOfEntry?: boolean;
  paymentTerm?: any;
  vatNumber?: string;
}

/**
 * "Supplier Information" card shared by the purchase documents: an async supplier search (20 per
 * page, more on scroll) with a "New Supplier" action, and a notice when the supplier is abroad (a
 * supplier with `allowBillOfEntry` - purchase documents then carry no tax). The parent owns the state.
 */
@Component({
  selector: 'app-doc-supplier-section',
  standalone: true,
  imports: [TranslateModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="df-card">
      <h2 class="df-card__title"><span class="df-ico df-ico--blue" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg></span>{{ 'DOC_FORM.SUPPLIER_INFORMATION' | translate }}</h2>
      <div class="df-field df-field--wide">
        <label>{{ 'DOC_FORM.SUPPLIER_NAME' | translate }} @if (required()) { <span class="req">*</span> }</label>
        <app-search-dropdown [loadFn]="load" [pageSize]="20" [displayWith]="display" [compareWith]="same"
          [value]="supplier()" (valueChange)="supplierChange.emit($any($event) ?? undefined)"
          [clearable]="true" [searchable]="true" [disabled]="locked()"
          [placeholder]="'DOC_FORM.SELECT_SUPPLIER' | translate">
          @if (allowCreate()) {
            <ng-template #footer>
              <button type="button" class="sp-new" (mousedown)="$event.preventDefault()" (click)="createNew.emit()">
                <span class="sp-new__plus">+</span> {{ 'DOC_FORM.NEW_SUPPLIER' | translate }}
              </button>
            </ng-template>
          }
        </app-search-dropdown>
        @if (error()) { <p class="df-error">{{ error() }}</p> }
        @if (international()) { <div class="df-warn">{{ 'DOC_FORM.INTERNATIONAL_SUPPLIER' | translate }}</div> }
      </div>
      <ng-content/>
    </section>
  `,
  styles: [`
    .sp-new { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; border: 0; background: none; color: #227d8d; font-weight: 500; cursor: pointer; text-align: start; }
    .sp-new:hover { background: #f1f5f9; }
    .sp-new__plus { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: #227d8d; color: #fff; font-size: 14px; line-height: 1; }
  `],
})
export class DocSupplierSectionComponent {
  private api = inject(ApiService);

  supplier = input<SupplierMini | null>(null);
  error = input<string>('');
  /** The supplier can't be changed any more (a bill was made from the document). */
  locked = input<boolean>(false);
  allowCreate = input<boolean>(true);
  /** The supplier is optional (expenses): no required star. */
  required = input<boolean>(true);
  international = input<boolean>(false);

  supplierChange = output<SupplierMini | undefined>();
  createNew = output<void>();

  load = async (p: { page: number; pageSize: number; search: string }) => {
    const res = await this.api.request<any>(this.api.post('accounts/getSupplierMiniList', { page: p.page, limit: p.pageSize, searchTerm: p.search }));
    const list: SupplierMini[] = res?.data?.list ?? [];
    return { items: list, hasMore: p.page < (res?.data?.pageCount ?? (list.length >= p.pageSize ? p.page + 1 : p.page)) };
  };

  display = (s: SupplierMini) => (s ? (s.phone ? `${s.name} - ${s.phone}` : s.name) : '');
  same = (a: SupplierMini, b: SupplierMini) => a?.id === b?.id;
}
