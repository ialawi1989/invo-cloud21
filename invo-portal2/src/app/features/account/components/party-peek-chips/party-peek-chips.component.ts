import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { ModalService } from '@shared/modal/modal.service';

import { PartyKind, openPartyQuickPeek } from '../party-quick-peek/party-quick-peek.component';

/** The id a document carries for a customer who isn't on file; there is nothing to peek at. */
const WALK_IN = 'WalkIn Customer';

/**
 * The "Supplier: X" / "Customer: Y" chips above a document view's paper (legacy `app-supplier-sidenav` /
 * `app-customer-sidenav`). Each opens the party quick-peek drawer. A party the document doesn't have - or the
 * walk-in customer - gets no chip, and with neither the component renders nothing. Project it into the view
 * shell with the `beforePaper` attribute.
 */
@Component({
  selector: 'app-party-peek-chips',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './party-peek-chips.component.html',
})
export class PartyPeekChipsComponent {
  private modal = inject(ModalService);

  supplierId = input<string | null | undefined>();
  supplierName = input<string | null | undefined>();
  customerId = input<string | null | undefined>();
  customerName = input<string | null | undefined>();

  hasSupplier = computed(() => !!this.supplierId());
  hasCustomer = computed(() => !!this.customerId() && this.customerId() !== WALK_IN);

  peek(kind: PartyKind): void {
    const supplier = kind === 'supplier';
    openPartyQuickPeek(this.modal, kind, supplier ? this.supplierId() : this.customerId(), supplier ? this.supplierName() : this.customerName());
  }
}
