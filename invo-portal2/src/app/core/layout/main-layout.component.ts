import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LayoutService } from '../../core/layout/services/layout.service';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';
import { ScrollTopButtonComponent } from '@shared/components/scroll-top/scroll-top-button.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, TopbarComponent, ScrollTopButtonComponent],
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

    <!-- Global "back to top", visible on every routed page. -->
    <app-scroll-top-button/>
  `,
  styles: [`
    .main-content {
      margin-top: 56px;
      margin-left: 240px;
      /* Published for FIXED-position children — the sticky form footer above
         all. `position: fixed` escapes this margin, so a full-width bar runs
         underneath the sidebar (z-index 1000 against the bar's 60) and its
         start edge is simply covered. Custom properties still inherit through
         the DOM to fixed descendants, so the bar can read the same number the
         layout is using instead of hard-coding a copy that drifts. */
      --app-content-start: 240px;
      min-height: calc(100vh - 56px);
      padding: 24px;
      /* Light-gray app canvas so white cards/tables read as distinct surfaces
         without needing a border or drop shadow. */
      background: #eef2f6;
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
      overflow: hidden;
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
  sidebarCollapsed     = signal(false);
  mobileMenuOpen       = signal(false);

  toggleMobileMenu() { this.mobileMenuOpen.set(!this.mobileMenuOpen()); }
}
