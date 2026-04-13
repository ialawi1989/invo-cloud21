import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlPanelComponent } from '../control-panel/control-panel.component';
import { PreviewFrameComponent } from '../preview-frame/preview-frame.component';
import { CustomizerService } from '../../services/customizer.service';
import { DeviceType, COMPONENT_LIBRARY, ComponentDefinition } from '../../models/settings.model';

// Page definitions with slug and status
interface PageDefinition {
  slug: string;
  name: string;
  icon: string;
  category?: string;
  hasSubmenu?: boolean;
  children?: PageDefinition[];
  created: boolean;
}

const PAGE_DEFINITIONS: PageDefinition[] = [
  { slug: 'home', name: 'Home page', icon: 'home', created: true },
  { slug: 'products', name: 'Products', icon: 'tag', hasSubmenu: true, created: true, children: [
    { slug: 'products/all', name: 'All products', icon: 'grid', created: true },
    { slug: 'products/[handle]', name: 'Product template', icon: 'file', created: true },
  ]},
  { slug: 'collections', name: 'Collections', icon: 'folder', hasSubmenu: true, created: true, children: [
    { slug: 'collections/all', name: 'All collections', icon: 'grid', created: true },
    { slug: 'collections/[handle]', name: 'Collection template', icon: 'file', created: true },
  ]},
  { slug: 'collections-list', name: 'Collections list', icon: 'list', created: true },
  { slug: 'gift-card', name: 'Gift card', icon: 'gift', created: false },
  { slug: 'cart', name: 'Cart', icon: 'cart', created: true },
  { slug: 'checkout', name: 'Checkout', icon: 'checkout', created: true },
  { slug: 'pages', name: 'Pages', icon: 'file-text', hasSubmenu: true, created: true, children: [
    { slug: 'pages/about', name: 'About us', icon: 'file', created: true },
    { slug: 'pages/contact', name: 'Contact', icon: 'file', created: true },
    { slug: 'pages/faq', name: 'FAQ', icon: 'file', created: false },
  ]},
  { slug: 'blogs', name: 'Blogs', icon: 'book', hasSubmenu: true, created: false, children: [
    { slug: 'blogs/news', name: 'News', icon: 'file', created: false },
  ]},
  { slug: 'blog-posts', name: 'Blog posts', icon: 'edit', hasSubmenu: true, created: false, children: [
    { slug: 'blog-posts/[handle]', name: 'Post template', icon: 'file', created: false },
  ]},
  { slug: 'search', name: 'Search', icon: 'search', created: true },
  { slug: 'password', name: 'Password', icon: 'lock', created: true },
  { slug: '404', name: '404 page', icon: 'alert', created: true },
];

