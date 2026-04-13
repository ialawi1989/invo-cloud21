import { Component, signal, computed, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomizerService } from '../../services/customizer.service';
import { ThemeManagerComponent } from '../theme-manager/theme-manager.component';
import { NavigationBuilderComponent, MenuData } from '../navigation-builder/navigation-builder.component';
import { 
  COMPONENT_LIBRARY, 
  GlobalSettings, 
  FONT_OPTIONS, 
  ComponentType,
  ThemePreset,
  HomepageTemplate,
  themeToGlobalSettings,
  ComponentDefinition
} from '../../models/settings.model';

type PanelView = 'structure' | 'theme-settings';

// Menu interface (from API)
interface MenuOption {
  id: string;
  name: string;
  isPrimaryMenu: boolean;
  isFooterMenu: boolean;
}

// Header Settings
interface HeaderSettings {
  layout: string;
  style: string;
  sticky: boolean;
  showTopBar: boolean;
  topBarContent: string;
  backgroundColor: string;
  textColor: string;
  showSearch: boolean;
  showCart: boolean;
  showAccount: boolean;
  showWishlist: boolean;
  selectedMenuId: string | null;
}

// Footer Settings
interface FooterSettings {
  layout: string;
  backgroundColor: string;
  textColor: string;
  showNewsletter: boolean;
  showSocialLinks: boolean;
  showPaymentIcons: boolean;
  copyrightText: string;
  selectedMenuId: string | null;
}

// Mobile Bar Item
interface MobileBarItem {
  uId: string;
  name: string;
  slug: string;
  icon: string;
  enabled: boolean;
  index: number;
}

const HEADER_LAYOUTS = [
  { value: 'logo-left-menu-right', label: 'Logo Left, Menu Right', icon: '◧' },
  { value: 'logo-center-menu-below', label: 'Logo Center', icon: '◫' },
  { value: 'logo-left-menu-center', label: 'Logo Left, Menu Center', icon: '◨' },
  { value: 'minimal', label: 'Minimal', icon: '▭' },
];

const FOOTER_LAYOUTS = [
  { value: '4-columns', label: '4 Columns', icon: '▣▣▣▣' },
  { value: '3-columns', label: '3 Columns', icon: '▣▣▣' },
  { value: '2-columns', label: '2 Columns', icon: '▣▣' },
  { value: 'centered', label: 'Centered', icon: '◯' },
];

