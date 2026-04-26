import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';
import { TranslateModule } from '@ngx-translate/core';

import { FindBranchPopoverComponent } from '../find-branch-popover/find-branch-popover.component';
import { BranchTabRef, BranchTabsService } from './branch-tabs.service';

const VISIBLE_TABS = 5;

/**
 * branch-tabs
 * ───────────
 * Horizontal tab strip for the branch selector — replaces the previous
 * dropdown picker. Up to 5 tabs render side-by-side; everything beyond
 * that lives behind the right-side "Find branch" trigger which opens a
 * searchable popover (pinned + recent + all sections).
 *
 * Selection state is owned by `BranchTabsService` so it survives across
 * navigations and (selectively) page reloads. The parent passes the live
 * branch directory via `[branches]` and reacts to `(activeChange)` to
 * sync its own per-branch FormGroup focus.
 */
@Component({
  selector: 'app-pf-branch-tabs',
  standalone: true,
  imports: [CommonModule, OverlayModule, TranslateModule, FindBranchPopoverComponent],
  templateUrl: './branch-tabs.component.html',
  styleUrl: './branch-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchTabsComponent {
  private store = inject(BranchTabsService);

  /** Live branch directory pushed from the parent. */
  branches = input.required<ReadonlyArray<BranchTabRef>>();

  /** Emits whenever the active branch changes — parent uses it to swap FormGroups. */
  activeChange = output<string>();

  popoverOpen = signal<boolean>(false);

  @ViewChild('findTrigger') findTrigger?: ElementRef<HTMLButtonElement>;

  constructor() {
    // Push the directory into the store whenever the input changes. The
    // store handles eviction of stale ids and first-load seeding internally.
    effect(() => {
      const list = this.branches();
      this.store.setDirectory(list ?? []);
    });

    // Bridge: emit the active id every time it changes so the parent can
    // swap its active FormGroup. Skipping null avoids spurious emissions
    // during the brief window between directory replace + reseed.
    effect(() => {
      const id = this.store.activeTabId();
      if (id) this.activeChange.emit(id);
    });
  }

  // ── Derived state ────────────────────────────────────────────────
  openTabs = this.store.openTabs;
  activeId = this.store.activeTabId;

  visibleTabs = computed<BranchTabRef[]>(() => this.openTabs().slice(0, VISIBLE_TABS));
  hiddenCount = computed<number>(() => Math.max(0, this.branches().length - this.visibleTabs().length));

  /** Compact mode flag — when 6–8 tabs are open, names ellipsize and shrink. */
  compact = computed<boolean>(() => this.openTabs().length > VISIBLE_TABS);

  // ── Actions ──────────────────────────────────────────────────────
  selectTab(id: string): void { this.store.setActive(id); }

  closeTab(ev: Event, id: string): void {
    ev.stopPropagation();
    this.store.closeTab(id);
  }

  togglePopover(): void { this.popoverOpen.update((v) => !v); }
  closePopover(): void { this.popoverOpen.set(false); }

  isActive(id: string): boolean { return this.activeId() === id; }

  // ── Keyboard shortcuts ──────────────────────────────────────────
  /**
   * Globally-bound shortcuts. Skipped when the user is typing into a form
   * input / textarea / contenteditable — otherwise typing branch names
   * elsewhere on the page would steal Cmd+K and friends.
   */
  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (this.shouldSkipShortcut(ev.target)) return;

    const cmd = ev.metaKey || ev.ctrlKey;
    if (!cmd) return;

    // Cmd/Ctrl + K — open the find popover.
    if (ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      this.popoverOpen.set(true);
      return;
    }

    // Cmd/Ctrl + 1..5 — jump to tab N.
    if (ev.key >= '1' && ev.key <= '5') {
      const idx = Number(ev.key) - 1;
      const tab = this.openTabs()[idx];
      if (tab) {
        ev.preventDefault();
        this.store.setActive(tab.id);
      }
      return;
    }

    // Cmd/Ctrl + W — close active tab. Browsers intercept this in regular
    // tabs; the handler still runs in PWA / standalone mode where the
    // browser yields the shortcut.
    if (ev.key.toLowerCase() === 'w') {
      const active = this.activeId();
      if (active) {
        ev.preventDefault();
        this.store.closeTab(active);
      }
    }
  }

  private shouldSkipShortcut(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (target.isContentEditable) return true;
    // Don't fire when focus is inside the popover's own search field either.
    if (target.closest('.cdk-overlay-pane')) return true;
    return false;
  }
}
