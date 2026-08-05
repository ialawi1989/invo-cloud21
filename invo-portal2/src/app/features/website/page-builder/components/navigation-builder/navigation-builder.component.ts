import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, CdkDrag, CdkDropList, CdkDragHandle, CdkDragMove, moveItemInArray } from '@angular/cdk/drag-drop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Menu Item Interface
export interface NavigationItem {
  uId: string;
  name: string;
  type: string;
  abbr?: string;
  customUrl?: string;
  depth: number;
  index: number;
  isMegaMenu?: boolean;
  megaWidth?: string;
  megaColumns?: MegaMenuColumn[];
  isDragging?: boolean;
  dragDepth?: number;
}

export interface MegaMenuColumn {
  uId: string;
  title: string;
  width: number;
  items: NavigationItem[];
  image?: string;
}

export interface MenuData {
  id: string;
  name: string;
  type: string;
  isPrimaryMenu: boolean;
  isFooterMenu: boolean;
  template: {
    list: NavigationItem[];
  };
}

export interface LinkOption {
  title: string;
  abbr: string;
  child: { name: string; abbr: string; type: string }[];
}

@Component({
  selector: 'app-navigation-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, CdkDropList, CdkDrag, CdkDragHandle],
  template: `
    <div class="navigation-builder">
      <div class="builder-header">
        <h2>{{ menuData.id ? 'Edit Menu' : 'New Menu' }}</h2>
        <div class="header-actions">
          <button class="btn-secondary" (click)="onCancel()">Cancel</button>
          <button class="btn-primary" (click)="onSave()">Save Menu</button>
        </div>
      </div>
      
      <div class="builder-body">
        <!-- Left Panel: Available Items -->
        <div class="left-panel">
          <div class="panel-section">
            <h3>Menu Name</h3>
            <input type="text" [(ngModel)]="menuData.name" class="form-input" placeholder="Enter menu name">
          </div>
          
          <div class="panel-section">
            <h3>Add Items</h3>
            @for (option of linkOptions; track option.abbr) {
              <div class="accordion-item">
                <button class="accordion-trigger" (click)="toggleAccordion(option.abbr)" [class.active]="openAccordion() === option.abbr">
                  {{ option.title }}
                  <svg [class.rotated]="openAccordion() === option.abbr" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                @if (openAccordion() === option.abbr) {
                  <div class="accordion-content">
                    @if (option.abbr === 'custom') {
                      <div class="custom-link-form">
                        <input type="text" [(ngModel)]="customLink.title" placeholder="Link Text" class="form-input">
                        <input type="url" [(ngModel)]="customLink.url" placeholder="URL" class="form-input">
                        <button class="btn-primary btn-sm" (click)="addCustomLink()" [disabled]="!customLink.title || !customLink.url">Add Link</button>
                      </div>
                    } @else if (option.abbr === 'mega') {
                      <div class="mega-menu-form">
                        <input type="text" [(ngModel)]="megaMenuTitle" placeholder="Mega Menu Title" class="form-input">
                        <button class="btn-primary btn-sm" (click)="addMegaMenu()" [disabled]="!megaMenuTitle">Add Mega Menu</button>
                      </div>
                    } @else {
                      @for (child of option.child; track child.abbr) {
                        <div class="available-item" (click)="addToMenu(child)">
                          <span class="item-icon" [innerHTML]="getItemIcon(child.type)"></span>
                          <span>{{ child.name }}</span>
                        </div>
                      }
                    }
                  </div>
                }
              </div>
            }
          </div>
          
          <div class="panel-section">
            <h3>Settings</h3>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="menuData.isPrimaryMenu">
              Primary Menu (Header)
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="menuData.isFooterMenu">
              Footer Menu
            </label>
          </div>
        </div>
        
        <!-- Right Panel: Menu Structure -->
        <div class="right-panel">
          <div class="menu-structure-header">
            <h3>Menu Structure</h3>
            <p class="hint">Drag items vertically to reorder, drag horizontally to change depth levels</p>
          </div>
          
          <div class="menu-structure" cdkDropList [cdkDropListData]="menuData.template.list" (cdkDropListDropped)="onDrop($event)">
            @for (item of menuData.template.list; track item.uId; let i = $index) {
              <div class="menu-item-wrapper" [style.margin-left.px]="(item.isDragging ? item.dragDepth! : item.depth) * 25" [class.dragging]="item.isDragging">
                <div class="menu-item" [class.mega-menu-item]="item.isMegaMenu" cdkDrag [cdkDragData]="item" [cdkDragDisabled]="editingItemId() === item.uId || editingMegaMenuId() === item.uId" (cdkDragMoved)="onDragMoved($event, item)" (cdkDragStarted)="onDragStarted(item)" (cdkDragEnded)="onDragEnded(item)">
                  
                  <!-- Drag Handle -->
                  <div class="drag-handle" cdkDragHandle>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M5.5 2.5a1 1 0 0 0-1 1v.5a1 1 0 0 0 1 1h.5a1 1 0 0 0 1-1v-.5a1 1 0 0 0-1-1z"/>
                      <path d="M5.5 6.75a1 1 0 0 0-1 1v.5a1 1 0 0 0 1 1h.5a1 1 0 0 0 1-1v-.5a1 1 0 0 0-1-1z"/>
                      <path d="M4.5 12a1 1 0 0 1 1-1h.5a1 1 0 0 1 1 1v.5a1 1 0 0 1-1 1h-.5a1 1 0 0 1-1-1z"/>
                      <path d="M10 2.5a1 1 0 0 0-1 1v.5a1 1 0 0 0 1 1h.5a1 1 0 0 0 1-1v-.5a1 1 0 0 0-1-1z"/>
                      <path d="M9 7.75a1 1 0 0 1 1-1h.5a1 1 0 0 1 1 1v.5a1 1 0 0 1-1 1h-.5a1 1 0 0 1-1-1z"/>
                      <path d="M10 11a1 1 0 0 0-1 1v.5a1 1 0 0 0 1 1h.5a1 1 0 0 0 1-1v-.5a1 1 0 0 0-1-1z"/>
                    </svg>
                  </div>
                  
                  <!-- Item Content -->
                  <div class="item-content">
                    <div class="item-header">
                      <div class="item-info">
                        <span class="item-icon" [innerHTML]="getItemIcon(item.type)"></span>
                        <span class="item-title">{{ item.name }}</span>
                        <span class="item-type">({{ item.type }}{{ item.isMegaMenu ? ' - Mega' : '' }})</span>
                        <span class="depth-badge">Level {{ item.depth }}</span>
                      </div>
                      
                      <div class="item-actions">
                        @if (item.depth > 0) {
                          <button class="action-btn" (click)="moveLeft(item)" title="Decrease depth">←</button>
                        }
                        @if (canMoveRight(item)) {
                          <button class="action-btn" (click)="moveRight(item)" title="Increase depth">→</button>
                        }
                        @if (!item.isMegaMenu && item.depth === 0) {
                          <button class="action-btn mega-btn" (click)="convertToMegaMenu(item)" title="Convert to Mega Menu">▦</button>
                        }
                        <button class="action-btn" (click)="editItem(item)" title="Edit">✎</button>
                        @if (item.isMegaMenu) {
                          <button class="action-btn" (click)="editMegaMenu(item)" title="Edit Mega Menu">⚙</button>
                        }
                        <button class="action-btn delete-btn" (click)="removeItem(item.uId)" title="Remove">×</button>
                      </div>
                    </div>
                    
                    <!-- Edit Form -->
                    @if (editingItemId() === item.uId) {
                      <div class="edit-form">
                        <div class="form-row">
                          <label>Label</label>
                          <input type="text" [(ngModel)]="item.name" class="form-input">
                        </div>
                        @if (item.type === 'customUrl') {
                          <div class="form-row">
                            <label>URL</label>
                            <input type="url" [(ngModel)]="item.customUrl" class="form-input">
                          </div>
                        }
                        <div class="form-actions">
                          <button class="btn-secondary btn-sm" (click)="cancelEdit()">Cancel</button>
                          <button class="btn-primary btn-sm" (click)="saveEdit()">Save</button>
                        </div>
                      </div>
                    }
                    
                    <!-- Mega Menu Editor -->
                    @if (editingMegaMenuId() === item.uId && item.megaColumns) {
                      <div class="mega-edit-form">
                        <div class="mega-settings">
                          <label>Width</label>
                          <select [(ngModel)]="item.megaWidth" class="form-select">
                            <option value="container">Container</option>
                            <option value="full">Full Width</option>
                          </select>
                        </div>
                        
                        <div class="mega-columns">
                          <h4>Columns</h4>
                          @for (column of item.megaColumns; track column.uId; let colIdx = $index) {
                            <div class="mega-column">
                              <div class="column-header">
                                <input type="text" [(ngModel)]="column.title" class="form-input-sm" placeholder="Column Title">
                                <button class="action-btn delete-btn" (click)="removeMegaColumn(item, colIdx)">×</button>
                              </div>
                              
                              <div class="column-items">
                                @for (colItem of column.items; track colItem.uId; let itemIdx = $index) {
                                  <div class="column-item">
                                    <span>{{ colItem.name }}</span>
                                    <button class="action-btn delete-btn" (click)="removeColumnItem(column, itemIdx)">×</button>
                                  </div>
                                }
                                <button class="btn-link" (click)="showItemPicker(column)">+ Add Item</button>
                              </div>
                            </div>
                          }
                          <button class="btn-secondary btn-sm" (click)="addMegaColumn(item)" [disabled]="item.megaColumns && item.megaColumns.length >= 4">+ Add Column</button>
                        </div>
                        
                        <div class="form-actions">
                          <button class="btn-secondary btn-sm" (click)="cancelMegaEdit()">Cancel</button>
                          <button class="btn-primary btn-sm" (click)="saveMegaEdit()">Save</button>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            }
            
            @if (menuData.template.list.length === 0) {
              <div class="empty-menu">
                <p>Pick items from the left to build your menu</p>
              </div>
            }
          </div>
        </div>
      </div>
      
      <!-- Item Picker Modal -->
      @if (showingItemPicker()) {
        <div class="modal-backdrop" (click)="closeItemPicker()">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h4>Add Items to {{ selectedColumn?.title }}</h4>
              <button class="close-btn" (click)="closeItemPicker()">×</button>
            </div>
            <div class="modal-body">
              <input type="text" [(ngModel)]="itemPickerSearch" class="form-input" placeholder="Search items...">
              <div class="picker-items">
                @for (option of linkOptions; track option.abbr) {
                  @if (option.child && option.child.length > 0) {
                    @for (child of getFilteredItems(option.child); track child.abbr) {
                      <div class="picker-item" (click)="addItemToColumn(child)">
                        <span class="item-icon" [innerHTML]="getItemIcon(child.type)"></span>
                        <span>{{ child.name }}</span>
                        <span class="item-type-badge">{{ child.type }}</span>
                      </div>
                    }
                  }
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .navigation-builder { display: flex; flex-direction: column; height: 100%; background: #f5f5f5; }
    .builder-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: white; border-bottom: 1px solid #e5e7eb; }
    .builder-header h2 { margin: 0; font-size: 18px; font-weight: 600; }
    .header-actions { display: flex; gap: 12px; }
    
    .builder-body { display: flex; flex: 1; overflow: hidden; }
    
    /* Left Panel */
    .left-panel { width: 300px; background: white; border-right: 1px solid #e5e7eb; overflow-y: auto; }
    .panel-section { padding: 16px; border-bottom: 1px solid #e5e7eb; }
    .panel-section h3 { margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #374151; }
    
    /* Accordion */
    .accordion-item { border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px; overflow: hidden; }
    .accordion-trigger { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 12px; background: #f9fafb; border: none; font-size: 13px; font-weight: 500; cursor: pointer; }
    .accordion-trigger:hover { background: #f3f4f6; }
    .accordion-trigger.active { background: #eef2ff; color: #6366f1; }
    .accordion-trigger svg { transition: transform 0.2s; }
    .accordion-trigger svg.rotated { transform: rotate(180deg); }
    .accordion-content { padding: 8px; background: white; }
    
    .available-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 4px; cursor: pointer; font-size: 13px; }
    .available-item:hover { background: #f3f4f6; }
    
    .custom-link-form, .mega-menu-form { display: flex; flex-direction: column; gap: 8px; }
    
    .checkbox-label { display: flex; align-items: center; gap: 8px; padding: 8px 0; font-size: 13px; cursor: pointer; }
    
    /* Right Panel */
    .right-panel { flex: 1; padding: 24px; overflow-y: auto; }
    .menu-structure-header { margin-bottom: 16px; }
    .menu-structure-header h3 { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
    .hint { margin: 0; font-size: 12px; color: #6b7280; }
    
    .menu-structure { min-height: 300px; padding: 16px; background: white; border: 2px dashed #e5e7eb; border-radius: 8px; }
    
    .menu-item-wrapper { margin-bottom: 8px; transition: margin-left 0.2s; }
    .menu-item-wrapper.dragging { transition: none; }
    
    .menu-item { display: flex; align-items: flex-start; padding: 12px; background: white; border: 1px solid #e5e7eb; border-radius: 6px; cursor: move; }
    .menu-item:hover { border-color: #6366f1; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1); }
    .menu-item.mega-menu-item { border-left: 4px solid #f97316; background: linear-gradient(135deg, #fff 0%, #fff7ed 100%); }
    
    .drag-handle { margin-right: 10px; padding: 4px; color: #9ca3af; cursor: grab; }
    .drag-handle:active { cursor: grabbing; }
    
    .item-content { flex: 1; }
    .item-header { display: flex; justify-content: space-between; align-items: center; }
    .item-info { display: flex; align-items: center; gap: 8px; }
    .item-icon { width: 18px; height: 18px; }
    .item-icon svg { width: 100%; height: 100%; }
    .item-title { font-weight: 500; color: #374151; }
    .item-type { font-size: 11px; color: #9ca3af; font-style: italic; }
    .depth-badge { font-size: 10px; padding: 2px 6px; background: #e0f2fe; color: #0369a1; border-radius: 10px; }
    
    .item-actions { display: flex; gap: 4px; }
    .action-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; font-size: 14px; }
    .action-btn:hover { background: #f3f4f6; }
    .action-btn.delete-btn:hover { background: #fee2e2; color: #ef4444; border-color: #fecaca; }
    .action-btn.mega-btn:hover { background: #ffedd5; color: #f97316; border-color: #fed7aa; }
    
    .edit-form, .mega-edit-form { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
    .mega-edit-form { background: #f9fafb; margin: 12px -12px -12px; padding: 12px; border-radius: 0 0 6px 6px; }
    
    .form-row { margin-bottom: 12px; }
    .form-row label { display: block; margin-bottom: 4px; font-size: 12px; font-weight: 500; color: #6b7280; }
    
    .mega-settings { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .mega-columns h4 { margin: 0 0 12px; font-size: 13px; font-weight: 600; }
    
    .mega-column { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 12px; }
    .column-header { display: flex; gap: 8px; margin-bottom: 8px; }
    .column-items { padding-left: 8px; }
    .column-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: #f9fafb; border-radius: 4px; margin-bottom: 4px; font-size: 13px; }
    
    .form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
    
    .empty-menu { padding: 40px; text-align: center; color: #9ca3af; }
    
    /* Buttons */
    .btn-primary { padding: 8px 16px; background: #6366f1; color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; }
    .btn-primary:hover { background: #4f46e5; }
    .btn-primary:disabled { background: #c7c7c7; cursor: not-allowed; }
    .btn-secondary { padding: 8px 16px; background: white; color: #374151; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; }
    .btn-secondary:hover { background: #f9fafb; }
    .btn-sm { padding: 6px 12px; font-size: 12px; }
    .btn-link { background: none; border: none; color: #6366f1; font-size: 12px; cursor: pointer; padding: 4px 0; }
    .btn-link:hover { text-decoration: underline; }
    
    /* Form Inputs */
    .form-input { width: 100%; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; }
    .form-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1); }
    .form-input-sm { padding: 6px 10px; font-size: 12px; flex: 1; }
    .form-select { padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; }
    
    /* Modal */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: white; border-radius: 12px; width: 90%; max-width: 600px; max-height: 80vh; display: flex; flex-direction: column; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e5e7eb; }
    .modal-header h4 { margin: 0; font-size: 16px; }
    .close-btn { width: 32px; height: 32px; background: none; border: none; font-size: 20px; cursor: pointer; border-radius: 6px; }
    .close-btn:hover { background: #f3f4f6; }
    .modal-body { padding: 16px 20px; overflow-y: auto; }
    
    .picker-items { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 12px; }
    .picker-item { display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .picker-item:hover { border-color: #6366f1; background: #f5f3ff; }
    .item-type-badge { font-size: 10px; padding: 2px 6px; background: #f3f4f6; border-radius: 10px; margin-left: auto; }
    
    /* CDK Drag */
    .cdk-drag-preview { box-shadow: 0 4px 16px rgba(0,0,0,0.15); border-color: #6366f1; }
    .cdk-drag-placeholder { opacity: 0.4; background: #f3f4f6; border: 2px dashed #d1d5db; }
  `]
})
export class NavigationBuilderComponent {
  @Input() menuData: MenuData = {
    id: '',
    name: '',
    type: 'Menus',
    isPrimaryMenu: false,
    isFooterMenu: false,
    template: { list: [] }
  };
  