// Static page schemas
const STATIC_PAGE_SCHEMAS: Record<string, any> = {
  'menu': {
    name: 'Menu',
    supportsSubheader: true,
    supportsSidebar: true,
    supportsTopBottom: true,
    settingsGroups: [
      {
        key: 'display',
        label: 'Display Settings',
        fields: [
          { key: 'default_view', label: 'Default View', type: 'select', options: [
            { value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }
          ]},
          { key: 'product_style', label: 'Product Style', type: 'select', options: [
            { value: 'Style 1', label: 'Style 1' }, { value: 'Style 2', label: 'Style 2' }
          ]},
          { key: 'page_limit', label: 'Per Page', type: 'select', options: [
            { value: '12', label: '12' }, { value: '24', label: '24' }, { value: '36', label: '36' }
          ]},
        ]
      },
      {
        key: 'features',
        label: 'Features',
        fields: [
          { key: 'show_filter_by_tag', label: 'Show Tag Filter', type: 'toggle' },
          { key: 'show_pager_button', label: 'Show Pagination', type: 'toggle' },
        ]
      }
    ]
  },
  'shop': {
    name: 'Shop',
    supportsSubheader: true,
    supportsSidebar: true,
    supportsTopBottom: true,
    settingsGroups: [
      {
        key: 'display',
        label: 'Display Settings',
        fields: [
          { key: 'default_view', label: 'Default View', type: 'select', options: [
            { value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }
          ]},
        ]
      }
    ]
  },
  'cart': {
    name: 'Shopping Cart',
    supportsSubheader: true,
    supportsSidebar: false,
    supportsTopBottom: true,
    settingsGroups: [
      {
        key: 'display',
        label: 'Display',
        fields: [
          { key: 'show_thumbnails', label: 'Show Images', type: 'toggle' },
          { key: 'show_promo_code', label: 'Show Promo Code', type: 'toggle' },
        ]
      }
    ]
  },
  'product': {
    name: 'Product',
    supportsSubheader: false,
    supportsSidebar: false,
    supportsTopBottom: true,
    settingsGroups: [
      {
        key: 'layout',
        label: 'Layout',
        fields: [
          { key: 'image_position', label: 'Image Position', type: 'select', options: [
            { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }
          ]},
          { key: 'show_reviews', label: 'Show Reviews', type: 'toggle' },
          { key: 'show_related', label: 'Show Related', type: 'toggle' },
        ]
      }
    ]
  },
};

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ThemeManagerComponent, NavigationBuilderComponent],
  template: `
    <div class="control-panel">
      <!-- Navigation Tabs -->
      <div class="panel-nav">
        <button class="nav-tab" [class.active]="panelView() === 'structure'" (click)="setPanelView('structure')" title="Page Structure">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
          </svg>
        </button>
        <button class="nav-tab" [class.active]="panelView() === 'theme-settings'" (click)="setPanelView('theme-settings')" title="Theme Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </div>
      
      <div class="panel-content">
        <!-- Structure View -->
        @if (panelView() === 'structure') {
          <div class="structure-view">
            <div class="panel-header">
              <h2>{{ currentPageName }}</h2>
              <span class="page-badge" [class.static]="isStaticPage">{{ isStaticPage ? 'Static' : 'Dynamic' }}</span>
            </div>
            
            <!-- Static Page Settings -->
            @if (isStaticPage && currentSchema) {
              @for (group of currentSchema.settingsGroups; track group.key) {
                <div class="section-group">
                  <button class="section-btn" (click)="toggleSection(group.key)">
                    <span>{{ group.label }}</span>
                    <svg [class.rotated]="openSection() === group.key" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  @if (openSection() === group.key) {
                    <div class="section-body">
                      @for (field of group.fields; track field.key) {
                        <div class="field-row">
                          <label>{{ field.label }}</label>
                          @if (field.type === 'select') {
                            <select [(ngModel)]="staticSettings[field.key]">
                              @for (opt of field.options; track opt.value) {
                                <option [value]="opt.value">{{ opt.label }}</option>
                              }
                            </select>
                          }
                          @if (field.type === 'toggle') {
                            <input type="checkbox" [(ngModel)]="staticSettings[field.key]">
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            }
            
            <!-- Dynamic Page: Full Builder -->
            @if (!isStaticPage) {
              <div class="section-group">
                <div class="section-label">SECTIONS</div>
                @for (comp of components(); track comp.id) {
                  <div class="tree-item" [class.selected]="selectedComponentId() === comp.id" (click)="selectComponent(comp.id)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                    <span>{{ getComponentName(comp.type) }}</span>
                    <div class="item-actions">
                      <button (click)="moveComponent(comp.id, 'up'); $event.stopPropagation()">↑</button>
                      <button (click)="moveComponent(comp.id, 'down'); $event.stopPropagation()">↓</button>
                      <button class="del" (click)="removeComponent(comp.id); $event.stopPropagation()">×</button>
                    </div>
                  </div>
                }
                <button class="add-btn" (click)="openModal()">+ Add section</button>
              </div>
            }
          </div>
        }
        
        <!-- Theme Settings View -->
        @if (panelView() === 'theme-settings') {
          <div class="theme-settings-view">
            <div class="panel-header">
              <h2>Theme settings</h2>
            </div>
            
            <!-- Theme Manager Button -->
            <div class="theme-trigger">
              <button class="theme-btn" (click)="openThemeManager()">
                <div class="theme-icon">🎨</div>
                <div class="theme-info">
                  <strong>Theme Manager</strong>
                  <span>Browse themes & templates</span>
                </div>
                <span>→</span>
              </button>
            </div>
            
            <!-- Header Accordion -->
            <div class="accordion-section">
              <button class="accordion-header" (click)="toggleThemeSection('header')" [class.active]="openThemeSection() === 'header'">
                <span>Header</span>
                <svg [class.rotated]="openThemeSection() === 'header'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              @if (openThemeSection() === 'header') {
                <div class="accordion-body">
                  <div class="subsection">
                    <h4>Layout</h4>
                    <div class="layout-options">
                      @for (layout of headerLayouts; track layout.value) {
                        <button class="layout-btn" [class.selected]="headerSettings.layout === layout.value" (click)="headerSettings.layout = layout.value; onSettingsChange()">
                          <span class="layout-icon">{{ layout.icon }}</span>
                          <span>{{ layout.label }}</span>
                        </button>
                      }
                    </div>
                  </div>
                  
                  <div class="subsection">
                    <h4>Navigation Menu</h4>
                    <div class="field-row">
                      <label>Select Menu</label>
                      <select [(ngModel)]="headerSettings.selectedMenuId" (change)="onSettingsChange()">
                        <option [ngValue]="null">-- Select Menu --</option>
                        @for (menu of availableMenus; track menu.id) {
                          <option [ngValue]="menu.id">{{ menu.name }} {{ menu.isPrimaryMenu ? '(Primary)' : '' }}</option>
                        }
                      </select>
                    </div>
                    <button class="action-link-btn" (click)="openMenuBuilder()">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit Menus
                    </button>
                  </div>
                  
                  <div class="subsection">
                    <h4>Elements</h4>
                    <div class="field-row"><label>Sticky Header</label><input type="checkbox" [(ngModel)]="headerSettings.sticky" (change)="onSettingsChange()"></div>
                    <div class="field-row"><label>Show Top Bar</label><input type="checkbox" [(ngModel)]="headerSettings.showTopBar" (change)="onSettingsChange()"></div>
                    @if (headerSettings.showTopBar) {
                      <div class="field-row full">
                        <label>Top Bar Text</label>
                        <input type="text" [(ngModel)]="headerSettings.topBarContent" (input)="onSettingsChange()" placeholder="Free shipping on orders over $50">
                      </div>
                    }
                    <div class="field-row"><label>Show Search</label><input type="checkbox" [(ngModel)]="headerSettings.showSearch" (change)="onSettingsChange()"></div>
                    <div class="field-row"><label>Show Cart</label><input type="checkbox" [(ngModel)]="headerSettings.showCart" (change)="onSettingsChange()"></div>
                    <div class="field-row"><label>Show Account</label><input type="checkbox" [(ngModel)]="headerSettings.showAccount" (change)="onSettingsChange()"></div>
                    <div class="field-row"><label>Show Wishlist</label><input type="checkbox" [(ngModel)]="headerSettings.showWishlist" (change)="onSettingsChange()"></div>
                  </div>
                  
                  <div class="subsection">
                    <h4>Colors</h4>
                    <div class="field-row"><label>Background</label><input type="color" [(ngModel)]="headerSettings.backgroundColor" (input)="onSettingsChange()"></div>
                    <div class="field-row"><label>Text Color</label><input type="color" [(ngModel)]="headerSettings.textColor" (input)="onSettingsChange()"></div>
                  </div>
                </div>
              }
            </div>
            
            <!-- Footer Accordion -->
            <div class="accordion-section">
              <button class="accordion-header" (click)="toggleThemeSection('footer')" [class.active]="openThemeSection() === 'footer'">
                <span>Footer</span>
                <svg [class.rotated]="openThemeSection() === 'footer'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              @if (openThemeSection() === 'footer') {
                <div class="accordion-body">
                  <div class="subsection">
                    <h4>Layout</h4>
                    <div class="layout-options">
                      @for (layout of footerLayouts; track layout.value) {
                        <button class="layout-btn" [class.selected]="footerSettings.layout === layout.value" (click)="footerSettings.layout = layout.value; onSettingsChange()">
                          <span class="layout-icon">{{ layout.icon }}</span>
                          <span>{{ layout.label }}</span>
                        </button>
                      }
                    </div>
                  </div>
                  
                  <div class="subsection">
                    <h4>Footer Menu</h4>
                    <div class="field-row">
                      <label>Select Menu</label>
                      <select [(ngModel)]="footerSettings.selectedMenuId" (change)="onSettingsChange()">
                        <option [ngValue]="null">-- Select Menu --</option>
                        @for (menu of availableMenus; track menu.id) {
                          <option [ngValue]="menu.id">{{ menu.name }} {{ menu.isFooterMenu ? '(Footer)' : '' }}</option>
                        }
                      </select>
                    </div>
                    <button class="action-link-btn" (click)="openMenuBuilder()">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit Menus
                    </button>
                  </div>
                  
                  <div class="subsection">
                    <h4>Features</h4>
                    <div class="field-row"><label>Show Newsletter</label><input type="checkbox" [(ngModel)]="footerSettings.showNewsletter" (change)="onSettingsChange()"></div>
                    <div class="field-row"><label>Show Social Links</label><input type="checkbox" [(ngModel)]="footerSettings.showSocialLinks" (change)="onSettingsChange()"></div>
                    <div class="field-row"><label>Show Payment Icons</label><input type="checkbox" [(ngModel)]="footerSettings.showPaymentIcons" (change)="onSettingsChange()"></div>
                  </div>
                  
                  <div class="subsection">
                    <h4>Colors</h4>
                    <div class="field-row"><label>Background</label><input type="color" [(ngModel)]="footerSettings.backgroundColor" (input)="onSettingsChange()"></div>
                    <div class="field-row"><label>Text Color</label><input type="color" [(ngModel)]="footerSettings.textColor" (input)="onSettingsChange()"></div>
                  </div>
                  
                  <div class="subsection">
                    <h4>Copyright</h4>
                    <div class="field-row full">
                      <input type="text" [(ngModel)]="footerSettings.copyrightText" (input)="onSettingsChange()" placeholder="© 2024 Your Store. All rights reserved.">
                    </div>
                  </div>
                </div>
              }
            </div>
            
            <!-- Mobile Bar Accordion -->
            <div class="accordion-section">
              <button class="accordion-header" (click)="toggleThemeSection('mobile-bar')" [class.active]="openThemeSection() === 'mobile-bar'">
                <span>Mobile Bar</span>
                <svg [class.rotated]="openThemeSection() === 'mobile-bar'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              @if (openThemeSection() === 'mobile-bar') {
                <div class="accordion-body">
                  <p class="helper-text">Configure bottom navigation for mobile devices</p>
                  
                  <div class="mobile-bar-preview">
                    @for (item of getEnabledMobileItems(); track item.uId) {
                      <div class="preview-icon">
                        <div class="icon" [innerHTML]="item.icon"></div>
                        <span>{{ item.name }}</span>
                      </div>
                    }
                  </div>
                  
                  <div class="subsection">
                    <h4>Icons</h4>
                    <div class="mobile-items-list">
                      @for (item of mobileBarItems; track item.uId; let i = $index) {
                        <div class="mobile-item-row">
                          <input type="checkbox" [(ngModel)]="item.enabled" (change)="onSettingsChange()">
                          <div class="item-icon" [innerHTML]="item.icon"></div>
                          <span class="item-name">{{ item.name }}</span>
                          <div class="item-order">
                            <button (click)="moveMobileItem(i, 'up')" [disabled]="i === 0">↑</button>
                            <button (click)="moveMobileItem(i, 'down')" [disabled]="i === mobileBarItems.length - 1">↓</button>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                  
                  <button class="action-link-btn" (click)="openMobileBarBuilder()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Open Full Editor
                  </button>
                </div>
              }
            </div>
            
            <!-- Colors Accordion -->
            <div class="accordion-section">
              <button class="accordion-header" (click)="toggleThemeSection('colors')" [class.active]="openThemeSection() === 'colors'">
                <span>Colors</span>
                <svg [class.rotated]="openThemeSection() === 'colors'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              @if (openThemeSection() === 'colors') {
                <div class="accordion-body">
                  <div class="field-row"><label>Primary</label><input type="color" [value]="settings().primaryColor" (input)="onColorChange('primaryColor', $event)"></div>
                  <div class="field-row"><label>Secondary</label><input type="color" [value]="settings().secondaryColor" (input)="onColorChange('secondaryColor', $event)"></div>
                  <div class="field-row"><label>Accent</label><input type="color" [value]="settings().accentColor" (input)="onColorChange('accentColor', $event)"></div>
                  <div class="field-row"><label>Background</label><input type="color" [value]="settings().bodyBgColor" (input)="onColorChange('bodyBgColor', $event)"></div>
                  <div class="field-row"><label>Text</label><input type="color" [value]="settings().bodyTextColor" (input)="onColorChange('bodyTextColor', $event)"></div>
                </div>
              }
            </div>
            
            <!-- Typography Accordion -->
            <div class="accordion-section">
              <button class="accordion-header" (click)="toggleThemeSection('typography')" [class.active]="openThemeSection() === 'typography'">
                <span>Typography</span>
                <svg [class.rotated]="openThemeSection() === 'typography'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              @if (openThemeSection() === 'typography') {
                <div class="accordion-body">
                  <div class="field-row">
                    <label>Heading Font</label>
                    <select [value]="settings().headingFontFamily" (change)="onSelectChange('headingFontFamily', $event)">
                      @for (font of fontOptions; track font.value) {
                        <option [value]="font.value">{{ font.label }}</option>
                      }
                    </select>
                  </div>
                  <div class="field-row">
                    <label>Body Font</label>
                    <select [value]="settings().fontFamily" (change)="onSelectChange('fontFamily', $event)">
                      @for (font of fontOptions; track font.value) {
                        <option [value]="font.value">{{ font.label }}</option>
                      }
                    </select>
                  </div>
                  <div class="field-row full">
                    <label>Font Size: {{ settings().baseFontSize }}px</label>
                    <input type="range" min="12" max="20" [value]="settings().baseFontSize" (input)="onRangeChange('baseFontSize', $event)">
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>
      
      <!-- Add Section Modal -->
      @if (showModal()) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Add Section</h3>
              <button (click)="closeModal()">×</button>
            </div>
            <div class="modal-body">
              @for (comp of componentLibrary; track comp.type) {
                <button class="modal-item" (click)="addComponent(comp.type)">
                  <strong>{{ comp.name }}</strong>
                  <span>{{ comp.description }}</span>
                </button>
              }
            </div>
          </div>
        </div>
      }
      
      <!-- Theme Manager Modal -->
      @if (showThemeManager()) {
        <div class="theme-modal-backdrop">
          <div class="theme-modal">
            <button class="close-theme" (click)="closeThemeManager()">×</button>
            <app-theme-manager (themeApplied)="onThemeApplied($event)" (homepageApplied)="onHomepageApplied($event)"></app-theme-manager>
          </div>
        </div>
      }
      
      <!-- Navigation Builder Modal -->
      @if (showNavBuilder()) {
        <div class="nav-builder-backdrop">
          <div class="nav-builder-modal">
            <app-navigation-builder 
              [menuData]="editingMenuData" 
              (save)="onMenuSave($event)" 
              (cancel)="closeNavBuilder()">
            </app-navigation-builder>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .control-panel { display: flex; height: 100%; background: #fff; }
    .panel-nav { display: flex; flex-direction: column; gap: 4px; padding: 12px 8px; border-right: 1px solid #e5e7eb; background: #f9fafb; }
    .nav-tab { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 8px; color: #6b7280; cursor: pointer; }
    .nav-tab:hover { background: #e5e7eb; }
    .nav-tab.active { background: var(--primary-color); color: white; }
    .panel-content { flex: 1; overflow-y: auto; }
    .panel-header { padding: 16px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 8px; }
    .panel-header h2 { font-size: 16px; font-weight: 600; margin: 0; }
    .page-badge { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; background: #dcfce7; color: #16a34a; }
    .page-badge.static { background: #dbeafe; color: #1d4ed8; }
    .section-group { border-bottom: 1px solid #e5e7eb; }
    .section-btn { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 12px 16px; background: transparent; border: none; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #9ca3af; cursor: pointer; }
    .section-btn:hover { background: #f9fafb; }
    .section-btn svg { transition: transform 0.2s; }
    .section-btn svg.rotated { transform: rotate(180deg); }
    .section-body { padding: 0 16px 16px; }
    .section-label { padding: 12px 16px 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #9ca3af; }
    .field-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; gap: 12px; }
    .field-row.full { flex-direction: column; align-items: stretch; }
    .field-row.full label { margin-bottom: 4px; }
    .field-row label { font-size: 13px; color: #6b7280; }
    .field-row select, .field-row input[type="text"] { padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; flex: 1; min-width: 0; }
    .field-row input[type="checkbox"] { width: 18px; height: 18px; }
    .field-row input[type="color"] { width: 40px; height: 32px; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; padding: 2px; }
    .field-row input[type="range"] { flex: 1; }
    .tree-item { display: flex; align-items: center; gap: 8px; padding: 8px 16px; cursor: pointer; }
    .tree-item:hover { background: #f9fafb; }
    .tree-item.selected { background: var(--primary-50); }
    .tree-item span { flex: 1; font-size: 14px; }
    .item-actions { display: flex; gap: 4px; opacity: 0; }
    .tree-item:hover .item-actions { opacity: 1; }
    .item-actions button { width: 24px; height: 24px; border: none; background: transparent; cursor: pointer; border-radius: 4px; }
    .item-actions button:hover { background: #e5e7eb; }
    .item-actions button.del:hover { background: #fee2e2; color: #ef4444; }
    .add-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 16px; background: transparent; border: none; font-size: 14px; color: var(--primary-color); font-weight: 500; cursor: pointer; text-align: left; }
    .add-btn:hover { background: var(--primary-50); }
    .theme-trigger { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
    .theme-btn { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px; background: linear-gradient(135deg, #f5f3ff, #ede9fe); border: 1px solid #ddd6fe; border-radius: 12px; cursor: pointer; text-align: left; }
    .theme-btn:hover { background: linear-gradient(135deg, #ede9fe, #ddd6fe); }
    .theme-icon { font-size: 24px; }
    .theme-info { flex: 1; }
    .theme-info strong { display: block; font-size: 14px; color: #4338ca; }
    .theme-info span { font-size: 12px; color: var(--primary-color); }
    
    /* Accordion Styles */
    .accordion-section { border-bottom: 1px solid #e5e7eb; }
    .accordion-header { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 14px 16px; background: transparent; border: none; font-size: 14px; font-weight: 500; color: #374151; cursor: pointer; text-align: left; }
    .accordion-header:hover { background: #f9fafb; }
    .accordion-header.active { background: #f3f4f6; }
    .accordion-header svg { transition: transform 0.2s; color: #9ca3af; }
    .accordion-header svg.rotated { transform: rotate(180deg); }
    .accordion-body { padding: 0 16px 16px; }
    .subsection { margin-bottom: 16px; }
    .subsection:last-child { margin-bottom: 0; }
    .subsection h4 { font-size: 12px; font-weight: 600; color: #6b7280; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    
    .action-link-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 10px 16px; margin-top: 10px; background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 8px; font-size: 13px; color: var(--primary-color); cursor: pointer; transition: all 0.15s; }
    .action-link-btn:hover { background: var(--primary-50); border-color: var(--primary-color); }
    
    .layout-options { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .layout-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; font-size: 11px; }
    .layout-btn:hover { border-color: #d1d5db; }
    .layout-btn.selected { border-color: var(--primary-color); background: var(--primary-50); }
    .layout-icon { font-family: monospace; font-size: 16px; }
    .helper-text { font-size: 12px; color: #9ca3af; margin: 0 0 12px; }
    
    /* Mobile Bar Preview */
    .mobile-bar-preview { display: flex; justify-content: space-around; background: #1a1a1a; border-radius: 8px; padding: 12px 8px; margin-bottom: 16px; }
    .preview-icon { display: flex; flex-direction: column; align-items: center; gap: 4px; color: white; }
    .preview-icon .icon { width: 20px; height: 20px; }
    .preview-icon .icon svg { width: 100%; height: 100%; }
    .preview-icon span { font-size: 9px; }
    
    /* Mobile Items List */
    .mobile-items-list { display: flex; flex-direction: column; gap: 8px; }
    .mobile-item-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #f9fafb; border-radius: 6px; }
    .mobile-item-row .item-icon { width: 20px; height: 20px; color: #6b7280; }
    .mobile-item-row .item-icon svg { width: 100%; height: 100%; }
    .mobile-item-row .item-name { flex: 1; font-size: 13px; }
    .mobile-item-row .item-order { display: flex; gap: 4px; }
    .mobile-item-row .item-order button { width: 24px; height: 24px; background: white; border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .mobile-item-row .item-order button:hover:not(:disabled) { background: #f3f4f6; }
    .mobile-item-row .item-order button:disabled { opacity: 0.3; cursor: not-allowed; }
    
    /* Modal */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: flex-start; justify-content: center; padding-top: 80px; z-index: 1000; }
    .modal { background: white; border-radius: 12px; width: 100%; max-width: 400px; max-height: 60vh; overflow: hidden; }
    .modal-header { display: flex; justify-content: space-between; padding: 16px; border-bottom: 1px solid #e5e7eb; }
    .modal-header h3 { margin: 0; font-size: 16px; }
    .modal-header button { background: none; border: none; font-size: 20px; cursor: pointer; }
    .modal-body { padding: 8px; overflow-y: auto; max-height: calc(60vh - 60px); }
    .modal-item { display: flex; flex-direction: column; width: 100%; padding: 12px; background: transparent; border: none; border-radius: 8px; text-align: left; cursor: pointer; }
    .modal-item:hover { background: #f9fafb; }
    .modal-item strong { font-size: 14px; }
    .modal-item span { font-size: 12px; color: #6b7280; }
    .theme-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .theme-modal { position: relative; width: 100%; max-width: 1200px; height: calc(100vh - 40px); background: white; border-radius: 16px; overflow: hidden; }
    .close-theme { position: absolute; top: 16px; right: 16px; z-index: 10; width: 40px; height: 40px; background: white; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 24px; cursor: pointer; }
    .theme-modal app-theme-manager { display: block; height: 100%; overflow: auto; }
    .nav-builder-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .nav-builder-modal { width: 100%; max-width: 1200px; height: calc(100vh - 40px); background: white; border-radius: 16px; overflow: hidden; }
    .nav-builder-modal app-navigation-builder { display: block; height: 100%; }
  `]
})
export class ControlPanelComponent {
  @Input() currentPageSlug: string = 'home';
  @Input() currentPageName: string = 'Home page';
  @Input() isStaticPage: boolean = false;
  @Input() availableMenus: MenuOption[] = [];
  
