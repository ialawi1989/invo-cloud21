import { Component, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { LayoutService } from '../../core/layout/services/layout.service';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';
import { AssistantPanelComponent } from '../ai/assistant/assistant-panel.component';
import { ScrollTopButtonComponent } from '@shared/components/scroll-top/scroll-top-button.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, TopbarComponent, ScrollTopButtonComponent, AssistantPanelComponent],
  template: `
    <app-topbar
      [collapsed]="sidebarCollapsed()"
      (menuToggle)="toggleMobileMenu()"
      (collapsedChange)="sidebarCollapsed.set($event)">
    </app-topbar>

    <app-sidebar
      [collapsed]="sidebarCollapsed()"
      [mobileOpen]="mobileMenuOpen()"
      (collapsedChange)="sidebarCollapsed.set($event)"
      (mobileOpenChange)="mobileMenuOpen.set($event)">
    </app-sidebar>

    <main class="main-content" [class.collapsed]="sidebarCollapsed()" [class.no-padding]="layoutSvc.noPadding()">
      <router-outlet></router-outlet>
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
    :host { display: flow-root; }
    .main-content {
      margin-top: 56px;
      margin-left: 240px;
      /* Published for FIXED-position children — the sticky form footer above
         all. A position:fixed child escapes this margin, so a full-width bar runs
         underneath the sidebar (z-index 1000 against the bar's 60) and its
         start edge is simply covered. Custom properties still inherit through
         the DOM to fixed descendants, so the bar can read the same number the
         layout is using instead of hard-coding a copy that drifts. */
      --app-content-start: 240px;
      min-height: calc(100vh - 56px);
      padding: 24px;
      /* App canvas: the legacy portal's light page colour (#f8f8fb). Lighter
         than the old blue-grey, so cards rely on their own hairline border. */
      background: #f8f8fb;
      transition: margin-left .25s ease;
    }
    .main-content.collapsed { margin-left: 56px; --app-content-start: 56px; }
    .main-content.no-padding {
      padding: 0;
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

    @media (max-width: 991px) {
      /* The sidebar becomes an overlay below this width, so nothing is
         reserved for it and the bar spans the full viewport again. */
      .main-content { margin-left: 0 !important; --app-content-start: 0px; overflow-x: hidden; }
    }
    @media (max-width: 576px) {
      .main-content:not(.no-padding) { padding: 16px; }
    }
  `]
})
export class MainLayoutComponent {
  readonly layoutSvc   = inject(LayoutService);
  private readonly router = inject(Router);
  sidebarCollapsed     = signal(false);
  mobileMenuOpen       = signal(false);

  /** Menu state to restore once a page that asked for it collapsed is left. */
  private restoreCollapsed: boolean | null = null;

  constructor() {
    // The router's `scrollPositionRestoration: 'top'` runs once, right at
    // NavigationEnd — before a lazy page has rendered. Anything that then
    // focuses or scrolls an element while the page settles (autofocus,
    // dropdown scrollIntoView, layout shifts) leaves the window scrolled a few
    // px, parking the page header behind the fixed top bar. Re-assert the top
    // once the new page has painted, for padded pages (window scrolls) too.
    // Same-path navigations (query-param/tab changes) and #fragment links keep
    // their position.
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
