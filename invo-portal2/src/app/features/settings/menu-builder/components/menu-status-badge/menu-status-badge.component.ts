import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import type { MenuStatus } from '../../services/menu-builder.types';
import { formatClock } from '../../utils/menu-hours';

/**
 * The state of one menu as a badge: an icon AND a text label (never colour alone).
 *   ACTIVE    "Active now"        SCHEDULED "Starts at 06:00"
 *   ENDED     "Ended at 22:00"    DISABLED  "Off"
 * Presentational: it formats what it is given and never computes the status (the backend does, in the branch's zone).
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
  /** ISO instant of the next start/end, for the tooltip. */
  nextChangeAt = input<string | null>(null);
  /** IANA zone the hours are in (for the tooltip's time). */
  timeZone = input('');
  use12h = input(false);
  locale = input('en');

  startLabel = computed(() => formatClock(this.startAt(), this.use12h(), this.locale()));
  endLabel = computed(() => formatClock(this.endAt(), this.use12h(), this.locale()));

  /** "Changes at 22:00" in the branch zone, or '' when nothing is scheduled. */
  changeHint = computed(() => {
    const iso = this.nextChangeAt();
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(this.locale(), {
        hour: '2-digit', minute: '2-digit', hour12: this.use12h(), timeZone: this.timeZone() || undefined,
      }).format(d);
    } catch { return ''; }
  });

  /** Tailwind classes per status (text + tint; the icon and label carry the meaning). */
  tone = computed(() => {
    switch (this.status()) {
      case 'ACTIVE':    return 'bg-emerald-50 text-emerald-800 ring-emerald-200 font-bold';
      case 'SCHEDULED': return 'bg-sky-50 text-sky-800 ring-sky-200 font-semibold';
      case 'ENDED':     return 'bg-slate-100 text-slate-600 ring-slate-200 font-medium';
      default:          return 'bg-rose-50/60 text-rose-700 ring-rose-200 font-medium';
    }
  });
}
