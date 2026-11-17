import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * "Active now: Dine-in Menu, Delivery Menu · 2 of 41", or a warning when nothing is live. Names are links:
 * the container scrolls to / filters to that menu. Presentational.
 */
@Component({
  selector: 'app-menu-status-summary',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-status-summary.component.html',
})
export class MenuStatusSummaryComponent {
  active = input<Array<{ id: string; name: string }>>([]);
  total = input(0);
  /** Hours are shown in this zone ("Asia/Riyadh"); empty hides the hint. */
  timeZone = input('');
  loaded = input(true);

  menuClick = output<string>();
  showScheduled = output<void>();
}
