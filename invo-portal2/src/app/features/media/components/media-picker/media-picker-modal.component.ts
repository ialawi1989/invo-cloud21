import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { Media, IMediaUploadConfig } from '../../models/media.model';
import { MediaService } from '../../services/media.service';
import { MODAL_REF, MODAL_DATA } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { ModalHeaderComponent } from '../../../../shared/modal/modal-header.component';
import { SpinnerComponent } from '../../../../shared/components/spinner';
import { UploadToastService } from '../../../../shared/components/upload-toast';
import { UploadToastPanelComponent } from '../../../../shared/components/upload-toast/upload-toast.component';
import { MediaUploadComponent } from '../media-upload';

export interface MediaPickerConfig {
  /** Filter to specific content types (e.g. ['image']). Empty = all. */
  contentTypes?: string[];
  /** Allow multiple selection. Default false. */
  multiple?: boolean;
  /** Modal title. */
  title?: string;
  /** Max selectable items. Default 1 for single, unlimited for multiple. */
  maxSelect?: number;
  /** Auto-start upload when files are selected. Default true. */
  autoUpload?: boolean;
  /** IDs of already-selected media to pre-select when opening. */
  preSelectedIds?: string[];
}

type PickerTab = 'library' | 'upload';

/**
 * MediaPickerModalComponent
 * ─────────────────────────
 * A full media picker modal with two tabs:
 *   • Media Library — browse/search existing media with grid + selection
 *   • Upload files  — upload new media via the existing MediaUploadComponent
 *
 * Opens via ModalService.open() and returns the selected Media item(s) on close.
 *
 * Usage:
 *   const ref = modalService.open(MediaPickerModalComponent, {
 *     size: 'xl',
 *     data: { contentTypes: ['image'], title: 'Choose an Image' }
 *   });
 *   const selected = await ref.afterClosed(); // Media | Media[] | undefined
 */
