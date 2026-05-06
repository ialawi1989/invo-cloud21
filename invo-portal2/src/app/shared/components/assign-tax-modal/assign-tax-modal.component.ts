import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ApiService } from '@core/http/api.service';

export interface AssignTaxModalData { taxId: string; }

type TabId = 'All' | 'Product' | 'Department' | 'Category' | 'Brand' | 'Type';

const TABS: TabId[] = ['All', 'Product', 'Department', 'Category', 'Brand', 'Type'];

const TYPES = [
  { value: 'inventory',      label: 'Inventory' },
  { value: 'serialized',     label: 'Serialized' },
  { value: 'batch',          label: 'Batched' },
  { value: 'kit',            label: 'Kit' },
  { value: 'service',        label: 'Service' },
  { value: 'package',        label: 'Package' },
  { value: 'menuItem',       label: 'Menu Item' },
  { value: 'menuSelection',  label: 'Menu Selection' },
];

@Component({
  selector: 'app-assign-tax-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header title="Assign To" />

    <div class="modal-body">

      <!-- ── Tabs ── -->
      <nav class="tabs">
        @for (tab of tabList; track tab) {
          <button
            class="tab"
            type="button"
            [class.active]="activeTab() === tab"
            (click)="switchTab(tab)"
          >{{ tab }}</button>
        }
      </nav>

      <!-- ── Search (list tabs only) ── -->
      @if (activeTab() !== 'Type' && activeTab() !== 'All') {
        <div class="search-wrap">
          <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            class="search-input"
            type="text"
            placeholder="Search"
            [(ngModel)]="searchTerm"
            (input)="onSearch()"
          />
          @if (searchTerm) {
            <button class="search-clear" type="button" (click)="clearSearch()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          }
        </div>
      }

      <!-- ── List area ── -->
      <div class="list" (scroll)="onScroll($event)">

        <!-- All tab -->
        @if (activeTab() === 'All') {
          <div class="all-confirm">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00a8b8" stroke-width="1.5">
              <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              <path d="M12 8v4m0 4h.01"/>
            </svg>
            <p>This will assign the tax to <strong>all products</strong>.</p>
            <p class="all-confirm__sub">Click Submit to continue.</p>
          </div>
        }

        <!-- Product tab -->
        @if (activeTab() === 'Product') {
          @if (loading()) {
            <div class="state-center"><span class="spinner"></span></div>
          } @else if (items().length === 0) {
            <div class="state-center">No products found</div>
          } @else {
            @for (item of items(); track item.id) {
              <div class="item" [class.item--selected]="isProductSelected(item.id)" (click)="toggleProduct(item.id)">
                <span class="checkbox" [class.checkbox--on]="isProductSelected(item.id)">
                  @if (isProductSelected(item.id)) {
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="1.5 6 4.5 9 10.5 3"/>
                    </svg>
                  }
                </span>
                <div class="thumb">
                  @if (item.thumbnailUrl) {
                    <img [src]="item.thumbnailUrl" [alt]="item.name" class="thumb__img"/>
                  } @else {
                    <svg viewBox="0 0 20 20" class="thumb__svg" fill="none" aria-hidden="true">
                      <path d="M12.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="#94a3b8"/>
                      <path fill-rule="evenodd" d="M9.018 3.5h1.964c.813 0 1.469 0 2 .043.546.045 1.026.14 1.47.366a3.75 3.75 0 0 1 1.64 1.639c.226.444.32.924.365 1.47.043.531.043 1.187.043 2v1.964c0 .813 0 1.469-.043 2-.045.546-.14 1.026-.366 1.47a3.75 3.75 0 0 1-1.639 1.64c-.444.226-.924.32-1.47.365-.531.043-1.187.043-2 .043h-1.964c-.813 0-1.469 0-2-.043-.546-.045-1.026-.14-1.47-.366a3.75 3.75 0 0 1-1.64-1.639c-.226-.444-.32-.924-.365-1.47-.043-.531-.043-1.187-.043-2v-1.964c0-.813 0-1.469.043-2 .045-.546.14-1.026.366-1.47a3.75 3.75 0 0 1 1.639-1.64c.444-.226.924-.32 1.47-.365.531-.043 1.187-.043 2-.043Zm-1.877 1.538c-.454.037-.715.107-.912.207a2.25 2.25 0 0 0-.984.984c-.1.197-.17.458-.207.912-.037.462-.038 1.057-.038 1.909v1.428l.723-.867a1.75 1.75 0 0 1 2.582-.117l2.695 2.695 1.18-1.18a1.75 1.75 0 0 1 2.604.145l.216.27v-2.374c0-.852 0-1.447-.038-1.91-.037-.453-.107-.714-.207-.911a2.25 2.25 0 0 0-.984-.984c-.197-.1-.458-.17-.912-.207-.462-.037-1.056-.038-1.909-.038h-1.9c-.852 0-1.447 0-1.91.038Zm-2.103 7.821a7.12 7.12 0 0 1-.006-.08.746.746 0 0 0 .044-.049l1.8-2.159a.25.25 0 0 1 .368-.016l3.226 3.225a.75.75 0 0 0 1.06 0l1.71-1.71a.25.25 0 0 1 .372.021l1.213 1.516c-.021.06-.045.114-.07.165-.216.423-.56.767-.984.983-.197.1-.458.17-.912.207-.462.037-1.056.038-1.909.038h-1.9c-.852 0-1.447 0-1.91-.038-.453-.037-.714-.107-.911-.207a2.25 2.25 0 0 1-.984-.984c-.1-.197-.17-.458-.207-.912Z" fill="#94a3b8"/>
                    </svg>
                  }
                </div>
                <div class="item__info">
                  <span class="item__name">{{ item.name }}</span>
                  @if (item.barcode) { <span class="item__code">{{ item.barcode }}</span> }
                </div>
                <span class="item__qty" [class.item__qty--zero]="item.qty === 0">{{ item.qty }}</span>
              </div>
            }
            @if (loadingMore()) { <div class="state-center state-center--sm"><span class="spinner"></span></div> }
          }
        }

        <!-- Department / Category / Brand tabs -->
        @if (activeTab() === 'Department' || activeTab() === 'Category' || activeTab() === 'Brand') {
          @if (loading()) {
            <div class="state-center"><span class="spinner"></span></div>
          } @else if (items().length === 0) {
            <div class="state-center">No {{ activeTab().toLowerCase() }}s found</div>
          } @else {
            @for (item of items(); track item.id) {
              <div class="item" [class.item--selected]="selectedSingleId() === item.id" (click)="selectSingle(item.id)">
                <span class="radio" [class.radio--on]="selectedSingleId() === item.id">
                  @if (selectedSingleId() === item.id) {
                    <span class="radio__dot"></span>
                  }
                </span>
                <div class="item__info">
                  <span class="item__name">{{ item.name }}</span>
                </div>
              </div>
            }
            @if (loadingMore()) { <div class="state-center state-center--sm"><span class="spinner"></span></div> }
          }
        }

        <!-- Type tab -->
        @if (activeTab() === 'Type') {
          <div class="type-list">
            @for (type of typeList; track type.value) {
              <label class="type-item" (click)="toggleType(type.value)">
                <span class="checkbox" [class.checkbox--on]="isTypeChecked(type.value)">
                  @if (isTypeChecked(type.value)) {
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="1.5 6 4.5 9 10.5 3"/>
                    </svg>
                  }
                </span>
                <span class="type-item__label">{{ type.label }}</span>
              </label>
            }
          </div>
        }

      </div>

      <!-- Footer bar -->
      <div class="footer-bar">
        <span class="selected-count">{{ selectionSummary() }}</span>
      </div>
    </div>

    <app-modal-footer>
      <button class="btn-cancel" type="button" (click)="ref.close()">Cancel</button>
      <button class="btn-submit" type="button" (click)="submit()" [disabled]="!canSubmit()">Submit</button>
    </app-modal-footer>
  `,
  styles: [`
    :host { display: contents; }

    .modal-body {
      display: flex;
      flex-direction: column;
      height: 480px;
      overflow: hidden;
    }

    /* ── Tabs ── */
    .tabs {
      display: flex;
      border-bottom: 1px solid #e2e8f0;
      padding: 0 20px;
      flex-shrink: 0;
      gap: 0;
    }

    .tab {
      padding: 11px 14px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      font: inherit;
      font-size: 12.5px;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      transition: color 100ms ease, border-color 100ms ease;
      white-space: nowrap;

      &:hover { color: #0f172a; }
      &.active { color: #00a8b8; border-bottom-color: #00a8b8; font-weight: 600; }
    }

    /* ── Search ── */
    .search-wrap {
      position: relative;
      padding: 12px 20px 8px;
      flex-shrink: 0;
    }

    .search-icon {
      position: absolute;
      left: 32px;
      top: 50%;
      transform: translateY(-50%);
      color: #94a3b8;
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      padding: 8px 32px 8px 34px;
      font-size: 13px;
      color: #0f172a;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color 120ms, box-shadow 120ms;

      &:focus {
        outline: none;
        background: #fff;
        border-color: #32acc1;
        box-shadow: 0 0 0 3px rgba(50,172,193,0.12);
      }
      &::placeholder { color: #94a3b8; }
    }

    .search-clear {
      position: absolute;
      right: 32px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px;
      &:hover { color: #475569; }
    }

    /* ── List ── */
    .list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
    }

    .item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 9px 20px;
      cursor: pointer;
      transition: background 100ms;

      &:hover { background: #f8fafc; }
      &--selected { background: #f0fafb; }
    }

    /* Checkbox */
    .checkbox {
      width: 18px;
      height: 18px;
      border-radius: 4px;
      border: 1.5px solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      flex-shrink: 0;
      transition: background 120ms, border-color 120ms;
      cursor: pointer;

      &--on { background: #00a8b8; border-color: #00a8b8; }
    }

    /* Radio */
    .radio {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 1.5px solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      flex-shrink: 0;
      transition: border-color 120ms;
      cursor: pointer;

      &--on { border-color: #00a8b8; }

      &__dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #00a8b8;
      }
    }

    /* Thumbnail */
    .thumb {
      width: 38px;
      height: 38px;
      border-radius: 6px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;

      &__img { width: 100%; height: 100%; object-fit: cover; }
      &__svg { width: 20px; height: 20px; }
    }

    .item__info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .item__name {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item__code {
      font-size: 11px;
      color: #00a8b8;
      font-weight: 500;
    }

    .item__qty {
      font-size: 12px;
      font-weight: 600;
      color: #0e7490;
      min-width: 36px;
      text-align: end;
      flex-shrink: 0;

      &--zero { color: #94a3b8; }
    }

    /* Type list */
    .type-list {
      display: flex;
      flex-direction: column;
      padding: 8px 0;
    }

    .type-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 20px;
      cursor: pointer;
      transition: background 100ms;

      &:hover { background: #f8fafc; }

      &__label {
        font-size: 13px;
        color: #0f172a;
        font-weight: 500;
      }
    }

    /* All confirm */
    .all-confirm {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      height: 100%;
      padding: 40px 32px;
      text-align: center;

      p { margin: 0; font-size: 14px; color: #0f172a; }
      &__sub { font-size: 12px; color: #94a3b8 !important; }
    }

    /* States */
    .state-center {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 40px 20px;
      color: #94a3b8;
      font-size: 13px;

      &--sm { padding: 14px; }
    }

    .spinner {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2.5px solid #e2e8f0;
      border-top-color: #32acc1;
      display: inline-block;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Footer */
    .footer-bar {
      padding: 9px 20px;
      border-top: 1px solid #f1f5f9;
      flex-shrink: 0;
    }

    .selected-count { font-size: 12px; color: #64748b; }

    /* Buttons */
    .btn-cancel {
      padding: 9px 20px;
      background: #fff;
      color: #374151;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms;
      &:hover { background: #f8fafc; }
    }

    .btn-submit {
      padding: 9px 24px;
      background: #00a8b8;
      color: #fff;
      border: none;
      border-radius: 8px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms;
      &:hover:not(:disabled) { background: #0097a5; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
  `]
})
export class AssignTaxModalComponent implements OnInit {
  data    = inject<AssignTaxModalData>(MODAL_DATA);
  ref     = inject<ModalRef<any>>(MODAL_REF);
  private api        = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  readonly tabList  = TABS;
  readonly typeList = TYPES;

  private searchSubject = new Subject<string>();

  activeTab      = signal<TabId>('Product');
  loading        = signal(false);
  loadingMore    = signal(false);
  items          = signal<any[]>([]);
  selectedIds    = signal<string[]>([]);    // product multi-select
  selectedSingleId = signal<string | null>(null); // dept/cat/brand single-select
  selectedTypes  = signal<string[]>([]);

  searchTerm = '';
  private page    = 1;
  private limit   = 20;
  private hasMore = true;

  private get endpoint(): string {
    switch (this.activeTab()) {
      case 'Department': return 'product/getDepartmentList';
      case 'Category':   return 'product/getCategoryList';
      case 'Brand':      return 'product/getBrandList';
      default:           return 'product/getProductsListByType';
    }
  }

  private get isListTab(): boolean {
    const tab = this.activeTab();
    return tab !== 'All' && tab !== 'Type';
  }

  ngOnInit(): void {
    this.searchSubject
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resetAndLoad());

    this.loadItems();
  }

  switchTab(tab: TabId): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.searchTerm = '';
    this.resetAndLoad();
  }

  onSearch(): void { this.searchSubject.next(this.searchTerm); }

  clearSearch(): void {
    this.searchTerm = '';
    this.resetAndLoad();
  }

  private resetAndLoad(): void {
    this.page    = 1;
    this.hasMore = true;
    this.items.set([]);
    this.loadItems();
  }

  private async loadItems(append = false): Promise<void> {
    if (!this.isListTab) return;
    if (!this.hasMore && append) return;

    if (append) this.loadingMore.set(true);
    else        this.loading.set(true);

    try {
      const body: any = { page: this.page, limit: this.limit };
      if (this.searchTerm) body.searchTerm = this.searchTerm;

      const res = await this.api.request(this.api.post(this.endpoint, body));
      const raw: any[] = res?.data?.list ?? [];

      const mapped = raw.map((p: any) => ({
        id:           p.id,
        name:         p.name,
        barcode:      p.barcode || p.sku || '',
        qty:          p.qty ?? p.quantity ?? 0,
        thumbnailUrl: p.mediaUrl?.thumbnailUrl || p.thumbnailUrl || '',
      }));

      this.hasMore = mapped.length >= this.limit;
      this.items.update(prev => append ? [...prev, ...mapped] : mapped);
    } catch {
      if (!append) this.items.set([]);
    } finally {
      this.loading.set(false);
      this.loadingMore.set(false);
    }
  }

  onScroll(event: Event): void {
    if (!this.hasMore || this.loadingMore() || this.loading()) return;
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      this.page++;
      this.loadItems(true);
    }
  }

  // ── Product selection ──────────────────────────────────────────────────
  isProductSelected(id: string): boolean { return this.selectedIds().includes(id); }

  toggleProduct(id: string): void {
    this.selectedIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }

  // ── Single selection (Department / Category / Brand) ───────────────────
  selectSingle(id: string): void {
    this.selectedSingleId.set(this.selectedSingleId() === id ? null : id);
  }

  // ── Type selection ─────────────────────────────────────────────────────
  isTypeChecked(value: string): boolean { return this.selectedTypes().includes(value); }

  toggleType(value: string): void {
    this.selectedTypes.update(types =>
      types.includes(value) ? types.filter(t => t !== value) : [...types, value]
    );
  }

  // ── Summary & submit ───────────────────────────────────────────────────
  selectionSummary(): string {
    switch (this.activeTab()) {
      case 'All':        return 'All products';
      case 'Product':    return `${this.selectedIds().length} selected`;
      case 'Type':       return `${this.selectedTypes().length} selected`;
      default: {
        const id = this.selectedSingleId();
        if (!id) return '0 selected';
        const found = this.items().find(i => i.id === id);
        return found ? found.name : '1 selected';
      }
    }
  }

  canSubmit(): boolean {
    switch (this.activeTab()) {
      case 'All':        return true;
      case 'Product':    return this.selectedIds().length > 0;
      case 'Type':       return this.selectedTypes().length > 0;
      default:           return this.selectedSingleId() !== null;
    }
  }

  submit(): void {
    const tab = this.activeTab();
    const params: any = { taxId: this.data.taxId, filterType: tab };

    switch (tab) {
      case 'Product':    params.productIds    = this.selectedIds();         break;
      case 'Department': params.departmentId  = this.selectedSingleId();    break;
      case 'Category':   params.categoryId    = this.selectedSingleId();    break;
      case 'Brand':      params.brandId       = this.selectedSingleId();    break;
      case 'Type':       params.types         = this.selectedTypes();       break;
    }

    this.ref.close(params);
  }
}