  @Output() save = new EventEmitter<MenuData>();
  @Output() cancel = new EventEmitter<void>();
  
  openAccordion = signal<string | null>('plus');
  editingItemId = signal<string | null>(null);
  editingMegaMenuId = signal<string | null>(null);
  showingItemPicker = signal(false);
  
  customLink = { title: '', url: '' };
  megaMenuTitle = '';
  itemPickerSearch = '';
  selectedColumn: MegaMenuColumn | null = null;
  
  isDragActive = false;
  dragTargetDepth = 0;
  maxDepth = 2;
  
  linkOptions: LinkOption[] = [
    {
      title: 'Online Store',
      abbr: 'plus',
      child: [
        { name: 'Menu', abbr: 'menu', type: 'menu' },
        { name: 'Shop', abbr: 'shop', type: 'shop' },
      ]
    },
    {
      title: 'Collections',
      abbr: 'collections',
      child: [
        { name: 'All Collections', abbr: 'all-collections', type: 'collections' },
      ]
    },
    {
      title: 'Pages',
      abbr: 'pages',
      child: [
        { name: 'Home', abbr: 'home', type: 'page' },
        { name: 'About', abbr: 'about', type: 'page' },
        { name: 'Contact', abbr: 'contact', type: 'page' },
      ]
    },
    {
      title: 'Orders',
      abbr: 'orders',
      child: [
        { name: 'Order History', abbr: 'my-orders', type: 'orders' },
      ]
    },
    {
      title: 'Reservations',
      abbr: 'reservations',
      child: [
        { name: 'Reservation History', abbr: 'my-reservations', type: 'reservations' },
      ]
    },
    {
      title: 'Services',
      abbr: 'services',
      child: [
        { name: 'Pickup', abbr: 'pickup-menu', type: 'services' },
        { name: 'Delivery', abbr: 'delivery-menu', type: 'services' },
        { name: 'Appointments', abbr: 'appointments', type: 'services' },
        { name: 'Table Reservation', abbr: 'table-reservation', type: 'services' },
      ]
    },
    { title: 'Custom Link', abbr: 'custom', child: [] },
    { title: 'Mega Menu', abbr: 'mega', child: [] },
  ];
  
