import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ModalRef, ModalService } from '@shared/modal/modal.service';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';
import { TrackingMapService } from '../../services/tracking-map.service';
import { Driver, DriverActivity } from '../../services/tracking-map.types';
import { DriverOrdersDrawerComponent } from '../driver-orders-drawer/driver-orders-drawer.component';

@Component({
  selector: 'app-driver-list',
  standalone: true,
  imports: [TranslateModule, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './driver-list.component.html',
  styleUrl: './driver-list.component.scss',
})
export class DriverListComponent {
  readonly tracking = inject(TrackingMapService);
  private readonly modal = inject(ModalService);

  readonly drivers = this.tracking.listDrivers;
  readonly selectedDriverId = this.tracking.selectedDriverId;

  /** Only the very first load — a background refresh with existing rows shouldn't flash the skeleton. */
  readonly showSkeleton = computed(() => this.tracking.loading() && this.drivers().length === 0);

  private openOrdersDrawer: ModalRef<void> | null = null;

  /** Selects the driver — centers/highlights them on the map, as before. */
  select(driverId: string): void {
    this.tracking.selectDriver(this.selectedDriverId() === driverId ? null : driverId);
  }

  /** Opens the driver's active orders in a side drawer. Called from the "N orders" badge only. */
  openOrders(driver: Driver, event: Event): void {
    event.stopPropagation();

    this.openOrdersDrawer?.dismiss();
    this.openOrdersDrawer = this.modal.open(DriverOrdersDrawerComponent, {
      drawer: true,
      drawerWidth: '380px',
      data: { driver, branchNameFor: (branchId: string) => this.branchNameFor(branchId) },
    });
    this.openOrdersDrawer.afterClosed().then(() => {
      this.openOrdersDrawer = null;
    });
  }

  activityLabel(activity: DriverActivity): string {
    switch (activity) {
      case 'to-customer': return 'TRACKING_MAP.ACTIVITY.TO_CUSTOMER';
      case 'to-restaurant': return 'TRACKING_MAP.ACTIVITY.TO_RESTAURANT';
      case 'just-delivered-an-order': return 'TRACKING_MAP.ACTIVITY.JUST_DELIVERED';
      default: return 'TRACKING_MAP.ACTIVITY.IDLE';
    }
  }

  branchNameFor(branchId: string): string | undefined {
    return this.tracking.branches().find(b => b.id === branchId)?.name;
  }

  trackById(_index: number, driver: Driver): string {
    return driver.id;
  }
}
