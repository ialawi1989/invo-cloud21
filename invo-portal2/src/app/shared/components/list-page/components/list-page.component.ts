import { EmptyStateComponent } from '../../empty-state/empty-state.component';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  OnInit,
  OnDestroy,
  signal,
  computed,
  effect,
  ContentChildren,
  QueryList,
  TemplateRef,
  ElementRef,
  ViewChild,
  inject,
  ChangeDetectionStrategy,
  HostBinding,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, catchError, of, tap, from, isObservable } from 'rxjs';

// Interfaces
import {
  TableColumn,
  ListQueryParams,
  ListResponse,
  FilterConfig,
  ActionConfig,
  BulkActionConfig,
  PaginationConfig,
  SearchConfig,
  SortingConfig,
  EmptyStateConfig,
  FilterState,
  ListPageState,
  RowClickEvent,
  ActionClickEvent,
  SelectionChangeEvent,
  SortChangeEvent,
  FilterChangeEvent,
  PageChangeEvent,
  MobileCardConfig,
  ListTreeConfig,
  ListRowNode,
  TreeNodeState,
  GalleryViewConfig
} from '../interfaces/list-page.types';

// Directives
import {
  ListCellTemplateDirective,
  ListHeaderTemplateDirective,
  ListRowActionsDirective,
  ListMobileThumbDirective,
  ListMobileTitleDirective,
  ListMobileChipDirective,
  ListGalleryCardDirective,
  ListRowDetailDirective
} from '../directives/list-template.directives';

// FilterModal - MUST be relative import from same folder
import { FilterModalComponent, FilterModalData, FilterModalResult } from './filter-modal.component';
import { ModalService } from '../../../modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '../../../modal/demo/confirm-modal.component';
import { CustomizeColumnsModalComponent, CustomizeColumnsData } from './customize-columns-modal.component';
import { PaginationComponent } from '../../pagination';
import { onDemandChrome, pageChrome, pageInfoFromResponse, resolvePage } from '../utils/page-info';
import { CountState, DeferredCount } from '../utils/deferred-count';
import { COUNT_TIMEOUT_MS, CountMode, listPageConfig, MAX_PAGE_LIMIT } from '../list-page.config';
import { OnDemandCount, OnDemandState } from '../utils/on-demand-count';
import { recordListMetric } from '../utils/list-metrics';
import { BreadcrumbsComponent, BreadcrumbItem } from '../../breadcrumbs';
import { ListPreferencesService } from '../../../../core/layout/services/list-preferences.service';
import { ListColumnPref } from '../../../../core/layout/services/employee-options.service';
import { LayoutService } from '../../../../core/layout/services/layout.service';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { ListFilterBarComponent, ListFilterChange } from './list-filter-bar/list-filter-bar.component';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '../../dropdown-menu-btn/dropdown-menu-btn.component';
import { SegmentedToggleComponent } from '../../segmented-toggle/segmented-toggle.component';

// Utilities
import {
  ListUrlStateHelper,
  ColumnHelper,
  FilterHelper,
  SelectionHelper,
  HighlightHelper
} from '../utils/list-helpers';

/**
 * Reusable List Page Component
 *
 * A comprehensive, configurable component for displaying lists with:
 * - Search, filters, sorting, pagination
 * - Bulk actions and row selection
 * - Custom cell templates
 * - URL state synchronization
 * - Mobile responsive (auto-switches to cards)
 * - Integration with existing components and services
 *
 * @example
 * <app-list-page
 *   [columns]="columns"
 *   [dataSource]="loadData"
 *   [pagination]="{ enabled: true }"
 *   [search]="{ enabled: true }">
 * </app-list-page>
 */
