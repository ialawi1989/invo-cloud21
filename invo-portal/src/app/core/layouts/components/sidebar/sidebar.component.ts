import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem, MENU_ITEMS } from '../../models/menu.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed" [class.mobile-open]="mobileOpen">
      <!-- Logo -->
      <div class="sidebar-header">
        <div class="logo">
          <span class="logo-icon">◆</span>
          @if (!collapsed) {
            <span class="logo-text">Dashboard</span>
          }
        </div>
        <button class="collapse-btn desktop-only" (click)="toggleCollapse()">
          <svg [class.rotated]="collapsed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      </div>

      <!-- Menu -->
      <nav class="sidebar-nav">
        <ul class="menu-list">
          @for (item of menuItems; track item.id) {
            @if (item.isTitle) {
              <li class="menu-title" [class.hidden]="collapsed">{{ item.label }}</li>
            } @else {
              <li class="menu-item" [class.active]="isActive(item)" [class.has-submenu]="item.subItems">
                @if (item.subItems && item.subItems.length > 0) {
                  <button class="menu-link" (click)="toggleSubmenu(item)" [title]="item.label">
                    <span class="menu-icon" [innerHTML]="getIcon(item.icon)"></span>
                    @if (!collapsed) {
                      <span class="menu-label">{{ item.label }}</span>
                      <svg class="arrow" [class.rotated]="item.expanded" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    }
                  </button>
                  @if (!collapsed && item.expanded) {
                    <ul class="submenu">
                      @for (sub of item.subItems; track sub.id) {
                        <li>
                          <a [routerLink]="sub.link" routerLinkActive="active" class="submenu-link">
                            {{ sub.label }}
                          </a>
                        </li>
                      }
                    </ul>
                  }
                } @else {
                  <a [routerLink]="item.link" routerLinkActive="active" class="menu-link" [title]="item.label">
                    <span class="menu-icon" [innerHTML]="getIcon(item.icon)"></span>
                    @if (!collapsed) {
                      <span class="menu-label">{{ item.label }}</span>
                    }
                  </a>
                }
              </li>
            }
          }
        </ul>
      </nav>

      <!-- Footer -->
      <div class="sidebar-footer">
        <button class="help-btn" [title]="collapsed ? 'Help' : ''">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          @if (!collapsed) {
            <span>Help & Support</span>
          }
        </button>
      </div>
    </aside>

    <!-- Mobile Overlay -->
    @if (mobileOpen) {
      <div class="sidebar-overlay" (click)="closeMobile()"></div>
    }
  `,
  styles: [`
    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
      width: 260px;
      background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
      color: #94a3b8;
      display: flex;
      flex-direction: column;
      transition: width 0.3s ease, transform 0.3s ease;
      z-index: 1000;
    }
    
    .sidebar.collapsed {
      width: 72px;
    }
    
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
      min-height: 64px;
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo-icon {
      font-size: 24px;
      color: #32acc1;
    }
    
    .logo-text {
      font-size: 18px;
      font-weight: 600;
      color: #f1f5f9;
      white-space: nowrap;
    }
    
    .collapse-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(148, 163, 184, 0.1);
      border: none;
      border-radius: 8px;
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .collapse-btn:hover {
      background: rgba(50, 172, 193, 0.2);
      color: #32acc1;
    }
    
    .collapse-btn svg {
      transition: transform 0.3s;
    }
    
    .collapse-btn svg.rotated {
      transform: rotate(180deg);
    }
    
    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      padding: 16px 0;
    }
    
    .menu-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    
    .menu-title {
      padding: 16px 20px 8px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
    }
    
    .menu-title.hidden {
      height: 0;
      padding: 8px 0;
      visibility: hidden;
    }
    
    .menu-item {
      margin: 2px 8px;
    }
    
    .menu-link {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 12px;
      background: transparent;
      border: none;
      border-radius: 8px;
      color: #94a3b8;
      text-decoration: none;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .menu-link:hover {
      background: rgba(148, 163, 184, 0.1);
      color: #f1f5f9;
    }
    
    .menu-link.active, .menu-item.active > .menu-link {
      background: rgba(50, 172, 193, 0.15);
      color: #32acc1;
    }
    
    .menu-icon {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .menu-icon svg {
      width: 20px;
      height: 20px;
    }
    
    .menu-label {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: left;
    }
    
    .arrow {
      transition: transform 0.2s;
      flex-shrink: 0;
    }
    
    .arrow.rotated {
      transform: rotate(180deg);
    }
    
    .submenu {
      list-style: none;
      margin: 4px 0 0;
      padding: 0 0 0 32px;
    }
    
    .submenu-link {
      display: block;
      padding: 8px 12px;
      color: #94a3b8;
      text-decoration: none;
      font-size: 13px;
      border-radius: 6px;
      transition: all 0.2s;
    }
    
    .submenu-link:hover {
      color: #f1f5f9;
      background: rgba(148, 163, 184, 0.05);
    }
    
    .submenu-link.active {
      color: #32acc1;
      background: rgba(50, 172, 193, 0.1);
    }
    
    .sidebar-footer {
      padding: 16px;
      border-top: 1px solid rgba(148, 163, 184, 0.1);
    }
    
    .help-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 12px;
      background: rgba(148, 163, 184, 0.1);
      border: none;
      border-radius: 8px;
      color: #94a3b8;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .help-btn:hover {
      background: rgba(50, 172, 193, 0.15);
      color: #32acc1;
    }
    
    .sidebar-overlay {
      display: none;
    }
    
    /* Collapsed state */
    .sidebar.collapsed .menu-link {
      justify-content: center;
      padding: 12px;
    }
    
    .sidebar.collapsed .sidebar-footer {
      padding: 12px;
    }
    
    .sidebar.collapsed .help-btn {
      justify-content: center;
      padding: 12px;
    }
    
    /* Mobile styles */
    @media (max-width: 991px) {
      .sidebar {
        transform: translateX(-100%);
        width: 280px;
      }
      
      .sidebar.mobile-open {
        transform: translateX(0);
      }
      
      .sidebar.collapsed {
        width: 280px;
      }
      
      .desktop-only {
        display: none;
      }
      
      .sidebar-overlay {
        display: block;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
      }
    }
  `]
})
export class SidebarComponent {
  @Input() collapsed = false;
  @Input() mobileOpen = false;
  @Output() collapsedChange = new EventEmitter<boolean>();
  @Output() mobileOpenChange = new EventEmitter<boolean>();

  menuItems: MenuItem[] = MENU_ITEMS;

  toggleCollapse() {
    this.collapsed = !this.collapsed;
    this.collapsedChange.emit(this.collapsed);
  }

  closeMobile() {
    this.mobileOpen = false;
    this.mobileOpenChange.emit(false);
  }

  toggleSubmenu(item: MenuItem) {
    item.expanded = !item.expanded;
  }

  isActive(item: MenuItem): boolean {
    // Implement active check based on current route
    return false;
  }

  getIcon(iconName?: string): string {
    const icons: Record<string, string> = {
      'dashboard': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
      'inventory': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
      'shopping_cart': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
      'people': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      'bar_chart': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
      'web': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
      'menu': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
      'settings': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    };
    return icons[iconName || ''] || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
  }
}
