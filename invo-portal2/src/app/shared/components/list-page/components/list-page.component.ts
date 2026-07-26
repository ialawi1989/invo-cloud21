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
  MobileCardConfig
} from '../interfaces/list-page.types';

// Directives
import {
  ListCellTemplateDirective,
  ListHeaderTemplateDirective,
  ListRowActionsDirective,
  ListMobileThumbDirective,
  ListMobileTitleDirective,
  ListMobileChipDirective,
  ListRowDetailDirective
} from '../directives/list-template.directives';

// FilterModal - MUST be relative import from same folder
import { FilterModalComponent, FilterModalData, FilterModalResult } from './filter-modal.component';
import { ModalService } from '../../../modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '../../../modal/demo/confirm-modal.component';
import { CustomizeColumnsModalComponent, CustomizeColumnsData } from './customize-columns-modal.component';
import { PaginationComponent } from '../../pagination';
import { BreadcrumbsComponent, BreadcrumbItem } from '../../breadcrumbs';
import { ListPreferencesService } from '../../../../core/layout/services/list-preferences.service';
import { ListColumnPref } from '../../../../core/layout/services/employee-options.service';
import { LayoutService } from '../../../../core/layout/services/layout.service';
import { TooltipDirective } from '../../../directives/tooltip.directive';

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
    ListCellTemplateDirective,
    ListRowActionsDirective,
    ListMobileThumbDirective,
    ListMobileTitleDirective,
    ListMobileChipDirective,
    FilterModalComponent,
    PaginationComponent,
    BreadcrumbsComponent,
    TranslateModule,
    TooltipDirective
  ],
  templateUrl: './list-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    /* ── Sticky columns (checkbox + primary on the start edge, actions
       on the end edge) ─────────────────────────────────────────────────
       Keep the sticky cells opaque so rows underneath don't bleed through
       when the user scrolls horizontally, and match the row hover colour
       so the sticky cells don't look out of place on hover. */
    .list-sticky-cell {
      background-color: #ffffff;
      transition: background-color 150ms ease;
    }
    tr.list-row:hover .list-sticky-cell { background-color: #f4fbfb; }
    tr.list-row-expanded .list-sticky-cell { background-color: #ecfafd; }

    /* Expanded child rows: keep their frozen (start + actions) cells opaque
       and tinted to match the child row so scrolling content tucks cleanly
       under them instead of bleeding over the sticky columns. */
    tr.list-child-row .list-sticky-cell,
    tr.list-child-row .list-floating-actions { background-color: #f5fdfd; }
    tr.list-child-row:hover .list-sticky-cell,
    tr.list-child-row:hover .list-floating-actions { background-color: #ecfafd; }

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

    /* Pinned Actions — TRANSPARENT (Wix-style): only the buttons inside float
       to the end edge over the row content; the cell itself has no background,
       so it doesn't read as a solid frozen column. The buttons carry their own
       white pill/shadow for legibility. */
    .list-floating-actions { background: transparent; }

    /* ── End-edge shadow ────────────────────────────────────────────────
       Placed at the table's right EDGE (inside the pinned Actions cell, no
       translate, no z-index so it sits BELOW the buttons but above the content
       scrolling under the transparent cell). It fades that content out at the
       edge and marks "more columns this way". Shown only while there is content
       still to scroll toward the end (.list-has-scroll-end). */
    .list-floating-actions::before,
    .list-actions-th::before {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      inset-inline-end: 0;
      width: 32px;
      background: linear-gradient(to left, rgba(15, 23, 42, 0.16), rgba(15, 23, 42, 0));
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .list-has-scroll-end .list-floating-actions::before,
    .list-has-scroll-end .list-actions-th::before { opacity: 1; }
    :host-context([dir="rtl"]) .list-floating-actions::before,
    :host-context([dir="rtl"]) .list-actions-th::before {
      background: linear-gradient(to right, rgba(15, 23, 42, 0.16), rgba(15, 23, 42, 0));
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
      scrollbar-color: #cbd5e1 transparent;
    }
    /* WebKit/Blink: slim vertical bar, no horizontal bar (phantom drives it). */
    .list-page-container .overflow-x-auto::-webkit-scrollbar { width: 10px; height: 0; }
    .list-page-container .overflow-x-auto::-webkit-scrollbar:horizontal { display: none; }
    .list-page-container .overflow-x-auto::-webkit-scrollbar-thumb {
      background: #cbd5e1;
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
      padding: 0 24px 20px;
      /* Comfortable, Wix-like row rhythm — roomy but not airy. */
      --row-pad-y: 12px;
    }
    .lp-fullbleed thead th {
      padding-top: 12px !important;
      padding-bottom: 12px !important;
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
    .list-page-container.lp-fullbleed > .mb-6:not(.list-card) {
      flex: 0 0 auto;
      padding: 14px 4px 0;
      margin-bottom: 10px;
    }
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
    .lp-fullbleed .list-card > :not(.relative):not(.lp-mcards):not(.grid):not([listCustomView]) {
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
    .lp-fullbleed .list-card > .border-t {
      padding-bottom: max(16px, env(safe-area-inset-bottom));
    }
    .lp-fullbleed .list-card > .relative,
    .lp-fullbleed .list-card > .lp-mcards,
    .lp-fullbleed .list-card > .grid {
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
    .lp-fullbleed .list-card > .grid {
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
      background: #f8fafc;
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
    .lp-fullbleed.lp-fit .list-card > .grid { flex: 0 1 auto; min-height: 0; }
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
    .lp-col-resizer:active::after { background: #7fb5bd; }

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
      background: rgba(255, 255, 255, 0.92);
      border-top: 1px solid #e6e8ee;
      scrollbar-width: thin;
      scrollbar-color: #9fbfc2 #eef2f6;
    }
    .lp-hscroll::-webkit-scrollbar { height: 10px; }
    .lp-hscroll::-webkit-scrollbar-track {
      background: #eef2f6;
      border-radius: 5px;
    }
    .lp-hscroll::-webkit-scrollbar-thumb {
      background: #9fbfc2;
      border-radius: 5px;
      border: 2px solid #eef2f6;
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
      background: #f8fafc !important;
      color: #4a5163 !important;
      font-size: 14px;
      font-weight: 600;
      padding: 13px 18px !important;
      white-space: nowrap;
      border-top: 0 !important;
      border-bottom: 1px solid #e2e8f0 !important;
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
    .list-page-container { --row-pad-y: 12px; }
    .list-page-container tbody td {
      padding: var(--row-pad-y, 12px) 18px !important;
      font-size: 14px;
      color: #4a5163;
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
    .list-page-container tbody td:not(.list-floating-actions):not(.start-0):not(.list-sticky-col):not(.list-disclosure-cell),
    .list-page-container thead th:not(.list-actions-th):not(.start-0):not(.list-sticky-col):not(.list-disclosure-cell) {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* Subtle row dividers (recolour the Tailwind divide-y borders) */
    .list-page-container tbody tr { border-top-color: #e6e8ee !important; }
    /* Row hover (override Tailwind hover:bg-slate-50) */
    .list-page-container tbody tr.list-row:hover { background-color: #f4fbfb !important; }
    /* Teal accent — checkboxes + link-styled values */
    .list-page-container input[type="checkbox"] { accent-color: #00aab3; }
    .list-page-container .list-interactive-cell { color: #00aab3; }

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
      padding-left: 16px !important; padding-right: 0 !important;
    }
    .list-page-container th.list-sticky-col,
    .list-page-container td.list-sticky-col {
      width: var(--lp-sticky-col-w, 300px);
      min-width: var(--lp-sticky-col-w, 300px);
      max-width: var(--lp-sticky-col-w, 300px);
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
      border-bottom: 1px solid #eef2f6; cursor: pointer;
      transition: background-color 120ms ease;
    }
    .lp-mcard:last-child { border-bottom: 0; }
    .lp-mcard:hover { background-color: #f4fbfb; }
    .lp-mcard__thumb {
      flex: 0 0 auto; width: 38px; height: 31px; border-radius: 7px;
      overflow: hidden; background: #f1f5f9; border: 1px solid #e2e8f0;
      display: flex; align-items: center; justify-content: center;
    }
    .lp-mcard__thumb :is(img) { width: 100%; height: 100%; object-fit: cover; display: block; }
    .lp-mcard__body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .lp-mcard__line1 {
      display: flex; align-items: center; gap: 6px; min-width: 0;
      font-size: 14px; font-weight: 600; color: #0f172a;
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
      overflow: hidden; font-size: 12.5px; color: #64748b;
    }
    .lp-mcard__secondary { flex: 0 0 auto; font-size: 12px; color: #94a3b8; white-space: nowrap; }
    .lp-mcard__actions { flex: 0 0 auto; margin-inline-start: 2px; }
    .lp-mcard__chevron {
      flex: 0 0 auto; width: 26px; height: 26px; border-radius: 8px;
      display: inline-flex; align-items: center; justify-content: center;
      color: #94a3b8; transition: color 120ms ease, background-color 120ms ease;
    }
    .lp-mcard__chevron:hover { color: #0e7490; background: #ecfeff; }
    /* Floating selection bar — lifted clear of any page-level sticky footer
       via --lp-selbar-offset (set by the host page). */
    .lp-selbar { bottom: calc(1rem + var(--lp-selbar-offset, 0px)) !important; }
    @media (min-width: 640px) {
      .lp-selbar { bottom: calc(1.5rem + var(--lp-selbar-offset, 0px)) !important; }
    }
    .lp-mcard-detail { border-bottom: 1px solid #eef2f6; background: #f8fafc; }
    .lp-skel { background: #f1f5f9; animation: lp-skel-pulse 1.2s ease-in-out infinite; }
    .lp-mcard--skel { cursor: default; }
    .lp-mcard--skel:hover { background: transparent; }
    @keyframes lp-skel-pulse { 50% { opacity: .55; } }
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

  // ══════════════════════════════════════════════════════════════
  // STATE SIGNALS
  // ══════════════════════════════════════════════════════════════

  // Data
  data = signal<T[]>([]);
  totalCount = signal<number>(0);
  pageCount = signal<number>(1);

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
  @ViewChild('scrollHost') scrollHost?: ElementRef<HTMLElement>;

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
      const docTop = host.getBoundingClientRect().top + window.scrollY;
      const h = window.innerHeight - docTop - ListPageComponent.SCROLL_BOTTOM_RESERVE - this.bottomReserve;
      // Never collapse to an unusably short strip on tiny viewports.
      this.scrollMaxHeight.set(Math.max(240, Math.round(h)));
    });
  }

  ngAfterViewInit(): void {
    this.recomputeScrollMaxHeight();
  }

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
    const nextSort = state.sortBy
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
      this.viewMode.set('grid');
    } else if (wasMobile) {
      // Leaving mobile: restore whatever the user had on desktop
      // (table by default) instead of staying stuck on grid.
      this.viewMode.set(this.preMobileViewMode || 'table');
      this.preMobileViewMode = null;
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

    this.isLoading.set(true);

    const params: ListQueryParams = {
      page: this.currentPage(),
      limit: this.pageSize(),
      searchTerm: this.searchTerm() || undefined,
      sortBy: this.sortBy(),
      filter: this.activeFilters(),
      // API columns array — strips UI-only keys (`noApi: true`) like
      // image thumbnails / derived totals so the backend's matcher
      // doesn't silently drop search hits against non-existent
      // fields. Tracking-side `visibleColumns()` still includes them
      // so the table renders them locally.
      columns: ColumnHelper.getApiColumnKeys(this.columns)
    };

    // "Scope" excludes page/limit/sort — those operate on the same dataset
    // and should preserve selection across reloads. Search + filters change
    // the dataset itself, so scope changes trigger selection pruning.
    const scope = JSON.stringify({
      searchTerm: params.searchTerm ?? '',
      filter: params.filter ?? {},
    });
    const scopeChanged = this._lastScope !== null && this._lastScope !== scope;
    this._lastScope = scope;

    const result = this.dataSource(params);
    const source$ = isObservable(result) ? result : from(Promise.resolve(result));

    this.dataSubscription = source$
      .pipe(
        tap((response: ListResponse<T>) => {
          this.data.set(response.list);
          this.pruneOpenDetails(response.list);
          this.pageCount.set(response.pageCount);
          if (response.count !== undefined) {
            this.totalCount.set(response.count);
          }
          if (scopeChanged) this.pruneSelection(response.list);
          this.isLoading.set(false);
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
          this.isLoading.set(false);
          this.data.set([]);
          if (scopeChanged) this.pruneSelection([]);
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
    this.loadData();
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
    this.currentPage.set(1);
    this.loadData();
    this.syncStateToUrl();
  }

  /** Esc — revert the draft to the committed term without firing
   *  a fetch. Lets users back out of an unsubmitted edit. */
  cancelSearchEdit(): void {
    this.searchDraft.set(this.searchTerm());
  }

  clearSearch(): void {
    this.searchDraft.set('');
    this.searchTerm.set('');
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
    return current.sortDirection === 'asc' ? '↑' : '↓';
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

  removeFilter(key: string): void {
    const newFilters = FilterHelper.removeFilter(this.activeFilters(), key);
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
    if (page < 1 || page > this.pageCount()) return;

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
    return column.align === 'end' ? 'text-end' : 'text-start';
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
    const columnsWithState = allCols.map(col => ({
      ...col,
      visible: col.isCustomField
        ? (col.visible === true)
        : useFallback ? (col.visible !== false) : visibleKeys.includes(col.key),
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
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode);
    this.viewModeChange.emit(mode);
  }

  /** True when the active view mode is one of the built-in
   *  table/grid bodies. False for any consumer-provided extra mode
   *  (e.g. 'tree') so the parent's projected content takes over. */
  isBuiltInView = computed<boolean>(() => {
    const m = this.viewMode();
    return m === 'table' || m === 'grid';
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
    if (state.sortBy) this.sortBy.set(state.sortBy);
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
    const total = this.pageCount();
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