@Component({
  selector: 'app-list-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EmptyStateComponent,
    ListCellTemplateDirective,
    ListRowActionsDirective,
    ListMobileThumbDirective,
    ListMobileTitleDirective,
    ListMobileChipDirective,
    ListGalleryCardDirective,
    FilterModalComponent,
    PaginationComponent,
    BreadcrumbsComponent,
    TranslateModule,
    TooltipDirective,
    ListFilterBarComponent,
    DropdownMenuBtnComponent,
    SegmentedToggleComponent
  ],
  templateUrl: './list-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    /* Custom elements have no display rule in the UA stylesheet — without this,
       <app-list-page> defaults to inline and its card can render narrower than
       sibling block content (a title row, a toolbar) instead of matching its
       parent's width. Consumers opting into [fitContent] override this to
       flex via the :host(.lp-host-fullbleed) rule below; this is just the
       base case every other consumer relies on implicitly. */
    :host {
      display: block;
      width: 100%;
      /* A flex child (the routed host, the full-bleed shell) must be allowed to be narrower than its content,
         otherwise a wide table widens the whole page instead of scrolling inside its card. */
      min-width: 0;
      max-width: 100%;
      /* Density tokens - Comfortable by default; the root attribute data-density (My Account > Preferences)
         switches them for every list. Colours come from the global --ui-* tokens so dark mode needs no change. */
      --lp-control-h: 36px;
      --lp-row-py: 14px;
      --lp-pad-x: 16px;
      --lp-gap: 8px;
      --lp-page-px: 24px;      /* page side padding */
      --lp-page-pb: var(--lp-page-px);   /* page bottom padding = the side padding */
      --lp-foot-py: 10px;      /* footer vertical padding */
      --lp-head-pt: 14px;      /* space above the page header block */
      --lp-head-pb: 12px;      /* space below it */
      --lp-th-h: 44px;         /* table header row height */
      --lp-toolbar-py: 12px;   /* toolbar vertical padding */
      --lp-row-ctl: 36px;      /* row "Edit" pill height */
      --lp-row-btn: 32px;      /* row kebab size */
      --lp-accent: var(--ui-brand-t700, #207484);
      --lp-on-accent: var(--ui-on-accent, #fff);
      --lp-accent-soft: var(--ui-brand-soft, #ecfeff);
      --lp-focus: var(--ui-brand-t700, #207484);
    }
    :host-context([data-density="compact"]) {
      --lp-control-h: 32px;
      --lp-row-py: 6px;
      --lp-pad-x: 12px;
      --lp-gap: 6px;
      --lp-page-px: 12px;
      --lp-foot-py: 8px;
      --lp-head-pt: 10px;
      --lp-head-pb: 10px;
      --lp-th-h: 36px;
      --lp-toolbar-py: 8px;
      --lp-row-ctl: 28px;
      --lp-row-btn: 28px;
    }

    /* ── Sticky columns (checkbox + primary on the start edge, actions
       on the end edge) ─────────────────────────────────────────────────
       Keep the sticky cells opaque so rows underneath don't bleed through
       when the user scrolls horizontally, and match the row hover colour
       so the sticky cells don't look out of place on hover. */
    /* ONE opaque colour per row, in every state: --lp-row-bg. The row, the frozen cells (start + Actions) and the end of
       the edge fades all read it, so they can never disagree. It is always an opaque colour (a tint mixed with the
       surface), never a translucent one: scrolling content must not show through a frozen cell. */
    tr { --lp-row-bg: var(--ui-surface); }
    tr.list-row:hover { --lp-row-bg: var(--ui-x-f4fbfb); }
    tr.list-row-expanded { --lp-row-bg: var(--ui-x-ecfafd); }
    tr.list-child-row { --lp-row-bg: var(--ui-x-f5fdfd); }
    /* The row a screen has open elsewhere (e.g. a details drawer), set through [rowClass]. A tint, never an edge stripe. */
    tr.lp-row--active, tr.lp-row--active:hover { --lp-row-bg: var(--ui-selected); }
    tr.lp-row--active > td { background-color: var(--lp-row-bg); }
    tr.list-child-row:hover { --lp-row-bg: var(--ui-x-ecfafd); }
    tr.lp-intree { --lp-row-bg: var(--lp-tint); }
    tr.lp-intree.list-row:hover { --lp-row-bg: color-mix(in srgb, var(--lp-accent) 18%, var(--ui-surface)); }
    .list-sticky-cell,
    .list-floating-actions {
      background-color: var(--lp-row-bg);
      transition: background-color 150ms ease;
    }

    /* Drop shadow CAST BY the frozen start (primary) column ONTO the scrolling
       content to its right — sits just outside the cell's end edge
       (translateX 100%), darkest at the seam, fading away. The frozen column
       keeps overflow:visible so this isn't clipped. A pseudo-element (not
       box-shadow) because Tailwind's collapsed table borders suppress cell
       box-shadows. Revealed only once scrolled (.list-has-scroll-start). */
    .list-sticky-col::after {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      inset-inline-end: 0;
      /* Wider + gentler multi-stop falloff so the edge reads as a soft shadow
         (Wix-style) rather than a hard line. */
      width: 30px;
      transform: translateX(100%);
      background: linear-gradient(to right, rgba(15, 23, 42, 0.13), rgba(15, 23, 42, 0.04) 45%, rgba(15, 23, 42, 0));
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
      z-index: 4;
    }
    .list-has-scroll-start .list-sticky-col::after { opacity: 1; }
    :host-context([dir="rtl"]) .list-sticky-col::after {
      transform: translateX(-100%);
      background: linear-gradient(to left, rgba(15, 23, 42, 0.13), rgba(15, 23, 42, 0.04) 45%, rgba(15, 23, 42, 0));
    }

    /* Pinned Actions. The CELL is solid (the row's own colour, --lp-row-bg), so the kebab and the hover "Edit" pill
       always sit on an opaque surface and the reserved --lp-actions-w never changes. Content that scrolls under it does
       not stop at a hard edge: a gradient just OUTSIDE the cell's inline-start edge fades from transparent into the
       row colour. It only shows while something is actually hidden under the column (.lp-overflow-end), so a table
       that fits has no fade over its last column. pointer-events: none: it never blocks a click or covers a focus ring
       (scroll-padding below also keeps focused cells clear of it). */
    .list-floating-actions,
    .list-actions-th { --lp-fade-w: 40px; --lp-fade-dir: to right; }
    :host-context([dir="rtl"]) .list-floating-actions,
    :host-context([dir="rtl"]) .list-actions-th { --lp-fade-dir: to left; }
    .list-floating-actions::before,
    .list-actions-th::before {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      inset-inline-start: calc(-1 * var(--lp-fade-w));
      inline-size: var(--lp-fade-w);
      background: linear-gradient(var(--lp-fade-dir), transparent, var(--lp-row-bg));
      pointer-events: none;
      opacity: 0;
      transition: opacity 150ms ease;
    }
    /* The header cell fades into the header colour, not the row colour. */
    .list-actions-th::before { background: linear-gradient(var(--lp-fade-dir), transparent, var(--ui-surface-1)); }
    .lp-overflow-end .list-floating-actions::before,
    .lp-overflow-end .list-actions-th::before { opacity: 1; }
    @media (prefers-reduced-motion: reduce) {
      .list-floating-actions::before, .list-actions-th::before, .list-sticky-cell, .list-floating-actions { transition: none; }
    }

    /* The table body scrolls INSIDE this host (both axes). Its height is capped
       to the viewport by the component (recomputeScrollMaxHeight, bound inline
       as max-height) so the page itself doesn't scroll past the header — that's
       what lets the thead stay stuck to the top on vertical scroll while the
       frozen start/actions columns stay put on the horizontal axis. The native
       HORIZONTAL bar stays hidden (the fixed phantom below is its control); the
       VERTICAL bar is shown for the inner scroll. */
    .list-page-container .overflow-x-auto {
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--ui-line-strong) transparent;
    }
    /* WebKit/Blink: slim vertical bar, no horizontal bar (phantom drives it). */
    .list-page-container .overflow-x-auto::-webkit-scrollbar { width: 10px; height: 0; }
    .list-page-container .overflow-x-auto::-webkit-scrollbar:horizontal { display: none; }
    .list-page-container .overflow-x-auto::-webkit-scrollbar-thumb {
      background: var(--ui-line-strong);
      border-radius: 5px;
      border: 2px solid transparent;
      background-clip: padding-box;
    }

    /* Sticky column header — freezes to the top of the scroll host on vertical
       scroll. No z-index here on purpose: the frozen corner cells keep their
       higher (z-20) stacking from the sticky-column classes so they win at the
       start/end edges, while middle header cells are positioned (sticky) and
       therefore already paint above the scrolling body rows. The themed teal
       fill is opaque, so rows scroll cleanly underneath. */
    .list-page-container .overflow-x-auto thead th {
      position: sticky;
      /* -1px (not 0) closes the sub-pixel gap where a scrolling row peeks above
         the header on some zoom/DPR levels. The 1px is absorbed by the header's
         vertical padding, so the label doesn't visibly shift. */
      top: -1px;
    }

    /* ── Full-bleed (edge-to-edge) layout — opt-in via [fullBleed] ──────────
       Fills the viewport as a flex column: page header + toolbar + pagination
       keep their height, only the table scroll host flexes and scrolls. Pairs
       with the host page setting main-content to no-padding (a fixed-height
       flex column). All rules are scoped to .lp-fullbleed / the host class so
       padded list pages are unaffected. */
    :host(.lp-host-fullbleed) {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .list-page-container.lp-fullbleed {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      /* Fill the viewport HEIGHT but keep comfortable side + bottom gutters
         (Wix-style contained panel) so the table stays scannable and doesn't
         feel crammed against the screen edges. The header supplies the top gap. */
      padding: 0 var(--lp-page-px) var(--lp-page-pb);
      /* Comfortable, Wix-like row rhythm — roomy but not airy. */
    }
    /* Let the primary (frozen) column absorb horizontal slack so wide screens
       give the long product name room instead of spreading the middle columns
       into sparse gaps. Its var stays the MIN width; it only grows when the
       table fits the viewport — once columns overflow, max-content pins the min
       and horizontal scroll takes over as before. Higher specificity than the
       base width-lock so this wins in full-bleed only. */
    /* The frozen primary column keeps its fixed default width (the base
       list-sticky-col rule) — a balanced, predictable layout. Users who want
       it wider/narrower drag the header resize handle (persisted per user). */
    /* Page header (H1) — small extra inset on top of the container gutters. */
    .list-page-container.lp-fullbleed > .lp-head {
      flex: 0 0 auto;
      padding: var(--lp-head-pt) 4px var(--lp-head-pb);
    }
    /* Card edge: the same border and shadow as the form cards (employee form,
       Customers), so lists and forms match. Full-bleed mode below removes it. */
    .list-card { border-radius: 12px; box-shadow: none; }
    /* !important so no utility class (or the full-bleed reset below) can win:
       every list card, full-width or not, carries the form-card border. */
    .list-page-container .list-card { border: 1px solid var(--ui-line) !important; }
    /* Card fills the rest, stripped of its rounded/border/shadow chrome. */
    .lp-fullbleed .list-card {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      margin: 0;
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }
    /* Toolbar + pagination keep their height; only the active body view flexes.
       The body view differs per breakpoint/mode: .relative (desktop table),
       .lp-mcards (mobile cards), or .grid (grid view). */
    .lp-fullbleed .list-card > :not(.relative):not(.lp-mcards):not(.grid):not(.lp-gallery):not([listCustomView]) {
      flex: 0 0 auto;
    }
    /* Consumer-provided custom views (e.g. the Chart-of-Accounts tree) also
       fill and scroll internally in full-bleed. */
    .lp-fullbleed .list-card > [listCustomView] {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
    }
    /* Pagination is the pinned bottom row — pad it past the iPhone home
       indicator so the controls aren't under the gesture bar. */
    .lp-fullbleed .list-card > .lp-foot {
      padding-bottom: max(var(--lp-foot-py), env(safe-area-inset-bottom));
    }
    .lp-fullbleed .list-card > .relative,
    .lp-fullbleed .list-card > .lp-mcards,
    .lp-fullbleed .list-card > .grid,
    .lp-fullbleed .list-card > .lp-gallery {
      flex: 1 1 auto;
      min-height: 0;
    }
    .lp-fullbleed .list-card > .relative {
      display: flex;
      flex-direction: column;
    }
    /* The table host scrolls itself; the card/grid views need their own
       vertical scroll (the table's #scrollHost already has overflow-y). */
    .lp-fullbleed .list-card > .lp-mcards,
    .lp-fullbleed .list-card > .grid,
    .lp-fullbleed .list-card > .lp-gallery {
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    .lp-fullbleed .overflow-x-auto {
      flex: 1 1 auto;
      min-height: 0;
    }
    /* Non-sticky lists ([stickyColumns]="false") have no overflow-x-auto class
       on the host — make whatever the table wrapper's scroller is fill + scroll
       vertically so the sticky header still works. (The phantom bar is fixed /
       out of flow, so exclude it.) */
    .lp-fullbleed .list-card > .relative > :not(.lp-hscroll) {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
    }
    /* Ensure the header sticks in full-bleed regardless of sticky-columns.
       -1px closes the sub-pixel peek gap (see the note above). */
    .lp-fullbleed thead th {
      position: sticky;
      top: -1px;
      /* Must outrank body cells: without this both sides resolve to auto and
         tbody (later in the DOM) paints over the header as rows scroll under
         it. Stays below the frozen header columns, which use z-20. */
      z-index: 5;
    }
    /* The blanket rule above (specificity beats the z-20 utility) would drop the
       frozen start/actions HEADER cells to z-5 — below the frozen body cells
       (.list-sticky-cell / .list-floating-actions, z-10) and the column resizer
       (z-25) — so scrolling body cells and the row's Edit pill paint over the
       frozen column header on vertical scroll. Lift them above the entire body
       layer (>25) and keep an opaque fill so rows can't ghost through. Higher
       specificity (0,2,2) than the blanket rule so this wins. */
    .lp-fullbleed thead th.list-sticky-col,
    .lp-fullbleed thead th.list-actions-th,
    .lp-fullbleed thead th.start-0 {
      z-index: 30;
      background: var(--ui-surface-1);
    }

    /* ── Fit-to-content height (opt-in via [fitContent]) ─────────────────
       In full-bleed the card normally flexes to fill the viewport, so a
       5-row table shows a tall empty area below it. With .lp-fit the card
       (and its inner table/card/grid views) size to their content instead;
       the scroll host keeps its max-height cap (re-applied inline in
       full-bleed for this mode) so a long table still stops at the viewport
       height and scrolls internally — same as before for many rows. */
    .list-page-container.lp-fullbleed.lp-fit { justify-content: flex-start; }
    .lp-fullbleed.lp-fit .list-card { flex: 0 1 auto; }
    .lp-fullbleed.lp-fit .list-card > .relative,
    .lp-fullbleed.lp-fit .list-card > .lp-mcards,
    .lp-fullbleed.lp-fit .list-card > .grid,
    .lp-fullbleed.lp-fit .list-card > .lp-gallery { flex: 0 1 auto; min-height: 0; }
    .lp-fullbleed.lp-fit .overflow-x-auto { flex: 0 1 auto; }

    /* ── Column resize handle ───────────────────────────────────────────────
       A grab strip on each header cell's end edge. Header cells are already
       positioned (sticky), so this anchors to each th. Sits above neighbouring
       cells so it stays grabbable at the frozen-column seam. */
    .lp-col-resizer {
      position: absolute;
      top: 0;
      bottom: 0;
      inset-inline-end: -4px;
      width: 9px;
      cursor: col-resize;
      z-index: 25;
      touch-action: none;
    }
    .lp-col-resizer::after {
      content: "";
      position: absolute;
      top: 25%;
      bottom: 25%;
      inset-inline-end: 4px;
      width: 2px;
      border-radius: 1px;
      background: transparent;
      transition: background-color 120ms ease;
    }
    .lp-col-resizer:hover::after,
    .lp-col-resizer:active::after { background: var(--lp-accent); }

    /* Fixed phantom scrollbar — pinned to the real viewport bottom while
       the table is in view. NOTE: position: sticky cannot work here because
       .list-card has overflow: hidden (for its rounded corners), which makes
       the card the sticky context — the track would stick to the card's
       bottom, i.e. exactly where the useless native bar already was. So the
       track is position: fixed and its left / width / bottom are set inline
       from the scroll host's bounding rect (see updatePhantomGeometry()).
       z-index stays below the bulk-selection bar (z-50). */
    .lp-hscroll {
      position: fixed;
      z-index: 40;
      overflow-x: auto;
      overflow-y: hidden;
      height: 14px;
      background: var(--ui-surface);
      border-top: 1px solid var(--ui-x-e6e8ee);
      scrollbar-width: thin;
      scrollbar-color: #9fbfc2 var(--ui-surface-2);
    }
    .lp-hscroll::-webkit-scrollbar { height: 10px; }
    .lp-hscroll::-webkit-scrollbar-track {
      background: var(--ui-surface-2);
      border-radius: 5px;
    }
    .lp-hscroll::-webkit-scrollbar-thumb {
      background: #9fbfc2;
      border-radius: 5px;
      border: 2px solid var(--ui-surface-2);
    }
    .lp-hscroll::-webkit-scrollbar-thumb:hover { background: #7fa9ad; }
    /* Inner spacer just needs width (mirrors the table's scrollWidth);
       1px tall so the track height comes from .lp-hscroll itself. */
    .lp-hscroll > div { height: 1px; }

    /* ── Themed table (thead + tbody) ───────────────────────────────────
       Neutral header, roomy cells, subtle dividers, teal accent. Applies
       to every list page since the table lives in this shared component.

       The header is deliberately NOT brand-tinted. Column labels are
       metadata you read once, so they should recede; and teal is the app's
       action signal (interactive cells, checkbox accent, primary button) —
       spending it on an inert band both out-shouts the data and weakens
       that signal. Keeping the header neutral leaves row hover and the
       expanded-row highlight as the strongest teal on the page, which is
       the way round it should be.

       Must stay opaque: the header is position: sticky, so rows would
       ghost through a transparent fill as they scroll under it. */
    .list-page-container thead th {
      background: var(--ui-surface-1) !important;
      color: var(--ui-t-4a5163);
      font-size: 13px;
      font-weight: 500;
      height: var(--lp-th-h);
      padding: 0 var(--lp-pad-x) !important;
      white-space: nowrap;
      border-top: 0 !important;
      border-bottom: 1px solid var(--ui-line) !important;
    }
    /* Disclosure (row-detail chevron) column — opts out of the themed 18px
       side padding above, which would otherwise push the first data column
       ~36px further in for a cell holding a single 28px button. Sized to the
       button plus a hair, so the chevron sits close to the column it opens. */
    .list-page-container th.list-disclosure-cell,
    .list-page-container td.list-disclosure-cell {
      width: 34px; min-width: 34px; max-width: 34px;
      padding-inline: 6px 0 !important;
      text-align: center;
    }

    /* Body cells. --row-pad-y tunes vertical density in one place. */
    .list-page-container tbody td {
      padding: var(--lp-row-py) var(--lp-pad-x) !important;
      font-size: 14px;
      color: var(--ui-t-4a5163);
      white-space: nowrap;
    }
    /* When a column is narrower than its content (resized, or a narrow window),
       clip it with an ellipsis instead of overflowing into the next column.
       Excluded: the Actions column (floating button has its own shadow), the
       selection checkbox column (.start-0 — a checkbox, not text), and the
       frozen primary column (.list-sticky-col — its name wraps rather than
       overflows, and it keeps overflow:visible so its cast edge-shadow shows).
       Also excluded: the disclosure cell (.list-disclosure-cell) — it holds a
       28px button in a 28px content box, so sub-pixel rounding counts as
       overflow and paints a stray "…" next to the chevron. */
    .list-page-container tbody td:not(.list-floating-actions):not(.start-0):not(.list-sticky-col):not(.list-disclosure-cell):not(.lp-col-num),
    .list-page-container thead th:not(.list-actions-th):not(.start-0):not(.list-sticky-col):not(.list-disclosure-cell):not(.lp-col-num) {
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: var(--lp-text-max, 260px);
    }
    /* Numbers (qty, stock value, price, tax): never clipped, end-aligned, readable inside Arabic text. */
    .list-page-container .lp-col-num {
      min-width: 112px;
      text-align: end;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .list-page-container td.lp-col-num > span { unicode-bidi: isolate; }
    /* Stacked rows inside one cell (name + barcode + image toggles): space only the rows that have content,
       so an empty toggle-only template never adds height (and density tokens stay in charge of row height). */
    .lp-grow:empty { display: none; }
    .list-page-container td > .lp-grow:not(:empty):not(:first-child) { margin-top: 4px; }
    .lp-ellipsis { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lp-sort-idle { width: 14px; height: 14px; flex: 0 0 auto; color: var(--ui-faint); }
    /* Keep focused cells clear of the sticky header / first column / actions column (WCAG 2.2 focus not obscured). */
    .list-page-container .overflow-x-auto {
      scroll-padding-top: var(--lp-th-h);
      scroll-padding-inline-start: calc(var(--lp-sticky-col-w, 300px) + 48px);
      scroll-padding-inline-end: calc(var(--lp-actions-w, 184px) + 40px);   /* + the Actions fade (--lp-fade-w) */
    }
    /* Subtle row dividers (recolour the Tailwind divide-y borders) */
    .list-page-container tbody tr { border-top-color: var(--ui-x-e6e8ee) !important; }
    /* Row hover (override Tailwind hover:bg-slate-50) */
    .list-page-container tbody tr.list-row:hover { background-color: var(--ui-x-f4fbfb) !important; }
    /* Teal accent — checkboxes + link-styled values */
    .list-page-container input[type="checkbox"] { accent-color: var(--lp-accent); }
    .list-page-container .list-interactive-cell { color: var(--lp-accent); }

    /* Card container — clean rounded corners (clip the inner square-cornered
       scroll area). */
    .list-card {
      border-radius: 14px !important;
      overflow: hidden;
      /* Borderless, flat: the white card reads against the light-gray app
         canvas (.main-content) — no border, no shadow. */
      border: 0 !important;
      box-shadow: none !important;
    }

    /* Force the table to its natural (nowrap) width so it overflows the
       scroll container when there are many columns — without this the
       w-full table just shrinks to fit and the sticky-column shadows
       never trigger (scrollWidth === clientWidth). Only wanted when the
       sticky/scroll machinery is on; pages with [stickyColumns]="false"
       keep the plain w-full table. */
    .list-page-container .overflow-x-auto table { min-width: max-content; }

    /* Lock the frozen columns to a constant width (min = max) so they can't
       reflow narrower/wider during horizontal scroll. Widths are exposed as
       CSS variables so individual pages can tighten them (e.g. a page whose
       actions cell is a single "…" button sets --lp-actions-w: 72px on the
       <app-list-page> host) without another !important override. */
    .list-page-container th.start-0,
    .list-page-container td.start-0 {
      width: 48px; min-width: 48px; max-width: 48px;
      padding-inline: var(--lp-pad-x) 0 !important;
    }
    .list-page-container th.list-sticky-col,
    .list-page-container td.list-sticky-col {
      width: var(--lp-sticky-col-w, 300px);
      min-width: var(--lp-sticky-col-w, 300px);
      max-width: var(--lp-sticky-col-w, 300px);
    }
    /* [flexFirstColumn]: the first column takes the slack (and truncates with an ellipsis) instead of a fixed width;
       its --lp-sticky-col-w is the minimum. Other columns size to their content. */
    .list-page-container.lp-flex-first th.list-sticky-col,
    .list-page-container.lp-flex-first td.list-sticky-col {
      width: auto;
      min-width: var(--lp-sticky-col-w, 300px);
      max-width: 0;   /* content never widens it: it truncates, and it is the only auto-width column so it takes the slack */
    }
    /* Every other data column shrinks to its content (no percentages: they inflate a max-content table). */
    .list-page-container.lp-flex-first thead th:not(.list-sticky-col):not(.start-0):not(.list-actions-th):not(.list-disclosure-cell),
    .list-page-container.lp-flex-first tbody tr:not(.lp-node-row) > td:not(.list-sticky-col):not(.start-0):not(.list-floating-actions):not(.list-disclosure-cell) {
      width: 1px;
    }
    .list-page-container td.list-floating-actions,
    .list-page-container th.list-actions-th {
      width: var(--lp-actions-w, 184px);
      min-width: var(--lp-actions-w, 184px);
      max-width: var(--lp-actions-w, 184px);
    }

    /* ── Compact mobile card list (opt-in via [mobileCardConfig]) ──
       One row per card (~60px). RTL-safe (logical props). Reuses the
       shared brand/hover tokens. */
    .lp-mcards { display: flex; flex-direction: column; }
    .lp-mcard {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px; min-height: 60px;
      border-bottom: 1px solid var(--ui-surface-2); cursor: pointer;
      transition: background-color 120ms ease;
    }
    .lp-mcard:last-child { border-bottom: 0; }
    .lp-mcard:hover { background-color: var(--ui-x-f4fbfb); }
    .lp-mcard__thumb {
      flex: 0 0 auto; width: 38px; height: 31px; border-radius: 7px;
      overflow: hidden; background: var(--ui-surface-2); border: 1px solid var(--ui-line);
      display: flex; align-items: center; justify-content: center;
    }
    .lp-mcard__thumb :is(img) { width: 100%; height: 100%; object-fit: cover; display: block; }
    .lp-mcard__body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .lp-mcard__line1 {
      display: flex; align-items: center; gap: 6px; min-width: 0;
      font-size: 14px; font-weight: 600; color: var(--ui-text);
    }
    /* Title text truncates; the badge/star stay visible. */
    .lp-mcard__line1 .lp-mcard__title,
    .lp-mcard__line1 > :first-child { min-width: 0; }
    .lp-mcard__title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lp-mcard__line2 {
      display: flex; align-items: center; justify-content: space-between;
      gap: 8px; min-width: 0;
    }
    .lp-mcard__metrics {
      display: flex; align-items: center; gap: 12px; min-width: 0;
      overflow: hidden; font-size: 12.5px; color: var(--ui-muted);
    }
    .lp-mcard__secondary { flex: 0 0 auto; font-size: 12px; color: var(--ui-faint); white-space: nowrap; }
    .lp-mcard__actions { flex: 0 0 auto; margin-inline-start: 2px; }
    .lp-mcard__chevron {
      flex: 0 0 auto; width: 26px; height: 26px; border-radius: 8px;
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--ui-faint); transition: color 120ms ease, background-color 120ms ease;
    }
    .lp-mcard__chevron:hover { color: var(--ui-brand-text); background: var(--ui-brand-soft); }
    .lp-mcard-detail { border-bottom: 1px solid var(--ui-surface-2); background: var(--ui-surface-1); }
    .lp-skel { background: var(--ui-surface-2); animation: lp-skel-pulse 1.2s ease-in-out infinite; }
    .lp-mcard--skel { cursor: default; }
    .lp-mcard--skel:hover { background: transparent; }
    @keyframes lp-skel-pulse { 50% { opacity: .55; } }

    /* ── Redesign: header / toolbar / bulk bar / footer ─────────────────────── */
    .lp-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--lp-gap); padding-block-end: 16px; }
    .lp-head__main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .lp-head__title-row { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .lp-title { font-size: 24px; font-weight: 500; line-height: 1.25; letter-spacing: -0.01em; color: var(--ui-text); }
    .lp-subtitle { font-size: 14px; color: var(--ui-muted); }
    .lp-count {
      flex: 0 0 auto; font-size: 13px; line-height: 1.4; padding: 2px 10px; border-radius: 999px;
      color: var(--ui-muted); border: 1px solid var(--ui-line-strong); font-variant-numeric: tabular-nums; unicode-bidi: isolate;
    }
    /* On-demand total: "Count" (dashed) and "Retry" (danger) pills are buttons. */
    .lp-count--btn { display: inline-flex; align-items: center; gap: 6px; background: transparent; border-style: dashed; font-family: inherit; cursor: pointer; }
    .lp-count--btn:hover { background: var(--ui-surface-2); color: var(--ui-text); }
    .lp-count--btn:focus-visible { outline: 2px solid var(--ui-brand-t700); outline-offset: 2px; }
    .lp-count--danger { color: var(--ui-red-text); border-color: var(--ui-red-text); border-style: solid; }
    .lp-count--danger:hover { background: var(--ui-red-soft); color: var(--ui-red-text); }
    .lp-count__icon { inline-size: 14px; block-size: 14px; flex: 0 0 auto; }
    @media (pointer: coarse) { .lp-count--btn { min-block-size: 44px; min-inline-size: 44px; justify-content: center; } }
    .lp-head__actions { display: flex; align-items: center; gap: var(--lp-gap); }

    .lp-toolbar, .lp-bulk {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
      gap: var(--lp-gap); padding: var(--lp-toolbar-py) var(--lp-pad-x); background: var(--ui-surface);
    }
    .lp-toolbar__start, .lp-toolbar__end { display: flex; align-items: center; flex-wrap: wrap; gap: var(--lp-gap); min-width: 0; }
    .lp-toolbar__start { flex: 1 1 auto; }

    .lp-search { position: relative; display: flex; align-items: center; flex: 1 1 180px; min-width: 180px; max-width: 300px; }
    .lp-search__input {
      width: 100%; height: var(--lp-control-h); padding-inline: 36px 32px; font-size: 14px;
      color: var(--ui-text); background: var(--ui-field, var(--ui-surface)); border: 1px solid var(--ui-field-border, var(--ui-line-strong)); border-radius: 8px;
    }
    .lp-search__input::placeholder { color: var(--ui-placeholder, var(--ui-muted)); }
    .lp-search__input:hover { border-color: var(--ui-field-border-hover, var(--ui-faint)); }
    .lp-search__input:focus-visible { outline: 2px solid var(--lp-focus); outline-offset: 1px; border-color: var(--lp-focus); }
    .lp-search__go, .lp-search__clear {
      position: absolute; top: 0; bottom: 0; display: inline-flex; align-items: center; justify-content: center;
      color: var(--ui-muted); background: transparent; border-radius: 8px; cursor: pointer;
    }
    .lp-search__go { inset-inline-start: 0; width: 36px; }
    .lp-search__clear { inset-inline-end: 0; width: 32px; }
    .lp-search__go:hover, .lp-search__clear:hover { color: var(--ui-text); }
    .lp-search__go:focus-visible, .lp-search__clear:focus-visible { outline: 2px solid var(--lp-focus); outline-offset: -2px; }
    .lp-search svg { width: 16px; height: 16px; }

    .lp-ico { width: 18px; height: 18px; flex: 0 0 auto; }
    .lp-spin { animation: lp-spin 900ms linear infinite; }
    @keyframes lp-spin { to { transform: rotate(360deg); } }
    .lp-btn.is-active { background: var(--lp-accent-soft); border-color: var(--lp-accent); }
    .lp-badge {
      display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px;
      font-size: 12px; font-weight: 600; line-height: 1; border-radius: 999px; color: var(--lp-on-accent); background: var(--lp-accent);
    }

    .lp-seg { display: inline-flex; align-items: center; gap: 2px; height: var(--lp-control-h); padding: 2px; border: 1px solid var(--ui-line-strong); border-radius: 8px; background: var(--ui-surface); }
    .lp-seg__btn {
      display: inline-flex; align-items: center; justify-content: center; height: 100%; aspect-ratio: 1; min-width: 28px;
      color: var(--ui-muted); background: transparent; border-radius: 6px; cursor: pointer; transition: background-color 150ms ease, color 150ms ease;
    }
    .lp-seg__btn:hover { background: var(--ui-hover); color: var(--ui-text); }
    .lp-seg__btn.is-on { background: var(--lp-accent-soft); color: var(--lp-accent); }
    .lp-seg__btn:focus-visible { outline: 2px solid var(--lp-focus); outline-offset: 1px; }
    .lp-seg__btn svg { width: 18px; height: 18px; }
    @media (pointer: coarse) { .lp-seg__btn { min-width: 44px; min-height: 44px; } }

    .lp-bulk { background: color-mix(in srgb, var(--lp-accent) 10%, var(--ui-surface)); border-bottom: 1px solid var(--ui-line); justify-content: flex-start; }
    .lp-bulk__count { font-size: 14px; font-weight: 600; color: var(--ui-text); }
    .lp-bulk__actions { display: flex; flex: 1 1 auto; flex-wrap: wrap; align-items: center; gap: var(--lp-gap); }

    .lp-foot { padding: var(--lp-foot-py) var(--lp-pad-x); border-top: 1px solid var(--ui-line); background: var(--ui-surface); }
    /* ── Gallery view (opt-in): auto-fill grid, card height follows its content ─────────────────────────────
       Comfortable 12px gap/padding, 180px min column; Compact 8px / 150px. 2 columns at narrow widths. */
    .lp-gallery {
      --lp-gal-gap: 12px;
      --lp-gal-min: 180px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--lp-gal-min), 1fr));
      align-items: start;
      align-content: start;
      gap: var(--lp-gal-gap);
      padding: var(--lp-gal-gap);
      min-inline-size: 0;
    }
    :host-context([data-density="compact"]) .lp-gallery { --lp-gal-gap: 8px; --lp-gal-min: 150px; }
    @media (max-width: 420px) { .lp-gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .lp-gallery__cell { min-inline-size: 0; }
    .lp-gallery__skel { border: 1px solid var(--ui-line); border-radius: 12px; background: var(--ui-surface); overflow: hidden; padding-block-end: 10px; }
    .lp-gallery__skel-img { aspect-ratio: 4 / 3; background: var(--ui-surface-2); }
    :host-context([data-density="compact"]) .lp-gallery__skel-img { aspect-ratio: 3 / 2; }
    .lp-gallery__skel-line { block-size: 10px; margin: 10px 12px 0; border-radius: 4px; background: var(--ui-surface-2); }
    .lp-gallery__skel-img, .lp-gallery__skel-line { animation: lp-gal-pulse 1.4s ease-in-out infinite; }
    @keyframes lp-gal-pulse { 50% { opacity: .55; } }
    @media (prefers-reduced-motion: reduce) { .lp-gallery__skel-img, .lp-gallery__skel-line { animation: none; } }


    /* ── Row tree ───────────────────────────────────────────────────────────────
       Every logical property, so indentation, connector, bar and chevron mirror in RTL. 24px per level; the
       structure also reads without colour (indent + connector). */
    .lp-tn { position: relative; display: flex; align-items: center; gap: 4px; min-width: 0; padding-inline-start: calc(min(var(--lp-level, 0), 3) * 24px);
      container: lp-tn / inline-size; }
    .lp-tn__body { flex: 0 1 auto; min-width: 0; overflow: hidden; }
    .lp-tn__body .lp-grow { min-width: 0; flex-wrap: nowrap; }
    .lp-tslot { flex: 0 0 20px; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; }
    .lp-tbtn {
      position: relative; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px;
      color: var(--ui-muted); background: transparent; border-radius: 6px; cursor: pointer; transition: background-color 150ms ease, color 150ms ease;
    }
    .lp-tbtn:hover { background: var(--ui-hover); color: var(--ui-text); }
    .lp-tbtn:focus-visible { outline: 2px solid var(--lp-focus); outline-offset: 1px; }
    .lp-tbtn svg { width: 14px; height: 14px; transition: transform 150ms ease; }
    .lp-tbtn.is-open svg { transform: rotate(90deg); }
    :host-context([dir="rtl"]) .lp-tbtn svg { transform: scaleX(-1); }
    :host-context([dir="rtl"]) .lp-tbtn.is-open svg { transform: scaleX(-1) rotate(90deg); }
    @media (pointer: coarse) { .lp-tbtn::before { content: ''; position: absolute; inset: -12px; } }
    .lp-tbtn--card { flex: 0 0 auto; width: 28px; height: 28px; }

    /* The children pill never truncates ("U..."): it keeps its size, and when the cell is short it shows only its icon
       (the label lives in the tooltip + aria-label). The name cell is a size container, so this follows the COLUMN width. */
    .lp-pill {
      flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px;
      font-size: 12px; line-height: 1.4; padding: 1px 8px; border-radius: 999px; white-space: nowrap;
      color: var(--ui-muted); border: 1px solid var(--ui-line-strong);
    }
    .lp-pill__icon { inline-size: 12px; block-size: 12px; flex: 0 0 auto; }
    @container lp-tn (max-width: 290px) {
      .lp-pill { padding-inline: 5px; }
      .lp-pill__label { display: none; }
    }
    /* Compact keeps name + unit + SKU chip on ONE line, so the label needs more room before it gives way. */
    @container lp-tn (max-width: 470px) {
      :host-context([data-density="compact"]) .lp-pill { padding-inline: 5px; }
      :host-context([data-density="compact"]) .lp-pill__label { display: none; }
    }
    /* Connector: an L from the parent's slot down to this row (logical borders + radius, so it mirrors). */
    .lp-conn {
      position: absolute; pointer-events: none;
      inset-inline-start: calc((min(var(--lp-level, 1), 3) - 1) * 24px + 9px);
      top: calc(-1 * var(--lp-row-py)); width: 14px; height: calc(50% + var(--lp-row-py));
      border-inline-start: 1.5px solid var(--ui-line-strong); border-bottom: 1.5px solid var(--ui-line-strong); border-end-start-radius: 6px;
    }

    /* Tree tint steps up per level (about 6 / 11 / 16%); opaque (mixed with the surface) so sticky cells stay solid. */
    .list-page-container tr.lp-intree[data-level="0"] { --lp-tint: color-mix(in srgb, var(--lp-accent) 6%, var(--ui-surface)); }
    .list-page-container tr.lp-intree[data-level="1"] { --lp-tint: color-mix(in srgb, var(--lp-accent) 11%, var(--ui-surface)); }
    .list-page-container tr.lp-intree[data-level="2"],
    .list-page-container tr.lp-intree[data-level="3"] { --lp-tint: color-mix(in srgb, var(--lp-accent) 16%, var(--ui-surface)); }
    .list-page-container tr.lp-intree > td { background-color: var(--lp-tint); }
    .list-page-container tr.lp-intree.list-row:hover > td { background-color: color-mix(in srgb, var(--lp-accent) 18%, var(--ui-surface)); }
    /* One 2px accent bar on the inline-start edge of the whole tree. */
    .list-page-container tr.lp-intree > td:first-child { position: relative; }
    .list-page-container tr.lp-intree > td:first-child.sticky { position: sticky; }
    .list-page-container tr.lp-intree > td:first-child::before {
      content: ''; position: absolute; inset-block: 0; inset-inline-start: 0; width: 2px; background: var(--lp-accent); pointer-events: none;
    }
    .list-page-container tr.lp-tr:focus-visible { outline: 2px solid var(--lp-focus); outline-offset: -2px; }

    .list-page-container tr.lp-node-row > td { padding-block: 4px !important; white-space: normal; }
    .lp-tn--status { gap: 8px; min-height: 28px; }
    .lp-node-msg { font-size: 13px; color: var(--ui-muted); }
    .lp-skel--bar { display: inline-block; height: 12px; border-radius: 6px; }
    .lp-count--skel { display: inline-flex; align-items: center; min-width: 52px; }
    .lp-count--skel .lp-skel--bar { width: 32px; }
    .lp-mnode { display: flex; align-items: center; gap: 8px; min-height: 40px; padding-block: 6px; padding-inline-end: 14px; border-bottom: 1px solid var(--ui-surface-2); background: color-mix(in srgb, var(--lp-accent) 8%, var(--ui-surface)); }
    .lp-mcard.lp-intree { background-color: color-mix(in srgb, var(--lp-accent) 8%, var(--ui-surface)); }
    @media (prefers-reduced-motion: reduce) { .lp-tbtn, .lp-tbtn svg { transition: none; } }

    /* Motion: opacity + transform only, 150-200ms; exits are instant (faster than enters) and never block state. */
    .lp-enter { animation: lp-in 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
    @keyframes lp-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) {
      .lp-enter, .animate-pulse, .lp-skel { animation: none; }
      .lp-seg__btn { transition: none; }
    }
  `]
})
export class ListPageComponent<T = any> implements OnInit, AfterViewInit, OnDestroy {
  // ══════════════════════════════════════════════════════════════
  // INJECTED SERVICES
  // ══════════════════════════════════════════════════════════════
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private modalService = inject(ModalService);
  private translate = inject(TranslateService);
  private listPrefs = inject(ListPreferencesService);
  private layout = inject(LayoutService);

  protected readonly Math = Math;
  // Expose Object to template
  protected readonly Object = Object;
  // Note: These services should be injected from your existing project
  // private tableHelperService = inject(TableHelperService, { optional: true });
  // private tableColumnService = inject(TableColumnService, { optional: true });
  // private customFieldsService = inject(CustomFieldsService, { optional: true });
  // private permissionService = inject(PermissionService, { optional: true });

  // ══════════════════════════════════════════════════════════════
  // INPUTS - Configuration
  // ══════════════════════════════════════════════════════════════

  /** Table columns configuration */
  private _columns = signal<TableColumn<T>[]>([]);
  private _urlColumnsRestored = false;
  // undefined = not fetched yet, null = no saved prefs, array = saved prefs
  private _savedPrefs: ListColumnPref[] | null | undefined = undefined;
  private _initialLoadDispatched = false;
  @Input({ required: true })
  get columns(): TableColumn<T>[] { return this._columns(); }
  set columns(value: TableColumn<T>[]) {
    console.debug('[list-page] columns setter fired', {
      valueKeys: value.map(c => c.key),
      initialLoadDispatched: this._initialLoadDispatched,
      customFieldsLoaded: this._customFieldsLoaded,
      savedPrefsLength: this._savedPrefs?.length,
    });
    this._columns.set(value);
    // Only set default visible columns if URL state hasn't already set them
    if (value.length > 0 && !this._urlColumnsRestored) {
      this.visibleColumns.set(ColumnHelper.getColumnKeys(value));
    }
    // Columns may arrive after ngOnInit (parent populates them async) — try
    // to apply saved prefs + load data whenever columns become ready.
    this.tryApplyPrefsAndLoad();
  }

  /** Page title displayed in header */
  @Input() pageTitle = '';

  /** Page subtitle / description */
  @Input() pageSubtitle = '';

  /** Breadcrumb items */
  @Input() breadcrumbs: BreadcrumbItem[] = [];

  /** Data source function - returns observable of list response */
  @Input({ required: true }) dataSource!: (params: ListQueryParams) => any;

  /** Pagination configuration */
  @Input() pagination: PaginationConfig = { enabled: false };

  /** Search configuration */
  @Input() search: SearchConfig = { enabled: false };

  /** Sorting configuration */
  @Input() sorting: SortingConfig = { enabled: false };

  /** Filter configurations */
  @Input() filters: FilterConfig[] = [];

  /** Header action buttons (e.g., "New", "Import") */
  @Input() headerActions: ActionConfig[] = [];

  /** Bulk action configurations (e.g., "Delete Selected") */
  @Input() bulkActions: BulkActionConfig[] = [];

  /** Row action configurations (shown in each row) */
  @Input() rowActions: ActionConfig[] = [];

  /** Sync state to URL query parameters */
  @Input() syncToUrl = true;

  /**
   * Entity type (e.g. 'product', 'customer'). Used as the key for loading
   * custom fields AND for persisting column preferences (visibility + order)
   * into the employee options — when set, saved prefs are loaded on init and
   * re-saved whenever the customize-columns modal is applied.
   */
  @Input() entityType?: string;

  /**
   * Async function to load custom fields and merge them into columns.
   * Called before opening the customize columns modal.
   * Should return the updated columns array with custom fields appended.
   */
  @Input() loadCustomFieldsFn?: (columns: TableColumn<T>[]) => Promise<TableColumn<T>[]>;

  /** Permission mappings */
  @Input() permissions: Record<string, string> = {};

  /** Enable row selection with checkboxes */
  @Input() selectable = false;

  /** Hide the built-in Grid view toggle. Pages that don't have a
   *  card layout (e.g. Chart of Accounts) can pass `false` to
   *  drop the grid button from the view-mode toggle entirely. */
  @Input() showGridView = true;

  /** Opt-in compact mobile card layout (< 768px). When provided, the
   *  list-page renders per-row cards driven by this config + the
   *  listMobile* template slots instead of the generic key/value grid.
   *  Omit → unchanged mobile behavior. */
  @Input() mobileCardConfig?: MobileCardConfig;

  /** Sticky primary/actions columns + horizontal scroll shadow. Default
   *  `true` keeps today's behavior for wide tables. Pages whose columns
   *  fit can pass `false` to drop the sticky cells, the scroll-shadow, and
   *  the overflow-x wrapper (no horizontal scroll). */
  @Input() stickyColumns = true;

  /** Full-bleed (edge-to-edge) layout: the list fills the viewport with the
   *  table body as the single internal scroll region — toolbar pinned on top,
   *  sticky header, pagination pinned at the bottom, no card chrome or outer
   *  gaps. Now the DEFAULT for every list page — the component self-manages the
   *  shell (switches main-content to no-padding on desktop, restores it on
   *  destroy) so pages need no extra wiring. Set `[fullBleed]="false"` to opt a
   *  page out (e.g. a list embedded below other content). */
  @Input() fullBleed = true;

  /** The first (sticky) column takes the leftover width and truncates with an ellipsis; its `--lp-sticky-col-w` becomes a minimum. */
  @Input() flexFirstColumn = false;

  /** Fit the table height to its rows instead of always filling the viewport:
   *  few rows → a short table (no big empty area below it); many rows → the
   *  table caps at the same viewport-based height as before and scrolls
   *  internally. Only meaningful together with full-bleed + sticky columns.
   *  Default `false` preserves the fill-the-viewport behavior (e.g. pages with
   *  a custom view that should stretch, like the Chart-of-Accounts tree). */
  @Input() fitContent = false;

  /** True when the fit-to-content sizing is active (opt-in AND full-bleed). */
  get isFitContent(): boolean {
    return this.fitContent && this.isFullBleed;
  }

  /** Effective full-bleed: only on desktop widths. On mobile (< 768px) we keep
   *  the padded, page-scroll layout — a fixed-viewport shell fights iOS Safari's
   *  dynamic toolbars, and mobile already scrolls the page fine. Reactive via
   *  the `isMobile` signal (updated on resize). */
  get isFullBleed(): boolean {
    return this.fullBleed && !this.isMobile();
  }

  /** Mirror the effective full-bleed onto the component host so its own `:host`
   *  box becomes a flex child that fills the no-padding main-content column. */
  @HostBinding('class.lp-host-fullbleed') get isHostFullBleed(): boolean {
    return this.isFullBleed;
  }

  /** Push the no-padding shell state to match the effective full-bleed. Called
   *  on init and whenever the viewport crosses the mobile breakpoint. */
  private syncFullBleedShell(): void {
    this.layout.setNoPadding(this.isFullBleed);
  }

  /** Additional view modes to surface alongside the built-in
   *  Table / Grid toggle. Each entry renders as an icon button in
   *  the toggle row. When the user picks one, the list-page hides
   *  its own table/grid bodies and emits `(viewModeChange)`; the
   *  parent renders custom content via the `[listCustomView]`
   *  projection slot. Example use: a "Tree" mode on the
   *  Chart-of-Accounts page. */
  @Input() extraViewModes: { id: string; labelKey?: string; iconPath?: string }[] = [];

  /** Opt-in: on phones keep the extra view the user picked (instead of forcing
   *  the grid / cards body) and show a compact "list | extra views" toggle.
   *  The consumer's extra views are then responsible for being phone-friendly. */
  @Input() mobileExtraViews = false;

  /** Mobile "list" button: back to the grid / cards body. */
  showMobileList(): void {
    if (this.viewMode() === 'grid') return;
    this.viewMode.set('grid');
    this.viewModeChange.emit('grid');
  }

  /**
   * Opt-in image-first gallery (Products). When set, the second toggle button is "Gallery" instead of "Grid", a
   * requested `'grid'` view maps to `'gallery'`, and while the gallery is on the list requests `imageKey` on top of
   * the user's own columns (never written back to their saved selection). Other pages leave this unset.
   */
  @Input() galleryView?: GalleryViewConfig;

  /** Skeleton cards while the gallery loads: one page's worth, capped so a 100-row page doesn't paint 100 placeholders. */
  gallerySkeletonRows = computed(() => Array.from({ length: Math.min(this.pageSize() || 12, 12) }, (_, i) => i));

  /** The card template the page supplied for the gallery body. */
  getGalleryCardTemplate = computed(() => this.galleryCardTemplates?.first?.template);

  /** `'grid'` is what a page without a gallery calls its card view; with one, the same request means the gallery. */
  normalizeViewMode(mode: string): string {
    return mode === 'grid' && !!this.galleryView && !this.isMobile() ? 'gallery' : mode;
  }

  /** API columns for the current view: the user's own, plus the gallery's image key while the gallery is open. */
  private apiColumnsFor(mode: string): string[] {
    const cols = ColumnHelper.getApiColumnKeys(this.columns);
    const img = this.galleryView?.imageKey;
    return mode === 'gallery' && img && !cols.includes(img) ? [...cols, img] : cols;
  }

  /** Columns the rows on screen (or the request in flight) were asked for; null before the first load or after a failed one. */
  private _loadedApiColumns: Set<string> | null = null;

  /** Reload only when the rows on screen lack a field the (new) view needs — never in a loop: this is called from
   *  user actions only, and a reload always records a superset of what the view needs. */
  private reloadIfViewNeedsMore(): void {
    if (!this.galleryView) return;
    const loaded = this._loadedApiColumns;
    if (loaded && this.apiColumnsFor(this.viewMode()).every(c => loaded.has(c))) return;
    this.loadData();
  }

  /** Fires whenever the active view mode changes — including the
   *  built-in 'table' / 'grid' modes. Useful for parents that need
   *  to load mode-specific data lazily. */
  @Output() viewModeChange = new EventEmitter<string>();

  /** Set of expanded row IDs (for parent-child rendering) */
  @Input() expandedRowIds: { (): Set<string> } = () => new Set();

  /** Key on each row that holds children array */
  @Input() childrenKey = 'children';

  /** Empty state configuration */
  @Input() emptyState: EmptyStateConfig = {
    title: 'No items found',
    message: 'Try adjusting your filters or search query'
  };

  /** Dynamic row CSS class */
  @Input() rowClass?: string | ((row: T) => string);

  /** ID field name for row selection */
  @Input() idField = 'id';

  /** Initial page size */
  @Input() initialPageSize = 25;

  /** Show loading spinner */
  @Input() loading = false;

  /**
   * Optional quick-view tabs (right side of the toolbar). Clicking one REPLACES the active filters with the preset;
   * no tab is selected when the active filters match none. Omit / empty = nothing rendered, no space reserved.
   */
  @Input() set quickViews(v: { id: string; label: string; filters: FilterState }[] | null | undefined) { this._quickViews.set(v ?? []); }
  get quickViews(): { id: string; label: string; filters: FilterState }[] { return this._quickViews(); }
  private readonly _quickViews = signal<{ id: string; label: string; filters: FilterState }[]>([]);

  /** Plural noun used in the screen-reader result announcement ("Showing 15 of 159 products"). */
  @Input() resultsNoun = '';

  // ══════════════════════════════════════════════════════════════
  // OUTPUTS - Events
  // ══════════════════════════════════════════════════════════════

  @Output() rowClicked = new EventEmitter<RowClickEvent<T>>();
  @Output() actionClicked = new EventEmitter<ActionClickEvent>();
  @Output() selectionChanged = new EventEmitter<SelectionChangeEvent<T>>();
  @Output() sortChanged = new EventEmitter<SortChangeEvent>();
  @Output() filterChanged = new EventEmitter<FilterChangeEvent>();
  @Output() filterOpened = new EventEmitter<void>();

  /** Optional async function to call before opening filter modal (e.g. to load filter options) */
  @Input() beforeFilterOpen?: () => Promise<void>;
  @Output() pageChanged = new EventEmitter<PageChangeEvent>();

  // ══════════════════════════════════════════════════════════════
  // CONTENT CHILDREN - Custom Templates
  // ══════════════════════════════════════════════════════════════

  @ContentChildren(ListCellTemplateDirective) cellTemplates!: QueryList<ListCellTemplateDirective>;
  @ContentChildren(ListHeaderTemplateDirective) headerTemplates!: QueryList<ListHeaderTemplateDirective>;
  @ContentChildren(ListRowActionsDirective) rowActionsTemplates!: QueryList<ListRowActionsDirective>;
  @ContentChildren(ListMobileThumbDirective) mobileThumbTemplates!: QueryList<ListMobileThumbDirective>;
  @ContentChildren(ListMobileTitleDirective) mobileTitleTemplates!: QueryList<ListMobileTitleDirective>;
  @ContentChildren(ListMobileChipDirective) mobileChipTemplates!: QueryList<ListMobileChipDirective>;
  @ContentChildren(ListRowDetailDirective) rowDetailTemplates!: QueryList<ListRowDetailDirective>;
  @ContentChildren(ListGalleryCardDirective) galleryCardTemplates!: QueryList<ListGalleryCardDirective>;

  // ══════════════════════════════════════════════════════════════
  // STATE SIGNALS
  // ══════════════════════════════════════════════════════════════

  // Data
  data = signal<T[]>([]);
  /** What the last response said about paging (read through `pageInfoFromResponse`, resolved by `pageInfo`). */
  private readonly responseInfo = signal<{ total?: number; hasNext?: boolean; pageCount?: number }>({});

  // UI State
  isLoading = signal(false);
  viewMode = signal<string>('table');
  isMobile = signal(false);
  showFilters = signal(false);
  showFilterModal = signal(false);

  /** Horizontal-scroll affordance flag — true once the table is scrolled
   *  right, so the frozen start (primary) column can cast its right-edge
   *  shadow over the content tucked behind it. */
  hasScrollStart = signal<boolean>(false);

  /** End-edge affordance flag — true while there is still content to
   *  scroll toward the end edge, so the pinned Actions column casts its
   *  fade over the columns tucked behind it ("more columns this way"). */
  hasScrollEnd = signal<boolean>(false);

  /** Live measurements of the horizontal scroll host — drive the fixed
   *  phantom scrollbar (rendered only when scrollWidth > clientWidth) and
   *  size its inner spacer so the thumb proportion matches the table. */
  hostScrollWidth = signal<number>(0);
  hostClientWidth = signal<number>(0);

  /** Geometry of the fixed phantom scrollbar (viewport coordinates),
   *  recomputed on page scroll / resize / data load. `phantomVisible`
   *  is true only while the table is in view AND overflows horizontally. */
  phantomVisible = signal<boolean>(false);
  phantomLeft = signal<number>(0);
  phantomWidth = signal<number>(0);
  phantomBottom = signal<number>(0);

  /** Measured pixel cap for the table scroll host so the table body scrolls
   *  INSIDE it (keeping the sticky header visible) instead of the whole page
   *  scrolling. Derived from the host's real document position so it fits the
   *  viewport exactly regardless of the page's header/toolbar height —
   *  recomputed on view-init, data load, and resize. Bound as an inline
   *  max-height on #scrollHost. */
  scrollMaxHeight = signal<number>(600);

  /** Space reserved BELOW the scroll host (pagination row + page padding) so
   *  it stays visible under the table rather than being pushed off-screen.
   *  Raise it via `[bottomReserve]` on pages that also pin something to the
   *  viewport bottom (e.g. a sticky save bar), which would otherwise cover
   *  the pagination row. */
  private static readonly SCROLL_BOTTOM_RESERVE = 88;

  /** Extra pixels to reserve below the table, on top of the default. */
  @Input() bottomReserve = 0;

  /** ViewChild reference to the horizontally-scrolling table
   *  container — used by the data-change effect to recompute the
   *  scroll-affordance state when rows are added/removed and on
   *  window resize. */
  private _scrollHost?: ElementRef<HTMLElement>;
  @ViewChild('scrollHost') set scrollHost(ref: ElementRef<HTMLElement> | undefined) {
    if (ref?.nativeElement === this._scrollHost?.nativeElement) { this._scrollHost = ref; return; }
    this.unbindScrollHost();
    this._scrollHost = ref;
    if (ref) this.bindScrollHost(ref.nativeElement);
  }
  get scrollHost(): ElementRef<HTMLElement> | undefined { return this._scrollHost; }

  // ── Scroll-state tracking (drives the Actions fade: .lp-overflow-end) ─────────────────────────
  // The host sits behind an @if (it is replaced when the view mode changes), so the listener and the observer follow
  // the ViewChild instead of being attached once. Scroll is passive and coalesced to one update per frame.
  private scrollRaf = 0;
  private hostRo?: ResizeObserver;
  private readonly onHostScroll = () => this.scheduleScrollState();

  private bindScrollHost(el: HTMLElement): void {
    el.addEventListener('scroll', this.onHostScroll, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      this.hostRo = new ResizeObserver(() => this.scheduleScrollState());
      this.hostRo.observe(el);
      const table = el.querySelector('table');
      if (table) this.hostRo.observe(table);
    }
    this.scheduleScrollState();
  }

  private unbindScrollHost(): void {
    this._scrollHost?.nativeElement.removeEventListener('scroll', this.onHostScroll);
    this.hostRo?.disconnect();
    this.hostRo = undefined;
    if (this.scrollRaf) { cancelAnimationFrame(this.scrollRaf); this.scrollRaf = 0; }
  }

  /** One `updateScrollState` per animation frame, however many scroll / resize / data events arrive. */
  scheduleScrollState(): void {
    if (this.scrollRaf) return;
    this.scrollRaf = requestAnimationFrame(() => {
      this.scrollRaf = 0;
      const host = this._scrollHost?.nativeElement;
      if (!host) return;
      // The table element is replaced (skeleton <-> rows): keep observing the live one.
      const table = host.querySelector('table');
      if (table && this.hostRo) this.hostRo.observe(table);
      this.updateScrollState(host);
    });
  }

  /** The columns or the rows changed: the hidden width under the Actions column may have appeared or gone. */
  private readonly rescanOnContentChange = effect(() => {
    this.displayColumns();
    this.data();
    this.scheduleScrollState();
  });

  /** The fixed phantom scrollbar track (only exists while visible). */
  @ViewChild('hscrollPhantom') hscrollPhantom?: ElementRef<HTMLElement>;

  /** Re-entrancy guard so host→phantom and phantom→host scroll sync
   *  can't ping-pong through their respective (scroll) handlers. */
  private _syncingScroll = false;

  /** Bound page-scroll handler (capture: also catches nested scrollers)
   *  — stored so ngOnDestroy can remove exactly this listener. */
  private pageScrollHandler = () => this.updatePhantomGeometry();

  /** Position the fixed phantom under the table's on-screen slice:
   *  - hidden when the table doesn't overflow horizontally, or is
   *    entirely off-screen;
   *  - pinned to the viewport bottom while the table extends below
   *    the fold (the case that motivated this — the native scrollbar
   *    lives at the table's bottom, unreachable without scrolling);
   *  - parked at the table's bottom edge when the user has scrolled
   *    far enough that the table ends above the viewport bottom. */
  updatePhantomGeometry(): void {
    const host = this.scrollHost?.nativeElement;
    if (!host) { this.phantomVisible.set(false); return; }

    const overflows = host.scrollWidth - host.clientWidth > 1;
    if (!overflows) { this.phantomVisible.set(false); return; }

    const rect = host.getBoundingClientRect();
    const vh = window.innerHeight;
    // In view = some slice of the table is on screen (small margins so
    // the track doesn't linger when only a border sliver remains).
    const inView = rect.top < vh - 24 && rect.bottom > 72;
    if (!inView) { this.phantomVisible.set(false); return; }

    // Only worth showing when the host's OWN horizontal scrollbar is out of
    // reach — i.e. the table runs past the fold. When the table ends on screen
    // (short lists, or [fitContent] where it scrolls internally) the native bar
    // is already visible and the phantom is a duplicate empty strip under it.
    if (rect.bottom <= vh - 8) { this.phantomVisible.set(false); return; }

    const wasHidden = !this.phantomVisible();
    this.phantomVisible.set(true);
    this.phantomLeft.set(rect.left);
    this.phantomWidth.set(rect.width);
    // 0 while the table runs past the fold (pin to viewport bottom);
    // otherwise the gap between table bottom and viewport bottom (park).
    this.phantomBottom.set(Math.max(0, vh - rect.bottom));

    // The @if re-creates the track when it reappears, resetting its
    // scrollLeft to 0 — re-mirror from the host on the next frame.
    if (wasHidden) {
      requestAnimationFrame(() => {
        if (this.hscrollPhantom && this.scrollHost) {
          this.hscrollPhantom.nativeElement.scrollLeft =
            this.scrollHost.nativeElement.scrollLeft;
        }
      });
    }
  }

  /** Recompute the scroll-affordance flags from a scroll container
   *  element. RTL flips `scrollLeft`'s polarity in some browsers,
   *  so we use Math.abs to keep the logic direction-agnostic. */
  updateScrollState(el: HTMLElement | EventTarget | null): void {
    const node = el as HTMLElement | null;
    if (!node) return;
    const left = Math.abs(node.scrollLeft);
    // 1px slack so floating-point rounding doesn't flicker the shadows.
    this.hasScrollStart.set(left > 1);
    this.hasScrollEnd.set(node.scrollWidth - node.clientWidth - left > 1);
    this.hostScrollWidth.set(node.scrollWidth);
    this.hostClientWidth.set(node.clientWidth);
    this.updatePhantomGeometry();

    // Mirror host → phantom so the visible thumb tracks native panning
    // (trackpad, shift+wheel, touch). Signed scrollLeft is copied as-is,
    // which keeps RTL correct — both containers share the same direction.
    if (!this._syncingScroll && this.hscrollPhantom) {
      this._syncingScroll = true;
      this.hscrollPhantom.nativeElement.scrollLeft = node.scrollLeft;
      this._syncingScroll = false;
    }
  }

  /** Phantom → host. The phantom is the only visible scrollbar, so
   *  dragging its thumb must pan the table; frozen start/actions columns
   *  stay put because only the host's scrollLeft changes. */
  syncFromPhantom(phantom: HTMLElement): void {
    if (this._syncingScroll || !this.scrollHost) return;
    this._syncingScroll = true;
    this.scrollHost.nativeElement.scrollLeft = phantom.scrollLeft;
    this._syncingScroll = false;
  }

  /** Recompute on resize — column widths can change when the
   *  viewport grows/shrinks, which flips whether the table needs
   *  horizontal scrolling at all. */
  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.scrollHost) this.updateScrollState(this.scrollHost.nativeElement);
    this.updatePhantomGeometry();
    this.recomputeScrollMaxHeight();
  }

  /**
   * Cap the scroll host's height to the viewport so the table body — not the
   * whole page — scrolls, which is what keeps the sticky `thead` in view. The
   * cap is `viewportHeight − (host's document top) − bottom reserve`, using a
   * document-relative top (`rect.top + scrollY`) so the value is stable no
   * matter how far the page is currently scrolled. Deferred to a frame so the
   * host has laid out (rows flushed, toolbar height settled).
   */
  recomputeScrollMaxHeight(): void {
    requestAnimationFrame(() => {
      const host = this.scrollHost?.nativeElement;
      if (!host || !this.stickyColumns) return;
      const root = this.hostRef.nativeElement as HTMLElement;
      const hostRect = host.getBoundingClientRect();
      const docTop = hostRect.top + window.scrollY;
      // What sits under the table inside the card (footer, borders): measured, not a fixed guess, so each density's
      // footer height and a visible filter bar are accounted for exactly.
      const card = root.querySelector<HTMLElement>('.list-card');
      const below = card ? Math.max(0, card.getBoundingClientRect().bottom - hostRect.bottom) : ListPageComponent.SCROLL_BOTTOM_RESERVE;
      // The card's bottom edge then sits exactly one page padding above the viewport bottom.
      const container = root.querySelector<HTMLElement>('.list-page-container');
      const pagePb = container ? parseFloat(getComputedStyle(container).paddingBottom) || 0 : 0;
      const h = window.innerHeight - docTop - below - pagePb - this.bottomReserve;
      // Never collapse to an unusably short strip on tiny viewports.
      this.scrollMaxHeight.set(Math.max(240, Math.round(h)));
    });
  }

  ngAfterViewInit(): void {
    this.recomputeScrollMaxHeight();
    // The table's top moves when the filter bar or the toolbar / bulk bar change height, and the footer's height
    // follows the density: re-measure whenever any of them resizes (the value converges, so this cannot loop).
    if (typeof ResizeObserver !== 'undefined') {
      this.sizeObserver = new ResizeObserver(() => this.recomputeScrollMaxHeight());
      const root = this.hostRef.nativeElement as HTMLElement;
      for (const sel of ['.lp-head', '.lp-above', '.list-card']) {
        const el = root.querySelector(sel);
        if (el) this.sizeObserver.observe(el);
      }
    }
  }

  private sizeObserver?: ResizeObserver;

  // List State
  currentPage = signal(1);
  pageSize = signal(this.initialPageSize);
  /** Committed search term — the value the data source filters by.
   *  Only changes when the user submits (Enter or magnifier click);
   *  typing in the input updates `searchDraft` locally instead. */
  searchTerm = signal('');
  /** Local typing buffer for the search input. Nothing fires until
   *  the user commits via `submitSearch()`, which mirrors the rest
   *  of the app's submit-on-action search UX. */
  searchDraft = signal('');
  sortBy = signal<{ sortValue: string; sortDirection: 'asc' | 'desc' } | undefined>(undefined);
  activeFilters = signal<FilterState>({});
  filterLabels = signal<Record<string, string>>({});
  selectedRows = signal<T[]>([]);
  expandedRows = signal<Set<string>>(new Set());
  visibleColumns = signal<string[]>([]);

  // ══════════════════════════════════════════════════════════════
  // COMPUTED SIGNALS
  // ══════════════════════════════════════════════════════════════

  /**
   * Visible columns, with columns sharing the same `label` collapsed into a
   * single "leader" column that carries its siblings on `groupedItems`. The
   * table template renders the leader as one cell and stacks sibling values
   * inside it according to each sibling's `displayStyle`.
   */
  displayColumns = computed(() => {
    const allCols = this._columns();
    const visible = this.visibleColumns();
    const filtered = visible.length > 0
      ? allCols.filter(col => col.visible !== false && visible.includes(col.key))
      : ColumnHelper.getVisibleColumns(allCols);

    // Group by label. A label shared by multiple columns → one cell.
    const groups = new Map<string, TableColumn<T>[]>();
    for (const col of filtered) {
      const existing = groups.get(col.label);
      if (existing) existing.push(col);
      else groups.set(col.label, [col]);
    }

    const result: TableColumn<T>[] = [];
    groups.forEach(items => {
      if (items.length === 1) {
        result.push(items[0]);
      } else {
        items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        // Split into layout rows. First item always starts a row. Subsequent
        // items join the current row if their displayStyle is 'inline',
        // otherwise they start a new row.
        const rows: TableColumn<T>[][] = [];
        let current: TableColumn<T>[] = [];
        items.forEach((item, idx) => {
          if (idx === 0 || item.displayStyle !== 'inline') {
            if (current.length) rows.push(current);
            current = [item];
          } else {
            current.push(item);
          }
        });
        if (current.length) rows.push(current);

        // Leader keeps its own key/customTemplate/etc.; siblings live on `groupedItems`.
        result.push({ ...items[0], groupedItems: items, groupedRows: rows });
      }
    });
    result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return result;
  });

  /** Check if any filters are active */
  hasActiveFilters = computed(() =>
    FilterHelper.hasActiveFilters(this.activeFilters())
  );

  /** Count of active filters */
  activeFilterCount = computed(() =>
    FilterHelper.countActiveFilters(this.activeFilters())
  );

  /** Check if all visible rows are selected */
  allSelected = computed(() =>
    SelectionHelper.allSelected(this.data(), this.selectedRows(), this.idField)
  );

  /** Check if some (but not all) rows are selected */
  someSelected = computed(() =>
    SelectionHelper.someSelected(this.data(), this.selectedRows(), this.idField)
  );

  /** Enabled header actions (based on permissions) */
  enabledHeaderActions = computed(() =>
    this.headerActions.filter(action => this.hasPermission(action.permission))
  );

  /** Enabled bulk actions (based on permissions and selection) */
  enabledBulkActions = computed(() => {
    const hasSelection = this.selectedRows().length > 0;
    return this.bulkActions.filter(action =>
      this.hasPermission(action.permission) &&
      (!action.requiresSelection || hasSelection)
    );
  });

  /** Get custom cell template for column */
  getCellTemplate = computed(() => {
    const templates = this.cellTemplates?.toArray() || [];
    return (key: string) => {
      return templates.find(t => t.columnKey === key)?.template;
    };
  });


  /** Get custom header template */
  getHeaderTemplate = computed(() => (): TemplateRef<any> | undefined => {
    return this.headerTemplates?.first?.template;
  });

  /** Get custom row actions template */
  getRowActionsTemplate = computed(() => {
    const template = this.rowActionsTemplates?.first;  // ✅ Use .first
    return template?.template;
  });

  /** Full-width row-detail panel template (adds the chevron column when set). */
  getRowDetailTemplate = computed(() => this.rowDetailTemplates?.first?.template);

  /** Mobile-card slot templates (thumb / title / chip). */
  getMobileThumbTemplate = computed(() => this.mobileThumbTemplates?.first?.template);
  getMobileTitleTemplate = computed(() => this.mobileTitleTemplates?.first?.template);
  getMobileChipTemplate  = computed(() => this.mobileChipTemplates?.first?.template);

  /** True when the compact mobile card list should render (config supplied
   *  AND on a small viewport). */
  useMobileCards = computed(() => this.isMobile() && !!this.mobileCardConfig);

  /** Look up a column definition by key (for mobile metric/secondary cells,
   *  which reuse the shared cellContent template). */
  colByKey(key: string): TableColumn<T> {
    return this.columns.find(c => c.key === key) ?? ({ key, label: '' } as TableColumn<T>);
  }

  // ══════════════════════════════════════════════════════════════
  // PRIVATE PROPERTIES
  // ══════════════════════════════════════════════════════════════

  private destroy$ = new Subject<void>();
  private searchSubject$ = new Subject<string>();
  private subscriptions = new Subscription();
  private dataSubscription?: Subscription;

  /** Bound resize handler — stored so ngOnDestroy can remove exactly the
   *  listener that ngOnInit registered (an inline arrow in
   *  addEventListener can never be removed and leaks per instance). */
  private resizeHandler = () => this.checkViewportSize();

  /** Remembers the desktop view mode across a desktop → mobile → desktop
   *  round-trip, so a user's deliberate Grid choice on desktop survives
   *  rotating a tablet / resizing the window. */
  private preMobileViewMode: string | null = null;

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE HOOKS
  // ══════════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.initializeState();
    this.setupSearchDebounce();
    this.setupViewportDetection();

    // Kick off the prefs fetch. It may resolve before or after the parent
    // populates `columns` — `tryApplyPrefsAndLoad` handles both orderings and
    // fires the initial data load exactly once, after both are ready.
    // Note: we load prefs even when the URL restored columns, because the URL
    // only carries *keys* — for custom fields the column definition itself is
    // lazy, so we still need prefs to drive eager-loading via
    // `ensureCustomFieldsForPrefs`. If URL columns disagree with prefs, prefs
    // win (they are the canonical persisted state).
    if (this.entityType) {
      this.listPrefs.load(this.entityType).then(pref => {
        this._savedPrefs = pref?.columns ?? null;
        this.tryApplyPrefsAndLoad();
      });
    } else {
      this._savedPrefs = null;
    }
    this.tryApplyPrefsAndLoad();
  }

  /**
   * Fire the initial data load once columns are populated AND saved prefs
   * have been fetched (or we know there are none). Applies saved prefs to
   * the current column set before dispatching the load so `getProductList`
   * is called with the persisted visibility/order.
   */
  private async tryApplyPrefsAndLoad(): Promise<void> {
    if (this._initialLoadDispatched) return;
    if (this._savedPrefs === undefined) return;   // prefs still loading
    if (this._columns().length === 0) return;    // columns not yet populated
    this._initialLoadDispatched = true;

    console.debug('[list-page] tryApplyPrefsAndLoad', {
      entityType: this.entityType,
      savedPrefsKeys: this._savedPrefs?.map(p => p.key),
      currentColumnKeys: this._columns().map(c => c.key),
    });

    if (this._savedPrefs && this._savedPrefs.length > 0) {
      await this.ensureCustomFieldsForPrefs(this._savedPrefs);
      this.applyColumnPrefs(this._savedPrefs);
    }
    this.loadInitialData();
  }

  /**
   * If saved prefs reference column keys we don't have locally (likely custom
   * fields which are loaded lazily), eager-load custom fields now so the
   * table renders in the saved configuration on first paint.
   */
  private async ensureCustomFieldsForPrefs(prefs: ListColumnPref[]): Promise<void> {
    if (!this.loadCustomFieldsFn || this._customFieldsLoaded) return;
    const knownKeys = new Set(this._columns().map(c => c.key));
    const unknownKeys = prefs.filter(p => !knownKeys.has(p.key)).map(p => p.key);
    if (unknownKeys.length === 0) return;

    console.debug('[list-page] eager-loading custom fields for prefs', { unknownKeys });
    try {
      const merged = await this.loadCustomFieldsFn([...this._columns()]);
      this._columns.set(merged);
      this._customFieldsLoaded = true;
      console.debug('[list-page] custom fields loaded', {
        mergedKeys: merged.map(c => c.key),
      });
    } catch (e) {
      console.error('[list-page] failed to eager-load custom fields', e);
    }
  }

  /**
   * Merge saved column prefs (visibility + order) into the current columns.
   * Locked columns always stay visible — only their order can be overridden.
   */
  private applyColumnPrefs(prefs: ListColumnPref[]): void {
    const current = this._columns();
    if (current.length === 0) return;
    const prefMap = new Map(prefs.map(p => [p.key, p]));
    const cols = current.map(col => {
      const p = prefMap.get(col.key);
      if (!p) return col;
      if (col.locked) return {
        ...col,
        order: p.order ?? col.order,
        displayStyle: p.displayStyle ?? col.displayStyle,
      };
      return {
        ...col,
        visible: p.visible,
        order: p.order ?? col.order,
        displayStyle: p.displayStyle ?? col.displayStyle,
      };
    });
    cols.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    this._columns.set(cols);
    this.visibleColumns.set(ColumnHelper.getColumnKeys(cols));

    // Restore persisted per-column widths (resize handle).
    const widths: Record<string, number> = {};
    for (const p of prefs) if (typeof p.width === 'number') widths[p.key] = p.width;
    this.columnWidths.set(widths);
    console.debug('[list-page] applyColumnPrefs', {
      applied: cols.map(c => ({ key: c.key, visible: c.visible, order: c.order })),
      visibleColumns: ColumnHelper.getColumnKeys(cols),
    });
  }

  ngOnDestroy(): void {
    this.deferredCount.dispose();
    this.onDemandCount.dispose();
    this.unbindScrollHost();
    this.sizeObserver?.disconnect();
    this.listAbort?.abort();
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.unsubscribe();
    this.dataSubscription?.unsubscribe();
    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('scroll', this.pageScrollHandler, { capture: true } as any);
    document.removeEventListener('mousemove', this._onResizeMove);
    document.removeEventListener('mouseup', this._onResizeEnd);
    // Restore the normal padded shell for the next (non-list) page.
    if (this.fullBleed) this.layout.setNoPadding(false);
  }

  // ══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ══════════════════════════════════════════════════════════════

  private initializeState(): void {
    // Initialize default page size
    if (this.pagination.enabled && this.pagination.default) {
      this.pageSize.set(this.pagination.default);
    }

    // Initialize default sort
    if (this.sorting.enabled && this.sorting.defaultSort) {
      this.sortBy.set({
        sortValue: this.sorting.defaultSort.key,
        sortDirection: this.sorting.defaultSort.direction
      });
    }

    // Initialize visible columns
    this.visibleColumns.set(ColumnHelper.getColumnKeys(this.columns));

    // Restore state from URL if enabled
    if (this.syncToUrl) {
      this.restoreStateFromUrl();
      // React to EXTERNAL url changes (browser back/forward, or a pasted link)
      // so the list follows the address bar. Self-initiated navigations
      // (syncStateToUrl) produce params that already match the in-memory state,
      // so onUrlQueryParamsChanged is a no-op for them — no reload loop.
      this.subscriptions.add(
        this.route.queryParams.subscribe(() => this.onUrlQueryParamsChanged()),
      );
    }

    // Custom fields are loaded lazily when customize modal opens
  }

  /** Re-apply page/size/search/sort/filters from the URL when it changes
   *  externally (back/forward), then reload. Does NOT re-write the URL. */
  private onUrlQueryParamsChanged(): void {
    if (!this.syncToUrl || !this._initialLoadDispatched) return;

    const state = ListUrlStateHelper.fromQueryParams(this.route.snapshot.queryParams, {
      page: 1,
      pageSize: this.pageSize(),
      searchTerm: '',
      filters: {},
      visibleColumns: ColumnHelper.getColumnKeys(this.columns),
    });

    const nextPage = state.page ?? 1;
    const nextSize = state.pageSize ?? this.pageSize();
    const nextSearch = state.searchTerm ?? '';
    const nextSort = ListUrlStateHelper.validateRestoredSort(state.sortBy, this.columns, this.sorting)
      ?? (this.sorting.enabled && this.sorting.defaultSort
        ? { sortValue: this.sorting.defaultSort.key, sortDirection: this.sorting.defaultSort.direction }
        : undefined);
    const nextFilters = state.filters ?? {};

    const changed =
      nextPage !== this.currentPage() ||
      nextSize !== this.pageSize() ||
      nextSearch !== this.searchTerm() ||
      JSON.stringify(nextSort) !== JSON.stringify(this.sortBy()) ||
      JSON.stringify(nextFilters) !== JSON.stringify(this.activeFilters());

    if (!changed) return;

    this.currentPage.set(nextPage);
    this.pageSize.set(nextSize);
    this.searchTerm.set(nextSearch);
    this.searchDraft.set(nextSearch);
    this.sortBy.set(nextSort);
    this.activeFilters.set(nextFilters);
    this.loadData();
  }

  private setupSearchDebounce(): void {
    // Intentionally a no-op now — search runs on submit (Enter or
    // magnifier click), not on keystrokes. Kept as a hook so the
    // ngOnInit call site still type-checks; remove this method
    // entirely once nothing else references the debounce subject.
  }

  private setupViewportDetection(): void {
    this.checkViewportSize();
    window.addEventListener('resize', this.resizeHandler);
    // Page scroll drives the fixed phantom scrollbar's geometry. Capture
    // phase so nested scroll containers (drawers, inner panes) also
    // trigger a recompute; passive since we never preventDefault.
    window.addEventListener('scroll', this.pageScrollHandler, { capture: true, passive: true });
  }

  private checkViewportSize(): void {
    const wasMobile = this.isMobile();
    this.isMobile.set(window.innerWidth < 768);

    if (this.isMobile()) {
      // Entering mobile: remember the desktop mode once, then force the
      // mobile-appropriate body (grid, or the compact cards when
      // mobileCardConfig is supplied — useMobileCards gates on isMobile).
      if (!wasMobile) {
        this.preMobileViewMode = this.viewMode();
      }
      // A consumer extra view the user is on survives (opt-in, and re-checked on
      // every resize so rotating the phone does not bounce them back to cards).
      const keepExtra = this.mobileExtraViews && this.extraViewModes.some(e => e.id === this.viewMode());
      if (!keepExtra) this.viewMode.set('grid');
    } else if (wasMobile) {
      // Leaving mobile: restore whatever the user had on desktop
      // (table by default) instead of staying stuck on grid.
      this.viewMode.set(this.preMobileViewMode || 'table');
      this.preMobileViewMode = null;
      // The phone body was loaded without the gallery's image; fetch it only if the restored view needs it.
      if (this._loadedApiColumns) this.reloadIfViewNeedsMore();
    }
    // Keep the no-padding shell in sync with the effective (desktop-only)
    // full-bleed as the viewport crosses the mobile breakpoint.
    this.syncFullBleedShell();
  }

  private async loadCustomFields(): Promise<void> {
    if (this.loadCustomFieldsFn && !this._customFieldsLoaded) {
      try {
        const merged = await this.loadCustomFieldsFn(this.columns);
        this.columns = merged;
        this._customFieldsLoaded = true;
      } catch (e) {
        console.error('Failed to load custom fields', e);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ══════════════════════════════════════════════════════════════

  private loadInitialData(): void {
    this.loadData();
  }

  /** Scope signature of the last `loadData` call — used to detect whether a
   *  reload is a pagination/sort (same scope, keep selection) or a
   *  filter/search change (new scope, drop stale selections). */
  private _lastScope: string | null = null;

  loadData(): void {
    if (!this.dataSource) {
      console.warn('ListPageComponent: No dataSource provided');
      return;
    }

    // Cancel previous request
    this.dataSubscription?.unsubscribe();
    this.listAbort?.abort();
    this.listAbort = new AbortController();

    // Any reload (refresh, page, search, filter, sort) invalidates the tree caches and collapses every node.
    this.resetTree();

    this.isLoading.set(true);

    const params: ListQueryParams = {
      page: Math.max(1, Math.floor(this.currentPage()) || 1),
      limit: Math.min(MAX_PAGE_LIMIT, Math.max(1, Math.floor(this.pageSize()) || 1)),
      searchTerm: this.searchTerm() || undefined,
      sortBy: this.sortBy(),
      filter: this.activeFilters(),
      // API columns array — strips UI-only keys (`noApi: true`) like
      // image thumbnails / derived totals so the backend's matcher
      // doesn't silently drop search hits against non-existent
      // fields. Tracking-side `visibleColumns()` still includes them
      // so the table renders them locally.
      // The gallery adds its image key on top (see apiColumnsFor); the saved selection is untouched.
      columns: this.apiColumnsFor(this.viewMode()),
      signal: this.listAbort.signal,
    };
    this._loadedApiColumns = new Set(params.columns);

    // "Scope" excludes page/limit/sort — those operate on the same dataset
    // and should preserve selection across reloads. Search + filters change
    // the dataset itself, so scope changes trigger selection pruning.
    const scope = JSON.stringify({
      searchTerm: params.searchTerm ?? '',
      filter: params.filter ?? {},
    });
    const scopeChanged = this._lastScope !== null && this._lastScope !== scope;
    this._lastScope = scope;
    // Total in parallel (never blocks the rows): new on a search / filter change or a refresh, kept across page / sort.
    this.loadCount(params, scopeChanged || this.forceCount);
    this.forceCount = false;

    const listT0 = performance.now();
    const metricMode = this.isOnDemand() ? 'onDemand' : 'auto';
    const result = this.dataSource(params);
    const source$ = isObservable(result) ? result : from(Promise.resolve(result));

    this.dataSubscription = source$
      .pipe(
        tap((response: ListResponse<T>) => {
          recordListMetric({ kind: 'list', page: this.pageTitle, mode: metricMode, ms: performance.now() - listT0, ok: true });
          this.data.set(response.list);
          this.pruneOpenDetails(response.list);
          const pi = pageInfoFromResponse(response, params.page, params.limit);
          this.responseInfo.set({ total: pi.total, hasNext: pi.hasNext, pageCount: pi.pageCount });
          if (scopeChanged) this.pruneSelection(response.list);
          this.isLoading.set(false);
          this.announceTick.update(n => n + 1);
          // Wait for the DOM to flush the new rows before measuring
          // scrollWidth — otherwise the end-edge fade flashes off
          // even when the new data overflows the viewport.
          requestAnimationFrame(() => {
            if (this.scrollHost) this.updateScrollState(this.scrollHost.nativeElement);
          });
          this.recomputeScrollMaxHeight();
        }),
        catchError(error => {
          console.error('ListPageComponent: Error loading data', error);
          recordListMetric({ kind: 'list', page: this.pageTitle, mode: metricMode, ms: performance.now() - listT0, ok: false });
          this.isLoading.set(false);
          this._loadedApiColumns = null;   // nothing usable on screen: the next view switch must fetch
          this.data.set([]);
          if (scopeChanged) this.pruneSelection([]);
          this.responseInfo.set({ total: 0, hasNext: false });
          this.announceTick.update(n => n + 1);
          return of({ list: [], pageCount: 0 });
        })
      )
      .subscribe();
  }

  /**
   * Drop any selected row that isn't present in the freshly-loaded data.
   * Only called when the query scope (search/filters) changes — pagination
   * and sort keep the selection intact so users can multi-page select.
   */
  /** Forget detail panels whose row is no longer on screen (page/search change). */
  private pruneOpenDetails(newData: T[]): void {
    if (this.openDetailRows().size === 0) return;
    const visible = new Set(newData.map((r: any) => String(r?.[this.idField] ?? '')));
    this.openDetailRows.update((open) => new Set([...open].filter((id) => visible.has(id))));
  }

  private pruneSelection(newData: T[]): void {
    const selected = this.selectedRows();
    if (selected.length === 0) return;
    const visibleIds = new Set(newData.map((r: any) => r[this.idField]));
    const pruned = selected.filter((r: any) => visibleIds.has(r[this.idField]));
    if (pruned.length !== selected.length) {
      this.selectedRows.set(pruned);
      this.emitSelectionChange();
    }
  }

  refresh(): void {
    this.forceCount = true;   // on demand: back to "unknown" (or, with sticky active, counted again)
    this.loadData();
  }


  // ══════════════════════════════════════════════════════════════
  // ROW TREE (opt-in via [tree]): lazy children, per-node paging, cache, keyboard
  // ══════════════════════════════════════════════════════════════

  /** Turns the tree on. Without it the list renders exactly as before (flat rows, legacy `childrenKey` rows). */
  @Input() tree?: ListTreeConfig<T>;

  private hostRef = inject(ElementRef<HTMLElement>);

  /** Path keys (`rootId>childId>…`) of the expanded nodes. */
  readonly treeExpanded = signal<Set<string>>(new Set());
  /** Children state per (search + filter + sort + node id). Collapse / re-expand reuses it. */
  readonly treeStates = signal<Map<string, TreeNodeState<T>>>(new Map());
  /** Path keys that expanded to nothing: their chevron and pill go away until the next refresh. */
  readonly treeNoChildren = signal<Set<string>>(new Set());
  /** Polite announcement for expand / collapse / "more loaded". */
  readonly treeAnnouncement = signal('');
  private treeReq = 0;

  private readonly treeScope = computed(() =>
    JSON.stringify([this.searchTerm(), this.activeFilters(), this.sortBy() ?? null]));

  private readonly treeUnsupportedActive = computed(() => {
    const keys = this.tree?.unsupportedFilterKeys ?? [];
    const f = this.activeFilters();
    return keys.some(k => { const v = f[k]; return Array.isArray(v) ? v.length > 0 : v != null && v !== ''; });
  });

  private treeCacheKey(id: string): string { return this.treeScope() + '|' + id; }

  /** Drops every tree cache and collapses all nodes (refresh, page / search / filter / sort change). */
  resetTree(): void {
    this.treeReq++;
    this.treeExpanded.set(new Set());
    this.treeStates.set(new Map());
    this.treeNoChildren.set(new Set());
    this.treeAnnouncement.set('');
  }

  /** The rows the table renders: the plain data rows, or — in tree mode — roots with their loaded descendants. */
  readonly rowNodes = computed<ListRowNode<T>[]>(() => {
    const data = this.data();
    const tree = this.tree;
    if (!tree) {
      return data.map((row, i) => ({
        key: String(this.trackByFn(i, row)), kind: 'row' as const, row, level: 0, parentKey: null,
        setSize: data.length, posInSet: i + 1, expandable: false, expanded: false, inTree: false,
      }));
    }
    const out: ListRowNode<T>[] = [];
    const expanded = this.treeExpanded();
    const states = this.treeStates();
    const noKids = this.treeNoChildren();
    const maxLevels = tree.maxLevels ?? 3;
    const showNotice = this.treeUnsupportedActive();

    const walk = (rows: T[], level: number, parentKey: string | null, parentRow: T | null, inTree: boolean): void => {
      rows.forEach((row, i) => {
        const id = String((row as any)[this.idField]);
        const key = parentKey ? `${parentKey}>${id}` : id;
        const expandable = level < maxLevels - 1 && tree.canExpand(row, level) && !noKids.has(key);
        // A node that expanded to nothing loses its chevron (not expandable) but keeps its "No children" line.
        const isOpen = (expandable || noKids.has(key)) && expanded.has(key);
        const st = isOpen ? states.get(this.treeCacheKey(id)) : undefined;
        const hasRows = !!st && st.status === 'ready' && st.rows.length > 0;
        out.push({
          key, kind: 'row', row, level, parentKey, setSize: rows.length, posInSet: i + 1,
          expandable, expanded: isOpen, inTree: inTree || (isOpen && hasRows),
          loading: isOpen && (!st || st.status === 'loading'),
        });
        if (!isOpen) return;
        const childLevel = level + 1;
        const base = { level: childLevel, parentKey: key, parentRow: row, setSize: 0, posInSet: 0, expandable: false, expanded: false, inTree: true } as const;
        if (!st || st.status === 'loading') {
          for (let s = 0; s < 3; s++) out.push({ ...base, key: `${key}#skel${s}`, kind: 'skeleton', skel: s });
        } else if (st.status === 'error') {
          out.push({ ...base, key: `${key}#error`, kind: 'error' });
        } else if (st.rows.length === 0) {
          out.push({ ...base, key: `${key}#empty`, kind: 'empty' });
        } else {
          if (showNotice) out.push({ ...base, key: `${key}#notice`, kind: 'notice' });
          walk(st.rows, childLevel, key, row, true);
          if (st.hasNext) {
            out.push({
              ...base, key: `${key}#more`, kind: 'more', shown: st.fetched, total: st.total,
              remaining: st.total !== undefined ? Math.min(tree.pageSize ?? 15, st.total - st.fetched) : undefined,
              loadingMore: st.loadingMore, moreError: st.moreError,
            });
          }
        }
      });
    };
    walk(data, 0, null, null, false);
    return out;
  });

  /** Pill next to a row's name. Nothing before the children are known for deeper rows. */
  pillText(node: ListRowNode<T>): string {
    const tree = this.tree;
    if (!tree || node.kind !== 'row' || !node.expandable || !node.row) return '';
    const st = this.treeStates().get(this.treeCacheKey(String((node.row as any)[this.idField])));
    const count = st && st.status === 'ready' && st.total !== undefined ? st.total : null;
    if (node.level > 0 && count === null) return '';
    return tree.pillLabel(node.row, count);
  }

  toggleTreeNode(node: ListRowNode<T>, ev?: Event): void {
    ev?.stopPropagation();
    if (!this.tree || node.kind !== 'row' || !node.expandable || !node.row) return;
    const set = new Set(this.treeExpanded());
    const id = String((node.row as any)[this.idField]);
    if (set.has(node.key)) {
      set.delete(node.key);
      this.treeExpanded.set(set);
      // Collapsing cancels a load still in flight (its late result is ignored).
      const ck = this.treeCacheKey(id);
      const st = this.treeStates().get(ck);
      if (st && st.status === 'loading') {
        const m = new Map(this.treeStates());
        m.delete(ck);
        this.treeStates.set(m);
      }
      this.treeAnnouncement.set(this.translate.instant('COMMON.LP_TREE_ANN_COLLAPSED', { name: this.nodeName(node.row) }));
    } else {
      set.add(node.key);
      this.treeExpanded.set(set);
      void this.loadTreeNode(node, false);
    }
  }

  retryTreeNode(node: ListRowNode<T>): void {
    const parent = node.parentRow;
    if (!parent) return;
    const parentNode = this.rowNodes().find(n => n.key === node.parentKey);
    if (parentNode) void this.loadTreeNode(parentNode, node.kind === 'more');
  }

  loadMoreTree(node: ListRowNode<T>): void { this.retryTreeNode(node); }

  private nodeName(row: T): string { return String((row as any)?.name ?? (row as any)?.[this.idField] ?? ''); }

  private async loadTreeNode(node: ListRowNode<T>, more: boolean): Promise<void> {
    const tree = this.tree;
    const row = node.row;
    if (!tree || !row) return;
    const id = String((row as any)[this.idField]);
    const ck = this.treeCacheKey(id);
    const existing = this.treeStates().get(ck);
    const setState = (s: TreeNodeState<T>) => { const m = new Map(this.treeStates()); m.set(ck, s); this.treeStates.set(m); };

    if (!more && existing && existing.status === 'ready') {
      this.treeAnnouncement.set(this.translate.instant('COMMON.LP_TREE_ANN_EXPANDED', { name: this.nodeName(row), label: tree.pillLabel(row, existing.total ?? null) }));
      return;
    }
    if (more && (!existing || !existing.hasNext || existing.loadingMore)) return;

    const reqId = ++this.treeReq;
    const page = more ? existing!.page + 1 : 1;                 // page >= 1, never past the last page
    const limit = tree.pageSize ?? 15;
    if (more) setState({ ...existing!, loadingMore: true, moreError: false, reqId });
    else setState({ status: 'loading', rows: [], fetched: 0, hasNext: false, page: 1, loadingMore: false, moreError: false, reqId });

    try {
      const res = await tree.loadChildren(row, {
        page, limit,
        searchTerm: this.searchTerm() || undefined,
        sortBy: this.sortBy(),
        filter: this.activeFilters(),
      });
      // Collapsed, refreshed or re-filtered meanwhile: this result no longer belongs anywhere.
      if (this.treeStates().get(ck)?.reqId !== reqId) return;

      const raw = res.list ?? [];
      const pg = resolvePage(
        { page, limit, total: res.total === undefined || res.total === null ? undefined : Number(res.total), hasNext: res.hasNext },
        raw.length);
      const total = pg.total ?? undefined;
      const ancestors = node.key.split('>');
      const kept = raw.filter(r => {
        const rid = String((r as any)[this.idField]);
        if (ancestors.includes(rid)) { console.warn('[list-page] tree cycle skipped:', rid, 'under', node.key); return false; }
        return true;
      });

      if (!more && raw.length === 0) {
        const nk = new Set(this.treeNoChildren());
        nk.add(node.key);
        this.treeNoChildren.set(nk);
        setState({ status: 'ready', rows: [], fetched: 0, total: 0, hasNext: false, page: 1, loadingMore: false, moreError: false, reqId });
        this.treeAnnouncement.set(this.translate.instant('COMMON.LP_TREE_ANN_EMPTY', { name: this.nodeName(row) }));
        return;
      }
      setState({
        status: 'ready',
        rows: more ? [...existing!.rows, ...kept] : kept,
        fetched: (more ? existing!.fetched : 0) + raw.length,
        total, hasNext: pg.hasNext, page, loadingMore: false, moreError: false, reqId,
      });
      if (more) {
        this.treeAnnouncement.set(this.translate.instant('COMMON.LP_TREE_ANN_MORE', { count: kept.length }));
        if (kept.length) this.focusTreeNode(`${node.key}>${String((kept[0] as any)[this.idField])}`);
      } else {
        this.treeAnnouncement.set(this.translate.instant('COMMON.LP_TREE_ANN_EXPANDED', { name: this.nodeName(row), label: tree.pillLabel(row, total ?? null) }));
      }
    } catch (e) {
      console.error('[list-page] tree load failed', e);
      if (this.treeStates().get(ck)?.reqId !== reqId) return;
      if (more) setState({ ...existing!, loadingMore: false, moreError: true, reqId });
      else setState({ status: 'error', rows: [], fetched: 0, hasNext: false, page: 1, loadingMore: false, moreError: false, reqId });
    }
  }

  /** Moves focus to a rendered tree row (after "Show more", or to a parent with Left Arrow). */
  focusTreeNode(key: string): void {
    setTimeout(() => {
      const el = (this.hostRef.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-node-key="${CSS.escape(key)}"]`);
      (el?.querySelector<HTMLElement>('.lp-tbtn') ?? el)?.focus();
    });
  }

  /** Treegrid keys: Right expands, Left collapses (or moves to the parent). Enter / Space use the chevron button. */
  onTreeKeydown(ev: KeyboardEvent, node: ListRowNode<T>): void {
    if (!this.tree || node.kind !== 'row') return;
    const t = ev.target as HTMLElement;
    if (t.closest('input:not([type="checkbox"]), textarea, select, [contenteditable="true"]')) return;
    const rtl = getComputedStyle(this.hostRef.nativeElement).direction === 'rtl';
    const expandKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const collapseKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (ev.key === expandKey && node.expandable && !node.expanded) {
      this.toggleTreeNode(node);
      ev.preventDefault();
    } else if (ev.key === collapseKey) {
      if (node.expandable && node.expanded) this.toggleTreeNode(node);
      else if (node.parentKey) this.focusTreeNode(node.parentKey);
      else return;
      ev.preventDefault();
    }
  }

  /** Accessible name of a "Show N more" button. */
  moreAria(node: ListRowNode<T>): string {
    const parent = this.rowNodes().find(n => n.key === node.parentKey);
    const name = parent?.row ? this.nodeName(parent.row) : '';
    return node.remaining !== undefined
      ? this.translate.instant('COMMON.LP_TREE_SHOW_MORE_ARIA', { count: node.remaining, name })
      : this.translate.instant('COMMON.LP_TREE_SHOW_MORE_ARIA_PLAIN', { name });
  }

  // ══════════════════════════════════════════════════════════════
  // TOOLBAR (redesign): filter bar, sort menu, quick views, announcements
  // ══════════════════════════════════════════════════════════════

  @ViewChild(ListFilterBarComponent) filterBar?: ListFilterBarComponent;

  /** Bumped after every load so the live region re-announces even when the text is identical. */
  private readonly announceTick = signal(0);

  /** One atomic polite status message ("Showing 15 of 159 products") — never a bare number. */
  readonly announcement = computed(() => {
    const tick = this.announceTick();
    if (this.isLoading() || tick === 0) return '';
    const shown = this.data().length;
    const pg = this.pageInfo();
    const text = shown === 0
      ? this.translate.instant('COMMON.LP_NO_RESULTS_ANNOUNCE')
      : pg.totalKnown
        ? this.translate.instant('COMMON.LP_RESULTS_ANNOUNCE', { shown, total: pg.total, noun: this.resultsNoun }).trim()
        : this.translate.instant('COMMON.LP_RESULTS_ANNOUNCE_NOTOTAL', { shown, noun: this.resultsNoun }).trim();
    // A zero-width suffix on alternate loads makes screen readers announce identical consecutive messages.
    return tick % 2 ? text : text + '​';
  });

  /** Resolves a filter chip's text; handed to the filter bar. */
  readonly filterTextFn = (key: string): string => this.getFilterDisplayValue(key);

  /** Paging facts for the footer, the header pill and the announcements: the only reader of the response's paging fields. */
  readonly pageInfo = computed(() => {
    const cs = this.countState();
    const od = this.onDemandState();
    // On demand, only a count the user asked for counts: a total or page count riding on the list response is ignored.
    const resp = this.isOnDemand() ? { hasNext: this.responseInfo().hasNext } : this.responseInfo();
    const total = this.isOnDemand() ? (od.status === 'known' ? { total: od.total } : {}) : (cs.status === 'ready' ? { total: cs.total } : {});
    return resolvePage({ page: this.currentPage(), limit: this.pageSize(), ...resp, ...total }, this.data().length);
  });

  /** What the pill and footer show (see `pageChrome`). */
  readonly chrome = computed(() => this.isOnDemand()
    ? onDemandChrome(this.pageInfo(), this.onDemandState().status)
    : { ...pageChrome(this.pageInfo(), this.countPending()), status: null as null, pillKind: null as null });

  /** Per-page choices, never above what the API accepts. */
  readonly pageSizeOptions = computed(() => {
    const opts = (this.pagination?.pageLimits?.length ? this.pagination.pageLimits : [15, 30, 50, 100]).filter(n => n >= 1 && n <= MAX_PAGE_LIMIT);
    return opts.length ? opts : [15];
  });

  // ── Deferred total (countOnly) ───────────────────────────────────────────
  /** Optional: returns the total for the same search / filters. Used only while `listPageConfig.useDeferredCount` is on. */
  @Input() countSource?: (params: ListQueryParams, signal: AbortSignal) => Promise<number>;

  private readonly countState = signal<CountState>({ status: 'idle', sig: '' });
  private forceCount = false;

  /** True while the total is on its way: the pill and the footer show a skeleton, never a spinner that can hang. */
  readonly countPending = computed(() => this.countState().status === 'pending');

  private countSignature(): string { return JSON.stringify([this.searchTerm() || '', this.activeFilters()]); }

  private readonly deferredCount = new DeferredCount<ListQueryParams>({
    enabled: () => !!this.countSource && listPageConfig.useDeferredCount,
    fetch: (p, signal) => this.countSource!(p, signal),
    signature: p => JSON.stringify([p.searchTerm || '', p.filter ?? {}]),
    currentSignature: () => this.countSignature(),
    onChange: st => this.countState.set(st),
    debounceMs: 300,
  });

  /** Aborts the previous list request when a newer one starts. */
  private listAbort: AbortController | null = null;

  private loadCount(params: ListQueryParams, force: boolean): void {
    this.lastParams = params;
    if (this.isOnDemand()) this.onDemandCount.observe(params, this.forceCount);
    else this.deferredCount.load(params, force);
  }

  // ── On-demand total (countMode: 'onDemand') ──────────────────────────────
  /** The page's mode (`listPageConfig.resolveCountMode` lets `localStorage['invo.countMode']` override it). */
  @Input() countMode: CountMode = 'auto';

  /** True when no count request is made until the user asks (needs a `countSource` and the deferred flag on). */
  isOnDemand(): boolean {
    return !!this.countSource && listPageConfig.useDeferredCount && listPageConfig.resolveCountMode(this.countMode) === 'onDemand';
  }

  private lastParams: ListQueryParams | null = null;
  readonly onDemandState = signal<OnDemandState>({ status: 'unknown', sig: '' });

  private readonly onDemandCount = new OnDemandCount<ListQueryParams>({
    fetch: (p, signal) => this.countSource!(p, signal),
    signature: p => JSON.stringify([p.searchTerm || '', p.filter ?? {}]),
    currentSignature: () => this.countSignature(),
    onChange: st => { this.onDemandState.set(st); this.announceCountState(st); },
    sticky: () => listPageConfig.countStickyPerVisit,
    timeoutMs: COUNT_TIMEOUT_MS,
    debounceMs: 300,
    onMetric: m => recordListMetric({ kind: 'count', page: this.pageTitle, mode: 'onDemand', ...m }),
  });

  /** "Count" / "Show total" / "Retry": the same request from every button. Does nothing while counting. */
  requestCount(): void {
    if (!this.isOnDemand() || !this.lastParams) return;
    this.onDemandCount.request(this.lastParams);
  }

  /** Footer texts for the on-demand states (translated here; the pagination component stays language-free). */
  readonly countLabels = computed(() => ({
    showTotal: this.translate.instant('COMMON.LP_SHOW_TOTAL'),
    showTotalAria: this.translate.instant('COMMON.LP_COUNT_ARIA', { noun: this.resultsNoun }),
    of: this.translate.instant('COMMON.LP_OF'),
    counting: this.translate.instant('COMMON.LP_COUNTING'),
    couldntCount: this.translate.instant('COMMON.LP_COULDNT_COUNT'),
    retry: this.translate.instant('COMMON.LP_RETRY'),
    retryAria: this.translate.instant('COMMON.LP_COUNT_FAILED_ARIA', { noun: this.resultsNoun }),
  }));

  /** Polite announcement of a count state change ("Counting products", "10,581 products", "Couldn't count products"). */
  readonly countAnnouncement = signal('');
  private announceCountState(st: OnDemandState): void {
    if (st.status === 'unknown') { this.countAnnouncement.set(''); return; }
    const noun = this.resultsNoun;
    const text = st.status === 'counting' ? this.translate.instant('COMMON.LP_COUNTING_ANNOUNCE', { noun })
      : st.status === 'failed' ? this.translate.instant('COMMON.LP_COUNT_FAILED_ANNOUNCE', { noun })
      : this.translate.instant('COMMON.LP_COUNT_DONE_ANNOUNCE', { total: this.fmtCount(st.total ?? 0), noun });
    this.countAnnouncement.set(String(text).trim());
  }

  /** Total shown in the header pill, grouped ("10,581"). */
  fmtCount(n: number): string { return n.toLocaleString('en-US'); }

  /** Toolbar "Filter": adds the first chip when there is none; otherwise moves to the filter bar. */
  async onFilterButton(btn: HTMLElement): Promise<void> {
    if (this.beforeFilterOpen) await this.beforeFilterOpen();
    this.filterOpened.emit();
    if (this.hasActiveFilters()) this.filterBar?.focusFirstChip();
    else this.filterBar?.startAdd(btn);
  }

  /** The filter bar edited the filters: same state + API params the filter modal produced. */
  onInlineFilters(e: ListFilterChange): void {
    this.filterLabels.set(e.labels);
    this.applyFilters(e.filters);
  }

  /** Sort menu: every sortable column; picking one uses the list's own asc -> desc -> off cycle. */
  readonly sortMenuItems = computed<DropdownMenuBtnItem[]>(() => {
    const cur = this.sortBy();
    return this._columns().filter(c => c.sortable).map(c => ({
      label: c.headerLabel || c.label,
      click: () => this.onColumnSort(c),
      checked: cur?.sortValue === c.key,
      trailing: cur?.sortValue === c.key ? (cur.sortDirection === 'asc' ? 'up' as const : 'down' as const) : undefined,
    }));
  });

  /** The Sort button needs sorting enabled and at least one sortable column. */
  get showSort(): boolean { return !!this.sorting?.enabled && this.sortMenuItems().length > 0; }

  // Quick views
  readonly quickViewOptions = computed(() =>
    this._quickViews().map(v => ({ value: v.id, label: v.label, translate: false })));

  /** Id of the quick view whose preset equals the active filters, else a value no tab has (none selected). */
  readonly activeQuickView = computed(() => {
    const now = this.normFilters(this.activeFilters());
    return this._quickViews().find(v => this.normFilters(v.filters) === now)?.id ?? '__none__';
  });

  applyQuickView(id: string): void {
    const v = this._quickViews().find(q => q.id === id);
    if (!v) return;
    this.filterLabels.set({});
    this.applyFilters({ ...v.filters });
  }

  private normFilters(f: FilterState): string {
    const entries = Object.entries(f ?? {})
      .filter(([, v]) => !(v == null || v === '' || (Array.isArray(v) && !v.length)))
      .map(([k, v]) => [k, Array.isArray(v) ? [...v].map(String).sort() : String(v)] as const)
      .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(entries);
  }

  // ══════════════════════════════════════════════════════════════
  // SEARCH
  // ══════════════════════════════════════════════════════════════

  /** Keystroke handler — updates only the local draft. The actual
   *  filtered fetch happens on `submitSearch()` (Enter / magnifier
   *  click). Match the rest of the app's search UX. */
  onSearchInput(event: Event): void {
    if (!this.search.enabled) return;
    const target = event.target as HTMLInputElement;
    this.searchDraft.set(target.value);
  }

  /** Commit the draft as the active search term and fire a fetch.
   *  Respects the `minLength` config — short queries are silently
   *  ignored so users don't trigger noisy load-empty cycles. */
  submitSearch(): void {
    if (!this.search.enabled) return;
    const value = this.searchDraft();
    if (this.search.minLength && value.length > 0 && value.length < this.search.minLength) {
      return;
    }
    if (this.searchTerm() === value) return;
    this.searchTerm.set(value);
    this.syncAutoDateRange(value);
    this.currentPage.set(1);
    this.loadData();
    this.syncStateToUrl();
  }

  /** Esc — revert the draft to the committed term without firing
   *  a fetch. Lets users back out of an unsubmitted edit. */
  cancelSearchEdit(): void {
    this.searchDraft.set(this.searchTerm());
  }

  /** The range `search.defaultDateRange` added to the filters (so it can be taken off again with the search). */
  private autoDateRange: { keyFrom: string; keyTo: string; from: string; to: string } | null = null;

  private syncAutoDateRange(term: string): void {
    const cfg = this.search.defaultDateRange;
    if (!cfg) return;
    const f = this.activeFilters();
    if (term.trim()) {
      if (f[cfg.keyFrom] || f[cfg.keyTo]) return;
      const pad = (n: number) => String(n).padStart(2, '0');
      const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const to = new Date(), from = new Date();
      from.setMonth(from.getMonth() - (cfg.months ?? 3));
      this.autoDateRange = { keyFrom: cfg.keyFrom, keyTo: cfg.keyTo, from: ymd(from), to: ymd(to) };
      this.activeFilters.set({ ...f, [cfg.keyFrom]: this.autoDateRange.from, [cfg.keyTo]: this.autoDateRange.to });
    } else if (this.autoDateRange) {
      const a = this.autoDateRange;
      this.autoDateRange = null;
      if (f[a.keyFrom] === a.from && f[a.keyTo] === a.to) {
        const next = { ...f };
        delete next[a.keyFrom];
        delete next[a.keyTo];
        this.activeFilters.set(next);
      }
    }
  }

  clearSearch(): void {
    this.searchDraft.set('');
    this.searchTerm.set('');
    this.syncAutoDateRange('');
    this.currentPage.set(1);
    this.loadData();
    this.syncStateToUrl();
  }

  // ══════════════════════════════════════════════════════════════
  // SORTING
  // ══════════════════════════════════════════════════════════════

  onColumnSort(column: TableColumn<T>): void {
    if (!this.sorting.enabled || !column.sortable) return;

    const current = this.sortBy();
    let newSort: { sortValue: string; sortDirection: 'asc' | 'desc' } | undefined;

    if (current?.sortValue === column.key) {
      // Toggle direction: asc -> desc -> none
      if (current.sortDirection === 'asc') {
        newSort = { sortValue: column.key, sortDirection: 'desc' };
      } else {
        newSort = undefined; // Clear sort
      }
    } else {
      // New column sort
      newSort = { sortValue: column.key, sortDirection: 'asc' };
    }

    this.sortBy.set(newSort);
    this.currentPage.set(1);
    this.loadData();
    this.syncStateToUrl();

    this.sortChanged.emit({
      column: column.key,
      direction: newSort?.sortDirection || null
    });
  }

  getSortIcon(column: TableColumn<T>): string {
    const current = this.sortBy();
    if (current?.sortValue !== column.key) return '';
    return current.sortDirection === 'asc' ? 'ui-icon-arrow-up' : 'ui-icon-arrow-down';
  }

  /** True if any grouped sibling is marked `primary`. Used by the header
   *  template to show the flag icon on grouped leaders whose child is primary. */
  hasPrimaryItem(column: TableColumn<T>): boolean {
    return !!column.groupedItems?.some(i => i.primary);
  }

  // ══════════════════════════════════════════════════════════════
  // FILTERING
  // ══════════════════════════════════════════════════════════════

  toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  async openFilterModal(): Promise<void> {
    if (this.beforeFilterOpen) {
      await this.beforeFilterOpen();
    }
    this.filterOpened.emit();
    const ref = this.modalService.open<FilterModalComponent, FilterModalData, FilterModalResult>(
      FilterModalComponent,
      {
        size: 'md',
        data: {
          filters: this.filters,
          activeFilters: this.activeFilters(),
          filterLabels: this.filterLabels()
        }
      }
    );
    ref.afterClosed().then(result => {
      if (result) {
        this.filterLabels.set(result.labels || {});
        this.applyFilters(result.filters);
      }
    });
  }

  closeFilterModal(): void {
    // no-op — modal service handles closing
  }

  applyFilters(filters: FilterState): void {
    this.activeFilters.set(filters);
    this.currentPage.set(1);
    this.loadData();
    this.syncStateToUrl();
    this.closeFilterModal();

    this.filterChanged.emit({
      filters,
      hasActiveFilters: FilterHelper.hasActiveFilters(filters)
    });
  }

  /** The `to` key of a date-range filter: its chip is shown once, on the `from` key. */
  isRangeEndKey(key: string): boolean {
    return this.filters.some(f => f.type === 'date-range' && (f as any).keyTo === key && !!this.activeFilters()[(f as any).keyFrom]);
  }

  removeFilter(key: string): void {
    // A date range is one filter in two keys: removing its chip takes off both ends.
    const range = this.filters.find(f => f.type === 'date-range' && ((f as any).keyFrom === key || (f as any).keyTo === key)) as any;
    let newFilters = FilterHelper.removeFilter(this.activeFilters(), key);
    if (range) newFilters = FilterHelper.removeFilter(newFilters, key === range.keyFrom ? range.keyTo : range.keyFrom);
    this.filterLabels.update(labels => {
      const updated = { ...labels };
      delete updated[key];
      return updated;
    });
    this.applyFilters(newFilters);
  }

  clearAllFilters(): void {
    this.filterLabels.set({});
    this.applyFilters({});
  }

  getFilterDisplayValue(key: string): string {
    // Check stored labels first
    const storedLabel = this.filterLabels()[key];
    if (storedLabel) return storedLabel;

    const filter = this.filters.find(f =>
      'key' in f && f.key === key ||
      'keyFrom' in f && (f.keyFrom === key || f.keyTo === key)
    );

    if (!filter) return key;

    const value = this.activeFilters()[key];
    if (!value) return '';

    // Handle different filter types
    if (filter.type === 'date-range') {
      const dateFilter = filter as any;
      const from = this.activeFilters()[dateFilter.keyFrom];
      const to = this.activeFilters()[dateFilter.keyTo];
      if (from && to) {
        return `${this.formatDate(from)} - ${this.formatDate(to)}`;
      }
      return '';
    }

    if (filter.type === 'date-preset') {
      const s = String(value);
      if (s.startsWith('custom:')) {
        const [from, to] = s.slice(7).split('..');
        const fmt = (d: string) => d ? this.formatDate(d) : '…';
        return `${fmt(from)} - ${fmt(to)}`;
      }
      const codeLabels: Record<string, string> = {
        last7: 'COMMON.PERIOD_LAST_7', last14: 'COMMON.PERIOD_LAST_14', last30: 'COMMON.PERIOD_LAST_30',
      };
      return codeLabels[s] ? this.translate.instant(codeLabels[s]) : s;
    }

    // Try to find label from static options
    if ('options' in filter && Array.isArray((filter as any).options)) {
      const opts = (filter as any).options as any[];
      if (Array.isArray(value)) {
        return value.map((v: any) => opts.find(opt => opt.value === v)?.label || v).join(', ');
      }
      const option = opts.find(opt => opt.value === value);
      return option?.label || value;
    }

    if (Array.isArray(value)) {
      return value.join(', ');
    }

    return value.toString();
  }

  private formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ══════════════════════════════════════════════════════════════
  // PAGINATION
  // ══════════════════════════════════════════════════════════════

  goToPage(page: number): void {
    const pg = this.pageInfo();
    if (page < 1 || (pg.pageCount !== null && page > pg.pageCount)) return;
    if (pg.pageCount === null && page > this.currentPage() && !pg.hasNext) return;

    this.currentPage.set(page);
    this.loadData();
    this.syncStateToUrl();
    this.scrollToTop();

    this.pageChanged.emit({
      page,
      pageSize: this.pageSize()
    });
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1); // Reset to first page
    this.loadData();
    this.syncStateToUrl();

    this.pageChanged.emit({
      page: 1,
      pageSize: size
    });
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ══════════════════════════════════════════════════════════════
  // SELECTION
  // ══════════════════════════════════════════════════════════════

  toggleAllSelection(): void {
    if (!this.selectable) return;

    const newSelection = SelectionHelper.toggleAll(
      this.data(),
      this.selectedRows(),
      this.idField
    );

    this.selectedRows.set(newSelection);
    this.emitSelectionChange();
  }

  toggleRowSelection(row: T): void {
    if (!this.selectable) return;

    const newSelection = SelectionHelper.toggleRow(
      row,
      this.selectedRows(),
      this.idField
    );

    this.selectedRows.set(newSelection);
    this.emitSelectionChange();
  }

  isRowSelected(row: T): boolean {
    return SelectionHelper.isRowSelected(row, this.selectedRows(), this.idField);
  }

  clearSelection(): void {
    this.selectedRows.set([]);
    this.emitSelectionChange();
  }

  private emitSelectionChange(): void {
    this.selectionChanged.emit({
      selectedRows: this.selectedRows(),
      allSelected: this.allSelected()
    });
  }

  // ══════════════════════════════════════════════════════════════
  // ROW EXPANSION
  // ══════════════════════════════════════════════════════════════

  toggleRowExpansion(rowId: string, event?: Event): void {
    event?.stopPropagation();

    this.expandedRows.update(expanded => {
      const newSet = new Set(expanded);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  }

  isRowExpanded(rowId: string): boolean {
    return this.expandedRows().has(rowId);
  }

  // ── Row-detail panels (listRowDetail) ─────────────────────────────────────
  // Kept separate from `expandedRows` above, which drives `childrenKey` child
  // rows; a list can use either without the two fighting over the same set.

  /** Row ids whose detail panel is open. */
  openDetailRows = signal<Set<string>>(new Set());

  /** Emits the row each time its detail panel opens — hook for lazy loading. */
  @Output() rowDetailOpened = new EventEmitter<any>();

  isRowDetailOpen(rowId: string): boolean {
    return this.openDetailRows().has(rowId);
  }

  toggleRowDetail(row: any, event?: Event): void {
    event?.stopPropagation();
    const rowId = String(row?.[this.idField] ?? '');
    let opened = false;
    this.openDetailRows.update((open) => {
      const next = new Set(open);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
        opened = true;
      }
      return next;
    });
    if (opened) this.rowDetailOpened.emit(row);
  }

  /** Column count for the detail row's `colspan`. */
  detailColspan(): number {
    return (
      this.displayColumns().length +
      (this.selectable ? 1 : 0) +
      (this.getRowDetailTemplate() ? 1 : 0) +
      (this.rowActions.length > 0 || this.getRowActionsTemplate() ? 1 : 0)
    );
  }

  // ══════════════════════════════════════════════════════════════
  // ACTIONS
  // ══════════════════════════════════════════════════════════════

  onHeaderAction(action: ActionConfig): void {
    if (this.isActionDisabled(action)) return;

    if (action.handler) {
      action.handler();
    }

    this.actionClicked.emit({
      action,
      selectedRows: this.selectedRows()
    });
  }

  async onBulkAction(action: BulkActionConfig): Promise<void> {
    if (this.isActionDisabled(action)) return;

    // Show confirmation modal if configured
    if (action.confirmMessage) {
      const ref = this.modalService.open<ConfirmModalComponent, ConfirmModalData, boolean>(
        ConfirmModalComponent,
        {
          size: 'sm',
          data: {
            title: action.label,
            message: action.confirmMessage,
            confirm: action.label,
            danger: action.color === 'danger',
          },
        }
      );
      const confirmed = await ref.afterClosed();
      if (!confirmed) return;
    }

    if (action.handler) {
      action.handler(this.selectedRows());
    }

    this.actionClicked.emit({
      action,
      selectedRows: this.selectedRows()
    });
  }

  onRowAction(action: ActionConfig, row: T, event?: Event): void {
    event?.stopPropagation();

    if (this.isActionDisabled(action)) return;

    if (action.handler) {
      action.handler(row);
    }

    this.actionClicked.emit({
      action,
      row
    });
  }

  isActionDisabled(action: ActionConfig): boolean {
    if (typeof action.disabled === 'function') {
      return action.disabled();
    }
    return action.disabled || false;
  }

  // ══════════════════════════════════════════════════════════════
  // ROW EVENTS
  // ══════════════════════════════════════════════════════════════

  onRowClick(row: T, column: TableColumn<T> | undefined, event: MouseEvent): void {
    // Don't trigger if clicking on checkbox or action buttons
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.closest('button')) {
      return;
    }

    // Handle clickable column navigation
    if (column?.clickable?.enabled) {
      const route = typeof column.clickable.route === 'function'
        ? column.clickable.route(row)
        : column.clickable.route;

      const queryParams = column.clickable.queryParams
        ? (typeof column.clickable.queryParams === 'function'
          ? column.clickable.queryParams(row)
          : column.clickable.queryParams)
        : undefined;

      if (column.clickable.target === '_blank') {
        window.open(route, '_blank');
      } else {
        this.router.navigate([route], { queryParams });
      }
      return;
    }

    this.rowClicked.emit({ row, column, event });
  }

  // ══════════════════════════════════════════════════════════════
  // CELL RENDERING
  // ══════════════════════════════════════════════════════════════

  getCellValue(row: T, column: TableColumn<T>): any {
    return ColumnHelper.getNestedValue(row, column.key);
  }

  getFormattedCellValue(row: T, column: TableColumn<T>): string {
    const value = this.getCellValue(row, column);
    return ColumnHelper.formatCellValue(value, column, row);
  }

  getCellClass(row: T, column: TableColumn<T>): string {
    if (!column.cellClass) return '';

    if (typeof column.cellClass === 'function') {
      return column.cellClass(row);
    }

    return column.cellClass;
  }

  /** Alignment class for a column — 'end' right-aligns (numbers:
   *  price, stock, qty) in an RTL-safe way via logical text-end. */
  getAlignClass(column: TableColumn<T>): string {
    return column.align === 'end' ? 'text-end lp-col-num' : 'text-start';
  }

  getRowClass(row: T): string {
    if (!this.rowClass) return '';

    if (typeof this.rowClass === 'function') {
      return this.rowClass(row);
    }

    return this.rowClass;
  }

  highlightSearchTerm(text: string): string {
    if (!this.searchTerm() || !this.search.enabled) {
      return text;
    }
    return HighlightHelper.highlightText(text, this.searchTerm());
  }

  // ══════════════════════════════════════════════════════════════
  // COLUMN CUSTOMIZATION
  // ══════════════════════════════════════════════════════════════

  private _customFieldsLoaded = false;

  async openColumnCustomization(): Promise<void> {
    // Load custom fields if available and not yet loaded
    if (this.loadCustomFieldsFn && !this._customFieldsLoaded) {
      try {
        const currentCols = [...this._columns()];
        const merged = await this.loadCustomFieldsFn(currentCols);
        this._columns.set(merged);
        this._customFieldsLoaded = true;
        // Custom fields were just added with their defaults — reapply the saved
        // prefs so persisted visibility/order for custom fields takes effect.
        if (this._savedPrefs && this._savedPrefs.length > 0) {
          this.applyColumnPrefs(this._savedPrefs);
        }
      } catch (e) {
        console.error('Failed to load custom fields', e);
      }
    }

    // Sync visible state with visibleColumns signal before opening.
    // When visibleColumns is empty (no saved prefs / no user tweak yet) we
    // mirror the table's fallback: use the column's own `visible` flag so
    // defaults render as enabled instead of everything appearing disabled.
    const visibleKeys = this.visibleColumns();
    const useFallback = visibleKeys.length === 0;
    const allCols = this._columns();
    console.debug('[list-page] openColumnCustomization state', {
      visibleKeys,
      allColsSnapshot: allCols.map(c => ({ key: c.key, visible: c.visible, isCustomField: c.isCustomField })),
      savedPrefs: this._savedPrefs,
    });
    // The gallery always shows the image: its field reads checked and locked here, but what the user saved is
    // remembered and written back on apply, so the stored selection never changes because of the view.
    const galleryKey = this.viewMode() === 'gallery' ? this.galleryView?.imageKey : undefined;
    const userImageVisible = galleryKey
      ? (useFallback ? allCols.find(c => c.key === galleryKey)?.visible !== false : visibleKeys.includes(galleryKey))
      : false;
    const columnsWithState = allCols.map(col => ({
      ...col,
      visible: col.isCustomField
        ? (col.visible === true)
        : useFallback ? (col.visible !== false) : visibleKeys.includes(col.key),
      ...(galleryKey && col.key === galleryKey
        ? { visible: true, locked: true, lockedHint: 'COMMON.GALLERY_ALWAYS_SHOWN' }
        : {}),
    }));

    const ref = this.modalService.open<CustomizeColumnsModalComponent, CustomizeColumnsData, TableColumn[]>(
      CustomizeColumnsModalComponent,
      {
        drawer: true,
        drawerWidth: '420px',
        drawerResizable: true,
        // Desktop width is fixed; only the mobile bottom-sheet can be resized.
        drawerResizableWidth: false,
        data: { columns: columnsWithState }
      }
    );
    ref.afterClosed().then(result => {
      if (result && galleryKey) {
        // Undo the display-only lock: restore the user's own Image choice (and drop the temporary hint).
        result = result.map(c => {
          if (c.key !== galleryKey) return c;
          const { lockedHint, ...rest } = c;
          return { ...rest, visible: userImageVisible, locked: allCols.find(a => a.key === galleryKey)?.locked };
        });
      }
      if (result) {
        this.columns = result;
        this.visibleColumns.set(ColumnHelper.getColumnKeys(result));
        this.loadData();
        this.syncStateToUrl();
        this.persistColumnPrefs(result);
      }
    });
  }

  /** Persist column visibility + order + displayStyle + width to employee
   *  options for this entity. */
  private persistColumnPrefs(columns: TableColumn<T>[]): void {
    if (!this.entityType) return;
    const widths = this.columnWidths();
    const prefs: ListColumnPref[] = columns.map((col, i) => ({
      key: col.key,
      visible: col.visible !== false,
      order: col.order ?? i,
      ...(col.displayStyle ? { displayStyle: col.displayStyle } : {}),
      ...(widths[col.key] != null ? { width: widths[col.key] } : {}),
    }));
    this.listPrefs.save(this.entityType, prefs);
  }

  /**
   * "Reset Column Width" — Zoho-style: clears every column's saved drag-resized width (keeping
   * visibility/order/displayStyle as they are) and persists that back to `EmployeeOptions`, so the
   * table falls back to each column's default sizing on the next render. Callers (a page's own
   * header "⋯" menu) reach this via `@ViewChild(ListPageComponent)`.
   */
  resetColumnWidths(): void {
    this.columnWidths.set({});
    if (this.entityType) {
      const prefs: ListColumnPref[] = this.columns.map((col, i) => ({
        key: col.key, visible: col.visible !== false, order: col.order ?? i,
        ...(col.displayStyle ? { displayStyle: col.displayStyle } : {}),
      }));
      this.listPrefs.save(this.entityType, prefs);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // COLUMN RESIZING (desktop) — drag a header's end edge to resize;
  // double-click the handle to auto-fit (drop the override). Widths persist
  // per user via employee options (the same ListColumnPref store).
  // ══════════════════════════════════════════════════════════════

  /** User width overrides, keyed by column key (px). Empty = default sizing. */
  columnWidths = signal<Record<string, number>>({});
  private static readonly MIN_COL_WIDTH = 64;
  private _resize: { key: string; startX: number; startWidth: number } | null = null;

  /** Resizing is a desktop-only affordance. */
  get canResizeColumns(): boolean {
    return !this.isMobile();
  }

  /** Inline width style for a column: a fixed px lock once the user resizes it,
   *  otherwise the column's default min-width (auto/content sizing preserved so
   *  the flexible primary column and clamp() rules keep working). */
  colStyle(col: TableColumn<T>): Record<string, string> {
    const w = this.columnWidths()[col.key];
    if (w != null) {
      const px = `${w}px`;
      // [flexFirstColumn]: a saved / dragged width of the first column is its minimum; it still takes the slack.
      if (this.flexFirstColumn && this.displayColumns()[0]?.key === col.key) return { 'min-width': px };
      return { width: px, 'min-width': px, 'max-width': px };
    }
    return col.width ? { 'min-width': col.width } : {};
  }

  startColumnResize(col: TableColumn<T>, ev: MouseEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    const th = (ev.target as HTMLElement).closest('th') as HTMLElement | null;
    const startWidth = this.columnWidths()[col.key] ?? th?.offsetWidth ?? 150;
    this._resize = { key: col.key, startX: ev.clientX, startWidth };
    document.addEventListener('mousemove', this._onResizeMove);
    document.addEventListener('mouseup', this._onResizeEnd);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  private _onResizeMove = (ev: MouseEvent): void => {
    if (!this._resize) return;
    const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
    const delta = (ev.clientX - this._resize.startX) * (rtl ? -1 : 1);
    const w = Math.max(
      ListPageComponent.MIN_COL_WIDTH,
      Math.round(this._resize.startWidth + delta),
    );
    this.columnWidths.update(m => ({ ...m, [this._resize!.key]: w }));
  };

  private _onResizeEnd = (): void => {
    document.removeEventListener('mousemove', this._onResizeMove);
    document.removeEventListener('mouseup', this._onResizeEnd);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    this._resize = null;
    // Save on drag-end (not on every move) so we hit the API once per resize.
    this.persistColumnPrefs(this._columns());
  };

  /** Double-click the handle → drop the override so the column auto-fits to
   *  its content again. */
  autoFitColumn(col: TableColumn<T>, ev: MouseEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.columnWidths.update(m => {
      if (m[col.key] == null) return m;
      const n = { ...m };
      delete n[col.key];
      return n;
    });
    this.persistColumnPrefs(this._columns());
  }

  // ══════════════════════════════════════════════════════════════
  // VIEW MODE
  // ══════════════════════════════════════════════════════════════

  setViewMode(mode: string): void {
    // Prevent switching to table on mobile.
    if (this.isMobile() && mode === 'table') {
      return;
    }
    mode = this.normalizeViewMode(mode);
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode);
    this.viewModeChange.emit(mode);
    this.reloadIfViewNeedsMore();
  }

  /** True when the active view mode is one of the built-in
   *  table/grid bodies. False for any consumer-provided extra mode
   *  (e.g. 'tree') so the parent's projected content takes over. */
  isBuiltInView = computed<boolean>(() => {
    const m = this.viewMode();
    return m === 'table' || m === 'grid' || m === 'gallery';
  });

  // ══════════════════════════════════════════════════════════════
  // URL STATE SYNCHRONIZATION
  // ══════════════════════════════════════════════════════════════

  private restoreStateFromUrl(): void {
    const params = this.route.snapshot.queryParams;

    const state = ListUrlStateHelper.fromQueryParams(params, {
      page: 1,
      pageSize: this.pageSize(),
      searchTerm: '',
      filters: {},
      visibleColumns: ColumnHelper.getColumnKeys(this.columns)
    });

    if (state.page) this.currentPage.set(state.page);
    if (state.pageSize) this.pageSize.set(state.pageSize);
    if (state.searchTerm) {
      this.searchTerm.set(state.searchTerm);
      // Seed the draft too so the input shows the restored term.
      this.searchDraft.set(state.searchTerm);
    }
    // Invalid/unknown sorts are dropped: the default sort set in initializeState stays.
    const restoredSort = ListUrlStateHelper.validateRestoredSort(state.sortBy, this.columns, this.sorting);
    if (restoredSort) this.sortBy.set(restoredSort);
    if (state.filters) this.activeFilters.set(state.filters);
    if (state.visibleColumns) {
      this.visibleColumns.set(state.visibleColumns);
      this._urlColumnsRestored = true;
    }
  }

  private syncStateToUrl(): void {
    if (!this.syncToUrl) return;

    const state: Partial<ListPageState> = {
      page: this.currentPage(),
      pageSize: this.pageSize(),
      searchTerm: this.searchTerm(),
      sortBy: this.sortBy(),
      filters: this.activeFilters(),
      visibleColumns: this.visibleColumns()
    };

    const queryParams = ListUrlStateHelper.toQueryParams(state);

    // Null out any existing filter_ params not in the new state
    const currentParams = this.route.snapshot.queryParams;
    Object.keys(currentParams).forEach(key => {
      if (key.startsWith('filter_') && !(key in queryParams)) {
        queryParams[key] = null;
      }
    });

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }

  // ══════════════════════════════════════════════════════════════
  // PERMISSIONS
  // ══════════════════════════════════════════════════════════════

  private hasPermission(permission?: string): boolean {
    if (!permission) return true;

    // TODO: Integrate with PermissionService
    // if (this.permissionService) {
    //   return this.permissionService.has(permission);
    // }

    // Default: allow all if no permission service
    return true;
  }

  // ══════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ══════════════════════════════════════════════════════════════

  trackByFn(index: number, item: any): any {
    return item[this.idField] || index;
  }

  getVisiblePages(): (number | string)[] {
    const current = this.currentPage();
    const total = this.pageInfo().pageCount ?? 1;
    const delta = 2;

    const range: number[] = [];  // ✅ Changed to number[]
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    // Collect page numbers
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }

    // Add ellipsis
    for (const i of range) {  // ✅ Now i is always number
      if (l !== undefined) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  }
}
