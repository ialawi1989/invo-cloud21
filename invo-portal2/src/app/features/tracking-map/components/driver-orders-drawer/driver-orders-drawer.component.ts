import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { CurrentOrder, Driver } from '../../services/tracking-map.types';

export interface DriverOrdersDrawerData {
  driver: Driver;
  /** Resolves a branch id to its display name — the driver's orders only carry the id. */
  branchNameFor: (branchId: string) => string | undefined;
}

/**
 * Shows one driver's active orders in a side drawer instead of an inline
 * expanding sublist under their row — keeps the driver list compact and
 * gives the order details (invoice, status, total) more room to breathe.
 */
@Component({
  selector: 'app-driver-orders-drawer',
  standalone: true,
  imports: [RouterLink, TranslateModule, MycurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './driver-orders-drawer.component.html',
  styleUrl: './driver-orders-drawer.component.scss',
})
export class DriverOrdersDrawerComponent {
  readonly data = inject<DriverOrdersDrawerData>(MODAL_DATA);
  private readonly modalRef = inject<ModalRef<void>>(MODAL_REF);

  get driver(): Driver {
    return this.data.driver;
  }

  /** Close the drawer before the invoice-detail route navigation takes over. */
  goToInvoice(): void {
    this.modalRef.dismiss();
  }

  activityLabel(): string {
    switch (this.driver.activity) {
      case 'to-customer': return 'TRACKING_MAP.ACTIVITY.TO_CUSTOMER';
      case 'to-restaurant': return 'TRACKING_MAP.ACTIVITY.TO_RESTAURANT';
      case 'just-delivered-an-order': return 'TRACKING_MAP.ACTIVITY.JUST_DELIVERED';
      default: return 'TRACKING_MAP.ACTIVITY.IDLE';
    }
  }

  orderStatusLabel(order: CurrentOrder): string {
    switch (order.deliveryOrderStatus.trim().toLowerCase()) {
      case 'claim':
      case 'to restaurant':
        return 'TRACKING_MAP.ORDER_STATUS.TO_RESTAURANT';
      case 'delivered':
        return 'TRACKING_MAP.ORDER_STATUS.DELIVERED';
      default:
        return 'TRACKING_MAP.ORDER_STATUS.TO_CUSTOMER';
    }
  }

  branchNameFor(branchId: string): string | undefined {
    return this.data.branchNameFor(branchId);
  }

  trackByOrderId(_index: number, order: CurrentOrder): string {
    return order.id;
  }
}
