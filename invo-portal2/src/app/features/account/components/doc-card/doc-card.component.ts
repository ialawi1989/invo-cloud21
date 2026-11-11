import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { DocViewAdapter } from '../doc-views/doc-views.types';

/**
 * One document as a card — shared by the status board (full) and the calendar
 * (compact) of every document list. What it shows and what its buttons do come
 * from the document's {@link DocViewAdapter}, whose actions are the same central
 * rules the table uses, so the views cannot drift from the table.
 */
@Component({
  selector: 'app-doc-card',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe, DropdownMenuBtnComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './doc-card.component.html',
})
export class DocCardComponent {
  readonly row     = input.required<any>();
  readonly adapter = input.required<DocViewAdapter>();
  /** Single-line card for the calendar. */
  readonly compact = input<boolean>(false);
  /** Fired after a menu action that may have changed the document. */
  readonly changed = output<void>();

  readonly number = computed(() => this.row()[this.adapter().numberKey]);
  readonly ref    = computed(() => { const k = this.adapter().refKey; return k ? this.row()[k] : null; });
  readonly party  = computed(() => this.row()[this.adapter().partyKey]);
  readonly date   = computed(() => this.row()[this.adapter().dateKey]);
  readonly due    = computed(() => { const k = this.adapter().dueKey; return k ? this.row()[k] : null; });

  readonly status = computed<string | null>(() => {
    const a = this.adapter();
    return a.statusOf ? a.statusOf(this.row()) : (this.row().status ?? null);
  });

  /** A due / expiry date in the past on a document that is not settled yet. */
  readonly overdue = computed(() => {
    const due = this.due();
    if (!due) return false;
    const settled = this.adapter().settledStatuses ?? [];
    if (settled.includes(this.status() ?? '')) return false;
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return String(due).slice(0, 10) < `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });

  readonly chips = computed(() => this.adapter().chips?.(this.row()) ?? []);
  readonly canEdit = computed(() => this.adapter().canEdit(this.row()));
  readonly blockedReason = computed(() => this.canEdit() ? null : (this.adapter().editBlockedReason?.(this.row()) ?? null));
  readonly menu = computed<DropdownMenuBtnItem[]>(() => this.adapter().menu(this.row(), () => this.changed.emit()));

  view(): void { this.adapter().view(this.row()); }
  edit(): void { this.adapter().edit(this.row()); }
}
