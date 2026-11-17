import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import type { MenuStatus } from '../../services/menu-builder.types';

/** The statuses that have a tab (what the hours say). */
const TAB_STATUSES: readonly MenuStatus[] = ['ACTIVE', 'SCHEDULED', 'ENDED'];

/** Tabs above the menu list: All, Active now, Scheduled, Ended, each with its count. A radiogroup: arrow keys move between them. */
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
  counts = input<Record<MenuStatus, number>>({ ACTIVE: 0, SCHEDULED: 0, ENDED: 0, DISABLED: 0 });
  /** Every menu (the "All" count). */
  total = input(0);
  valueChange = output<MenuStatus | null>();

  options = computed<Array<{ id: MenuStatus | null; key: string; count: number }>>(() => {
    const c = this.counts();
    return [
      { id: null, key: 'ALL', count: this.total() },
      ...TAB_STATUSES.map((s) => ({ id: s as MenuStatus | null, key: s, count: c[s] })),
    ];
  });

  select(id: MenuStatus | null): void {
    if (id !== this.value()) this.valueChange.emit(id);
  }

  onKey(e: KeyboardEvent, index: number): void {
    const rtl = document.dir === 'rtl' ? -1 : 1;
    const n = this.options().length;
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + rtl + n) % n;
    else if (e.key === 'ArrowLeft') next = (index - rtl + n) % n;
    else if (e.key === 'ArrowDown') next = (index + 1) % n;
    else if (e.key === 'ArrowUp') next = (index - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next < 0) return;
    e.preventDefault();
    this.select(this.options()[next].id);
    const group = (e.currentTarget as HTMLElement | null)?.parentElement;
    queueMicrotask(() => group?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus());
  }
}