@Component({
  selector: 'app-customizer',
  standalone: true,
  imports: [CommonModule, FormsModule, ControlPanelComponent, PreviewFrameComponent],
  template: `
    <div class="customizer-layout">
      <!-- Header -->
      <header class="customizer-header">
        <div class="header-left">
          <button class="btn-icon" title="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div class="header-title">
            <span class="store-name">Horizon</span>
            <span class="badge">Live</span>
          </div>
          <button class="btn-icon" title="More">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="1.5"/>
              <circle cx="6" cy="12" r="1.5"/>
              <circle cx="18" cy="12" r="1.5"/>
            </svg>
          </button>
        </div>
        
        <div class="header-center">
          <button class="page-selector-btn" (click)="togglePageSelector()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            </svg>
            <span>{{ currentPageName() }}</span>
            <svg class="chevron" [class.open]="showPageSelector()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          
          <!-- Page Selector Dropdown -->
          @if (showPageSelector()) {
            <div class="page-selector-backdrop" (click)="closePageSelector()"></div>
            <div class="page-selector-dropdown">
              <div class="dropdown-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
                <input 
                  type="text" 
                  placeholder="Search online store" 
                  [(ngModel)]="pageSearchQuery"
                  (click)="$event.stopPropagation()">
              </div>
              
              <div class="dropdown-list">
                @for (page of filteredPages(); track page.slug) {
                  <div class="page-item-wrapper">
                    <button 
                      class="page-item"
                      [class.active]="currentPage() === page.slug"
                      [class.has-children]="page.hasSubmenu"
                      (click)="selectPage(page)">
                      <span class="page-icon" [innerHTML]="getPageIcon(page.icon)"></span>
                      <span class="page-name">{{ page.name }}</span>
                      @if (!page.created) {
                        <span class="not-created-badge">Not created</span>
                      }
                      @if (page.hasSubmenu) {
                        <svg class="submenu-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      }
                    </button>
                    
                    <!-- Submenu -->
                    @if (page.hasSubmenu && page.children && expandedPage() === page.slug) {
                      <div class="page-submenu">
                        @for (child of page.children; track child.slug) {
                          <button 
                            class="page-item child"
                            [class.active]="currentPage() === child.slug"
                            (click)="selectPage(child); $event.stopPropagation()">
                            <span class="page-icon" [innerHTML]="getPageIcon(child.icon)"></span>
                            <span class="page-name">{{ child.name }}</span>
                            @if (!child.created) {
                              <span class="not-created-badge">Not created</span>
                            }
                          </button>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
              
              <div class="dropdown-footer">
                <button class="create-template-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
                  </svg>
                  Create metaobject template
                </button>
              </div>
            </div>
          }
        </div>
        
        <div class="header-right">
          <div class="device-buttons">
            <button 
              class="device-btn" 
              [class.active]="currentDevice() === 'desktop'"
              (click)="setDevice('desktop')"
              title="Desktop">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </button>
            <button 
              class="device-btn" 
              [class.active]="currentDevice() === 'tablet'"
              (click)="setDevice('tablet')"
              title="Tablet">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <line x1="12" y1="18" x2="12" y2="18"/>
              </svg>
            </button>
            <button 
              class="device-btn" 
              [class.active]="currentDevice() === 'mobile'"
              (click)="setDevice('mobile')"
              title="Mobile">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="5" y="2" width="14" height="20" rx="2"/>
                <line x1="12" y1="18" x2="12" y2="18"/>
              </svg>
            </button>
          </div>
          
          <div class="header-actions">
            <button class="btn-icon" [disabled]="!customizer.canUndo()" (click)="customizer.undo()" title="Undo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
              </svg>
            </button>
            <button class="btn-icon" [disabled]="!customizer.canRedo()" (click)="customizer.redo()" title="Redo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/>
              </svg>
            </button>
          </div>
          
          <button class="btn btn-primary btn-sm" (click)="handleSave()">Save</button>
        </div>
      </header>
      
      <!-- Main Content -->
      <div class="customizer-main">
        <!-- Left Sidebar -->
        <app-control-panel class="sidebar-left"></app-control-panel>
        
        <!-- Preview Area -->
        <app-preview-frame 
          class="preview-area"
          [device]="currentDevice()">
        </app-preview-frame>
        
        <!-- Right Panel -->
        <div class="sidebar-right">
          @if (selectedComponent()) {
            <!-- Component Settings Panel -->
            <div class="component-settings">
              <!-- Header -->
              <div class="settings-header">
                <div class="settings-title">
                  <h3>{{ getComponentName(selectedComponent()!.type) }}</h3>
                  <button class="more-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="1.5"/>
                      <circle cx="6" cy="12" r="1.5"/>
                      <circle cx="18" cy="12" r="1.5"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              <!-- Settings Content -->
              <div class="settings-content">
                @for (field of getComponentSchema(selectedComponent()!.type); track field.key) {
                  <div class="setting-group">
                    <label>{{ field.label }}</label>
                    
                    @switch (field.type) {
                      @case ('text') {
                        <input 
                          type="text" 
                          [value]="selectedComponent()!.settings[field.key] || ''"
                          (input)="updateComponentSetting(field.key, $event)">
                      }
                      @case ('textarea') {
                        <textarea 
                          [value]="selectedComponent()!.settings[field.key] || ''"
                          (input)="updateComponentSetting(field.key, $event)"
                          rows="3">
                        </textarea>
                      }
                      @case ('select') {
                        <select 
                          [value]="selectedComponent()!.settings[field.key] || ''"
                          (change)="updateComponentSetting(field.key, $event)">
                          @for (option of field.options; track option.value) {
                            <option [value]="option.value">{{ option.label }}</option>
                          }
                        </select>
                      }
                      @case ('toggle') {
                        <label class="toggle">
                          <input 
                            type="checkbox" 
                            [checked]="selectedComponent()!.settings[field.key]"
                            (change)="updateComponentToggle(field.key, $event)">
                          <span class="toggle-slider"></span>
                        </label>
                      }
                      @case ('color') {
                        <div class="color-input">
                          <input 
                            type="color" 
                            [value]="selectedComponent()!.settings[field.key] || '#000000'"
                            (input)="updateComponentSetting(field.key, $event)">
                          <input 
                            type="text" 
                            [value]="selectedComponent()!.settings[field.key] || ''"
                            (input)="updateComponentSetting(field.key, $event)">
                        </div>
                      }
                      @case ('number') {
                        <input 
                          type="number" 
                          [value]="selectedComponent()!.settings[field.key] || 0"
                          [min]="field.min"
                          [max]="field.max"
                          (input)="updateComponentSetting(field.key, $event)">
                      }
                      @case ('image') {
                        <div class="image-input">
                          <div class="image-preview">
                            @if (selectedComponent()!.settings[field.key]) {
                              <img [src]="selectedComponent()!.settings[field.key]" alt="Preview">
                            } @else {
                              <div class="no-image">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                                  <circle cx="8.5" cy="8.5" r="1.5"/>
                                  <polyline points="21 15 16 10 5 21"/>
                                </svg>
                              </div>
                            }
                          </div>
                          <div class="image-actions">
                            <button class="btn-small">Select</button>
                            <button class="btn-small secondary">Explore free images</button>
                          </div>
                        </div>
                      }
                      @default {
                        <input 
                          type="text" 
                          [value]="selectedComponent()!.settings[field.key] || ''"
                          (input)="updateComponentSetting(field.key, $event)">
                      }
                    }
                  </div>
                }
              </div>
              
              <!-- Footer Actions -->
              <div class="settings-footer">
                <button class="remove-btn" (click)="removeSelectedComponent()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                  Remove section
                </button>
              </div>
            </div>
          } @else {
            <!-- Default Empty State -->
            <div class="right-panel-content">
              <div class="right-panel-header">
                <div class="panel-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 9h18M9 21V9"/>
                  </svg>
                </div>
                <h2>Customize your templates</h2>
                <p>Select a section or block in the sidebar to start.</p>
              </div>
              
              <div class="shortcuts-section">
                <h3>Keyboard shortcuts</h3>
                <div class="shortcuts-list">
                  <div class="shortcut-item">
                    <span>Undo</span>
                    <div class="shortcut-keys">
                      <span class="key">CTRL</span>
                      <span class="key">Z</span>
                    </div>
                  </div>
                  <div class="shortcut-item">
                    <span>Redo</span>
                    <div class="shortcut-keys">
                      <span class="key">CTRL</span>
                      <span class="key">Y</span>
                    </div>
                  </div>
                  <div class="shortcut-item">
                    <span>Save</span>
                    <div class="shortcut-keys">
                      <span class="key">CTRL</span>
                      <span class="key">S</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      </div>
      
      <!-- Toast -->
      @if (showToast()) {
        <div class="toast" [class]="toastType()">
          {{ toastMessage() }}
        </div>
      }
    </div>
  `,
  styles: [`
    .customizer-layout {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      background: var(--bg-gray-100);
    }
    
    /* Header */
    .customizer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: var(--header-height);
      padding: 0 12px;
      background: #1a1a1a;
      color: white;
      z-index: 100;
    }
    
    .header-left, .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .header-center {
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: rgba(255,255,255,0.9);
    }
    
    .page-selector-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(255,255,255,0.1);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .page-selector-btn:hover {
      background: rgba(255,255,255,0.15);
    }
    
    .page-selector-btn .chevron {
      transition: transform 0.2s;
    }
    
    .page-selector-btn .chevron.open {
      transform: rotate(180deg);
    }
    
    .page-selector-backdrop {
      position: fixed;
      inset: 0;
      z-index: 199;
    }
    
    .page-selector-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      width: 320px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      z-index: 200;
      overflow: hidden;
      animation: dropdownIn 0.15s ease;
    }
    
    @keyframes dropdownIn {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
    
    .dropdown-search {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .dropdown-search svg {
      color: #9ca3af;
      flex-shrink: 0;
    }
    
    .dropdown-search input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 14px;
      color: #111827;
      background: transparent;
    }
    
    .dropdown-search input::placeholder {
      color: #9ca3af;
    }
    
    .dropdown-list {
      max-height: 400px;
      overflow-y: auto;
      padding: 8px;
    }
    
    .page-item-wrapper {
      margin-bottom: 2px;
    }
    
    .page-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 10px 12px;
      background: transparent;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      color: #374151;
      cursor: pointer;
      transition: background 0.15s;
      text-align: left;
    }
    
    .page-item:hover {
      background: #f3f4f6;
    }
    
    .page-item.active {
      background: #eff6ff;
      color: #2563eb;
    }
    
    .page-item.child {
      padding-left: 40px;
    }
    
    .page-icon {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;
      flex-shrink: 0;
    }
    
    .page-item.active .page-icon {
      color: #2563eb;
    }
    
    .page-name {
      flex: 1;
    }
    
    .not-created-badge {
      padding: 2px 6px;
      background: #fef3c7;
      color: #92400e;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
    }
    
    .submenu-arrow {
      color: #9ca3af;
    }
    
    .page-submenu {
      margin-top: 2px;
      margin-left: 8px;
      padding-left: 12px;
      border-left: 1px solid #e5e7eb;
    }
    
    .dropdown-footer {
      padding: 12px;
      border-top: 1px solid #e5e7eb;
    }
    
    .create-template-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 10px 12px;
      background: transparent;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      color: #2563eb;
      cursor: pointer;
      transition: background 0.15s;
    }
    
    .create-template-btn:hover {
      background: #eff6ff;
    }
    
    .create-template-btn svg {
      color: #2563eb;
    }
    
    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .store-name {
      font-weight: 600;
      font-size: 14px;
    }
    
    .badge {
      background: var(--success-color);
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }
    
    .customizer-header .btn-icon {
      color: rgba(255,255,255,0.7);
      padding: 8px;
      border-radius: 6px;
      background: transparent;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .customizer-header .btn-icon:hover {
      background: rgba(255,255,255,0.1);
      color: white;
    }
    
    .customizer-header .btn-icon:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    
    .customizer-header .device-buttons {
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 2px;
      display: flex;
    }
    
    .customizer-header .device-btn {
      color: rgba(255,255,255,0.6);
      padding: 6px 10px;
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .customizer-header .device-btn:hover {
      color: white;
      background: rgba(255,255,255,0.1);
    }
    
    .customizer-header .device-btn.active {
      background: rgba(255,255,255,0.15);
      color: white;
    }
    
    .header-actions {
      display: flex;
      gap: 4px;
      margin-right: 8px;
    }
    
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    
    .btn-primary {
      background: var(--primary-color);
      color: white;
    }
    
    .btn-primary:hover {
      background: var(--primary-hover);
    }
    
    .btn-sm {
      padding: 6px 12px;
      font-size: 13px;
    }
    
    /* Main Layout */
    .customizer-main {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    
    .sidebar-left {
      width: var(--sidebar-width);
      flex-shrink: 0;
      background: var(--bg-white);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .preview-area {
      flex: 1;
      overflow: hidden;
      background: var(--bg-gray-100);
    }
    
    .sidebar-right {
      width: var(--right-panel-width);
      flex-shrink: 0;
      background: var(--bg-white);
      border-left: 1px solid var(--border-color);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }
    
    /* Component Settings Panel */
    .component-settings {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    
    .settings-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
    }
    
    .settings-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .settings-title h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }
    
    .more-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: 6px;
      color: var(--text-muted);
      cursor: pointer;
    }
    
    .more-btn:hover {
      background: var(--bg-gray-100);
    }
    
    .settings-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
    }
    
    .setting-group {
      margin-bottom: 20px;
    }
    
    .setting-group:last-child {
      margin-bottom: 0;
    }
    
    .setting-group label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }
    
    .setting-group input[type="text"],
    .setting-group input[type="number"],
    .setting-group textarea,
    .setting-group select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      font-size: 14px;
      background: var(--bg-white);
      color: var(--text-primary);
      transition: border-color 0.2s;
    }
    
    .setting-group input:focus,
    .setting-group textarea:focus,
    .setting-group select:focus {
      outline: none;
      border-color: var(--primary-color);
    }
    
    .setting-group textarea {
      resize: vertical;
      min-height: 80px;
    }
    
    /* Color Input */
    .color-input {
      display: flex;
      gap: 8px;
    }
    
    .color-input input[type="color"] {
      width: 44px;
      height: 44px;
      padding: 2px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      cursor: pointer;
      flex-shrink: 0;
    }
    
    .color-input input[type="text"] {
      flex: 1;
    }
    
    /* Toggle */
    .toggle {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
      cursor: pointer;
    }
    
    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .toggle-slider {
      position: absolute;
      inset: 0;
      background: var(--bg-gray-200);
      border-radius: 24px;
      transition: 0.3s;
    }
    
    .toggle-slider:before {
      content: "";
      position: absolute;
      width: 18px;
      height: 18px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: 0.3s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    
    .toggle input:checked + .toggle-slider {
      background: var(--primary-color);
    }
    
    .toggle input:checked + .toggle-slider:before {
      transform: translateX(20px);
    }
    
    /* Image Input */
    .image-input {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .image-preview {
      width: 100%;
      height: 120px;
      background: var(--bg-gray-100);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .image-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .no-image {
      color: var(--text-muted);
    }
    
    .image-actions {
      display: flex;
      gap: 8px;
    }
    
    .btn-small {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-white);
      font-size: 12px;
      font-weight: 500;
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .btn-small:hover {
      background: var(--bg-gray-50);
    }
    
    .btn-small.secondary {
      color: var(--primary-color);
    }
    
    /* Settings Footer */
    .settings-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border-color);
    }
    
    .remove-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 10px;
      background: transparent;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      color: #ef4444;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .remove-btn:hover {
      background: #fef2f2;
    }
    
    /* Default Empty State */
    .right-panel-content {
      padding: 24px 20px;
    }
    
    .right-panel-header {
      text-align: left;
      margin-bottom: 32px;
    }
    
    .panel-icon {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-gray-100);
      border-radius: 12px;
      margin-bottom: 16px;
      color: var(--text-secondary);
    }
    
    .right-panel-header h2 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text-primary);
    }
    
    .right-panel-header p {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.5;
    }
    
    .shortcuts-section h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--text-primary);
    }
    
    .shortcuts-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .shortcut-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .shortcut-item span:first-child {
      font-size: 14px;
      color: var(--text-secondary);
    }
    
    .shortcut-keys {
      display: flex;
      gap: 4px;
    }
    
    .key {
      padding: 3px 6px;
      background: var(--bg-gray-100);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-secondary);
      font-family: ui-monospace, monospace;
    }
    
    /* Toast */
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      background: var(--text-primary);
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      z-index: 1000;
    }
    
    .toast.success {
      background: var(--success-color);
    }
    
    .toast.error {
      background: #ef4444;
    }
  `]
})
export class CustomizerComponent {
  currentDevice = signal<DeviceType>('desktop');
  showToast = signal<boolean>(false);
  toastMessage = signal<string>('');
  toastType = signal<'success' | 'error' | 'info'>('success');
  
