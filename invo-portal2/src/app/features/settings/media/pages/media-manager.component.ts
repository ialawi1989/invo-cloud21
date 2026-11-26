import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { Component, signal, computed, ViewChild, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

import { Media } from '../models/media.model';
import { MediaGalleryComponent } from '../components/media-gallery';
import { MediaPreviewComponent, MediaEditResult } from '../components/media-preview';
import { DetachMediaComponent } from '../components/detach-media';
import { AttachMediaComponent } from '../components/attach-media';
import { UploadModalComponent } from '../components/upload-modal';
import { MediaService } from '../services/media.service';
import { ModalService } from '../../../../shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '../../../../shared/modal/demo/confirm-modal.component';
import { SearchDropdownComponent } from '../../../../shared/components/dropdown';
import { DatePickerComponent, formatDate } from '../../../../shared/components/datepicker';
import { PaginationComponent } from '../../../../shared/components/pagination';
import { BreadcrumbItem } from '../../../../shared/components/breadcrumbs';
import { SpinnerComponent, LoadingOverlayComponent } from '../../../../shared/components/spinner';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { UploadToastService } from '../../../../shared/components/upload-toast';
import { RangeSliderComponent, RangeSliderValue } from '../../../../shared/components/range-slider';
import { SegmentedToggleComponent, SegmentedToggleOption } from '../../../../shared/components/segmented-toggle/segmented-toggle.component';
import {
  QueryParamsService,
  ParamDef,
  IntCodec,
  intCodec,
  StringCodec,
  enumCodec,
  NumberCodec,
} from '../../../../shared/services/query-params.service';

import { TooltipDirective } from '@shared/directives/tooltip.directive';
type MediaTab = 'all' | 'images' | 'documents' | 'videos' | 'audio' | 'models';
type SortField = 'createdAt' | 'name' | 'size';
type SortDirection = 'ASC' | 'DESC';

/** The tabs shown. Documents is hidden for now (a `?tab=documents` link falls back to All). */
const MEDIA_TABS = ['all', 'images', 'videos', 'audio', 'models'] as const;
const SORT_FIELDS = ['createdAt', 'name', 'size'] as const;
const SORT_DIRS = ['ASC', 'DESC'] as const;
const VIEW_MODES = ['grid', 'list'] as const;

/** URL query-param definitions for the media manager. */
const QP = {
  tab:       { key: 'tab',       codec: enumCodec(MEDIA_TABS, 'all') }         as ParamDef<MediaTab>,
  page:      { key: 'page',      codec: IntCodec }                             as ParamDef<number>,
  pageSize:  { key: 'limit',     codec: intCodec(15) }                          as ParamDef<number>,
  search:    { key: 'q',         codec: StringCodec }                          as ParamDef<string>,
  sortField: { key: 'sort',      codec: enumCodec(SORT_FIELDS, 'createdAt') }  as ParamDef<SortField>,
  sortDir:   { key: 'dir',       codec: enumCodec(SORT_DIRS, 'DESC') }         as ParamDef<SortDirection>,
  view:      { key: 'view',      codec: enumCodec(VIEW_MODES, 'grid') }        as ParamDef<'grid' | 'list'>,
  dateFrom:  { key: 'from',      codec: StringCodec }                          as ParamDef<string>,
  dateTo:    { key: 'to',        codec: StringCodec }                          as ParamDef<string>,
  minSize:   { key: 'minSize',   codec: NumberCodec }                          as ParamDef<number | null>,
  maxSize:   { key: 'maxSize',   codec: NumberCodec }                          as ParamDef<number | null>,
};

interface MediaFilters {
  dateFrom: string | null;
  dateTo: string | null;
  minSizeKb: number | null;
  maxSizeKb: number | null;
}

const TAB_TO_CONTENT_TYPE: Record<MediaTab, string[]> = {
  // Documents are hidden, so "All" asks for the other types only (an empty list would include them).
  all:        ['image', 'video', 'audio', 'model'],
  images:     ['image'],
  documents:  ['document', 'docs'], // backend may store either
  videos:     ['video'],
  audio:      ['audio'],
  models:     ['model'],
};

/** Static metadata for each filter tab — label + SVG inner markup.
 *  Kept module-scoped so the array identity is stable across renders
 *  (the segmented-toggle's `track opt.value` keys off the array). */
const TAB_META: Record<MediaTab, { label: string; icon: string }> = {
  all:       { label: 'All Media',
    icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>' },
  images:    { label: 'Images',
    icon: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>' },
  documents: { label: 'Documents',
    icon: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>' },
  videos:    { label: 'Videos',
    icon: '<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>' },
  audio:     { label: 'Audio',
    icon: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
  models:    { label: '3D Models',
    icon: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>' },
};

@Component({
  selector: 'app-media-manager',
  standalone: true,
  imports: [PageHeaderComponent, TooltipDirective, 
    CommonModule,
    FormsModule,
    MediaGalleryComponent,
    DetachMediaComponent,
    AttachMediaComponent,
    SearchDropdownComponent,
    DatePickerComponent,
    PaginationComponent,
    SpinnerComponent,
    SkeletonComponent,
    LoadingOverlayComponent,
    RangeSliderComponent,
    SegmentedToggleComponent,
  ],
  templateUrl: './media-manager.component.html',
  styleUrls: ['./media-manager.component.scss']
})
export class MediaManagerComponent implements OnInit, OnDestroy {
  private mediaService = inject(MediaService);
  private modalService = inject(ModalService);
  private qp           = inject(QueryParamsService);
  private uploadToast  = inject(UploadToastService);

  @ViewChild(MediaGalleryComponent) gallery!: MediaGalleryComponent;

  // ── Breadcrumb trail ────────────────────────────────────────────────────────
  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home',     routerLink: '/',                icon: 'home', iconOnly: true },
    { label: 'Settings', routerLink: '/settings' },
    { label: 'Media',    routerLink: '/settings/media' },
    { label: 'Library' },  // current page (no link → marked aria-current)
  ];

  // ── UI state ────────────────────────────────────────────────────────────────
  currentTab    = signal<MediaTab>('all');
  viewMode      = signal<'grid' | 'list'>('grid');
  searchQuery   = signal<string>('');
  selectedItems = signal<string[]>([]);
  showUpload    = signal<boolean>(false);
  showFilters   = signal<boolean>(false);
  loading       = signal<boolean>(false);
  deleting      = signal<boolean>(false);
  detaching     = signal<boolean>(false);
  /** Placeholder cards shown while the first page of media loads. */
  readonly skeletonTiles = Array.from({ length: 8 }, (_, i) => i);
  savingEdit    = signal<boolean>(false);

  // ── Pagination state ────────────────────────────────────────────────────────
  page       = signal<number>(1);
  pageSize   = signal<number>(15);
  count      = signal<number>(0);
  pageCount  = signal<number>(0);
  startIndex = signal<number>(0);
  lastIndex  = signal<number>(0);

  // ── Sort state ──────────────────────────────────────────────────────────────
  sortField     = signal<SortField>('createdAt');
  sortDirection = signal<SortDirection>('DESC');

  // Sort dropdown options (for SearchDropdown)
  readonly sortOptions: Array<{ value: SortField; label: string }> = [
    { value: 'createdAt', label: 'Date' },
    { value: 'name',      label: 'Name' },
    { value: 'size',      label: 'Size' },
  ];
  sortOptionLabel = (o: { value: SortField; label: string }) => o.label;
  sortOptionEq    = (a: { value: SortField }, b: { value: SortField }) => a.value === b.value;
  selectedSortOption = computed(() => this.sortOptions.find(o => o.value === this.sortField()) ?? null);

  onSortOptionChange(option: { value: SortField; label: string } | null): void {
    if (!option) return;
    if (this.sortField() !== option.value) {
      this.sortField.set(option.value);
      this.sortDirection.set('DESC');
      this.page.set(1);
      this.syncUrl();
      this.loadMedia();
    }
  }

  // ── Date filter <-> DatePicker bridge ───────────────────────────────────────
  // Filter state stores ISO strings ('yyyy-MM-dd'), the picker speaks Date.

  dateFromValue = computed<Date | null>(() => {
    const s = this.filters().dateFrom;
    return s ? new Date(s) : null;
  });

  dateToValue = computed<Date | null>(() => {
    const s = this.filters().dateTo;
    return s ? new Date(s) : null;
  });

  onDateFromChange(d: Date | null): void {
    this.updateFilter('dateFrom', d ? formatDate(d, 'yyyy-MM-dd') : null);
  }

  onDateToChange(d: Date | null): void {
    this.updateFilter('dateTo', d ? formatDate(d, 'yyyy-MM-dd') : null);
  }

  // ── Size range slider ──────────────────────────────────────────────────────
  /** Max ceiling for the slider in KB (5 MB). Adjust as needed. */
  readonly sizeCeilingKb = 5120;

  sizeRange = signal<RangeSliderValue>({ min: 0, max: 5120 });

  onSizeRangeChange(v: RangeSliderValue | number): void {
    if (typeof v === 'number') return;
    this.sizeRange.set(v);
    const isFullRange = v.min === 0 && v.max === this.sizeCeilingKb;
    this.updateFilter('minSizeKb', isFullRange ? null : v.min);
    this.updateFilter('maxSizeKb', isFullRange ? null : v.max);
  }

  // ── Advanced filters ────────────────────────────────────────────────────────
  filters = signal<MediaFilters>({
    dateFrom: null,
    dateTo: null,
    minSizeKb: null,
    maxSizeKb: null,
  });

  // ── Data ────────────────────────────────────────────────────────────────────
  mediaData    = signal<Media[]>([]);
  countByType  = signal<Record<string, number>>({});

  // Total across the visible tabs (documents are not counted)
  totalCount = computed(() => {
    const counts = this.countByType();
    return TAB_TO_CONTENT_TYPE.all.reduce((sum, t) => sum + (counts[t] || 0), 0);
  });

  // Per-tab counts for badges
  tabCount = (tab: MediaTab): number => {
    if (tab === 'all') return this.totalCount();
    const counts = this.countByType();
    const types = TAB_TO_CONTENT_TYPE[tab];
    return types.reduce((sum, t) => sum + (counts[t] || 0), 0);
  };

  /** Options for `<app-segmented-toggle>` rebuilt whenever the
   *  per-type counts change. `translate: false` because labels are
   *  free-form English (already user-facing strings, not i18n keys
   *  — Media Manager isn't translated yet). */
  tabOptions = computed<SegmentedToggleOption<MediaTab>[]>(() =>
    MEDIA_TABS.map(tab => ({
      value:     tab,
      label:     TAB_META[tab].label,
      translate: false,
      icon:      TAB_META[tab].icon,
      count:     this.tabCount(tab),
    })),
  );


  // ── Search debouncing ───────────────────────────────────────────────────────
  private searchInput$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // ── Restore state from URL query params ──────────────────────────────────
    const p = this.qp.read(QP);
    this.currentTab.set(p.tab);
    this.page.set(p.page);
    this.pageSize.set(p.pageSize);
    this.searchQuery.set(p.search);
    this.sortField.set(p.sortField);
    this.sortDirection.set(p.sortDir);
    this.viewMode.set(p.view);

    if (p.dateFrom || p.dateTo || p.minSize != null || p.maxSize != null) {
      this.filters.set({
        dateFrom: p.dateFrom || null,
        dateTo: p.dateTo || null,
        minSizeKb: p.minSize,
        maxSizeKb: p.maxSize,
      });
      if (p.minSize != null || p.maxSize != null) {
        this.sizeRange.set({
          min: p.minSize ?? 0,
          max: p.maxSize ?? this.sizeCeilingKb,
        });
      }
      this.showFilters.set(true);
    }

    // ── Search debounce ──────────────────────────────────────────────────────
    this.searchInput$
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe(query => {
        this.searchQuery.set(query);
        this.page.set(1);
        this.syncUrl();
        this.loadMedia({ refreshCounts: true });
      });

    this.loadMedia({ refreshCounts: true });
  }

  // ── Sync current state → URL query params ──────────────────────────────────
  private syncUrl(): void {
    const f = this.filters();
    this.qp.write(QP, {
      tab:       this.currentTab(),
      page:      this.page(),
      pageSize:  this.pageSize(),
      search:    this.searchQuery(),
      sortField: this.sortField(),
      sortDir:   this.sortDirection(),
      view:      this.viewMode(),
      dateFrom:  f.dateFrom ?? '',
      dateTo:    f.dateTo ?? '',
      minSize:   f.minSizeKb,
      maxSize:   f.maxSizeKb,
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchInput$.complete();
  }

  // ── Data loading ────────────────────────────────────────────────────────────

  async loadMedia(opts: { refreshCounts?: boolean } = {}): Promise<void> {
    this.loading.set(true);
    try {
      const tab = this.currentTab();
      const contentType = TAB_TO_CONTENT_TYPE[tab];
      const f = this.filters();

      const result = await this.mediaService.getMediaListPaged({
        page: this.page(),
        limit: this.pageSize(),
        searchTerm: this.searchQuery(),
        contentType,
        sortBy: {
          sortValue: this.sortField(),
          sortDirection: this.sortDirection(),
        },
        includeCountByType: !!opts.refreshCounts,
        // Optional advanced filters — backend may ignore unknown keys
        dateFrom: f.dateFrom,
        dateTo: f.dateTo,
        minSize: f.minSizeKb != null ? f.minSizeKb * 1024 : null,
        maxSize: f.maxSizeKb != null ? f.maxSizeKb * 1024 : null,
      });

      this.mediaData.set(result.list);
      this.count.set(result.count);
      this.pageCount.set(result.pageCount);
      this.startIndex.set(result.startIndex);
      this.lastIndex.set(result.lastIndex);

      if (result.countByType) {
        this.countByType.set(result.countByType);
      }
    } catch (error) {
      console.error('Error loading media:', error);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Refresh ─────────────────────────────────────────────────────────────────

  /**
   * Re-fetch the current page with the same filters / sort / search.
   * Also refreshes `countByType` so the tab badges stay accurate.
   */
  refresh(): void {
    this.loadMedia({ refreshCounts: true });
  }

  // ── Tabs ────────────────────────────────────────────────────────────────────

  setTab(tab: MediaTab): void {
    if (this.currentTab() === tab) return;
    this.currentTab.set(tab);
    this.page.set(1);
    this.selectedItems.set([]);
    this.syncUrl();
    this.loadMedia();
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchInput$.next(value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchInput$.next('');
    this.syncUrl();
  }

  // ── Sort ────────────────────────────────────────────────────────────────────

  setSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'ASC' ? 'DESC' : 'ASC');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('DESC');
    }
    this.page.set(1);
    this.syncUrl();
    this.loadMedia();
  }

  // ── Filters ─────────────────────────────────────────────────────────────────

  toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  updateFilter<K extends keyof MediaFilters>(key: K, value: MediaFilters[K]): void {
    this.filters.update(f => ({ ...f, [key]: value }));
  }

  applyFilters(): void {
    this.page.set(1);
    this.syncUrl();
    this.loadMedia();
  }

  clearFilters(): void {
    this.filters.set({ dateFrom: null, dateTo: null, minSizeKb: null, maxSizeKb: null });
    this.sizeRange.set({ min: 0, max: this.sizeCeilingKb });
    this.page.set(1);
    this.syncUrl();
    this.loadMedia();
  }

  hasActiveFilters = computed(() => {
    const f = this.filters();
    return f.dateFrom !== null || f.dateTo !== null || f.minSizeKb !== null || f.maxSizeKb !== null;
  });

  // ── Pagination ──────────────────────────────────────────────────────────────

  goToPage(p: number): void {
    if (p < 1 || p > this.pageCount() || p === this.page()) return;
    this.page.set(p);
    this.syncUrl();
    this.loadMedia();
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.syncUrl();
    this.loadMedia();
  }

  // ── View mode ───────────────────────────────────────────────────────────────

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode.set(mode);
    this.syncUrl();
  }

  // ── Selection ───────────────────────────────────────────────────────────────

  onMediaSelected(selectedIds: string[]): void {
    this.selectedItems.set(selectedIds);
  }

  clearSelection(): void {
    this.selectedItems.set([]);
  }

  // ── Bulk actions ────────────────────────────────────────────────────────────

  async downloadSelected(): Promise<void> {
    const ids = new Set(this.selectedItems());
    const items = this.mediaData().filter(m => m.id && ids.has(m.id));
    for (const media of items) {
      if (media.isImage && media.imageUrl) {
        this.mediaService.downloadImage(media.imageUrl, media.name);
      } else {
        this.mediaService.downloadPDF(media);
      }
    }
  }

  async deleteSelected(): Promise<void> {
    const ids = this.selectedItems();
    if (ids.length === 0) return;

    const ref = this.modalService.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title: ids.length === 1 ? 'Delete media' : `Delete ${ids.length} items`,
          message: ids.length === 1
            ? 'Are you sure you want to delete this item? This cannot be undone.'
            : `Are you sure you want to delete these ${ids.length} items? This cannot be undone.`,
          confirm: 'Delete',
          danger: true,
        },
      }
    );

    const confirmed = await ref.afterClosed();
    if (!confirmed) return;

    this.deleting.set(true);
    try {
      // Send each file's type too (the server needs it to remove the stored file).
      const byId = new Map(this.mediaData().map((m) => [m.id, m]));
      await this.mediaService.deleteMultipleMedia(ids.map((id) => ({ id, mediaType: byId.get(id)?.mediaType ?? null })));
      this.selectedItems.set([]);
      await this.loadMedia({ refreshCounts: true });
    } catch (error) {
      console.error('Bulk delete failed:', error);
    } finally {
      this.deleting.set(false);
    }
  }

  // ── Upload ──────────────────────────────────────────────────────────────────

  async openUploadPanel(): Promise<void> {
    const ref = this.modalService.open<UploadModalComponent, any, Media[]>(
      UploadModalComponent,
      { size: 'lg' },
    );

    const result = await ref.afterClosed();
    if (result && result.length > 0) {
      await this.loadMedia({ refreshCounts: true });
    }
  }

  // ── Preview ─────────────────────────────────────────────────────────────────

  async onMediaEdit(media: Media): Promise<void> {
    const ref = this.modalService.open<MediaPreviewComponent, unknown, MediaEditResult | undefined>(
      MediaPreviewComponent,
      {
        size: 'xl',
        closeable: false,
        data: {
          media,
          mediaList: this.mediaData(),
          title: media.name,
        },
      },
    );

    // The preview closes and returns the edited image as a File when the user
    // saves an edit. Upload it here (with a page-level spinner) so the modal is
    // gone by the time we're crunching the upload, then refresh the library.
    const edit = await ref.afterClosed();
    if (!edit) return;

    this.savingEdit.set(true);
    try {
      // `uploadFile` reports a server-side rejection as `{ success: false }` rather than throwing, so check it.
      const result = await this.mediaService.uploadFile(edit.file);
      if (result.success === false) throw new Error(result.error || result.message || 'Upload failed');
      const savedId = result.data?.[0]?.id;

      if (edit.mode === 'replace' && savedId && edit.original.id) {
        // Replace: the new image takes the original's place on everything that used it; the original is then deleted or kept (old version).
        try {
          await this.mediaService.replaceMedia(edit.original.id, savedId, edit.deleteOriginal);
        } catch (e: any) {
          this.uploadToast.add({ id: `error-${Date.now()}`, name: 'Replace failed', size: '', status: 'failed', progress: 0,
            error: `The edited image was saved as a new image, but could not replace the original. ${e?.error?.msg ?? e?.message ?? ''}`.trim() });
        }
        await this.loadMedia({ refreshCounts: true });
        return;
      }

      await this.loadMedia({ refreshCounts: true });
      // Saved as a new media item: offer to put it on the entities that used the original.
      const used = (media.uploadTo as any[] | undefined)?.filter(e => e && e.id && e.reference) ?? [];
      if (savedId && used.length && result.data?.[0]) this.attachTarget.set({ media: new Media({ ...result.data[0] }), entities: used });
    } catch (err: any) {
      console.error('Failed to upload edited image:', err);
      this.uploadToast.add({
        id: `error-${Date.now()}`,
        name: 'Edit failed',
        size: '',
        status: 'failed',
        progress: 0,
        error: err?.message ?? 'Upload failed',
      });
    } finally {
      this.savingEdit.set(false);
    }
  }

  // ── Attach (the inverse of Detach) ──────────────────────────────────────────
  /** The saved image and the entities offered to attach it to; null when the dialog is closed. */
  attachTarget = signal<{ media: Media; entities: Array<{ id: string; name: string; reference: string }> } | null>(null);
  attaching = signal<boolean>(false);

  closeAttachModal(): void { this.attachTarget.set(null); }

  async onAttachConfirmed(chosen: Array<{ id: string; reference: string }>): Promise<void> {
    const t = this.attachTarget();
    if (!t || chosen.length === 0) { this.closeAttachModal(); return; }
    this.attaching.set(true);
    try {
      const result = await this.mediaService.linkMedia(chosen.map(e => ({ id: e.id, reference: e.reference, mediaId: t.media.id as string })));
      if (result?.success === false) throw new Error(result.error?.error?.message || result.message || 'Could not attach the image');
      this.closeAttachModal();
      await this.loadMedia({ refreshCounts: true });
    } catch (err: any) {
      console.error('Attach error:', err);
      this.uploadToast.add({ id: `error-${Date.now()}`, name: 'Attach failed', size: '', status: 'failed', progress: 0, error: err?.message ?? 'Could not attach the image' });
    } finally {
      this.attaching.set(false);
    }
  }

  // ── Detach ──────────────────────────────────────────────────────────────────
  // The DetachMediaComponent is a self-contained modal (renders its own
  // backdrop), so we control its visibility via a signal-bound `@if` block in
  // the template. `detachTarget` holds the Media being detached, or null when
  // the modal is closed.

  detachTarget = signal<Media | null>(null);

  openDetachModal(media: Media): void {
    this.detachTarget.set(media);
  }

  closeDetachModal(): void {
    this.detachTarget.set(null);
  }

  async onDetachConfirmed(entities: Array<{ id: string; reference: string }>): Promise<void> {
    const media = this.detachTarget();
    if (!media || entities.length === 0) {
      this.closeDetachModal();
      return;
    }

    // `media/unLinkMedia` (`MediaRepo.unlinkMedia`) reads `id` and `reference` of each item; `mediaId` / `referenceId` are kept for clarity.
    const payload = entities.map(e => ({
      id: e.id,
      reference: e.reference,
      mediaId: media.id,
      referenceId: e.id,
    }));

    this.detaching.set(true);
    try {
      const result = await this.mediaService.unLinkMedia(payload);
      if (result?.success !== false) {
        this.closeDetachModal();
        await this.loadMedia({ refreshCounts: true });
      } else {
        console.error('Detach failed:', result);
      }
    } catch (error) {
      console.error('Detach error:', error);
    } finally {
      this.detaching.set(false);
    }
  }

  // ── Utility ─────────────────────────────────────────────────────────────────

  formatBytes(bytes: number): string {
    return this.mediaService.formatBytes(bytes);
  }
}
