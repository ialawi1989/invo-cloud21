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
      min-height: calc(100vh - 56px);
      padding: 24px;
      /* Light-gray app canvas so white cards/tables read as distinct surfaces
         without needing a border or drop shadow. */
      background: #eef2f6;
      transition: margin-left .25s ease;
    }
    .main-content.collapsed { margin-left: 56px; }
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
      .main-content { margin-left: 0 !important; overflow-x: hidden; }
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
