import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LayoutService } from '../../core/layout/services/layout.service';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, TopbarComponent],
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

  `,
  styles: [`
    .main-content {
      margin-top: 56px;
      margin-left: 240px;
      min-height: calc(100vh - 56px);
      padding: 24px;
      background: #f8fafc;
      transition: margin-left .25s ease;
    }
    .main-content.collapsed { margin-left: 56px; }
    .main-content.no-padding {
      padding: 0;
      height: calc(100vh - 56px);
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
