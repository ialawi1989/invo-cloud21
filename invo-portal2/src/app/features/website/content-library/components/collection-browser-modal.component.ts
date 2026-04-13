import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MODAL_DATA, MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { ContentLibraryService } from '../services/content-library.service';
import { Website } from '../../models/website.model';
import { ContentField } from '../models/content-library.model';

export interface CollectionBrowserData {
  collectionId: string;
}

@Component({
  selector: 'app-collection-browser-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { display: block; font-family: 'Inter', -apple-system, sans-serif; color: #111827; }

    .cb { display: flex; flex-direction: column; height: 100%; }

    .cb-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px 16px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0;
    }
    .cb-header-left { display: flex; flex-direction: column; gap: 4px; }
    .cb-breadcrumb { font-size: 12px; color: #6b7280; }
    .cb-title { font-size: 20px; font-weight: 700; color: #111827; }
    .cb-close {
      width: 32px; height: 32px; border: none; background: transparent;
      cursor: pointer; border-radius: 8px; display: flex; align-items: center;
      justify-content: center; color: #9ca3af;
    }
    .cb-close:hover { background: #f3f4f6; color: #374151; }

    /* Toolbar */
    .cb-toolbar {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 24px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0;
    }
    .cb-view-label { font-size: 14px; font-weight: 600; color: #111827; }
    .cb-search {
      margin-left: auto; height: 34px; width: 200px;
      border: 1px solid #e5e7eb; border-radius: 8px;
      padding: 0 10px 0 32px; font-size: 13px; font-family: inherit;
      outline: none; background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E") 10px center no-repeat;
    }
    .cb-search:focus { border-color: #32acc1; }

    /* Table */
    .cb-body { flex: 1; overflow-y: auto; }
    .cb-table { width: 100%; border-collapse: collapse; }
    .cb-table th {
      text-align: left; padding: 10px 14px;
      font-size: 12px; font-weight: 600; color: #6b7280;
      text-transform: uppercase; letter-spacing: .03em;
      border-bottom: 1px solid #e5e7eb; background: #fafbfc;
      position: sticky; top: 0; z-index: 1;
    }
    .cb-table td {
      padding: 10px 14px; border-bottom: 1px solid #f1f5f9;
      font-size: 14px; color: #374151;
      max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .cb-table tr:hover td { background: #f8fafc; }
    .cb-row-num { color: #9ca3af; font-size: 12px; width: 40px; }
    .cb-img { width: 36px; height: 36px; border-radius: 6px; object-fit: cover; }
    .cb-img-empty {
      width: 36px; height: 36px; border-radius: 6px;
      background: #f1f5f9; display: flex; align-items: center; justify-content: center;
    }
    .cb-empty { padding: 40px; text-align: center; color: #9ca3af; font-size: 14px; }
    .cb-loading { padding: 40px; text-align: center; color: #9ca3af; font-size: 13px; }

    /* Footer */
    .cb-footer {
      padding: 14px 24px; border-top: 1px solid #f1f5f9;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .cb-count { font-size: 13px; color: #6b7280; }
    .cb-add-btn {
      height: 36px; padding: 0 16px; border: none; border-radius: 100px;
      background: #32acc1; color: #fff; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 6px;
    }
    .cb-add-btn:hover { background: #2b95a8; }
  `],
  template: `
    <div class="cb">
      <div class="cb-header">
        <div class="cb-header-left">
          <span class="cb-breadcrumb">{{ collectionName() }}</span>
          <span class="cb-title">{{ collectionName() }}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <button class="cb-close" (click)="ref.dismiss()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="cb-toolbar">
        <span class="cb-view-label">Default view</span>
        <input class="cb-search" placeholder="Search" [(ngModel)]="searchQuery" (ngModelChange)="onSearch()"/>
      </div>

      <div class="cb-body">
        @if (loading()) {
          <div class="cb-loading">Loading items…</div>
        } @else if (filteredItems().length === 0) {
          <div class="cb-empty">No items in this collection</div>
        } @else {
          <table class="cb-table">
            <thead>
              <tr>
                <th style="width:40px">#</th>
                @for (field of visibleFields(); track field.id) {
                  <th>{{ field.name }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (item of filteredItems(); track item.id; let i = $index) {
                <tr>
                  <td class="cb-row-num">{{ i + 1 }}</td>
                  @for (field of visibleFields(); track field.id) {
                    <td>
                      @if (field.type === 'image') {
                        @if (item.template?.data?.[field.key]?.url) {
                          <img class="cb-img" [src]="item.template.data[field.key].url" alt=""/>
                        } @else {
                          <div class="cb-img-empty">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                          </div>
                        }
                      } @else if (field.type === 'boolean') {
                        {{ item.template?.data?.[field.key] ? 'Yes' : 'No' }}
                      } @else {
                        {{ displayVal(item.template?.data?.[field.key]) }}
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        }
      </div>

      <div class="cb-footer">
        <span class="cb-count">{{ filteredItems().length }} items</span>
        <button class="cb-add-btn" (click)="ref.dismiss()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Item
        </button>
      </div>
    </div>
  `
})
export class CollectionBrowserModalComponent implements OnInit {
  data = inject<CollectionBrowserData>(MODAL_DATA);
  ref  = inject<ModalRef>(MODAL_REF);
  private cms = inject(ContentLibraryService);

  loading        = signal(true);
  collectionName = signal('');
  allFields      = signal<ContentField[]>([]);
  visibleFields  = signal<ContentField[]>([]);
  items          = signal<Website[]>([]);
  filteredItems  = signal<Website[]>([]);
  searchQuery    = '';

  async ngOnInit(): Promise<void> {
    try {
      const coll = await this.cms.getCollectionById(this.data.collectionId);
      this.collectionName.set(coll.template?.displayName || coll.name || 'Collection');
      const fields: ContentField[] = coll.template?.fields ?? [];
      this.allFields.set(fields);
      this.visibleFields.set(fields.filter(f => f.isVisible !== false).slice(0, 6));

      const { list } = await this.cms.getItems(this.data.collectionId, { pageSize: 200 });
      this.items.set(list);
      this.filteredItems.set(list);
    } finally {
      this.loading.set(false);
    }
  }

  onSearch(): void {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) {
      this.filteredItems.set(this.items());
      return;
    }
    this.filteredItems.set(this.items().filter(item => {
      const title = (item.template?.data?.['title'] || item.name || '').toLowerCase();
      return title.includes(q);
    }));
  }

  displayVal(val: any): string {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v : v?.name || '').filter(Boolean).join(', ');
    if (val?.name) return val.name;
    if (val?.url) return val.url;
    return String(val);
  }
}
