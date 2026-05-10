import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  effect,
  inject,
  input,
  model,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { RbfWidgetCoordinator } from './rbf-widget-coordinator.service';

/** Tab descriptor passed via `tabs` input. `id` is the slot key the
 *  parent uses to look up which body to render; `title` is the label
 *  shown on the tab pill. */
export interface RbfWidgetTab {
  id:    string;
  title: string;
}

/**
 * RbfWidgetComponent
 * ──────────────────
 * Adobe-style stackable panel: a header bar (title or tab strip + collapse
 * caret + drag handle) plus a content body projected via `<ng-content>`.
 * The widget can collapse to header-only and is draggable inside a parent
 * `cdkDropList` so the user can reorder panels in the rail.
 *
 * Modes:
 *   - **Single** (`tabs` empty or 1 entry, or `tabs` not bound) — header
 *     shows the `title` input; body is whatever the parent projects.
 *   - **Tabbed** (`tabs.length > 1`) — header shows a row of tab pills;
 *     `activeTabId` (two-way) tracks which is selected. The parent is
 *     responsible for rendering the right body content for the active
 *     tab inside the projected `<ng-content>`.
 *
 * Drag-reorder:
 *   - The host is a `cdkDrag`; the entire header doubles as the drag
 *     handle. Clicks inside the body (other than the header strip)
 *     don't trigger drags.
 *
 * Tab close:
 *   - Tabs in tabbed mode show a small × button. Clicking it emits
 *     `(tabClose)` with the tab id — parent unmerges the slot back into
 *     its own group.
 *
 * The widget is intentionally "dumb" about its content — it knows only
 * the title (or tab labels) and projects everything else.
 */