@Component({
  selector: 'app-media-picker-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalHeaderComponent, SpinnerComponent, MediaUploadComponent, UploadToastPanelComponent],
  template: `
    <!-- Header -->
    <app-modal-header [title]="config.title ?? 'Media Library'" />

    <!-- Upload toast — rendered inside the modal so it's always above -->
    <div class="picker-toast">
      <app-upload-toast-panel />
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button
        [class]="'tab ' + (activeTab() === 'library' ? 'tab--active' : '')"
        (click)="activeTab.set('library')">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
        </svg>
        Media Library
      </button>
      <button
        [class]="'tab ' + (activeTab() === 'upload' ? 'tab--active' : '')"
        (click)="activeTab.set('upload')">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Upload files
      </button>
    </div>

    <!-- Library tab -->
    @if (activeTab() === 'library') {
      <div class="library-row">
        <!-- Main content (search + grid) -->
        <div class="body" (scroll)="onGridScroll($event)">
          <!-- Search -->
          <div class="search-wrap">
            <svg class="search-icon" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="Search"
              [(ngModel)]="searchQuery"
              (ngModelChange)="onSearch()"
              class="search-input" />
          </div>

          <!-- Grid -->
          <div class="grid-wrap">
            @if (loading()) {
              <div class="loading">
                <app-spinner size="md" class="text-brand-500" />
                <span>Loading media…</span>
              </div>
            }

            @if (!loading() && mediaItems().length === 0) {
              <div class="empty">
                <span [innerHTML]="emptyIcon()"></span>
                <p>No media found</p>
              </div>
            }

            @if (!loading() && mediaItems().length > 0) {
              <div class="grid">
                @for (item of mediaItems(); track item.id) {
                  <div
                    [class]="'card ' + (isSelected(item) ? 'card--selected' : '')"
                    (click)="toggleSelect(item)"
                    (dblclick)="confirmItem(item)">

                    <div class="card-thumb">
                      @if (item.thumbUrl || item.imageUrl) {
                        <img [src]="item.thumbUrl || item.imageUrl" [alt]="item.name" (error)="onImgError($event)" />
                      } @else {
                        <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="color:#94a3b8">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      }
                    </div>

                    @if (isSelected(item)) {
                      <div class="card-check">
                        <svg width="14" height="14" fill="none" stroke="white" stroke-width="3" viewBox="0 0 24 24">
                          <path d="M5 13l4 4L19 7"/>
                        </svg>
                      </div>
                    }

                    <div class="card-name">{{ item.name }}</div>
                    <div class="card-size">{{ formatSize(item.size) }}</div>
                  </div>
                }
              </div>
            }

            @if (loadingMore()) {
              <div class="loading-more">
                <app-spinner size="sm" class="text-brand" /> Loading more…
              </div>
            }
          </div>
        </div>

        <!-- Right sidebar -->
        @if (selected().length > 1) {
          <!-- Multi-select summary -->
          <div class="sidebar">
            <div class="multi-summary">
              <div class="multi-summary-header">
                <svg width="20" height="20" fill="none" stroke="#10b981" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
                <strong>{{ selected().length }} files selected</strong>
              </div>
              <span class="multi-summary-size">Total size: {{ totalSelectedSize() }}</span>
              <button class="multi-summary-delete" (click)="selected.set([])">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Clear selection
              </button>
            </div>
          </div>
        } @else if (activeItem()) {
          <!-- Single item detail -->
          <div class="sidebar">
            <div class="sidebar-preview">
              @if (activeItem()!.isImage && activeItem()!.thumbUrl) {
                <img [src]="activeItem()!.imageUrl" [alt]="activeItem()!.name" />
              } @else {
                <div class="sidebar-file-icon">
                  <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="color:#94a3b8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
              }
            </div>
            <div class="sidebar-name">{{ activeItem()!.name }}</div>
            <div class="sidebar-info">
              <div class="info-row">
                <span class="info-label">Type</span>
                <span class="info-value">{{ getContentType(activeItem()!) }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Size</span>
                <span class="info-value">{{ formatSize(activeItem()!.size) }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Dimensions</span>
                <span class="info-value">{{ getDimensions(activeItem()!) }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Uploaded</span>
                <span class="info-value">{{ formatDate(activeItem()!.createdDate) }}</span>
              </div>
            </div>
            <button class="sidebar-delete-btn" (click)="selected.set([])">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Remove
            </button>
          </div>
        } @else {
          <div class="sidebar-empty">
            <span [innerHTML]="emptyIcon()"></span>
            <span>Select a file to see its details</span>
          </div>
        }
      </div>
    }

    <!-- Upload tab -->
    @if (activeTab() === 'upload') {
      <div class="body upload-body">
        <app-media-upload
          [config]="uploadConfig"
          [allowMultiple]="config.multiple ?? false"
          [showPreview]="true"
          [autoUpload]="config.autoUpload ?? true"
          [showProgress]="false"
          (uploadComplete)="onUploadComplete($event)"
          (uploadError)="onUploadError($event)" />
      </div>
    }

    <!-- Footer -->
    <div class="footer">
      <div class="footer-info">
        @if (selected().length > 0) {
          <span>{{ selected().length }} selected</span>
        } @else {
          <span class="hint">
            {{ config.multiple ? 'Select files to continue' : 'Click to preview, double-click to choose' }}
          </span>
        }
      </div>
      <div class="footer-actions">
        <button class="btn-cancel" (click)="ref.dismiss()">Cancel</button>
        <button
          class="btn-choose"
          [disabled]="selected().length === 0"
          (click)="confirm()">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7"/>
          </svg>
          {{ config.multiple ? 'Choose files' : 'Choose' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display:flex; flex-direction:column; height:100%; overflow:hidden; }

    .picker-toast {
      position: fixed; bottom: 24px; left: 24px; z-index: 99999;
      pointer-events: auto;
    }

    /* Tabs */
    .tabs {
      display:flex; background:var(--color-brand-600); padding:0 24px;
    }
    .tab {
      display:inline-flex; align-items:center; gap:8px;
      padding:12px 20px; font-size:14px; font-weight:500;
      color:rgba(255,255,255,.65); background:none; border:none;
      border-bottom:2px solid transparent; cursor:pointer;
      font-family:inherit; transition:.15s;
    }
    .tab:hover { color:rgba(255,255,255,.9); }
    .tab--active {
      color:#fff; border-bottom-color:#fff;
    }

    /* Library row — main + sidebar */
    .library-row { flex:1; min-height:0; display:flex; overflow:hidden; }

    /* Body */
    .body { flex:1; min-width:0; overflow-y:auto; padding:20px 24px; }
    .upload-body { flex:1; min-height:0; overflow-y:auto; padding:24px; }

    /* Sidebar — always visible, never collapses */
    .sidebar {
      width:260px; min-width:260px; flex-shrink:0;
      border-inline-start:1px solid #e2e8f0;
      background:#f8fafc; overflow-y:auto; padding:0;
    }

    /* When no item selected, show empty sidebar placeholder */
    .sidebar-empty {
      width:260px; min-width:260px; flex-shrink:0;
      border-inline-start:1px solid #e2e8f0;
      background:#f8fafc; display:flex; flex-direction:column;
      align-items:center; justify-content:center; gap:12px;
      color:#94a3b8; font-size:13px; padding:40px 20px; text-align:center;
    }
    .sidebar-preview {
      width:100%; aspect-ratio:1; background:#f1f5f9;
      display:flex; align-items:center; justify-content:center; overflow:hidden;
    }
    .sidebar-preview img { width:100%; height:100%; object-fit:contain; }
    .sidebar-file-icon {
      display:flex; align-items:center; justify-content:center;
      width:100%; height:100%;
    }
    .sidebar-name {
      padding:14px 16px 4px; font-size:13px; font-weight:600; color:#0f172a;
      word-break:break-all;
    }
    .sidebar-info { padding:8px 16px 16px; }
    .info-row {
      display:flex; justify-content:space-between; align-items:baseline;
      padding:6px 0; border-bottom:1px solid #f1f5f9; font-size:12px;
    }
    .info-row:last-child { border-bottom:none; }
    .info-label { color:#64748b; font-weight:500; }
    .info-value { color:#0f172a; text-align:end; }
    .sidebar-section { padding:0 16px 16px; }
    .sidebar-section-title {
      font-size:11px; font-weight:600; color:#64748b;
      text-transform:uppercase; letter-spacing:.5px; margin-bottom:8px;
    }
    /* Multi-select summary */
    .multi-summary {
      padding:24px 16px; display:flex; flex-direction:column; align-items:center;
      justify-content:center; height:100%; gap:8px; text-align:center;
    }
    .multi-summary-header {
      display:flex; align-items:center; gap:8px; font-size:15px; color:#0f172a;
    }
    .multi-summary-size { font-size:13px; color:#64748b; }
    .multi-summary-delete {
      margin-top:12px; display:inline-flex; align-items:center; gap:6px;
      padding:8px 16px; border:1px solid #fecaca; border-radius:8px;
      background:#fff; color:#dc2626; font-size:13px; font-weight:500;
      cursor:pointer; font-family:inherit; transition:.12s;
    }
    .multi-summary-delete:hover { background:#fef2f2; }

    /* ── Mobile (≤640px) ───────────────────────────────────────────────
       Stack main + sidebar vertically and collapse the "X files selected"
       summary into a compact horizontal bar pinned below the grid so it
       doesn't steal vertical space from the list.
    */
    @media (max-width: 640px) {
      .library-row { flex-direction: column; overflow: auto; }

      /* Main grid area takes all remaining height; sidebar flows below. */
      .body { overflow: visible; padding: 14px 16px; }

      .sidebar,
      .sidebar-empty {
        width: 100%;
        min-width: 0;
        flex-shrink: 0;
        border-inline-start: 0;
        border-top: 1px solid #e2e8f0;
        padding: 0;
      }
      .sidebar-empty { display: none; }

      /* Single-item detail: shrink the preview so it doesn't eat the viewport. */
      .sidebar-preview { aspect-ratio: auto; height: 160px; }
      .sidebar-name    { padding: 12px 16px 4px; }

      /* Multi-select summary → one-line bar with inline "Clear selection". */
      .multi-summary {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        height: auto;
        text-align: start;
      }
      .multi-summary-header { font-size: 14px; }
      .multi-summary-size {
        display: none; /* hide total-size on mobile — count is the useful bit */
      }
      .multi-summary-delete {
        margin-top: 0;
        padding: 6px 10px;
        font-size: 12px;
      }
    }

    /* Single item delete */
    .sidebar-delete-btn {
      display:flex; align-items:center; justify-content:center; gap:6px;
      margin:12px 16px; padding:8px; border:1px solid #fecaca; border-radius:8px;
      background:#fff; color:#dc2626; font-size:13px; font-weight:500;
      cursor:pointer; font-family:inherit; width:calc(100% - 32px); transition:.12s;
    }
    .sidebar-delete-btn:hover { background:#fef2f2; }

    /* Selected items list in sidebar (multi-select) */
    .sidebar-selected-list { border-bottom:1px solid #e2e8f0; }
    .sidebar-sel-item {
      display:flex; align-items:center; gap:10px; padding:8px 16px;
      cursor:pointer; transition:background .1s;
    }
    .sidebar-sel-item:hover { background:#f8fafc; }
    .sidebar-sel-item.active { background:var(--color-brand-50, #effbfd); }
    .sidebar-sel-thumb {
      width:36px; height:36px; border-radius:6px; overflow:hidden;
      flex-shrink:0; background:#f1f5f9;
      display:flex; align-items:center; justify-content:center;
    }
    .sidebar-sel-thumb img { width:100%; height:100%; object-fit:cover; }
    .sidebar-sel-info { flex:1; min-width:0; }
    .sidebar-sel-name {
      font-size:12px; font-weight:500; color:#0f172a;
      display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    }
    .sidebar-sel-size { font-size:11px; color:#94a3b8; }
    .sidebar-sel-remove {
      width:24px; height:24px; border:none; background:none; border-radius:4px;
      display:flex; align-items:center; justify-content:center;
      color:#94a3b8; cursor:pointer; flex-shrink:0;
    }
    .sidebar-sel-remove:hover { background:#fef2f2; color:#dc2626; }

    .link-badge {
      display:inline-block; padding:3px 10px; font-size:11px; font-weight:500;
      background:#e2e8f0; color:#334155; border-radius:100px; margin:0 4px 4px 0;
    }

    /* Search */
    .search-wrap { position:relative; margin-bottom:16px; }
    .search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#94a3b8; pointer-events:none; }
    .search-input {
      width:100%; height:42px; border:1px solid #e2e8f0; border-radius:8px;
      padding:0 14px 0 40px; font-size:14px; font-family:inherit;
      color:#0f172a; background:#fff; outline:none; box-sizing:border-box;
    }
    .search-input:focus { border-color:var(--color-brand-500); box-shadow:0 0 0 3px rgba(50,172,193,.12); }

    /* Grid */
    .grid-wrap { min-height:200px; }
    .grid {
      display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr));
      gap:12px;
    }
    .card {
      border:2px solid transparent; border-radius:10px; overflow:hidden;
      cursor:pointer; transition:all .15s; position:relative; background:#f8fafc;
    }
    .card:hover { border-color:#cbd5e1; }
    .card--selected { border-color:var(--color-brand-500) !important; background:var(--color-brand-50); }
    .card-thumb {
      aspect-ratio:1; display:flex; align-items:center; justify-content:center;
      overflow:hidden; background:#f1f5f9;
    }
    .card-thumb img { width:100%; height:100%; object-fit:cover; }
    .card-check {
      position:absolute; top:8px; right:8px; width:24px; height:24px;
      border-radius:50%; background:var(--color-brand-500);
      display:flex; align-items:center; justify-content:center;
    }
    .card-name {
      padding:8px 10px 2px; font-size:12px; font-weight:500; color:#0f172a;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    }
    .card-size { padding:0 10px 8px; font-size:11px; color:#94a3b8; }

    .loading-more {
      display:flex; align-items:center; justify-content:center; gap:8px;
      padding:16px; font-size:13px; color:#94a3b8;
    }
    .text-brand { color:var(--color-brand-500, #32acc1); }

    /* Loading + empty */
    .loading, .empty {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:12px; padding:60px 20px; color:#94a3b8; font-size:14px;
    }

    /* Footer */
    .footer {
      display:flex; align-items:center; justify-content:space-between;
      padding:14px 24px; border-top:1px solid #e2e8f0; flex-shrink:0;
      background:#f8fafc;
    }
    .footer-info { font-size:13px; color:#64748b; }
    .hint { font-size:13px; color:#94a3b8; }
    .footer-actions { display:flex; gap:10px; }
    .btn-cancel {
      height:38px; padding:0 20px; border-radius:8px; font-size:14px;
      font-weight:500; border:1px solid #e2e8f0; background:#fff;
      color:#334155; cursor:pointer; font-family:inherit;
    }
    .btn-cancel:hover { background:#f8fafc; }
    .btn-choose {
      height:38px; padding:0 20px; border-radius:8px; font-size:14px;
      font-weight:500; border:none; background:var(--color-brand-600);
      color:#fff; cursor:pointer; font-family:inherit;
      display:inline-flex; align-items:center; gap:8px;
    }
    .btn-choose:hover { background:var(--color-brand-700); }
    .btn-choose:disabled { opacity:.5; cursor:not-allowed; }
  `]
})
export class MediaPickerModalComponent implements OnInit {
  ref    = inject<ModalRef<Media | Media[] | null>>(MODAL_REF);
  config = inject<MediaPickerConfig>(MODAL_DATA) ?? {};

