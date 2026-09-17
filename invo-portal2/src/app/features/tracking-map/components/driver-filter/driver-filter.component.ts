import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DRIVER_FILTER_OPTIONS, DriverFilter } from '../../services/tracking-map.types';
import { TrackingMapService } from '../../services/tracking-map.service';

interface FilterChip {
  value: DriverFilter;
  label: string;
  count: number;
}

/**
 * Filter chips as a wrapping pill row (not a shared `app-segmented-toggle`,
 * which only lays out a single line or a full vertical stack — neither fits
 * 5 chips in a narrow sidebar without either overflowing or leaving a tall,
 * mostly-empty rail next to the driver list).
 */
@Component({
  selector: 'app-driver-filter',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './driver-filter.component.html',
  styleUrl: './driver-filter.component.scss',
})
export class DriverFilterComponent {
  readonly tracking = inject(TrackingMapService);

  readonly chips = computed<FilterChip[]>(() => {
    const counts = this.tracking.filterCounts();
    return DRIVER_FILTER_OPTIONS.map(o => ({ value: o.value, label: o.label, count: counts[o.value] }));
  });

  isActive(value: DriverFilter): boolean {
    return this.tracking.activeFilter() === value;
  }
}