@Component({
  selector: 'app-rbf-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, CdkDragHandle, CdkDropList, CdkDrag, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="rbfw__header" [class.rbfw__header--draggable]="draggable()" [class.rbfw__header--tabbed]="isTabbed()" cdkDragHandle (click)="onHeaderClick($event)">
      @if (draggable()) {
        <span
          class="rbfw__handle"
          [attr.aria-label]="'COMMON.WIDGET_DRAG_HINT' | translate"
          [appTooltip]="'COMMON.WIDGET_DRAG_HINT' | translate"
          (click)="$event.stopPropagation()"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3"  y1="6"  x2="21" y2="6"/>
            <line x1="3"  y1="12" x2="21" y2="12"/>
            <line x1="3"  y1="18" x2="21" y2="18"/>
          </svg>
        </span>
      }

      @if (isTabbed()) {
        <!-- Tab strip — one pill per tab. The active pill is highlighted;
             clicking inactive switches active. The × button ungroups
             that tab. cdkDropList wraps the strip so the user can drag
             tabs left/right to reorder within the group; the
             cdkDragStartDelay keeps quick clicks (= switch tab) from
             triggering a drag. -->
        <div
          class="rbfw__tabs"
          role="tablist"
          cdkDropList
          cdkDropListOrientation="horizontal"
          (cdkDropListDropped)="onTabReorder($event)"
        >
          @for (tab of tabs(); track tab.id) {
            <button
              type="button"
              class="rbfw__tab"
              [class.rbfw__tab--on]="activeTabId() === tab.id"
              role="tab"
              [attr.aria-selected]="activeTabId() === tab.id"
              cdkDrag
              cdkDragLockAxis="x"
              [cdkDragStartDelay]="120"
              (click)="selectTab(tab.id, $event)"
            >
              <span class="rbfw__tab-label">{{ tab.title }}</span>
              <span
                class="rbfw__tab-close"
                role="button"
                tabindex="0"
                [attr.aria-label]="'COMMON.UNGROUP' | translate"
                [appTooltip]="'COMMON.UNGROUP' | translate"
                (click)="closeTab(tab.id, $event)"
              >×</span>
            </button>
          }
        </div>
      } @else {
        <h2 class="rbfw__title">{{ title() }}</h2>
      }

      <button
        type="button"
        class="rbfw__caret"
        [class.rbfw__caret--collapsed]="collapsed()"
        (click)="toggle(); $event.stopPropagation()"
        [attr.aria-label]="(collapsed()
          ? 'COMMON.EXPAND'
          : 'COMMON.COLLAPSE') | translate"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
    </header>
    <div class="rbfw__body" [class.rbfw__body--collapsed]="collapsed()">
      <ng-content/>
    </div>
  `,
  styleUrl: './rbf-widget.component.scss',
})
export class RbfWidgetComponent {
  /** Localised title shown in the header in single (non-tabbed) mode. */
  title = input.required<string>();

  /** Two-way bound collapsed state. Parent can pre-collapse via
   *  `[collapsed]="true"`, listen via `(collapsedChange)`, or use the
   *  banana-in-the-box `[(collapsed)]` shortcut. */
  collapsed = model<boolean>(false);

  /** Optional localStorage key. When set, the widget reads its
   *  initial collapsed state from `rbfw:<key>` on first render and
   *  writes back on every change. */
  storageKey = input<string>();

  /** Whether the widget is wired up for drag-to-reorder by its host. */
  draggable = input<boolean>(false);

  /** Tab descriptors. When 2+ entries are provided the header switches
   *  to tab-strip mode; otherwise the title is shown. Empty array (the
   *  default) keeps existing single-widget behaviour. */
  tabs = input<RbfWidgetTab[]>([]);

  /** Currently active tab id (two-way bound). Parent decides what body
   *  content to project based on this value. */
  activeTabId = model<string | undefined>(undefined);

  /** Emitted when the user clicks the × on a tab — parent should
   *  ungroup that slot back into its own widget. */
  @Output() tabClose = new EventEmitter<string>();

  /** Emitted after the user drags a tab to a new position within
   *  the strip. Indices are into the `tabs()` array; parent applies
   *  them to the underlying group's slot list. */
  @Output() tabReorder = new EventEmitter<{ previousIndex: number; currentIndex: number }>();

  isTabbed = computed<boolean>(() => this.tabs().length > 1);

  constructor() {
    queueMicrotask(() => {
      const key = this.storageKey();
      if (!key) return;
      try {
        const stored = localStorage.getItem('rbfw:' + key);
        if (stored !== null) this.collapsed.set(stored === '1');
      } catch { /* localStorage may be unavailable in some embeds */ }
    });

    effect(() => {
      const key = this.storageKey();
      const v = this.collapsed();
      if (!key) return;
      try { localStorage.setItem('rbfw:' + key, v ? '1' : '0'); }
      catch { /* swallow quota / disabled storage errors */ }
    });

    const coordinator = inject(RbfWidgetCoordinator);
    effect(() => {
      const cmd = coordinator.command();
      if (!cmd) return;
      const key = this.storageKey() ?? '';
      if (cmd.keyPrefix && !key.startsWith(cmd.keyPrefix)) return;
      this.collapsed.set(cmd.collapsed);
    });
  }

  toggle(): void { this.collapsed.update((v) => !v); }

  /** Header click — only toggles in non-tabbed mode. In tabbed mode the
   *  header is busy (tab strip) so we leave the caret as the only
   *  collapse trigger. */
  onHeaderClick(_event: Event): void {
    if (this.isTabbed()) return;
    this.toggle();
  }

  /** Switch active tab. Stops propagation so the header click (toggle)
   *  doesn't also fire. If the click was on the inactive tab while the
   *  widget is collapsed, expand it as a courtesy — clicking a tab
   *  pill clearly signals intent to view that tab. */
  selectTab(id: string, event: Event): void {
    event.stopPropagation();
    this.activeTabId.set(id);
    if (this.collapsed()) this.collapsed.set(false);
  }

  closeTab(id: string, event: Event): void {
    event.stopPropagation();
    this.tabClose.emit(id);
  }

  onTabReorder(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.tabReorder.emit({
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
    });
  }

  isCollapsed = computed<boolean>(() => this.collapsed());
}
