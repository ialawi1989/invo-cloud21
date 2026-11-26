import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  contentChild,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { SettingsModeService } from '../../../core/layout/services/settings-mode.service';
import { LanguageService } from '../../../core/i18n/language.service';

import {
  BreadcrumbItem,
  BreadcrumbSeparator,
} from './breadcrumbs.types';

/**
 * BreadcrumbsComponent
 * ────────────────────
 * A modern, accessible breadcrumb trail. Renders a sequence of links / labels
 * with chevron (or slash / dot) separators, last item marked as the current
 * page via `aria-current="page"`.
 *
 * Two ways to provide the trail:
 *
 *   1. Pass everything in `[items]` — the **last** item is treated as the
 *      current page (no link, semantic emphasis).
 *
 *   2. Pass parents in `[items]` AND a separate `[current]` label. The
 *      `current` value is appended automatically as the last segment.
 *
 * Each item navigates via:
 *   • `routerLink` (Angular Router) — internal nav, with optional `queryParams`
 *   • `href`                         — external link
 *   • or neither, in which case `(itemClick)` fires
 *
 * Slot:
 *   `<ng-template #item let-item let-isCurrent="isCurrent">…</ng-template>`
 *   gives full control over how each segment renders.
 */
@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './breadcrumbs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbsComponent {
  // ── Inputs ─────────────────────────────────────────────────────────────────

  /** Trail of breadcrumb items. The last item is the current page unless `current` is set. */
  items = input<BreadcrumbItem[]>([]);

  /**
   * Optional current-page label. When provided it is appended to `items` as
   * the final segment, so callers can keep `items` as the parent trail.
   */
  current = input<string | null>(null);

  /** Separator style between segments. */
  separator = input<BreadcrumbSeparator>('chevron');

  /**
   * Maximum visible items. When the trail exceeds this, middle items are
   * collapsed into a single `…` and the first + last few segments stay
   * visible. Set to `0` to disable collapsing (default).
   */
  maxItems = input<number>(0);

  /** Extra classes for the root nav element. */
  navClass = input<string>('');

  /**
   * On narrow screens, replace the trail with a single "back to parent" link.
   *
   * A full trail on a phone either wraps to two lines or truncates every
   * segment into uselessness, and the only action anyone takes from it there
   * is "go up one level" — which is what the platform back convention is.
   * Set false to keep the wrapped trail on mobile too.
   */
  mobileBack = input<boolean>(true);

  /**
   * True when `items` are only the PARENTS of the current page (what `<app-page-header>` passes — the page's own title is
   * shown right below, so it is not a crumb). Then no crumb is "the current page": the last one is a normal link.
   */
  trailIsParents = input<boolean>(false);

  // ── Outputs ────────────────────────────────────────────────────────────────
  itemClick = output<BreadcrumbItem>();

  // ── Projected templates ────────────────────────────────────────────────────
  itemTpl = contentChild<TemplateRef<{ $implicit: BreadcrumbItem; isCurrent: boolean }>>('item');

  // ── Derived state ──────────────────────────────────────────────────────────

  /** Items with the optional `current` appended as the last segment. */
  fullItems = computed<BreadcrumbItem[]>(() => {
    const base = this.items();
    const cur = this.current();
    return this.settingsTrail(cur == null ? base : [...base, { label: cur }]);
  });

  private readonly settings = inject(SettingsModeService);
  private readonly translate = inject(TranslateService);
  private readonly lang = inject(LanguageService);
  /** Bumped once the lazy 'settings' strings arrive, so a trail built before they loaded re-reads its labels. */
  private readonly i18nTick = signal(0);
  private settingsLoading = false;

  /** Group / "Settings" labels live in the lazy 'settings' namespace: load it on demand instead of showing the raw key. */
  private settingsLabel(key: string): string {
    this.i18nTick();
    const t = this.translate.instant(key);
    if (t === key && !this.settingsLoading) {
      this.settingsLoading = true;
      void this.lang.loadFeature('settings').catch(() => {}).then(() => this.i18nTick.update(n => n + 1));
    }
    return t;
  }

  /**
   * Inside the settings shell the trail reads "Settings › <Group>" and no longer repeats the page's own title (the crumb
   * right after "Settings"): the rail already shows which tile is open. A detail page keeps its extra crumb
   * ("Settings › Group › Edit"). Outside settings mode — or on a full-page layout — the trail is untouched.
   */
  private settingsTrail(items: BreadcrumbItem[]): BreadcrumbItem[] {
    if (!this.settings.crumbsInShell()) return items;
    const group = this.settings.activeGroup();
    const parents = this.trailIsParents();
    if (!group || (!parents && items.length < 2)) return items;
    const first = this.settings.targetFor(group);
    const groupCrumb: BreadcrumbItem = { label: this.settingsLabel(group.title), routerLink: first?.link, queryParams: first?.queryParams };
    const settingsCrumb: BreadcrumbItem = { label: this.settingsLabel('SETTINGS.TITLE'), routerLink: '/settings' };
    const s = items.findIndex(i => i.routerLink === '/settings');
    if (parents) {
      // Parents only (the page title is below): Settings › Group, then whatever parent crumbs followed "Settings".
      if (s >= 0) return [...items.slice(0, s + 1), groupCrumb, ...items.slice(s + 1)];
      return [settingsCrumb, groupCrumb, ...items.slice(1)]; // a tile that lives elsewhere (/promotions/*): its own first crumb is the feature
    }
    if (s >= 0) return [...items.slice(0, s + 1), groupCrumb, ...items.slice(s + 2)];
    return [settingsCrumb, groupCrumb, ...items.slice(2)];
  }

  /**
   * The visible items, after optional collapsing. Collapsed groups are
   * represented by a sentinel item with `label === '…'` and no link/href.
   */
  visibleItems = computed<BreadcrumbItem[]>(() => {
    const items = this.fullItems();
    const max = this.maxItems();
    if (max <= 0 || items.length <= max) return items;

    // Keep the first item, an ellipsis, and the last `max - 2` items.
    const tailCount = Math.max(1, max - 2);
    const ellipsis: BreadcrumbItem = { label: '…' };
    return [items[0], ellipsis, ...items.slice(items.length - tailCount)];
  });

  /**
   * The nearest navigable ancestor — what the mobile back link points at.
   * Skips the current page and any ellipsis sentinel, and requires something
   * to navigate to; returns null when there's no parent worth linking.
   */
  parentItem = computed<BreadcrumbItem | null>(() => {
    const items = this.visibleItems();
    for (let i = items.length - (this.trailIsParents() ? 1 : 2); i >= 0; i--) {
      const item = items[i];
      if (item.label === '…') continue;
      if (item.routerLink || item.href) return item;
    }
    return null;
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  isCurrent(index: number): boolean {
    return !this.trailIsParents() && index === this.visibleItems().length - 1;
  }

  isEllipsis(item: BreadcrumbItem): boolean {
    return item.label === '…' && !item.routerLink && !item.href;
  }

  /** True if the item should render as a clickable link (not the current page, not an ellipsis). */
  isLinkable(item: BreadcrumbItem, index: number): boolean {
    if (this.isEllipsis(item)) return false;
    if (this.isCurrent(index)) return false;
    return !!item.routerLink || !!item.href || true; // also true for click-handler-only items
  }

  onItemClick(item: BreadcrumbItem, index: number, event: Event): void {
    if (this.isEllipsis(item) || this.isCurrent(index)) {
      event.preventDefault();
      return;
    }
    // Always emit so consumers can react. RouterLink/href still navigate normally.
    this.itemClick.emit(item);
  }
}