  private mediaService = inject(MediaService);
  private uploadToast  = inject(UploadToastService);

  activeTab    = signal<PickerTab>('library');
  mediaItems   = signal<Media[]>([]);
  selected     = signal<Media[]>([]);
  loading      = signal(false);
  loadingMore  = signal(false);
  searchQuery  = '';
  page         = 1;
  hasMore      = signal(true);

  /** Explicitly focused item (for multi-select sidebar clicks). */
  focusedItem = signal<Media | null>(null);

  /** The item shown in the sidebar detail panel. */
  activeItem = computed<Media | null>(() => this.focusedItem() ?? this.selected()[0] ?? null);

  /** Total size of all selected items, formatted. */
  totalSelectedSize = computed(() => {
    const total = this.selected().reduce((sum, m) => {
      const s = m.size as any;
      const bytes = (s && typeof s === 'object') ? (s.size || 0) : (typeof s === 'number' ? s : 0);
      return sum + bytes;
    }, 0);
    return this.mediaService.formatBytes(total);
  });

  uploadConfig: IMediaUploadConfig = {
    maxFileSize: MediaService.MAX_FILE_SIZE,
    compressionEnabled: true,
    compressionQuality: 0.8,
  };

  async ngOnInit(): Promise<void> {
    await this.loadMedia();

    // Pre-select items if IDs were provided
    const preIds = this.config.preSelectedIds;
    if (preIds && preIds.length > 0) {
      const idSet = new Set(preIds);
      const matches = this.mediaItems().filter(m => m.id && idSet.has(m.id));
      if (matches.length > 0) {
        this.selected.set(matches);
      }
    }
  }

