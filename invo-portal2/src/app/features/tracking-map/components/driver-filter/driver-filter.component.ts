import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { DRIVER_FILTER_OPTIONS, DriverFilter } from '../../services/tracking-map.types';
import { TrackingMapService } from '../../services/tracking-map.service';

@Component({
  selector: 'app-driver-filter',
  standalone: true,
  imports: [SegmentedToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block;
      flex: 0 0 128px;
    }
  `],
  template: `
    <app-segmented-toggle
      [options]="options()"
      [value]="tracking.activeFilter()"
      [vertical]="true"
      size="sm"
      (valueChange)="tracking.setFilter($event)"
    />
  `,
})
export class DriverFilterComponent {
  readonly tracking = inject(TrackingMapService);

  readonly options = computed<SegmentedToggleOption<DriverFilter>[]>(() => {
    const counts = this.tracking.filterCounts();
    return DRIVER_FILTER_OPTIONS.map(o => ({ value: o.value, label: o.label, count: counts[o.value] }));
  });
}
