import '../../account-i18n';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, model, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentPaperComponent } from '@shared/components/document-paper/document-paper.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';
import type { DocumentTemplate } from '../../../settings/document-builder/services/document-template.types';
import { DocRailItem } from '../../services/document-view-base';
import { DocRailFilterComponent, DocRailFilterOption } from '../doc-rail-filter/doc-rail-filter.component';

/**
 * Page template of every sales / purchase document view — Zoho Books layout: a left rail listing
 * the other records (search, "+", "⋯"), the open document with a title bar (icon actions, a close
 * button back to the list), a single toolbar row (Edit, Send Email, Share, an optional primary
 * action, then whatever the entity supplies through `moreItems`), notice banners, and the document
 * on paper edge-to-edge (no page padding) with a status ribbon in its corner.
 *
 * Slots: `banner` (the blue/gray tip strips above the paper), `alt` (shown instead of the paper
 * when `showPaper` is false, e.g. a merged invoice).
 */
@Component({
  selector: 'app-doc-view-shell',
  standalone: true,
  imports: [TranslateModule, DropdownMenuBtnComponent, DocumentPaperComponent, DocRailFilterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './doc-view-shell.component.scss',
  template: `
    <div class="dv">
      <!-- Record rail -->
      <aside class="dv-rail">
        <div class="dv-rail__head">
          @if (railFilterOptions().length) {
            <app-doc-rail-filter [options]="railFilterOptions()" [value]="railFilterValue()" [storageKey]="railFilterStorageKey()" (pickValue)="railFilterPick.emit($event)"/>
          } @else {
            <span class="dv-rail__title">{{ railTitle() | translate }}</span>
          }
          <div class="dv-rail__actions">
            @if (showAdd()) {
              <div class="dv-rail__btn-group">
                <button type="button" class="dv-rail__gbtn dv-rail__gbtn--primary dv-rail__gbtn--first" (click)="add.emit()" [attr.aria-label]="'COMMON.ADD' | translate">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                @if (addMenuItems().length) {
                  <app-dropdown-menu-btn [items]="addMenuItems()" [appendToBody]="true" [chevron]="false" align="start" triggerClass="dv-rail__gbtn dv-rail__gbtn--primary dv-rail__gbtn--caret">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </app-dropdown-menu-btn>
                }
              </div>
            }
            @if (railMoreItems().length) {
              <div class="dv-rail__btn-group">
                <app-dropdown-menu-btn [items]="railMoreItems()" [appendToBody]="true" [chevron]="false" align="start" triggerClass="dv-rail__gbtn dv-rail__gbtn--first">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 8c0 .83-.67 1.5-1.5 1.5S.5 8.83.5 8 1.17 6.5 2 6.5s1.5.67 1.5 1.5zM8 6.5c-.83 0-1.5.67-1.5 1.5S7.17 9.5 8 9.5 9.5 8.83 9.5 8 8.83 6.5 8 6.5zm6 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/></svg>
                </app-dropdown-menu-btn>
              </div>
            }
          </div>
        </div>
        <div class="dv-rail__search">
          <div class="dv-rail__search-box">
            <input type="text" [placeholder]="'COMMON.SEARCH' | translate" [value]="railTerm()" (input)="railSearch.emit($any($event.target).value)"/>
            @if (railTerm()) {
              <button type="button" class="dv-rail__search-clear" [attr.aria-label]="'COMMON.CLEAR' | translate" (click)="railSearch.emit('')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            }
          </div>
        </div>
        <div class="dv-rail__list">
          @if (railLoading() && !railItems().length) {
            @for (n of skeletonRows; track n) {
              <div class="dv-rail__item dv-skel" aria-hidden="true">
                <div class="dv-rail__row"><span class="dv-skel__bar" style="width: 55%"></span><span class="dv-skel__bar" style="width: 20%"></span></div>
                <span class="dv-skel__bar dv-skel__bar--sm" style="width: 40%"></span>
              </div>
            }
          } @else {
            @for (item of railItems(); track item.id) {
              <button type="button" class="dv-rail__item" [class.is-active]="item.id === selectedId()" (click)="railPick.emit(item)">
                <div class="dv-rail__row">
                  <span class="dv-rail__primary">{{ item.primary }}</span>
                  <span class="dv-rail__amount">{{ item.amountLabel }}</span>
                </div>
                <div class="dv-rail__sub">
                  <span>{{ item.sub }}</span>
                  @if (item.statusText) {
                    <span class="dv-rail__status" [class]="'dv-rail__status--' + (item.statusKind ?? 'neutral')">{{ item.statusText }}</span>
                  }
                </div>
                @if (item.badgeText) {
                  <div class="dv-rail__badge" [class.dv-rail__badge--warn]="item.badgeKind === 'warn'">{{ item.badgeText }}</div>
                }
              </button>
            } @empty {
              @if (!railLoading()) { <div class="dv-rail__empty">{{ 'DOC_VIEW.NO_RECORDS' | translate }}</div> }
            }
          }
        </div>
        @if (railPageCount() > 1) {
          <div class="dv-rail__pager">
            <button type="button" class="dv-rail__page-btn" [disabled]="railPage() <= 1" (click)="railPrev.emit()">‹ {{ 'COMMON.PREVIOUS' | translate }}</button>
            <span class="dv-rail__page-of">{{ railPage() }} / {{ railPageCount() }}</span>
            <button type="button" class="dv-rail__page-btn" [disabled]="railPage() >= railPageCount()" (click)="railNext.emit()">{{ 'COMMON.NEXT' | translate }} ›</button>
          </div>
        }
      </aside>

      <!-- Document -->
      <div class="dv-main">
        <header class="dv-titlebar">
          <h1>{{ docTitle() }}</h1>
          <div class="dv-titlebar__acts">
            <ng-content select="[titleExtra]"/>
            <button type="button" class="dv-icon" (click)="close.emit()" [attr.aria-label]="'COMMON.CLOSE' | translate">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </header>

        @if (showToolbar()) {
          <div class="dv-toolbar">
            @if (showEdit()) {
              <button type="button" class="dv-tool" (click)="edit.emit()">
                <svg width="14" height="14" viewBox="0 0 510 512" fill="currentColor"><path d="M50.3 512c-13.04 0-25.74-5.08-35.2-14.35C3.47 486.27-1.93 469.88.64 453.82l16.9-105.61c3.01-18.79 11.71-35.82 25.17-49.27l272.83-272.7c35.01-34.99 91.99-34.98 127.01.02l41.14 41.12c16.96 16.96 26.31 39.5 26.32 63.47 0 23.98-9.33 46.52-26.29 63.47L210.3 467.59c-12.98 12.98-29.4 21.57-47.47 24.84L59.23 511.2c-2.97.54-5.96.8-8.93.8zM379.02 39.99c-12.74 0-25.48 4.85-35.18 14.54L71 327.23c-7.46 7.45-12.28 16.9-13.95 27.31l-16.9 105.61c-.73 4.55 1.54 7.55 2.95 8.93 1.41 1.38 4.46 3.58 8.99 2.76l103.6-18.77A49.498 49.498 0 00182 439.3l273.4-273.27c9.4-9.39 14.57-21.89 14.57-35.18s-5.19-25.79-14.59-35.19l-41.14-41.12c-9.71-9.71-22.47-14.56-35.22-14.56z"/><path transform="rotate(-45.01 331.896 178.02)" d="M311.84 79.14h40.01v197.75h-40.01z"/></svg>
                {{ 'COMMON.EDIT' | translate }}
              </button>
            }
            @if (shareItems().length) {
              <app-dropdown-menu-btn [items]="shareItems()" [appendToBody]="true" align="start" triggerClass="dv-tool">
                <svg width="14" height="14" viewBox="0 0 512 512" fill="currentColor"><path d="M492 246.21c-11.05 0-20 8.95-20 20V412c0 33.08-26.92 60-60 60H100c-33.08 0-60-26.92-60-60V100c0-33.08 26.92-60 60-60h153.57c11.05 0 20-8.95 20-20s-8.96-20-20-20H100C44.86 0 0 44.86 0 100v312c0 55.14 44.86 100 100 100h312c55.14 0 100-44.86 100-100V266.21c0-11.05-8.95-20-20-20z"/><path d="M395.8 35.1l45.76 39.73C257.57 95.32 202.09 227.85 185.42 309.47c-2.21 10.82 4.77 21.39 15.6 23.6 1.35.28 2.69.41 4.02.41 9.31 0 17.64-6.53 19.57-16 11.26-55.15 33.97-100.31 67.49-134.22 37.97-38.41 89.6-61.41 153.86-68.63l-41.21 47.46c-7.24 8.34-6.35 20.97 1.99 28.21 3.79 3.29 8.46 4.9 13.1 4.9 5.59 0 11.16-2.33 15.11-6.89l72.12-83.06.11-.14a13.9 13.9 0 00.86-1.1c.12-.16.25-.32.37-.49.25-.37.48-.75.71-1.13.11-.19.23-.37.34-.56.2-.37.38-.75.56-1.12.1-.21.21-.42.31-.64.16-.36.28-.73.42-1.1.09-.25.19-.49.27-.74.11-.34.19-.69.28-1.04.08-.29.16-.57.22-.86.07-.31.11-.63.16-.94.06-.34.12-.68.15-1.02.03-.28.04-.57.06-.86.03-.38.05-.76.06-1.14 0-.08.01-.16.01-.24 0-.21-.02-.41-.03-.62-.01-.37-.02-.74-.06-1.11-.03-.31-.07-.62-.11-.93-.04-.33-.09-.67-.15-1-.06-.32-.13-.64-.21-.96-.07-.32-.15-.63-.24-.94-.09-.31-.19-.61-.29-.91-.11-.32-.22-.64-.35-.96-.11-.27-.23-.54-.35-.8a15 15 0 00-.86-1.68c-.2-.34-.4-.68-.62-1.02-.13-.2-.27-.4-.42-.6-.23-.33-.47-.65-.73-.97-.16-.2-.33-.39-.49-.58-.26-.3-.51-.59-.79-.87-.2-.2-.41-.39-.61-.59-.2-.19-.38-.38-.58-.56L422.02 4.9c-8.34-7.24-20.97-6.35-28.21 1.99-7.24 8.34-6.35 20.97 1.99 28.21z"/></svg>
                {{ 'DOC_VIEW.SHARE' | translate }}
              </app-dropdown-menu-btn>
            }
            <ng-content select="[toolbarExtra]"/>
            @if (printItems().length) {
              <app-dropdown-menu-btn [items]="printItems()" [appendToBody]="true" align="start" triggerClass="dv-tool">
                <svg width="14" height="14" viewBox="0 0 430 512" fill="currentColor"><path d="M329.86 512H100.14C44.92 512 0 467.14 0 412V100C0 44.86 44.92 0 100.14 0h139.17c24.06 0 46.69 9.36 63.71 26.34L403.6 126.72c17.03 17 26.41 39.61 26.41 63.66V412c0 55.14-44.92 100-100.14 100zM100.14 40c-33.13 0-60.08 26.92-60.08 60v312c0 33.08 26.95 60 60.08 60h229.73c33.13 0 60.08-26.92 60.08-60V190.38c0-13.36-5.21-25.92-14.67-35.36L274.7 54.64C265.24 45.2 252.67 40 239.31 40H100.14z"/><path d="M103.23 382.57c-5.43 0-10.83-2.19-14.77-6.49-7.24-7.89-6.98-20.08.61-27.65 3.32-3.32 6.73-6.52 10.23-9.62 8.78-8.81 22.9-24.28 37.22-45.44 21.13-31.22 47.12-81.75 51.01-145.16.63-10.33 9.06-18.48 19.42-18.77 10.37-.29 19.24 7.36 20.46 17.64.03.25 3.75 29.46 19.16 61.19 19.64 40.44 48.42 66.13 85.55 76.38 10.6 2.93 16.86 13.85 14.01 24.46-2.85 10.61-13.74 16.94-24.39 14.17-.26-.07-31.08-7.78-71.85-4.73-48.43 3.62-89.68 20.13-122.83 49.13-6.42 6.39-10.53 9.86-10.95 10.21a19.9 19.9 0 01-12.86 4.68zm109.08-153.25c-6.84 20.88-15.84 41.32-26.9 61.02 19.43-6.15 40.01-10.07 61.51-11.68-13.38-13.85-25-30.36-34.62-49.34z"/></svg>
                {{ 'DOC_VIEW.PRINT' | translate }}
              </app-dropdown-menu-btn>
            }
            @if (exportItems().length) {
              <app-dropdown-menu-btn [items]="exportItems()" [appendToBody]="true" align="start" triggerClass="dv-tool">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {{ 'DOC_VIEW.EXPORT' | translate }}
              </app-dropdown-menu-btn>
            }
            @if (actionItems().length) {
              <app-dropdown-menu-btn [items]="actionItems()" [appendToBody]="true" align="end" triggerClass="dv-tool dv-tool--more">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 8c0 .83-.67 1.5-1.5 1.5S.5 8.83.5 8 1.17 6.5 2 6.5s1.5.67 1.5 1.5zM8 6.5c-.83 0-1.5.67-1.5 1.5S7.17 9.5 8 9.5 9.5 8.83 9.5 8 8.83 6.5 8 6.5zm6 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/></svg>
              </app-dropdown-menu-btn>
            }
          </div>
        }

        <div class="dv-body">
          <ng-content select="[banner]"/>
          <ng-content select="[beforePaper]"/>

          @if (showPaper()) {
            <div class="dv-paper">
              @if (template() && data(); as d) {
                <div class="dv-paper__frame">
                  @if (ribbonText()) {
                    <div class="dv-ribbon-clip" aria-hidden="true">
                      <span class="dv-ribbon" [class.dv-ribbon--danger]="ribbonKind() === 'danger'">{{ ribbonText() }}</span>
                    </div>
                  }
                  <div class="dv-paper__scale" [style.zoom]="zoom() / 100">
                    <app-document-paper [template]="template()!" [data]="d"/>
                  </div>
                </div>
              } @else if (!loading()) {
                <div class="dv-empty">{{ 'DOC_VIEW.NO_TEMPLATE' | translate }}</div>
              }
            </div>
          } @else {
            <ng-content select="[alt]"/>
          }

          <ng-content select="[tabs]"/>
        </div>
      </div>
    </div>
  `,
})
export class DocViewShellComponent {
  /** Placeholder rows shown while the rail's first page is loading. */
  readonly skeletonRows = Array.from({ length: 7 }, (_, i) => i);

  docTitle = input<string>('');
  railTitle = input<string>('DOC_VIEW.ALL_RECORDS');
  railItems = input<DocRailItem[]>([]);
  railLoading = input<boolean>(false);
  railTerm = input<string>('');
  railPage = input<number>(1);
  railPageCount = input<number>(1);
  railMoreItems = input<DropdownMenuBtnItem[]>([]);
  /** Extra entries under the "+" split caret (e.g. "New Recurring Invoice"); the "+" itself always fires `add`. */
  addMenuItems = input<DropdownMenuBtnItem[]>([]);
  /** Turns the rail title into a status-filter dropdown (search + star favorites) when non-empty. */
  railFilterOptions = input<DocRailFilterOption[]>([]);
  railFilterValue = input<string | null>(null);
  /** `EmployeeOptions.docRailFavorites` key the filter's starred favorites are saved under. */
  railFilterStorageKey = input<string>('docRail');
  selectedId = input<string | null>(null);
  showAdd = input<boolean>(true);

  printItems = input<DropdownMenuBtnItem[]>([]);
  shareItems = input<DropdownMenuBtnItem[]>([]);
  exportItems = input<DropdownMenuBtnItem[]>([]);
  actionItems = input<DropdownMenuBtnItem[]>([]);
  showToolbar = input<boolean>(true);
  showEdit = input<boolean>(false);
  showPaper = input<boolean>(true);
  loading = input<boolean>(false);
  template = input<DocumentTemplate | null>(null);
  data = input<DocumentRenderData | null>(null);
  /** Zoom percentage; the page persists it. */
  zoom = model<number>(100);
  /** Diagonal corner ribbon (e.g. "Overdue"); omit for none. */
  ribbonText = input<string>('');
  ribbonKind = input<'warn' | 'danger'>('warn');

  railSearch = output<string>();
  railPick = output<DocRailItem>();
  railFilterPick = output<string | null>();
  railPrev = output<void>();
  railNext = output<void>();
  add = output<void>();
  close = output<void>();
  edit = output<void>();
}