  // Page selector state
  showPageSelector = signal<boolean>(false);
  currentPage = signal<string>('home');
  expandedPage = signal<string | null>(null);
  pageSearchQuery = '';
  pages = PAGE_DEFINITIONS;
  
  constructor(public customizer: CustomizerService) {}
  
  selectedComponent = computed(() => this.customizer.selectedComponent());
  
  currentPageName = computed(() => {
    const findPage = (pages: PageDefinition[], slug: string): string | null => {
      for (const page of pages) {
        if (page.slug === slug) return page.name;
        if (page.children) {
          const found = findPage(page.children, slug);
          if (found) return found;
        }
      }
      return null;
    };
    return findPage(this.pages, this.currentPage()) || 'Home page';
  });
  
  filteredPages = computed(() => {
    if (!this.pageSearchQuery) return this.pages;
    const query = this.pageSearchQuery.toLowerCase();
    return this.pages.filter(page => {
      const matchesMain = page.name.toLowerCase().includes(query);
      const matchesChildren = page.children?.some(c => c.name.toLowerCase().includes(query));
      return matchesMain || matchesChildren;
    });
  });
  
  setDevice(device: DeviceType): void {
    this.currentDevice.set(device);
  }
  
  togglePageSelector(): void {
    this.showPageSelector.set(!this.showPageSelector());
    if (!this.showPageSelector()) {
      this.pageSearchQuery = '';
      this.expandedPage.set(null);
    }
  }
  
