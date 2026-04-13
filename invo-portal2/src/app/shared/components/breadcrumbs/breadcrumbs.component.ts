import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  contentChild,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

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

  // ── Outputs ────────────────────────────────────────────────────────────────
  itemClick = output<BreadcrumbItem>();

  // ── Projected templates ────────────────────────────────────────────────────
  itemTpl = contentChild<TemplateRef<{ $implicit: BreadcrumbItem; isCurrent: boolean }>>('item');

  // ── Derived state ──────────────────────────────────────────────────────────

  /** Items with the optional `current` appended as the last segment. */
  fullItems = computed<BreadcrumbItem[]>(() => {
    const base = this.items();
    const cur = this.current();
    if (cur == null) return base;
    return [...base, { label: cur }];
  });

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

  // ── Helpers ────────────────────────────────────────────────────────────────

  isCurrent(index: number): boolean {
    return index === this.visibleItems().length - 1;
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
