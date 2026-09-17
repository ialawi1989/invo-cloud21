import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LayoutService } from '@core/layout/services/layout.service';
import { BranchFilterComponent } from '../../components/branch-filter/branch-filter.component';
import { DriverFilterComponent } from '../../components/driver-filter/driver-filter.component';
import { DriverSearchComponent } from '../../components/driver-search/driver-search.component';
import { DriverListComponent } from '../../components/driver-list/driver-list.component';
import { DriverMapComponent } from '../../components/driver-map/driver-map.component';
import { TrackingMapService } from '../../services/tracking-map.service';
import { TrackingMapSocketService } from '../../services/tracking-map-socket.service';

/**
 * Root component for the driver tracking feature. Purely a layout/composition
 * shell — all state lives in `TrackingMapService`, so this component (and its
 * children) stay OnPush throughout.
 */
@Component({
  selector: 'app-tracking-map',
  standalone: true,
  imports: [TranslateModule, BranchFilterComponent, DriverFilterComponent, DriverSearchComponent, DriverListComponent, DriverMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tracking-map.component.html',
  styleUrl: './tracking-map.component.scss',
})
export class TrackingMapComponent implements OnInit, OnDestroy {
  readonly tracking = inject(TrackingMapService);
  private readonly socket = inject(TrackingMapSocketService);
  private readonly layoutSvc = inject(LayoutService);

  ngOnInit(): void {
    // Full-bleed, fixed-height page (no page padding/scroll) — same as
    // Content Library — so the map genuinely fills the viewport.
    this.layoutSvc.setNoPadding(true);
    this.socket.connect();
  }

  ngOnDestroy(): void {
    this.layoutSvc.setNoPadding(false);
    this.socket.disconnect();
  }
}
