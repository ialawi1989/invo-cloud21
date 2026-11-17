import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import type { MenuStatus } from '../../services/menu-builder.types';
import { formatClock } from '../../utils/menu-hours';

/**
 * A menu's state by its hours, as a badge with an icon AND a text label (never colour alone):
 *   ACTIVE "Active now" / SCHEDULED "Starts at 06:00" / ENDED "Ended at 22:00".
 * Presentational: the backend works the status out (in the branch's time zone); this only shows it.
 */
@Component({
  selector: 'app-menu-status-badge',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-status-badge.component.html',
})
export class MenuStatusBadgeComponent {
  status = input.required<MenuStatus>();
  /** The menu's own hours ("HH:mm[:ss]"): "Starts at" shows the start, "Ended at" the end. */
  startAt = input('00:00:00');
  endAt = input('23:59:00');
  use12h = input(false);
  locale = input('en');

  startLabel = computed(() => formatClock(this.startAt(), this.use12h(), this.locale()));
  endLabel = computed(() => formatClock(this.endAt(), this.use12h(), this.locale()));

  tone = computed(() => {
    switch (this.status()) {
      case 'ACTIVE':    return 'bg-emerald-50 text-emerald-800 ring-emerald-200 font-bold';
      case 'SCHEDULED': return 'bg-sky-50 text-sky-800 ring-sky-200 font-semibold';
      default:          return 'bg-slate-100 text-slate-600 ring-slate-200 font-medium';
    }
  });
}
