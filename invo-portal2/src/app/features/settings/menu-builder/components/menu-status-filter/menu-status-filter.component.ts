import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { MENU_STATUSES, MenuStatus, MenuStatusCounts } from '../../services/menu-builder.types';

/** Filter chips above the list: All, Active now, Scheduled, Ended, Disabled, each with its count. A radiogroup (arrow keys move). */
@Component({
  selector: 'app-menu-status-filter',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-status-filter.component.html',
})
export class MenuStatusFilterComponent {
  /** The selected status; null = All. */
  value = input<MenuStatus | null>(null);
  counts = input<MenuStatusCounts>({ ACTIVE: 0, SCHEDULED: 0, ENDED: 0, DISABLED: 0 });
  valueChange = output<MenuStatus | null>();

  options = computed<Array<{ id: MenuStatus | null; key: string; count: number }>>(() => {
    const c = this.counts();
    const total = MENU_STATUSES.reduce((n, s) => n + c[s], 0);
    return [
      { id: null, key: 'ALL', count: total },
      ...MENU_STATUSES.map(s => ({ id: s as MenuStatus | null, key: s, count: c[s] })),
    ];
  });

  select(id: MenuStatus | null): void {
    if (id !== this.value()) this.valueChange.emit(id);
  }

  onKey(e: KeyboardEvent, index: number): void {
    const dir = document.dir === 'rtl' ? -1 : 1;
    const n = this.options().length;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + (e.key === 'ArrowRight' ? dir : 1) + n) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - (e.key === 'ArrowLeft' ? dir : 1) + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next < 0) return;
    e.preventDefault();
    this.select(this.options()[next].id);
    queueMicrotask(() => (e.currentTarget as HTMLElement | null)?.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus());
  }
}
