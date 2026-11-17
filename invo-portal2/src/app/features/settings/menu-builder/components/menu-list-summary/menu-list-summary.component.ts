import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import type { MenuSummary } from '../../services/menu-builder.types';

const NAMED = 3;

/**
 * A strip above the menu list: how many menus there are, how many are live now / start later / have ended (by their hours),
 * and which ones are live. Information only. Presentational: it shows the summary it is given.
 */
@Component({
  selector: 'app-menu-list-summary',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-list-summary.component.html',
})
export class MenuListSummaryComponent {
  summary = input<MenuSummary | null>(null);

  named = computed(() => (this.summary()?.active ?? []).slice(0, NAMED));
  more = computed(() => Math.max(0, (this.summary()?.active.length ?? 0) - NAMED));
}