  closePageSelector(): void {
    this.showPageSelector.set(false);
    this.pageSearchQuery = '';
    this.expandedPage.set(null);
  }
  
  selectPage(page: PageDefinition): void {
    // If page has submenu, toggle expansion
    if (page.hasSubmenu) {
      this.expandedPage.set(this.expandedPage() === page.slug ? null : page.slug);
      return;
    }
    
    // Check if page is created
    if (!page.created) {
      if (confirm(`The page "${page.name}" hasn't been created yet. Would you like to create it now?`)) {
        // In real app, this would create the page
        this.currentPage.set(page.slug);
        this.closePageSelector();
        this.showNotification(`Created "${page.name}"`, 'success');
      }
      return;
    }
    
    // Check for unsaved changes
    if (this.customizer.hasUnsavedChanges()) {
      const confirmed = confirm('You have unsaved changes. Do you want to leave this page? Your changes will be lost.');
      if (!confirmed) return;
    }
    
    // Switch to the page
    this.currentPage.set(page.slug);
    this.closePageSelector();
    
    // Reset customizer for new page
    this.customizer.loadPageData(page.slug);
  }
  
  getPageIcon(iconName: string): string {
    const icons: Record<string, string> = {
      'home': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>',
      'tag': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
      'folder': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
      'list': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
      'gift': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>',
      'cart': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>',
      'checkout': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
      'file-text': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
      'file': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      'book': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
      'edit': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
      'grid': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
      'search': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      'lock': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
      'alert': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    };
    return icons[iconName] || icons['file'];
  }
  
