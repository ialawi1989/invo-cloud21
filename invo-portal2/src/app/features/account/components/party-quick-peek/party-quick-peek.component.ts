import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef, ModalService } from '@shared/modal/modal.service';

import { SuppliersService } from '../../suppliers/services/suppliers.service';
import { CustomersService } from '../../customers/services/customers.service';

export type PartyKind = 'supplier' | 'customer';

export interface PartyQuickPeekData {
  kind: PartyKind;
  id: string;
  /** Shown while the record loads. */
  name?: string;
}

/** Opens the quick-peek drawer for a supplier or customer (legacy `app-supplier-sidenav` / `app-customer-sidenav`). */
export function openPartyQuickPeek(modal: ModalService, kind: PartyKind, id: string | null | undefined, name?: string | null): void {
  if (!id) return;
  modal.open<PartyQuickPeekComponent, PartyQuickPeekData, void>(PartyQuickPeekComponent, {
    drawer: true,
    drawerWidth: '440px',
    drawerResizable: true,
    data: { kind, id, name: name ?? '' },
  });
}

/**
 * Read-only side panel of a supplier or customer: identity, outstanding / unused credit / last payment,
 * contact details and the five most recent bills (supplier) or invoices (customer), with View / Edit
 * shortcuts. One component serves both parties; only the endpoints and field names differ.
 */
@Component({
  selector: 'app-party-quick-peek',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './party-quick-peek.component.html',
  styleUrl: './party-quick-peek.component.scss',
})
export class PartyQuickPeekComponent implements OnInit {
  private ref = inject<ModalRef<void>>(MODAL_REF);
  readonly data = inject<PartyQuickPeekData>(MODAL_DATA);
  private router = inject(Router);
  private suppliers = inject(SuppliersService);
  private customers = inject(CustomersService);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly party = signal<any>(null);
  readonly overview = signal<any>(null);
  readonly lastPayment = signal<any>(null);
  readonly recent = signal<any[]>([]);

  readonly isSupplier = this.data.kind === 'supplier';
  private readonly base = this.isSupplier ? '/account/suppliers' : '/account/customers';

  /** The party's total still to be settled. */
  outstanding = (): number => (this.isSupplier
    ? this.overview()?.outStandingPayable ?? this.party()?.outStandingPayable
    : this.overview()?.outStandingRecivable) ?? 0;

  async ngOnInit(): Promise<void> {
    try {
      const { id } = this.data;
      const [party, overview, last, recent] = this.isSupplier
        ? await Promise.all([
            this.suppliers.getSupplier(id),
            this.suppliers.getSupplierOverView({ supplierId: id, interval: this.interval() }),
            this.suppliers.getLastPaymentMadeToSupplier(id),
            this.suppliers.getSupplierBillingsTransactions({ page: 1, limit: 5, supplierId: id }),
          ])
        : await Promise.all([
            this.customers.getCustomer(id),
            this.customers.getCustomerOverView({ customerId: id, branchId: null, filterType: 'all' }),
            this.customers.getCustomerLastPayment(id),
            this.customers.getCustomerInvoiceTransactions({ page: 1, limit: 5, customerId: id }),
          ]);
      this.party.set(party);
      this.overview.set(overview ?? {});
      this.lastPayment.set(last);
      this.recent.set(recent?.list ?? []);
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  /** Last six months, like the legacy panel. */
  private interval(): { from: string; to: string } {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth() - 6, to.getDate());
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { from: ymd(from), to: ymd(to) };
  }

  docNumber = (r: any): string => (this.isSupplier ? r.billingNumber : r.invoiceNumber) ?? '';
  docLink = (r: any): string[] => [this.isSupplier ? '/account/bills/view' : '/account/invoices/view', r.id];

  go(commands: string[]): void {
    this.ref.close();
    void this.router.navigate(commands);
  }
  view(): void { this.go([this.base, 'view', this.data.id]); }
  edit(): void { this.go([this.base, this.data.id]); }
}