  constructor(private sanitizer: DomSanitizer) {}
  
  toggleAccordion(abbr: string) {
    this.openAccordion.set(this.openAccordion() === abbr ? null : abbr);
  }
  
  generateId(): string {
    return 'item-' + Math.random().toString(36).substr(2, 9);
  }
  
  addToMenu(child: { name: string; abbr: string; type: string }) {
    const newItem: NavigationItem = {
      uId: this.generateId(),
      name: child.name,
      type: child.type,
      abbr: child.abbr,
      depth: 0,
      index: this.menuData.template.list.length
    };
    this.menuData.template.list.push(newItem);
  }
  
  addCustomLink() {
    if (this.customLink.title && this.customLink.url) {
      const newItem: NavigationItem = {
        uId: 'custom-' + this.generateId(),
        name: this.customLink.title,
        type: 'customUrl',
        customUrl: this.customLink.url,
        depth: 0,
        index: this.menuData.template.list.length
      };
      this.menuData.template.list.push(newItem);
      this.customLink = { title: '', url: '' };
    }
  }
  
  addMegaMenu() {
    if (this.megaMenuTitle) {
      const newItem: NavigationItem = {
        uId: 'mega-' + this.generateId(),
        name: this.megaMenuTitle,
        type: 'mega',
        customUrl: '#',
        depth: 0,
        index: this.menuData.template.list.length,
        isMegaMenu: true,
        megaWidth: 'container',
        megaColumns: [{
          uId: 'col-' + this.generateId(),
          title: 'Column 1',
          width: 25,
          items: []
        }]
      };
      this.menuData.template.list.push(newItem);
      this.megaMenuTitle = '';
    }
  }
  