  @Output() openMenuBuilderEvent = new EventEmitter<void>();
  @Output() openMobileBarBuilderEvent = new EventEmitter<void>();
  @Output() settingsChanged = new EventEmitter<{ header: HeaderSettings; footer: FooterSettings }>();
  @Output() menuSaved = new EventEmitter<MenuData>();
  
  panelView = signal<PanelView>('structure');
  openThemeSection = signal<string | null>('header');
  openSection = signal<string | null>(null);
  showModal = signal(false);
  showThemeManager = signal(false);
  showNavBuilder = signal(false);
  
  // Menu data for editing
  editingMenuData: MenuData = {
    id: '',
    name: '',
    type: 'Menus',
    isPrimaryMenu: false,
    isFooterMenu: false,
    template: { list: [] }
  };
  
  // Header/Footer settings
  headerSettings: HeaderSettings = {
    layout: 'logo-left-menu-right',
    style: 'solid',
    sticky: true,
    showTopBar: false,
    topBarContent: 'Free shipping on orders over $50',
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    showSearch: true,
    showCart: true,
    showAccount: true,
    showWishlist: false,
    selectedMenuId: null
  };
  
  footerSettings: FooterSettings = {
    layout: '4-columns',
    backgroundColor: '#1a1a1a',
    textColor: '#ffffff',
    showNewsletter: true,
    showSocialLinks: true,
    showPaymentIcons: true,
    copyrightText: '© 2024 Your Store. All rights reserved.',
    selectedMenuId: null
  };
  
