import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { LayoutService } from '../../core/layout/services/layout.service';
import { SettingsModeService } from './services/settings-mode.service';
import { SettingsBreadcrumbComponent, SettingsSubmenuComponent } from './components/settings-nav/settings-submenu.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';
import { AssistantPanelComponent } from '../ai/assistant/assistant-panel.component';
import { EmployeeAvatarService } from '../auth/employee-avatar.service';
import { UserPreferencesService } from '../preferences/user-preferences.service';
import { ScrollTopButtonComponent } from '@shared/components/scroll-top/scroll-top-button.component';

/**
 * How a page sits in the frame, set per route via data.pageWidth:
 *  fluid  no cap (lists, tables, dashboards)
 *  form   capped at --page-form-max (forms, settings)
 *  narrow capped at --page-narrow-max (single-column forms that would look sparse at the form width)
 *  bleed  no gutters (edge-to-edge canvases and document views)
 * All of them keep the same left and top; only the right edge differs.
 *
 * RULE: every route that renders inside this shell must carry data: { pageWidth: 'fluid' | 'form' | 'narrow' | 'bleed' } (on the route
 * or a parent route; the deepest wins). A route without it is treated as 'fluid'. Pages themselves must NOT set an outer padding, margin,
 * max-width, centering or background on their host or outermost wrapper — the page frame owns all of that.
 */
