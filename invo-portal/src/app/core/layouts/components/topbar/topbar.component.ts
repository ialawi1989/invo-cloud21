import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="topbar">
      <div class="topbar-left">
        <button class="menu-toggle" (click)="toggleMenu()">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        
        <div class="breadcrumb">
          <span class="breadcrumb-item">Home</span>
          <span class="separator">/</span>
          <span class="breadcrumb-item active">Dashboard</span>
        </div>
      </div>
      
      <div class="topbar-right">
        <!-- Search -->
        <div class="search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Search..." class="search-input">
        </div>
        
        <!-- Notifications -->
        <button class="icon-btn" (click)="toggleNotifications()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span class="badge">3</span>
        </button>
        
        <!-- User -->
        <div class="user-menu" (click)="toggleUserMenu()">
          <div class="avatar">
            <span>JD</span>
          </div>
          <div class="user-info">
            <span class="user-name">John Doe</span>
            <span class="user-role">Administrator</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        
        @if (showUserDropdown) {
          <div class="user-dropdown">
            <a href="#" class="dropdown-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              Profile
            </a>
            <a href="#" class="dropdown-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </a>
            <div class="dropdown-divider"></div>
            <a href="#" class="dropdown-item text-danger">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Logout
            </a>
          </div>
        }
      </div>
    </header>
  `,
  styles: [`
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
      padding: 0 24px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    
    .topbar-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .menu-toggle {
      display: none;
      width: 40px;
      height: 40px;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: 8px;
      color: #64748b;
      cursor: pointer;
    }
    
    .menu-toggle:hover {
      background: #f1f5f9;
      color: #32acc1;
    }
    
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    
    .breadcrumb-item {
      color: #64748b;
    }
    
    .breadcrumb-item.active {
      color: #1e293b;
      font-weight: 500;
    }
    
    .separator {
      color: #cbd5e1;
    }
    
    .topbar-right {
      display: flex;
      align-items: center;
      gap: 16px;
      position: relative;
    }
    
    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #f1f5f9;
      border-radius: 8px;
      color: #64748b;
    }
    
    .search-input {
      border: none;
      background: transparent;
      outline: none;
      font-size: 14px;
      width: 200px;
      color: #1e293b;
    }
    
    .search-input::placeholder {
      color: #94a3b8;
    }
    
    .icon-btn {
      position: relative;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: 8px;
      color: #64748b;
      cursor: pointer;
    }
    
    .icon-btn:hover {
      background: #f1f5f9;
      color: #32acc1;
    }
    
    .badge {
      position: absolute;
      top: 4px;
      right: 4px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      background: #ef4444;
      color: white;
      font-size: 11px;
      font-weight: 600;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .user-menu {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px 6px 6px;
      background: #f8fafc;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .user-menu:hover {
      background: #f1f5f9;
    }
    
    .avatar {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #32acc1, #2b95a8);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 14px;
    }
    
    .user-info {
      display: flex;
      flex-direction: column;
    }
    
    .user-name {
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
    }
    
    .user-role {
      font-size: 12px;
      color: #64748b;
    }
    
    .user-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 200px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      border: 1px solid #e2e8f0;
      padding: 8px;
      z-index: 1000;
    }
    
    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      color: #475569;
      text-decoration: none;
      font-size: 14px;
      border-radius: 8px;
      transition: all 0.2s;
    }
    
    .dropdown-item:hover {
      background: #f1f5f9;
      color: #1e293b;
    }
    
    .dropdown-item.text-danger {
      color: #ef4444;
    }
    
    .dropdown-item.text-danger:hover {
      background: #fef2f2;
    }
    
    .dropdown-divider {
      height: 1px;
      background: #e2e8f0;
      margin: 8px 0;
    }
    
    @media (max-width: 991px) {
      .menu-toggle {
        display: flex;
      }
      
      .search-box {
        display: none;
      }
      
      .user-info {
        display: none;
      }
    }
    
    @media (max-width: 576px) {
      .topbar {
        padding: 0 16px;
      }
      
      .breadcrumb {
        display: none;
      }
    }
  `]
})
export class TopbarComponent {
  @Output() menuToggle = new EventEmitter<void>();
  
  showUserDropdown = false;
  
  toggleMenu() {
    this.menuToggle.emit();
  }
  
  toggleNotifications() {
    // Implement notifications panel
  }
  
  toggleUserMenu() {
    this.showUserDropdown = !this.showUserDropdown;
  }
}
