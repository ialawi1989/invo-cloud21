import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { TrackingMapService } from '../../services/tracking-map.service';
import { CurrentOrder, Driver, DriverActivity } from '../../services/tracking-map.types';

@Component({
  selector: 'app-driver-list',
  standalone: true,
  imports: [RouterLink, TranslateModule, MycurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './driver-list.component.html',
  styleUrl: './driver-list.component.scss',
})
export class DriverListComponent {
  readonly tracking = inject(TrackingMapService);

  readonly drivers = this.tracking.listDrivers;
  readonly selectedDriverId = this.tracking.selectedDriverId;

  select(driverId: string): void {
    this.tracking.selectDriver(this.selectedDriverId() === driverId ? null : driverId);
  }

  activityLabel(activity: DriverActivity): string {
    switch (activity) {
      case 'to-customer': return 'TRACKING_MAP.ACTIVITY.TO_CUSTOMER';
      case 'to-restaurant': return 'TRACKING_MAP.ACTIVITY.TO_RESTAURANT';
      case 'just-delivered-an-order': return 'TRACKING_MAP.ACTIVITY.JUST_DELIVERED';
      default: return 'TRACKING_MAP.ACTIVITY.IDLE';
    }
  }

  /** Short one-line label for an order row under the selected driver. */
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
    return this.tracking.branches().find(b => b.id === branchId)?.name;
  }

  trackById(_index: number, driver: Driver): string {
    return driver.id;
  }

  trackByOrderId(_index: number, order: CurrentOrder): string {
    return order.id;
  }
}