export type PageWidth = 'fluid' | 'form' | 'narrow' | 'bleed';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, TopbarComponent, ScrollTopButtonComponent, AssistantPanelComponent, SettingsSubmenuComponent, SettingsBreadcrumbComponent],
  template: `
    <app-topbar
      [collapsed]="navCollapsed()"
      (menuToggle)="toggleMobileMenu()"
      (collapsedChange)="sidebarCollapsed.set($event)">
    </app-topbar>

    <app-sidebar
      [collapsed]="navCollapsed()"
      [mobileOpen]="mobileMenuOpen()"
      (collapsedChange)="sidebarCollapsed.set($event)"
      (mobileOpenChange)="mobileMenuOpen.set($event)">
    </app-sidebar>

    <main class="main-content" [class.collapsed]="navCollapsed()" [class.no-padding]="layoutSvc.noPadding()"
          [class.in-settings]="settingsMode.inSettingsMode()">
      <!-- The settings rail (when on) is a sibling of the page frame, rendered once. The frame is the ONLY place that gives a
           page its gutters and width cap: pages must not set their own outer padding, margin, max-width, centering or
           background on their host or outermost wrapper. -->
      <div class="app-body">
        <!-- Only ever rendered in settings mode, so the rail, its breadcrumb and the settings catalog UI load lazily. -->
        @if (settingsMode.showSubmenu()) {
          @defer (on immediate) { <app-settings-submenu class="settings-sub" [class.collapsed]="settingsMode.railCollapsed()"/> }
        }
        <div class="page-frame" [attr.data-width]="pageWidth()">
          @if (settingsMode.showSubmenu()) { @defer (on immediate) { <app-settings-breadcrumb/> } }
          <div class="page-frame__content"><router-outlet></router-outlet></div>
        </div>
      </div>
    </main>

    <!-- Assistant chat panel; opened from the top bar button. -->
    <app-ai-assistant/>

    <!-- Global "back to top", visible on every routed page. -->
    <app-scroll-top-button/>
  `,
  styles: [`
    /* A block formatting context: without it <main>'s margin-top (the fixed top bar's height) collapses out through
       this inline host and shifts <app-root> and <body> down by 56px, which gave every page an extra 56px of document
       scroll on top of its own inner scroller. */
    :host {
      display: flow-root;
      /* Width tokens of the page frame. 'form' pages (forms, settings) are capped here, once; 'fluid' pages are not. */
      --page-gutter: 24px;
      --page-form-max: 1200px;
      --page-narrow-max: 840px;
    }
    .main-content {
      margin-top: 56px;
      margin-left: 240px;
      min-height: calc(100vh - 56px);
      /* Wide content (a table) scrolls inside its own container; the page itself never scrolls sideways. clip creates
         no scroll container, so sticky children and page scrolling are unaffected. */
      overflow-x: clip;
      /* App canvas: the legacy portal's light page colour (#f8f8fb). Lighter
         than the old blue-grey, so cards rely on their own hairline border. */
      background: var(--ui-page);
      transition: margin-left .25s ease;
    }
    .main-content.collapsed { margin-left: 56px; }

    /* [rail | page frame]. Without the settings rail the row is just the frame. */
    .app-body { display: flex; align-items: flex-start; min-height: calc(100vh - 56px); min-height: calc(100dvh - 56px); }
    .page-frame { flex: 1; min-width: 0; box-sizing: border-box; padding: var(--page-gutter); padding-bottom: calc(var(--page-gutter) + var(--mobile-action-bar-h, 0px)); } /* phones: room for the fixed form-actions bar */
    .page-frame__content { min-width: 0; }
    .page-frame[data-width='form'] > .page-frame__content { max-width: var(--page-form-max); }
    .page-frame[data-width='narrow'] > .page-frame__content { max-width: var(--page-narrow-max); }
    /* 'bleed': edge-to-edge canvases (calendar, map, document views with their own record rail). No gutters. */
    .page-frame[data-width='bleed'] { padding: 0 0 var(--mobile-action-bar-h, 0px); }

    /* The settings rail: docked against the main menu, flush with the top bar, full height, in view while the page scrolls. */
    /* Reserves the rail's width while its (lazy) component loads, so the page does not jump. */
    .settings-sub-ph { width: 224px; flex-shrink: 0; box-sizing: border-box; background: var(--ui-surface); border-inline-end: 1px solid var(--ui-line); }
    .settings-sub-ph.collapsed { width: 56px; }
    @media (max-width: 1199px) { .settings-sub-ph { width: 184px; } .settings-sub-ph.collapsed { width: 56px; } }
    @media (max-width: 767px) { .settings-sub-ph { display: none; } }
    .settings-sub { position: sticky; top: 56px; align-self: flex-start; height: calc(100vh - 56px); height: calc(100dvh - 56px); }
    /* Most pages draw their own breadcrumb (<app-breadcrumbs>, settings-aware); the shell crumb only shows on pages with none. */
    .page-frame:has(app-breadcrumbs) > app-settings-breadcrumb { display: none; }

    /* Height-bound pages (lists, calendars, document views): a fixed-height flex column that does not scroll as a whole,
       so a pinned pagination row stays reachable. The frame and its content fill it. */
    .main-content.no-padding {
      /* dvh (dynamic viewport height) excludes the mobile browser's toolbars,
         so the pinned bottom row (e.g. list pagination) isn't hidden behind
         iOS Safari's bottom bar. Fallback to vh for older engines. */
      height: calc(100vh - 56px);
      height: calc(100dvh - 56px);
      min-height: unset;
      /* clip, not hidden: hidden still lets focus()/scrollIntoView() scroll
         the box programmatically, which pushed the page header behind the
         fixed top bar after navigating in. clip forbids any scroll offset. */
      overflow: hidden;
      overflow: clip;
      display: flex;
      flex-direction: column;
    }
    .main-content.no-padding .app-body { flex: 1; min-height: 0; align-items: stretch; }
    .main-content.no-padding .page-frame { display: flex; flex-direction: column; min-height: 0; }
    .main-content.no-padding .page-frame__content { flex: 1; min-height: 0; display: flex; flex-direction: column; }

    @media (max-width: 991px) {
      /* The sidebar becomes an overlay below this width, so nothing is
         reserved for it and the bar spans the full viewport again. */
      .main-content { margin-left: 0 !important; overflow-x: clip; }
    }
    @media (max-width: 767px) {
      :host { --page-gutter: 16px; }
      /* The settings sub-menu becomes a strip above the frame. */
      .app-body { flex-direction: column; align-items: stretch; }
      .settings-sub { position: static; height: auto; }
    }

    /* Print: exactly the old output (main had its own 24px padding, none for height-bound pages); the frame adds nothing.
       The settings chrome hides itself, and in settings mode the content takes the whole page. */
    @media print {
      .page-frame { padding: 0; }
      .main-content:not(.no-padding) { padding: 24px; }
      .main-content.in-settings { margin: 0 !important; padding: 0 !important; }
      .app-body { display: block; min-height: 0; }
    }
  `]
})
export class MainLayoutComponent {
  readonly layoutSvc   = inject(LayoutService);
  readonly settingsMode = inject(SettingsModeService);
  /** Settings mode always shows the full-width menu, so the app menu's collapsed state is ignored while it is on. */
  readonly navCollapsed = computed(() => this.sidebarCollapsed() && !this.settingsMode.inSettingsMode());
  private readonly router = inject(Router);
  sidebarCollapsed     = signal(false);

