import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, effect, inject, input, model, output, untracked, viewChild,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

export type SidebarTab = 'settings' | 'tables' | 'objects';

const STORAGE_KEY = 'tm.sidebar.collapsed';

/** Whether the sidebar was left collapsed last time (the page needs it at start-up to size the canvas). */
export function readSidebarCollapsed(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

/**
 * The floor-plan editor's one docked right sidebar: a header with tabs (Settings / Tables / Objects), one scrolling body, and a fixed
 * footer. It does not overlay the canvas: the page gives the canvas the remaining width (see `--sb-w`). It collapses to a thin rail
 * and remembers that in localStorage.
 *
 * List / detail flow: while `detailTitle` is set the header shows "← Tables · name" in place of the tabs and the body shows the
 * detail content; going back restores the list's scroll position. Content is projected: the default slot is the body (the page puts
 * the list or the detail there) and `[sidebarFooter]` is the fixed footer.
 */
@Component({
  selector: 'app-floor-plan-sidebar',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.sb-host--collapsed]': 'collapsed()' },
  template: `
    @if (collapsed()) {
      <button type="button" class="sb__rail" (click)="collapsed.set(false)"
              [attr.aria-label]="'SETTINGS.TABLES.SHOW_PANEL' | translate" [title]="'SETTINGS.TABLES.SHOW_PANEL' | translate">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        <span class="sb__rail-label">{{ 'SETTINGS.TABLES.PANEL_TITLE' | translate }}</span>
      </button>
    } @else {
      <section class="sb" [attr.aria-label]="'SETTINGS.TABLES.PANEL_TITLE' | translate">
        <header class="sb__head">
          @if (detailTitle(); as title) {
            <button type="button" class="sb__back" (click)="back.emit()"
                    [attr.aria-label]="(tab() === 'objects' ? 'SETTINGS.TABLES.BACK_TO_OBJECTS' : 'SETTINGS.TABLES.BACK_TO_TABLES') | translate">
              <svg class="sb__flip" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
              </svg>
              {{ (tab() === 'objects' ? 'SETTINGS.TABLES.PANEL_OBJECTS' : 'SETTINGS.TABLES.PANEL_TABLES') | translate }}
            </button>
            <span class="sb__dot" aria-hidden="true">·</span>
            <h3 class="sb__title" [title]="title">{{ title }}</h3>
          } @else {
            <h3 class="sb__title">{{ 'SETTINGS.TABLES.PANEL_TITLE' | translate }}</h3>
          }
          <button type="button" class="sb__collapse" (click)="collapsed.set(true)"
                  [attr.aria-label]="'SETTINGS.TABLES.HIDE_PANEL' | translate" [title]="'SETTINGS.TABLES.HIDE_PANEL' | translate">
            <svg class="sb__flip" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </header>

        @if (!detailTitle()) {
          <div class="sb__tabs" role="tablist" [attr.aria-label]="'SETTINGS.TABLES.PANEL_TITLE' | translate" (keydown)="onTabsKey($event)">
            @for (t of tabs; track t) {
              <button type="button" role="tab" class="sb__tab" [class.sb__tab--active]="tab() === t"
                      [id]="'sb-tab-' + t" [attr.aria-selected]="tab() === t" [attr.aria-controls]="'sb-panel'"
                      [attr.tabindex]="tab() === t ? 0 : -1" (click)="tabChange.emit(t)">
                {{ ('SETTINGS.TABLES.PANEL_' + t.toUpperCase()) | translate }}
                @if (t === 'tables') { <span class="sb__count">{{ tablesCount() }}</span> }
                @if (t === 'objects') { <span class="sb__count">{{ objectsCount() }}</span> }
              </button>
            }
          </div>
        }

        <div #body class="sb__body" id="sb-panel" role="tabpanel" [attr.aria-labelledby]="detailTitle() ? null : 'sb-tab-' + tab()">
          @for (view of [detailTitle() ? 'detail' : 'list']; track view) {
            <div class="sb__view" [class.sb__view--detail]="view === 'detail'">
              <ng-content/>
            </div>
          }
        </div>

        <footer class="sb__footer"><ng-content select="[sidebarFooter]"/></footer>
      </section>
    }
  `,
  styleUrl: './floor-plan-sidebar.component.scss',
})
export class FloorPlanSidebarComponent {
  private injector = inject(Injector);

  tab = input<SidebarTab>('settings');
  tablesCount = input(0);
  objectsCount = input(0);
  /** Set (non-null) while a table / object is open for editing: the header shows the back link and this title. */
  detailTitle = input<string | null>(null);

  /** Folded to a thin rail. Two-way (`[(collapsed)]`) so the page can size the canvas; persisted here. */
  collapsed = model(readSidebarCollapsed());

  tabChange = output<SidebarTab>();
  back = output<void>();

  readonly tabs: readonly SidebarTab[] = ['settings', 'tables', 'objects'];

  private body = viewChild<ElementRef<HTMLElement>>('body');
  private savedScroll = 0;

  constructor() {
    effect(() => {
      const c = this.collapsed();
      untracked(() => { try { localStorage.setItem(STORAGE_KEY, c ? '1' : '0'); } catch { /* storage unavailable */ } });
    });

    // Opening a detail view starts it at the top; going back puts the list where it was.
    let wasDetail = false;
    effect(() => {
      const detail = !!this.detailTitle();
      untracked(() => {
        const el = this.body()?.nativeElement;
        if (detail && !wasDetail) {
          this.savedScroll = el?.scrollTop ?? 0;
          afterNextRender(() => { const b = this.body()?.nativeElement; if (b) b.scrollTop = 0; }, { injector: this.injector });
        } else if (!detail && wasDetail) {
          afterNextRender(() => { const b = this.body()?.nativeElement; if (b) b.scrollTop = this.savedScroll; }, { injector: this.injector });
        }
        wasDetail = detail;
      });
    });
  }

  /** Arrow keys move between the tabs (the tab list is one tab stop). */
  onTabsKey(e: KeyboardEvent): void {
    const rtl = getComputedStyle(e.currentTarget as Element).direction === 'rtl';
    const i = this.tabs.indexOf(this.tab());
    let next = i;
    if (e.key === 'ArrowRight') next = i + (rtl ? -1 : 1);
    else if (e.key === 'ArrowLeft') next = i + (rtl ? 1 : -1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = this.tabs.length - 1;
    else return;
    e.preventDefault();
    next = (next + this.tabs.length) % this.tabs.length;
    this.tabChange.emit(this.tabs[next]);
    afterNextRender(() => (document.getElementById('sb-tab-' + this.tabs[next]) as HTMLElement | null)?.focus(), { injector: this.injector });
  }
}