  convertToMegaMenu(item: NavigationItem) {
    item.isMegaMenu = true;
    item.type = 'mega';
    item.megaWidth = 'container';
    item.megaColumns = [{
      uId: 'col-' + this.generateId(),
      title: 'Column 1',
      width: 25,
      items: []
    }];
  }
  
  removeItem(uId: string) {
    this.menuData.template.list = this.menuData.template.list.filter(i => i.uId !== uId);
  }
  
  editItem(item: NavigationItem) {
    this.editingItemId.set(item.uId);
    this.editingMegaMenuId.set(null);
  }
  
  saveEdit() { this.editingItemId.set(null); }
  cancelEdit() { this.editingItemId.set(null); }
  
  editMegaMenu(item: NavigationItem) {
    this.editingMegaMenuId.set(item.uId);
    this.editingItemId.set(null);
  }
  
  saveMegaEdit() { this.editingMegaMenuId.set(null); }
  cancelMegaEdit() { this.editingMegaMenuId.set(null); }
  
  addMegaColumn(item: NavigationItem) {
    if (!item.megaColumns) item.megaColumns = [];
    if (item.megaColumns.length < 4) {
      item.megaColumns.push({
        uId: 'col-' + this.generateId(),
        title: `Column ${item.megaColumns.length + 1}`,
        width: 25,
        items: []
      });
    }
  }
  
