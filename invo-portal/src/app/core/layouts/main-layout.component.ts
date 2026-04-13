import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, TopbarComponent],
  template: `
    <div class="layout" [class.sidebar-collapsed]="sidebarCollapsed()">
      <app-sidebar 
        [collapsed]="sidebarCollapsed()" 
        [mobileOpen]="mobileMenuOpen()"
        (collapsedChange)="sidebarCollapsed.set($event)"
        (mobileOpenChange)="mobileMenuOpen.set($event)">
      </app-sidebar>
      
      <div class="main-wrapper">
        <app-topbar (menuToggle)="toggleMobileMenu()"></app-topbar>
        
        <main class="main-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .layout {
      display: flex;
      min-height: 100vh;
      background: #f8fafc;
    }
    
    .main-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      margin-left: 260px;
      transition: margin-left 0.3s ease;
      min-height: 100vh;
    }
    
    .layout.sidebar-collapsed .main-wrapper {
      margin-left: 72px;
    }
    
    .main-content {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
    }
    
    @media (max-width: 991px) {
      .main-wrapper {
        margin-left: 0 !important;
      }
    }
    
    @media (max-width: 576px) {
      .main-content {
        padding: 16px;
      }
    }
  `]
})
export class MainLayoutComponent {
  sidebarCollapsed = signal(false);
  mobileMenuOpen = signal(false);
  
  toggleMobileMenu() {
    this.mobileMenuOpen.set(!this.mobileMenuOpen());
  }
}
