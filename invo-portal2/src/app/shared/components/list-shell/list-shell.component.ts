import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { ListSearchComponent } from '@shared/components/list-search/list-search.component';

/**
 * Shared chrome for list / index pages.
 *
 * Wraps three pieces every settings list page repeats by hand:
 *
 *   1. Page header — breadcrumbs + title + subtitle, with an optional
 *      action button on the trailing edge (e.g. "+ Add new"). Project
 *      action buttons via `[shellActions]`.
 *
 *   2. Toolbar — `<app-list-search>` paired with a prev/next pager.
 *      Both are driven by inputs/outputs so the parent owns the
 *      actual state. Optional extras (filter chips, type tabs) can be
 *      projected via `[shellToolbarExtra]`.
 *
 *   3. Card — wraps the table in a rounded panel that owns the empty
 *      and loading states. The parent projects the actual `<table>`
 *      (or any other body markup) as default content. Empty-state
 *      customisation goes through `[shellEmpty]` so each page can keep
 *      its own icon + message + call-to-action.
 *
 * **What this component DOES NOT do**:
 *   - Own the row templates. Rows differ too much across pages (drag
 *     handles, custom badges, multi-row groups). Pages keep their own
 *     table markup.
 *   - Own the search state. Parent owns the signal; we just wire it
 *     into the shared `<app-list-search>` with the same submit-on-
 *     enter UX every list page uses.
 *
 * Restyle the whole settings-style list surface by editing this file.
 */