  headerLayouts = HEADER_LAYOUTS;
  footerLayouts = FOOTER_LAYOUTS;
  
  // Mobile Bar Items (from API typically)
  mobileBarItems: MobileBarItem[] = [
    { uId: '1', name: 'Home', slug: '/', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>', enabled: true, index: 0 },
    { uId: '2', name: 'Menu', slug: 'menu', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>', enabled: true, index: 1 },
    { uId: '3', name: 'Cart', slug: 'cart', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg>', enabled: true, index: 2 },
    { uId: '4', name: 'Wishlist', slug: 'wishlist', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 14 1.5-1.5c2-2 2-5 0-7s-5-2-7 0l-1.5 1.5L10.5 5.5c-2-2-5-2-7 0s-2 5 0 7L5 14l7 7 7-7z"></path></svg>', enabled: true, index: 3 },
    { uId: '5', name: 'Account', slug: 'account', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>', enabled: true, index: 4 },
    { uId: '6', name: 'Search', slug: 'search', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>', enabled: false, index: 5 },
    { uId: '7', name: 'Categories', slug: 'categories', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="7" x="3" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="14" rx="1"></rect><rect width="7" height="7" x="3" y="14" rx="1"></rect></svg>', enabled: false, index: 6 },
  ];
  
  // Static page settings
  staticSettings: Record<string, any> = {};
  
  componentLibrary = COMPONENT_LIBRARY;
  fontOptions = FONT_OPTIONS;
  
  constructor(private customizer: CustomizerService) {}
  
  get settings() { return this.customizer.globalSettings; }
  get components() { return this.customizer.components; }
  get selectedComponentId() { return this.customizer.selectedComponentId; }
  get currentSchema() { return STATIC_PAGE_SCHEMAS[this.currentPageSlug]; }
  
  setPanelView(view: PanelView) { this.panelView.set(view); }
  toggleThemeSection(section: string) { this.openThemeSection.set(this.openThemeSection() === section ? null : section); }
  toggleSection(section: string) { this.openSection.set(this.openSection() === section ? null : section); }
  openModal() { this.showModal.set(true); }
  closeModal() { this.showModal.set(false); }
  openThemeManager() { this.showThemeManager.set(true); }
  closeThemeManager() { this.showThemeManager.set(false); }
  selectComponent(id: string) { this.customizer.selectComponent(id); }
  removeComponent(id: string) { this.customizer.removeComponent(id); }
  moveComponent(id: string, dir: 'up' | 'down') { this.customizer.moveComponent(id, dir); }
  getComponentName(type: string) { return COMPONENT_LIBRARY.find((c: ComponentDefinition) => c.type === type)?.name || type; }
  addComponent(type: string) { this.customizer.addComponent(type as ComponentType); this.closeModal(); }
  
  onColorChange(key: keyof GlobalSettings, e: Event) { this.customizer.updateGlobalSetting(key, (e.target as HTMLInputElement).value); }
  onSelectChange(key: keyof GlobalSettings, e: Event) { this.customizer.updateGlobalSetting(key, (e.target as HTMLSelectElement).value as any); }
  onRangeChange(key: keyof GlobalSettings, e: Event) { this.customizer.updateGlobalSetting(key, parseFloat((e.target as HTMLInputElement).value) as any); }
  
  // Emit settings changes to parent
  onSettingsChange() {
    this.settingsChanged.emit({
      header: this.headerSettings,
      footer: this.footerSettings
    });
  }
  
  // Open navigation builder modal
  openMenuBuilder() {
    // Reset to new menu or load existing
    this.editingMenuData = {
      id: '',
      name: 'New Menu',
      type: 'Menus',
      isPrimaryMenu: false,
      isFooterMenu: false,
      template: { list: [] }
    };
    this.showNavBuilder.set(true);
  }
  
  closeNavBuilder() {
    this.showNavBuilder.set(false);
  }
  
  onMenuSave(menuData: MenuData) {
    this.menuSaved.emit(menuData);
    this.closeNavBuilder();
  }
  
  // Open your existing mobile bar builder
  openMobileBarBuilder() {
    this.openMobileBarBuilderEvent.emit();
  }
  
  // Mobile bar methods
  getEnabledMobileItems(): MobileBarItem[] {
    return this.mobileBarItems.filter(item => item.enabled).slice(0, 5);
  }
  
  moveMobileItem(index: number, direction: 'up' | 'down') {
    if (direction === 'up' && index > 0) {
      [this.mobileBarItems[index], this.mobileBarItems[index - 1]] = [this.mobileBarItems[index - 1], this.mobileBarItems[index]];
    } else if (direction === 'down' && index < this.mobileBarItems.length - 1) {
      [this.mobileBarItems[index], this.mobileBarItems[index + 1]] = [this.mobileBarItems[index + 1], this.mobileBarItems[index]];
    }
    this.onSettingsChange();
  }
  
  // Theme Manager handlers
  onThemeApplied(theme: ThemePreset) { 
    const s = themeToGlobalSettings(theme); 
    Object.entries(s).forEach(([k, v]) => { 
      if (v !== undefined) this.customizer.updateGlobalSetting(k as keyof GlobalSettings, v as any); 
    }); 
    this.closeThemeManager(); 
  }
  
  onHomepageApplied(homepage: HomepageTemplate) { 
    this.customizer.components().forEach(c => this.customizer.removeComponent(c.id)); 
    homepage.components.forEach(c => this.customizer.addComponent(c.type)); 
    this.closeThemeManager(); 
  }
}
