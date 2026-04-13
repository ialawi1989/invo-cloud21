import { Component, inject, signal, input, output, effect, OnInit, ElementRef, HostListener, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ContentLibraryService } from '../services/content-library.service';
import { ModalService } from '../../../../shared/modal/modal.service';
import { Website } from '../../models/website.model';

export interface RefItem {
  id:    string;
  title: string;
  image: string;
}

@Component({
  selector: 'app-reference-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { display: block; width: 100%; }
    :host(.compact) { }  /* host class applied via HostBinding */

    /* Header row: label + Open Collection link */
    .rp-head {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 6px;
    }
    .rp-label { font-size: 13px; font-weight: 500; color: #374151; }
    .rp-open-link {
      border: none; background: none; cursor: pointer;
      font-size: 12px; font-weight: 500; color: #32acc1;
      font-family: inherit; padding: 0;
    }
    .rp-open-link:hover { text-decoration: underline; }

    /* Main box — bordered area like Wix */
    .rp-box {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
      min-height: 42px; padding: 6px 10px;
      border: 1.5px solid #e5e7eb; border-radius: 8px;
      background: #fff; cursor: text; transition: border-color .12s;
      position: relative;
    }
    .rp-box:focus-within { border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.08); }
    .rp-box.empty { padding: 8px 12px; }

    /* Tags */
    .tag {
      display: inline-flex; align-items: center; gap: 4px;
      height: 24px; padding: 0 7px 0 4px; border-radius: 5px;
      background: #e6f7fa; color: #0e7a8a; font-size: 12px; font-weight: 500;
      white-space: nowrap; max-width: 160px;
    }
    .tag-img {
      width: 18px; height: 18px; border-radius: 3px; object-fit: cover; flex-shrink: 0;
    }
    .tag-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tag-x {
      width: 14px; height: 14px; border: none; background: none; cursor: pointer;
      color: #7dd3e0; display: flex; align-items: center; justify-content: center;
      border-radius: 50%; padding: 0; flex-shrink: 0; margin-left: 1px;
    }
    .tag-x:hover { color: #0e7a8a; background: #ccf0f5; }

    /* + Add Reference button */
    .rp-add {
      display: inline-flex; align-items: center; gap: 4px;
      height: 24px; padding: 0 8px;
      border: none; background: none; cursor: pointer;
      font-size: 12px; font-weight: 500; color: #32acc1;
      font-family: inherit; white-space: nowrap; outline: none;
    }
    .rp-add:hover { color: #1a8fa3; }

    /* Compact mode (table cells) — always show tags, hide +Add until hover */
    :host(.compact) { width: 100%; }
    :host(.compact) .rp-box {
      min-height: auto; padding: 0; border: none; border-radius: 0;
      gap: 5px; width: 100%; box-shadow: none !important;
      flex-wrap: nowrap; overflow: hidden; background: transparent;
    }
    :host(.compact) .rp-box:focus-within { box-shadow: none !important; }
    :host(.compact) .rp-box.empty { padding: 0; }
    :host(.compact) .rp-add { display: none !important; }
    :host-context(td.cell-focused) .rp-box.empty .rp-add { display: inline-flex !important; }
    :host(.compact) .tag { flex-shrink: 0; }
    :host(.compact) .tag-x { display: none; }
    :host-context(td.cell-focused) .tag-x { display: flex !important; }

    /* No collection configured */
    .rp-disabled {
      min-height: 42px; padding: 10px 12px;
      border: 1.5px dashed #e5e7eb; border-radius: 8px;
      background: #fafafa; color: #9ca3af; font-size: 13px;
      display: flex; align-items: center; gap: 6px;
    }

    /* Dropdown — fixed position */
    .rp-dd {
      position: fixed; z-index: 9999;
      width: 220px; background: #fff;
      border: 1px solid #e5e7eb; border-radius: 10px;
      box-shadow: 0 10px 32px rgba(0,0,0,.14);
      max-height: 320px; display: flex; flex-direction: column;
      overflow: hidden;
    }
    .rp-dd-search {
      margin: 0; height: 34px;
      border: none; border-bottom: 1px solid #f1f5f9;
      padding: 0 12px; font-size: 13px; font-family: inherit; color: #111827;
      outline: none; background: #fff; flex-shrink: 0;
      box-sizing: border-box; width: 100%; border-radius: 10px 10px 0 0;
    }
    .rp-dd-search:focus { border-bottom-color: #32acc1; }

    .rp-dd-header {
      font-size: 10px; font-weight: 700; color: #32acc1;
      text-transform: uppercase; letter-spacing: .05em;
      padding: 8px 12px 4px; flex-shrink: 0;
    }
    .rp-dd-list { flex: 1; overflow-y: auto; padding: 4px 6px 6px; }
    .rp-dd-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 10px; border-radius: 6px; cursor: pointer;
      font-size: 13px; color: #374151; transition: background .08s;
    }
    .rp-dd-item:hover { background: #f1f5f9; }
    .rp-dd-item.sel { background: #e6f7fa; color: #0e7a8a; font-weight: 500; }
    .rp-dd-img {
      width: 28px; height: 28px; border-radius: 6px; object-fit: cover; flex-shrink: 0;
      background: #f1f5f9;
    }
    .rp-dd-ph {
      width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
      background: #f1f5f9; display: flex; align-items: center; justify-content: center;
      color: #cbd5e1;
    }
    .rp-dd-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rp-dd-empty { padding: 16px 12px; text-align: center; font-size: 13px; color: #9ca3af; }
    .rp-dd-loading { padding: 16px; text-align: center; color: #9ca3af; font-size: 12px; }

    .rp-dd-footer {
      padding: 8px 12px; border-top: 1px solid #f1f5f9; flex-shrink: 0;
    }
    .rp-dd-open-btn {
      border: none; background: none; cursor: pointer;
      font-size: 12px; font-weight: 600; color: #32acc1;
      font-family: inherit; padding: 0;
    }
    .rp-dd-open-btn:hover { text-decoration: underline; }
  `],
  template: `
    @if (!collectionId()) {
      <!-- No collection configured -->
      @if (!compact()) {
        <div class="rp-disabled">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          Select a referenced collection in field settings
        </div>
      } @else {
        <span style="font-size:12px;color:#9ca3af">—</span>
      }
    } @else {
      <!-- Tags box -->
      <div class="rp-box" [class.empty]="selectedItems().length === 0">
        @for (item of selectedItems(); track item.id) {
          <span class="tag">
            @if (item.image) { <img class="tag-img" [src]="item.image" alt=""/> }
            <span class="tag-name">{{ item.title }}</span>
            <button class="tag-x" (click)="removeItem(item.id, $event)">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </span>
        }
        <button class="rp-add" (click)="openDropdown($event)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {{ multiple() ? 'Add Reference' : (selectedItems().length ? 'Change' : 'Add Reference') }}
        </button>
      </div>
    }

    @if (dropdownOpen()) {
      <div class="rp-dd" [style.top.px]="ddPos.top" [style.left.px]="ddPos.left">
        <input class="rp-dd-search" placeholder="Search items…"
               [(ngModel)]="ddSearch" (ngModelChange)="onDdSearch()"
               (click)="$event.stopPropagation()"/>
        <div class="rp-dd-header">{{ collectionName() }}</div>
        <div class="rp-dd-list">
          @if (loadingItems()) {
            <div class="rp-dd-loading">Loading…</div>
          } @else if (filteredItems().length === 0) {
            <div class="rp-dd-empty">No items found</div>
          } @else {
            @for (item of filteredItems(); track item.id) {
              <div class="rp-dd-item" [class.sel]="isSelected(item.id)" (click)="toggleItem(item, $event)">
                @if (item.image) {
                  <img class="rp-dd-img" [src]="item.image" alt=""/>
                } @else {
                  <div class="rp-dd-ph">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </div>
                }
                <span class="rp-dd-name">{{ item.title }}</span>
              </div>
            }
          }
        </div>
        <div class="rp-dd-footer">
          <button class="rp-dd-open-btn" (click)="openCollection($event)">Open Collection</button>
        </div>
      </div>
    }
  `
})
export class ReferencePickerComponent implements OnInit {
  collectionId   = input<string>('');
  multiple       = input(false);
  compact        = input(false);
  focused        = input(false);
  value          = input<RefItem | RefItem[] | null>(null);
  valueChange    = output<RefItem | RefItem[] | null>();

  @HostBinding('class.compact') get isCompact() { return this.compact(); }

  private focusEffect = effect(() => {
    const f = this.focused();
    if (f && this.compact() && this.collectionId() && !this.dropdownOpen()) {
      this.openDropdown();
    }
    if (!f && this.dropdownOpen()) {
      this.dropdownOpen.set(false);
    }
  });

  private static activeInstance: ReferencePickerComponent | null = null;

  private cms      = inject(ContentLibraryService);
  private modalSvc = inject(ModalService);
  private elRef    = inject(ElementRef);

  dropdownOpen   = signal(false);
  loadingItems   = signal(false);
  allItems       = signal<RefItem[]>([]);
  selectedItems  = signal<RefItem[]>([]);
  filteredItems  = signal<RefItem[]>([]);
  collectionName = signal('');
  ddSearch       = '';
  ddPos          = { top: 0, left: 0 };

  ngOnInit(): void {
    this.syncSelected();
    if (this.collectionId()) {
      this.loadCollectionName();
    }
  }

  private async loadCollectionName(): Promise<void> {
    try {
      const coll = await this.cms.getCollectionById(this.collectionId());
      this.collectionName.set(coll.template?.displayName || coll.name || 'Collection');
    } catch {
      this.collectionName.set('Collection');
    }
  }

  private syncSelected(): void {
    const v = this.value();
    if (!v) { this.selectedItems.set([]); return; }
    if (Array.isArray(v)) { this.selectedItems.set([...v]); }
    else { this.selectedItems.set([v]); }
  }

  async openDropdown(e?: Event): Promise<void> {
    e?.stopPropagation();
    if (this.dropdownOpen()) { this.dropdownOpen.set(false); ReferencePickerComponent.activeInstance = null; return; }
    // Close any other open picker
    if (ReferencePickerComponent.activeInstance && ReferencePickerComponent.activeInstance !== this) {
      ReferencePickerComponent.activeInstance.dropdownOpen.set(false);
    }
    ReferencePickerComponent.activeInstance = this;
    const rect = this.elRef.nativeElement.getBoundingClientRect();
    this.ddPos = { top: rect.bottom + 4, left: rect.left };
    this.dropdownOpen.set(true);
    this.ddSearch = '';
    if (this.allItems().length === 0) {
      await this.loadItems();
    } else {
      this.applyFilter();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    if (!this.elRef.nativeElement.contains(e.target)) {
      if (this.dropdownOpen()) {
        this.dropdownOpen.set(false);
        if (ReferencePickerComponent.activeInstance === this) ReferencePickerComponent.activeInstance = null;
      }
    }
  }

  private async loadItems(): Promise<void> {
    this.loadingItems.set(true);
    try {
      const { list } = await this.cms.getItems(this.collectionId(), { pageSize: 200 });
      const items: RefItem[] = list.map(w => ({
        id: w.id,
        title: w.template?.data?.['title'] || w.name || 'Untitled',
        image: this.getItemImage(w),
      }));
      this.allItems.set(items);
      this.applyFilter();
    } finally {
      this.loadingItems.set(false);
    }
  }

  private getItemImage(w: Website): string {
    const d = w.template?.data;
    if (!d) return '';
    for (const key of Object.keys(d)) {
      const val = d[key];
      if (val?.url && typeof val.url === 'string') return val.url;
      if (Array.isArray(val) && val[0]?.url) return val[0].url;
    }
    return '';
  }

  onDdSearch(): void { this.applyFilter(); }

  private applyFilter(): void {
    const q = this.ddSearch.toLowerCase().trim();
    if (!q) {
      this.filteredItems.set(this.allItems());
    } else {
      this.filteredItems.set(this.allItems().filter(i => i.title.toLowerCase().includes(q)));
    }
  }

  isSelected(id: string): boolean {
    return this.selectedItems().some(s => s.id === id);
  }

  toggleItem(item: RefItem, e: Event): void {
    e.stopPropagation();
    if (this.multiple()) {
      if (this.isSelected(item.id)) {
        const next = this.selectedItems().filter(s => s.id !== item.id);
        this.selectedItems.set(next);
        this.valueChange.emit(next);
      } else {
        const next = [...this.selectedItems(), item];
        this.selectedItems.set(next);
        this.valueChange.emit(next);
      }
    } else {
      this.selectedItems.set([item]);
      this.valueChange.emit(item);
      this.dropdownOpen.set(false);
    }
  }

  removeItem(id: string, e: Event): void {
    e.stopPropagation();
    const next = this.selectedItems().filter(s => s.id !== id);
    this.selectedItems.set(next);
    this.valueChange.emit(this.multiple() ? next : null);
  }

  async openCollection(e: Event): Promise<void> {
    e.stopPropagation();
    this.dropdownOpen.set(false);

    const { ContentLibraryComponent } = await import('../pages/content-library/content-library.component');
    const fakeRoute = {
      snapshot: { paramMap: convertToParamMap({ id: this.collectionId() }) },
      paramMap: { subscribe: () => ({ unsubscribe: () => {} }) },
      queryParamMap: { subscribe: () => ({ unsubscribe: () => {} }) },
      params: { subscribe: () => ({ unsubscribe: () => {} }) },
      queryParams: { subscribe: () => ({ unsubscribe: () => {} }) },
    };
    const ref = this.modalSvc.open(ContentLibraryComponent, {
      size: 'xl',
      panelClass: 'collection-modal',
      providers: [
        { provide: ActivatedRoute, useValue: fakeRoute },
      ],
    });
    // Refresh items list when modal closes (user may have added/edited items)
    ref.afterClosed().then(() => {
      this.allItems.set([]);
      this.loadItems();
    });
  }
}
