import '../../../account-i18n';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { CustomerMini } from '@shared/components/customer-picker/customer-picker.component';

import { LanguageService } from '@core/i18n/language.service';
import { CustomersService } from '../../services/customers.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';

type SearchField = 'all' | 'name' | 'email' | 'phone';
const FIELDS: SearchField[] = ['all', 'name', 'email', 'phone'];

/**
 * "Advanced Customer Search": pick the field to search in, type, and choose from the paged results
 * (name, email, phone), from the light mini list. The server matches the text; the chosen field narrows each page.
 */
@Component({
  selector: 'app-customer-advanced-search-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, PaginationComponent, SearchDropdownComponent],
  template: `
    <app-modal-header [title]="'CUSTOMERS.SEARCH.TITLE' | translate"/>
    <div class="cs">
      <form class="cs__bar" (ngSubmit)="search()">
        <div class="cs__group">
          <div class="cs__field">
            <app-search-dropdown [items]="fieldOptions()" [displayWith]="fieldLabel" [compareWith]="sameField" [searchable]="false"
              [value]="fieldOf()" (valueChange)="field.set($any($event)?.value ?? 'all')" [clearable]="false"/>
          </div>
          <input class="cs__input" type="text" name="term" autofocus [ngModel]="term()" (ngModelChange)="term.set($event)"/>
        </div>
        <button type="submit" class="cs__btn">{{ 'CUSTOMERS.SEARCH.SEARCH' | translate }}</button>
      </form>

      <div class="cs__wrap">
        <table class="cs__table">
          <thead>
            <tr>
              <th>{{ 'CUSTOMERS.SEARCH.CUSTOMER_NAME' | translate }}</th>
              <th>{{ 'CUSTOMERS.SEARCH.EMAIL' | translate }}</th>
              <th>{{ 'CUSTOMERS.SEARCH.PHONE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.id) {
              <tr (click)="pick(r)">
                <td>{{ r.saluation ? r.saluation + ' ' + r.name : r.name }}</td><td>{{ r.email }}</td><td>{{ r.phone }}</td>
              </tr>
            } @empty {
              <tr><td colspan="3" class="cs__empty">{{ (loading() ? 'DOC_LINES.LOADING' : 'CUSTOMERS.SEARCH.EMPTY') | translate }}</td></tr>
            }
          </tbody>
        </table>
      </div>
      <app-pagination [page]="page()" [pageSize]="limit" [count]="count()" [showPageSize]="false" (pageChange)="goTo($event)"/>
    </div>
  `,
  styles: [`
    .cs { width: 100%; box-sizing: border-box; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
    .cs__bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .cs__group { display: flex; align-items: stretch; flex: 1 1 260px; min-width: 0; border: 1px solid #d0d5dd; border-radius: 8px; background: #fff; overflow: hidden; }
    .cs__group:focus-within { border-color: #2691a4; box-shadow: 0 0 0 3px rgba(38, 145, 164, .12); }
    .cs__field { flex: 0 0 170px; border-inline-end: 1px solid #e4e7ec; }
    .cs__field ::ng-deep .sd-trigger, .cs__field ::ng-deep button { border: 0; border-radius: 0; box-shadow: none; }
    .cs__input { flex: 1; border: 0; outline: none; padding: 9px 12px; font: inherit; font-size: 13.5px; min-width: 0; }
    .cs__btn { border: 1px solid #2691a4; background: #2691a4; color: #fff; border-radius: 8px; padding: 9px 20px; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .cs__btn:hover { background: #227d8d; }
    .cs__wrap { overflow-x: auto; border: 1px solid #e4e7ec; border-radius: 10px; }
    .cs__table { width: 100%; border-collapse: collapse; font-size: 13.5px; table-layout: auto; }
    .cs__table td { overflow-wrap: anywhere; }
    .cs__table th { text-align: start; background: #f8f9fc; color: #64748b; font-size: 12px; text-transform: uppercase; padding: 10px 14px; white-space: nowrap; }
    .cs__table td { padding: 11px 14px; border-top: 1px solid #f1f5f9; }
    .cs__table tbody tr { cursor: pointer; }
    .cs__table tbody tr:hover td { background: #f0fafb; }
    .cs__empty { text-align: center; color: #94a3b8; padding: 28px !important; cursor: default; }
  `],
})
export class CustomerAdvancedSearchModalComponent implements OnInit {
  ref = inject<ModalRef<CustomerMini | null>>(MODAL_REF);
  private customers = inject(CustomersService);
  private lang = inject(LanguageService);

  readonly fields = FIELDS;
  fieldOptions = signal(FIELDS.map(f => ({ value: f, label: '' })));
  fieldOf = () => this.fieldOptions().find(o => o.value === this.field()) ?? null;
  fieldLabel = (o: { value: SearchField }) => (o ? this.lang.instant('CUSTOMERS.SEARCH.FIELD_' + o.value) : '');
  sameField = (a: any, b: any) => a?.value === b?.value;
  readonly limit = 10;
  field = signal<SearchField>('all');
  term = signal('');
  page = signal(1);
  count = signal<number | null>(null);
  rows = signal<any[]>([]);
  loading = signal(false);

  ngOnInit(): void { void this.load(); }

  search(): void { this.page.set(1); void this.load(); }
  goTo(p: number): void { this.page.set(p); void this.load(); }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.customers.getCustomerMiniList({
        page: this.page(), limit: this.limit, searchTerm: this.term(), sortBy: {},
      });
      let list: any[] = data?.list ?? [];
      const f = this.field();
      const t = this.term().trim().toLowerCase();
      if (f !== 'all' && t) list = list.filter(r => String(r[f] ?? '').toLowerCase().includes(t));
      this.rows.set(list);
      this.count.set(data?.count ?? list.length);
    } finally {
      this.loading.set(false);
    }
  }

  pick(r: any): void {
    this.ref.close({
      id: r.id, name: r.name, phone: r.phone ?? '', email: r.email ?? '', paymentTerm: r.paymentTerm,
      displayName: r.saluation ? `${r.saluation} ${r.name}` : r.name,
    });
  }
}