  /** data.pageWidth of the active route (deepest wins, so a parent route can set it for all its children). */
  private readonly routeWidth = signal<PageWidth | null>(null);
  /** The frame mode for the current page: whatever the route says with data: { pageWidth }, else 'fluid'. Explicit on purpose. */
  readonly pageWidth = computed<PageWidth>(() => this.routeWidth() ?? 'fluid');
  mobileMenuOpen       = signal(false);

  /** Menu state to restore once a page that asked for it collapsed is left. */
  private restoreCollapsed: boolean | null = null;

  constructor() {
    this.settingsMode.shellActive.set(true);
    inject(DestroyRef).onDestroy(() => this.settingsMode.shellActive.set(false));
    // The employee's own preferences (timezone, formats, language) apply from the first screen after sign-in.
    void inject(UserPreferencesService).load();
    void inject(EmployeeAvatarService).sync();
    // The router's `scrollPositionRestoration: 'top'` runs once, right at
    // NavigationEnd — before a lazy page has rendered. Anything that then
    // focuses or scrolls an element while the page settles (autofocus,
    // dropdown scrollIntoView, layout shifts) leaves the window scrolled a few
    // px, parking the page header behind the fixed top bar. Re-assert the top
    // once the new page has painted, for padded pages (window scrolls) too.
    // Same-path navigations (query-param/tab changes) and #fragment links keep
    // their position.
    const readWidth = () => {
      let r: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
      let w: PageWidth | null = null;
      while (r) { const v = r.data?.['pageWidth']; if (v) w = v as PageWidth; r = r.firstChild; }
      this.routeWidth.set(w);
    };
    readWidth();
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(readWidth);
    let lastPath = this.router.url.split(/[?#]/)[0];
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(e => {
      const [path, ...rest] = e.urlAfterRedirects.split('#');
      const pathOnly = path.split('?')[0];
      const changed = pathOnly !== lastPath;
      lastPath = pathOnly;
      if (!changed || rest.length) return;
      const settle = () => { if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'instant' }); };
      requestAnimationFrame(() => requestAnimationFrame(settle));
      setTimeout(settle, 250);
    });

    // Entering settings mode on purpose (the gear) opens the phone drawer, which is where the settings menu lives.
    effect(() => {
      if (this.settingsMode.enterRequest() > 0 && window.matchMedia('(max-width: 991px)').matches) {
        untracked(() => this.mobileMenuOpen.set(true));
      }
    });

    effect(() => {
      const wanted = this.layoutSvc.collapseSidebar();
      untracked(() => {
        if (wanted) {
          this.restoreCollapsed = this.sidebarCollapsed();
          this.sidebarCollapsed.set(true);
        } else if (this.restoreCollapsed !== null) {
          this.sidebarCollapsed.set(this.restoreCollapsed);
          this.restoreCollapsed = null;
        }
      });
    });
  }

  toggleMobileMenu() { this.mobileMenuOpen.set(!this.mobileMenuOpen()); }
}