@Component({
  selector: 'app-list-shell',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    BreadcrumbsComponent,
    ListSearchComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ls-page" [class.ls-page--wide]="wide">
      <header class="ls-header">
        <div class="ls-header__titles">
          @if (breadcrumbs?.length) {
            <app-breadcrumbs [items]="breadcrumbs ?? []" separator="chevron"/>
          }
          @if (title) { <h1 class="ls-title">{{ title }}</h1> }
          @if (subtitle) { <p class="ls-sub">{{ subtitle }}</p> }
        </div>
        <div class="ls-header__actions">
          <ng-content select="[shellActions]"/>
        </div>
      </header>

      @if (!hideToolbar) {
        <div class="ls-toolbar">
          <app-list-search
            [value]="search"
            [placeholder]="searchPlaceholder"
            [clearLabel]="'COMMON.CLEAR' | translate"
            [searchLabel]="'COMMON.SEARCH' | translate"
            [live]="searchLive"
            (search)="searchChange.emit($event)"
            (clear)="searchClear.emit()"/>

          <ng-content select="[shellToolbarExtra]"/>

          @if (total > 0 && pageCount > 1) {
            <div class="ls-pager">
              @if (rangeLabel) { <span class="ls-pager__range">{{ rangeLabel }}</span> }
              <button type="button" class="ls-pager__btn"
                      (click)="prevPage.emit()"
                      [disabled]="page <= 1 || loading"
                      [attr.aria-label]="'COMMON.PREVIOUS' | translate">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="rtl:rotate-180">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <button type="button" class="ls-pager__btn"
                      (click)="nextPage.emit()"
                      [disabled]="page >= pageCount || loading"
                      [attr.aria-label]="'COMMON.NEXT' | translate">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="rtl:rotate-180">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          }
        </div>
      }

      <!-- The wrapper class (.ls-card or not) is conditional, but
           the inside has ONE set of ng-content slots. Having multiple
           default ng-content in sibling control-flow branches
           silently drops projection - Angular binds only the first
           declaration, so the active branch's slot ends up empty. -->
      <div [class.ls-card]="!hideCard" [class.ls-card--flush]="cardFlush">
        @if (loading && !hasRows) {
          @if (customLoading) {
            <ng-content select="[shellLoading]"/>
          } @else {
            <div class="ls-loading"><span class="ls-spinner"></span></div>
          }
        } @else if (!hasRows) {
          <div class="ls-empty">
            <ng-content select="[shellEmpty]"/>
          </div>
        } @else {
          <ng-content/>
        }
      </div>
    </div>
  `,
  styles: [`
    .ls-page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 16px 24px 40px;
      position: relative;
    }
    .ls-page--wide { max-width: none; }

    .ls-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
    }
    .ls-header__titles { flex: 1; min-width: 0; }
    .ls-header__actions { display: flex; gap: 8px; flex-shrink: 0; }

    .ls-title {
      margin: 8px 0 4px;
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .ls-sub { margin: 0; font-size: 14px; color: #64748b; }

    .ls-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .ls-pager {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-inline-start: auto;
    }
    .ls-pager__range {
      font-size: 12px;
      color: #64748b;
      margin-inline-end: 4px;
    }
    .ls-pager__btn {
      width: 28px;
      height: 28px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #fff;
      color: #475569;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 120ms ease, color 120ms ease;
    }
    .ls-pager__btn:hover:not(:disabled) { background: #f8fafc; color: #0f172a; }
    .ls-pager__btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .ls-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    .ls-card--flush { padding: 0; }

    .ls-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 60px 0;
    }
    .ls-spinner {
      width: 28px; height: 28px;
      border-radius: 50%;
      border: 3px solid #e2e8f0;
      border-top-color: var(--color-brand-600, #0891b2);
      animation: ls-spin 0.8s linear infinite;
      display: inline-block;
    }
    @keyframes ls-spin { to { transform: rotate(360deg); } }

    .ls-empty {
      text-align: center;
      padding: 60px 16px;
      color: #94a3b8;
    }
    .ls-empty :where(svg) { color: #cbd5e1; margin-bottom: 8px; }
    .ls-empty :where(p) { margin: 0 0 12px; font-size: 13px; }
  `],
})
export class ListShellComponent {
  // ── Header ─────────────────────────────────────────────────────────
  @Input() title = '';
  @Input() subtitle = '';
  @Input() breadcrumbs: BreadcrumbItem[] | null = null;
  /** Drop the 1100px max-width so the shell stretches edge-to-edge.
   *  Set on pages where the existing layout was already full-width. */
  @Input() wide = false;

  // ── Search ─────────────────────────────────────────────────────────
  @Input() search = '';
  @Input() searchPlaceholder = '';
  /** Emit `search` on every keystroke (for client-side filters)
   *  instead of waiting for Enter / submit. */
  @Input() searchLive = false;
  @Output() searchChange = new EventEmitter<string>();
  @Output() searchClear  = new EventEmitter<void>();

  // ── Pagination ─────────────────────────────────────────────────────
  @Input() page = 1;
  @Input() pageCount = 1;
  @Input() total = 0;
  /** Pre-formatted "1–15 of 42" string — owned by the parent so it
   *  can use whatever pluralisation rules the page already has. */
  @Input() rangeLabel = '';
  @Output() prevPage = new EventEmitter<void>();
  @Output() nextPage = new EventEmitter<void>();

  // ── State ──────────────────────────────────────────────────────────
  @Input() loading = false;
  /** True when there are no rows to show. Controls whether the empty
   *  slot or the projected body content renders. */
  @Input() hasRows = false;
  /** True when the page projects its own loading content into
   *  `[shellLoading]` (e.g. a skeleton table). The default spinner
   *  is suppressed in that case. */
  @Input() customLoading = false;

  // ── Layout knobs ───────────────────────────────────────────────────
  /** Hide the toolbar entirely on pages that need a custom header
   *  layout. Defaults to false. */
  @Input() hideToolbar = false;
  /** Drop the card's internal padding when the slotted content
   *  already manages its own spacing (e.g. a `<table>`). */
  @Input() cardFlush = false;
  /** Skip the rounded card wrapper entirely — for pages that render
   *  a grid of cards or any other surface that owns its own framing
   *  (e.g. the custom-fields page). Loading + empty states still
   *  render, but without the rounded panel around them. */
  @Input() hideCard = false;
}