  handleSave(): void {
    this.customizer.saveData();
    this.showNotification('Changes saved!', 'success');
  }
  
  getComponentName(type: string): string {
    const comp = COMPONENT_LIBRARY.find((c: ComponentDefinition) => c.type === type);
    return comp?.name || type;
  }
  
  getComponentSchema(type: string): any[] {
    const comp = COMPONENT_LIBRARY.find((c: ComponentDefinition) => c.type === type);
    return comp?.settingsSchema || [];
  }
  
  updateComponentSetting(key: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const componentId = this.customizer.selectedComponentId();
    if (componentId) {
      this.customizer.updateComponentSetting(componentId, key, value);
    }
  }
  
  updateComponentToggle(key: string, event: Event): void {
    const value = (event.target as HTMLInputElement).checked;
    const componentId = this.customizer.selectedComponentId();
    if (componentId) {
      this.customizer.updateComponentSetting(componentId, key, value);
    }
  }
  
  removeSelectedComponent(): void {
    const componentId = this.customizer.selectedComponentId();
    if (componentId && confirm('Remove this section?')) {
      this.customizer.removeComponent(componentId);
    }
  }
  
  private showNotification(message: string, type: 'success' | 'error' | 'info'): void {
    this.toastMessage.set(message);
    this.toastType.set(type);
    this.showToast.set(true);
    setTimeout(() => this.showToast.set(false), 2500);
  }
}