  removeMegaColumn(item: NavigationItem, index: number) {
    item.megaColumns?.splice(index, 1);
  }
  
  removeColumnItem(column: MegaMenuColumn, index: number) {
    column.items.splice(index, 1);
  }
  
  showItemPicker(column: MegaMenuColumn) {
    this.selectedColumn = column;
    this.showingItemPicker.set(true);
  }
  
  closeItemPicker() {
    this.showingItemPicker.set(false);
    this.selectedColumn = null;
    this.itemPickerSearch = '';
  }
  
  getFilteredItems(items: { name: string; abbr: string; type: string }[]) {
    if (!this.itemPickerSearch) return items;
    const search = this.itemPickerSearch.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(search));
  }
  
  addItemToColumn(child: { name: string; abbr: string; type: string }) {
    if (this.selectedColumn) {
      this.selectedColumn.items.push({
        uId: this.generateId(),
        name: child.name,
        type: child.type,
        abbr: child.abbr,
        depth: 0,
        index: this.selectedColumn.items.length
      });
    }
  }
  
  moveLeft(item: NavigationItem) {
    if (item.depth > 0) item.depth--;
  }
  
  moveRight(item: NavigationItem) {
    if (this.canMoveRight(item)) item.depth++;
  }
  
  canMoveRight(item: NavigationItem): boolean {
    const index = this.menuData.template.list.findIndex(i => i.uId === item.uId);
    if (index === 0 || item.isMegaMenu) return false;
    const prevItem = this.menuData.template.list[index - 1];
    return item.depth <= prevItem.depth && item.depth < this.maxDepth;
  }
  
  onDrop(event: CdkDragDrop<NavigationItem[]>) {
    moveItemInArray(this.menuData.template.list, event.previousIndex, event.currentIndex);
    this.updateOrder();
  }
  
  onDragStarted(item: NavigationItem) {
    this.isDragActive = true;
    item.isDragging = true;
    item.dragDepth = item.depth;
  }
  
  onDragMoved(event: CdkDragMove, item: NavigationItem) {
    if (item.index === 0 || item.isMegaMenu) return;
    const depthChange = Math.floor(event.distance.x / 30);
    let newDepth = (item.depth || 0) + depthChange;
    newDepth = Math.max(0, Math.min(this.maxDepth, newDepth));
    
    const itemIndex = this.menuData.template.list.findIndex(i => i.uId === item.uId);
    if (itemIndex > 0 && newDepth > 0) {
      const prevItem = this.menuData.template.list[itemIndex - 1];
      newDepth = Math.min(newDepth, prevItem.depth + 1);
    }
    
    item.dragDepth = newDepth;
    this.dragTargetDepth = newDepth;
  }
  
  onDragEnded(item: NavigationItem) {
    this.isDragActive = false;
    item.isDragging = false;
    if (item.dragDepth !== undefined) {
      item.depth = item.dragDepth;
    }
    delete item.dragDepth;
  }
  
  updateOrder() {
    this.menuData.template.list.forEach((item, index) => {
      item.index = index;
    });
  }
  
  getItemIcon(type: string): SafeHtml {
    const icons: Record<string, string> = {
      'page': '<svg viewBox="0 0 20 20" fill="#6b7280"><path d="M13 3c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h7zm1 12V5a1 1 0 00-1-1H6a1 1 0 00-1 1v10a1 1 0 001 1h7a1 1 0 001-1zm-7-5V9h5v1H7zm0-3V6h5v1H7z"/></svg>',
      'customUrl': '<svg viewBox="0 0 20 20" fill="#6b7280"><path d="M7.73 15.4l1.6-1.6.71.71-1.6 1.59a3.16 3.16 0 01-4.48-4.48l2.74-2.66a3.16 3.16 0 014.48 0l-.7.7c-.85-.85-2.23-.85-3.07 0L4.66 12.33a2.17 2.17 0 003.07 3.07zm8.37-11.44a3.16 3.16 0 010 4.48l-2.66 2.67a3.2 3.2 0 01-4.49 0l.71-.71c.85.85 2.22.85 3.07 0l2.67-2.67a2.18 2.18 0 00-3.08-3.08l-1.66 1.66-.7-.7 1.66-1.66a3.16 3.16 0 014.48 0z"/></svg>',
      'services': '<svg viewBox="0 0 20 20" fill="#6b7280"><path d="M7.73 15.4l1.6-1.6.71.71-1.6 1.59a3.16 3.16 0 01-4.48-4.48l2.74-2.66a3.16 3.16 0 014.48 0l-.7.7c-.85-.85-2.23-.85-3.07 0L4.66 12.33a2.17 2.17 0 003.07 3.07zm8.37-11.44a3.16 3.16 0 010 4.48l-2.66 2.67a3.2 3.2 0 01-4.49 0l.71-.71c.85.85 2.22.85 3.07 0l2.67-2.67a2.18 2.18 0 00-3.08-3.08l-1.66 1.66-.7-.7 1.66-1.66a3.16 3.16 0 014.48 0z"/></svg>',
      'collections': '<svg viewBox="0 0 20 20" fill="#6b7280"><rect x="2" y="2" width="7" height="7" rx="1"/><rect x="11" y="2" width="7" height="7" rx="1"/><rect x="2" y="11" width="7" height="7" rx="1"/><rect x="11" y="11" width="7" height="7" rx="1"/></svg>',
      'menu': '<svg viewBox="0 0 20 20" fill="#6b7280"><path d="M3 5h14v2H3V5zm0 4h14v2H3V9zm0 4h14v2H3v-2z"/></svg>',
      'shop': '<svg viewBox="0 0 20 20" fill="#6b7280"><path d="M3 3h14l-1 9H4L3 3zm1 11a2 2 0 104 0 2 2 0 00-4 0zm8 0a2 2 0 104 0 2 2 0 00-4 0z"/></svg>',
      'orders': '<svg viewBox="0 0 20 20" fill="#6b7280"><path d="M4 4h12v2H4V4zm0 4h12v2H4V8zm0 4h8v2H4v-2z"/></svg>',
      'reservations': '<svg viewBox="0 0 20 20" fill="#6b7280"><path d="M6 2v2H4v12h12V4h-2V2h2a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2h2zm4 0v2h4V2h-4zM6 2h4v2H6V2z"/></svg>',
      'mega': '<svg viewBox="0 0 20 20" fill="#f97316"><rect x="2" y="4" width="16" height="12" rx="1"/><line x1="7" y1="4" x2="7" y2="16" stroke="#f97316" stroke-width="1"/><line x1="13" y1="4" x2="13" y2="16" stroke="#f97316" stroke-width="1"/></svg>',
    };
    return this.sanitizer.bypassSecurityTrustHtml(icons[type] || icons['page']);
  }
  
  onSave() {
    this.save.emit(this.menuData);
  }
  
  onCancel() {
    this.cancel.emit();
  }
}