  async loadMedia(reset = true): Promise<void> {
    if (reset) {
      this.page = 1;
      this.hasMore.set(true);
      this.loading.set(true);
    } else {
      this.loadingMore.set(true);
    }

    try {
      const contentType = this.config.contentTypes ?? [];
      const result = await this.mediaService.getMediaListPaged({
        page: this.page,
        limit: 30,
        searchTerm: this.searchQuery,
        contentType,
        includeCountByType: false,
        selectedIds: reset ? (this.config.preSelectedIds ?? []) : [],
      });

      if (reset) {
        this.mediaItems.set(result.list);
      } else {
        // Append, avoiding duplicates
        const existingIds = new Set(this.mediaItems().map(m => m.id));
        const newItems = result.list.filter(m => !existingIds.has(m.id));
        this.mediaItems.update(items => [...items, ...newItems]);
      }

      this.hasMore.set(this.page < result.pageCount);
    } catch (e) {
      console.error('Media picker load failed:', e);
    } finally {
      this.loading.set(false);
      this.loadingMore.set(false);
    }
  }

  onSearch(): void {
    this.loadMedia(true);
  }

  onGridScroll(event: Event): void {
    if (!this.hasMore() || this.loadingMore()) return;
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      this.page++;
      this.loadMedia(false);
    }
  }

  isSelected(item: Media): boolean {
    return this.selected().some(s => s.id === item.id);
  }

  /** Single click = select (show in sidebar). */
  toggleSelect(item: Media): void {
    const isMultiple = this.config.multiple ?? false;
    if (this.isSelected(item)) {
      this.selected.update(arr => arr.filter(s => s.id !== item.id));
    } else {
      if (isMultiple) {
        this.selected.update(arr => [...arr, item]);
      } else {
        this.selected.set([item]);
      }
    }
  }

  /** Double click = confirm and close (single-select only). */
  confirmItem(item: Media): void {
    if (this.config.multiple) return;
    this.ref.close(item);
  }

  onUploadComplete(uploaded: Media[]): void {
    // Toast progress is already handled by MediaUploadComponent.
    // Just switch to library tab and reload.
    // the file was uploaded and will appear in the refreshed list.
    this.activeTab.set('library');
    this.loadMedia().then(() => {
      // Try to auto-select the uploaded items in the refreshed list
      if (uploaded.length > 0) {
        const uploadedIds   = new Set(uploaded.filter(u => u.id).map(u => u.id));
        const uploadedNames = new Set(uploaded.filter(u => u.name).map(u => u.name));

        const freshMatches = this.mediaItems().filter(
          m => (m.id && uploadedIds.has(m.id)) || (m.name && uploadedNames.has(m.name)),
        );

        if (freshMatches.length > 0) {
          this.selected.set(this.config.multiple ? freshMatches : [freshMatches[0]]);
        } else {
          // Fallback: select the first (newest) item
          this.selected.set([this.mediaItems()[0]]);
        }
      } else {
        // No uploaded media info — select the first (newest) item
        if (this.mediaItems().length > 0) {
          this.selected.set([this.mediaItems()[0]]);
        }
      }
    });
  }

  confirm(): void {
    const sel = this.selected();
    if (sel.length === 0) return;
    this.ref.close(this.config.multiple ? sel : sel[0]);
  }

  onUploadError(error: string): void {
    this.uploadToast.add({
      id: `error-${Date.now()}`,
      name: 'Upload failed',
      size: '',
      status: 'failed',
      progress: 0,
      error,
    });
  }

  /** In multi-select mode, click a sidebar item to show its details. */
  setActiveItem(item: Media): void {
    this.focusedItem.set(item);
  }

  private sanitizer = inject(DomSanitizer);

  emptyIcon(): SafeHtml {
    const type = (this.config.contentTypes ?? [])[0] || 'image';
    const icons: Record<string, string> = {
      image: '<svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="color:#94a3b8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
      video: '<svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="color:#94a3b8"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
      audio: '<svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="color:#94a3b8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
      document: '<svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="color:#94a3b8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    };
    return this.sanitizer.bypassSecurityTrustHtml(icons[type] || icons['image']);
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  formatSize(size: any): string {
    let bytes = 0;
    if (size && typeof size === 'object') bytes = size.size || 0;
    else if (typeof size === 'number') bytes = size;
    return this.mediaService.formatBytes(bytes);
  }

  formatDate(d: any): string {
    if (!d) return '—';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  getContentType(item: Media): string {
    return item.contentType || item.mediaType?.fileType || 'file';
  }

  getDimensions(item: Media): string {
    const s = item.size as any;
    if (s?.width && s?.height) return `${s.width} × ${s.height}`;
    return '—';
  }
}
