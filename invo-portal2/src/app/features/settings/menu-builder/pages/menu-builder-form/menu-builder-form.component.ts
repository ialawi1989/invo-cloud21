import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormSkeletonComponent } from '@shared/components/skeleton/form-skeleton.component';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { BranchSettingsService, BranchSummary } from '../../../services/branch-settings.service';
import { MenuBuilderService } from '../../services/menu-builder.service';
import type { MenuSectionColor, MenuSectionProduct } from '../../services/menu-builder.types';
import { MenuBuilderStore, idOf } from '../../store/menu-builder.store';
import { firstInvalidKey } from '../../utils/menu-form-validation';
import { MenuDetailsCardComponent, MenuDetailsPatch } from '../../components/menu-details-card/menu-details-card.component';
import { SectionListComponent, SectionAction, SectionRow } from '../../components/section-list/section-list.component';
import { SectionEditorComponent } from '../../components/section-editor/section-editor.component';
import { StickySaveBarComponent } from '../../components/sticky-save-bar/sticky-save-bar.component';
import type { DraggedProduct, Direction } from '../../components/product-grid/product-grid.component';
import { PickProductModalComponent, PickProductModalData, PickedProduct } from './components/pick-product-modal/pick-product-modal.component';
import { ColorPickerModalComponent, ColorPickerModalData } from './components/color-picker-modal/color-picker-modal.component';
import {
  ManageSectionProductsModalComponent,
  ManageSectionProductsData,
  ManageSectionProductsResult,
} from './components/manage-section-products-modal/manage-section-products-modal.component';

/**
 * Menu Builder edit page: the container. It owns the data loading, the dialogs, the toasts and the announcements;
 * every edit goes through {@link MenuBuilderStore}, and the presentational components below only show what they are given.
 *
 *   header (breadcrumb, name, status) / details card / [ section list | section editor ] / sticky save bar
 */
@Component({
  selector: 'app-menu-builder-form',
  standalone: true,
  imports: [PageHeaderComponent, 
    RouterModule, TranslateModule, LoadingOverlayComponent, FormSkeletonComponent,
    MenuDetailsCardComponent, SectionListComponent, SectionEditorComponent, StickySaveBarComponent,
  ],
  providers: [MenuBuilderStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-builder-form.component.html',
  styleUrl: './menu-builder-form.component.scss',
})
export class MenuBuilderFormComponent implements OnInit, CanLeaveComponent {
  readonly store = inject(MenuBuilderStore);
  private service    = inject(MenuBuilderService);
  private branchSvc  = inject(BranchSettingsService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  private toast      = inject(ToastService);
  private modal      = inject(ModalService);
  private announcer  = inject(LiveAnnouncer);

  branches    = signal<BranchSummary[]>([]);
  priceLabels = signal<Array<{ id: string; name: string }>>([]);
  results     = signal<DraggedProduct[]>([]);
  searching   = signal(false);
  /** Inline message under the grid ("... is already on this page"). */
  notice      = signal<string | null>(null);
  renameRequest = signal(0);

  private i18nTick = signal(0);
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('MENU_BUILDER.TITLE'), routerLink: '/settings/menu-builder' },
      { label: this.store.menu().name || this.translate.instant('MENU_BUILDER.NEW_MENU') },
    ];
  });

  sectionRows = computed<SectionRow[]>(() =>
    this.store.sections().map((s) => ({
      id: idOf(s), name: s.name, colorStart: s.color.colorStart, colorEnd: s.color.colorEnd, productsCount: s.products.length,
    })));

  /** Section-name errors keyed by section id, for the list. */
  sectionErrors = computed<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.store.errors())) if (k.startsWith('section:')) out[k.slice(8)] = v;
    return out;
  });
  selectedNameError = computed(() => {
    const id = this.store.selectedSectionId();
    return id ? this.sectionErrors()[id] ?? null : null;
  });

  constructor() {
    withTranslations('settings/menu-builder');
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update((n) => n + 1));
    this.destroyRef.onDestroy(() => { if (this.noticeTimer) clearTimeout(this.noticeTimer); });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    const [branchesPage, labels] = await Promise.all([
      this.branchSvc.getList({ page: 1, limit: 200 }),
      this.service.getPriceLabels(),
      this.store.load(id && id !== 'new' ? id : null),
    ]);
    this.branches.set(branchesPage.list);
    this.priceLabels.set(labels);
  }

  // ── Leaving with unsaved changes ──
  hasUnsavedChanges(): boolean { return this.store.isDirty() && !this.store.saving(); }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) { e.preventDefault(); e.returnValue = ''; }
  }

  async cancel(): Promise<void> {
    // The route's canDeactivate guard asks "leave without saving?" when there are edits: one prompt, not two.
    await this.router.navigate(['/settings/menu-builder']);
  }

  // ── Menu details ──
  onDetails(p: MenuDetailsPatch): void { this.store.patch(p.key, p.value as never); }

  // ── Sections ──
  addSection(): void {
    this.store.addSection(this.t('MENU_BUILDER.NEW_SECTION_DEFAULT'));
    this.renameRequest.update((n) => n + 1);
    this.announce('MENU_BUILDER.A11Y.SECTION_ADDED', { name: this.t('MENU_BUILDER.NEW_SECTION_DEFAULT') });
  }

  onSectionReorder(e: { from: number; to: number }): void {
    const s = this.store.sections()[e.from];
    this.store.moveSection(e.from, e.to);
    if (s) this.announce('MENU_BUILDER.A11Y.SECTION_MOVED', { name: s.name, n: e.to + 1, total: this.store.sections().length });
  }

  async onSectionAction(e: { id: string; action: SectionAction }): Promise<void> {
    const s = this.store.sections().find((x) => idOf(x) === e.id);
    if (!s) return;
    switch (e.action) {
      case 'rename':
        this.store.select(e.id);
        this.renameRequest.update((n) => n + 1);
        break;
      case 'color': {
        const picked = await this.pickColor(s.color);
        if (picked) this.store.setSectionColor(e.id, picked);
        break;
      }
      case 'duplicate': {
        const id = this.store.duplicateSection(e.id);
        if (id) this.announce('MENU_BUILDER.A11Y.SECTION_DUPLICATED', { name: s.name });
        break;
      }
      case 'delete':
        await this.deleteSection(e.id);
        break;
    }
  }

  /** A section with products asks first; an empty one is removed straight away, with Undo. */
  async deleteSection(id: string): Promise<void> {
    const s = this.store.sections().find((x) => idOf(x) === id);
    if (!s) return;
    if (s.products.length > 0) {
      const ok = await this.confirm({
        title: this.t('COMMON.DELETE'),
        message: this.translate.instant('MENU_BUILDER.SECTION.CONFIRM_DELETE', { name: s.name || '—', n: s.products.length }),
        confirm: this.t('COMMON.DELETE'),
        danger: true,
      });
      if (!ok) return;
    }
    const removed = this.store.deleteSection(id);
    if (!removed) return;
    this.announce('MENU_BUILDER.A11Y.SECTION_DELETED', { name: s.name });
    if (s.products.length === 0) {
      this.toast.info(this.translate.instant('MENU_BUILDER.SECTION.DELETED', { name: s.name || '—' }), undefined, 6000, {
        label: 'MENU_BUILDER.UNDO',
        run: () => this.store.restoreSection(removed.section, removed.index),
      });
    }
  }

  // ── Section editor ──
  onRename(name: string): void {
    const id = this.store.selectedSectionId();
    if (id) this.store.renameSection(id, name);
  }

  async onProductColors(): Promise<void> {
    const s = this.store.selectedSection();
    if (!s) return;
    const ref = this.modal.open<ManageSectionProductsModalComponent, ManageSectionProductsData, ManageSectionProductsResult>(
      ManageSectionProductsModalComponent, { size: 'md', data: { section: s } });
    const edits = await ref.afterClosed();
    if (edits?.length) this.store.setProductColors(edits);
  }

  async onRemovePage(page: number): Promise<void> {
    const ok = await this.confirm({
      title: this.t('MENU_BUILDER.REMOVE_PAGE'),
      message: this.translate.instant('MENU_BUILDER.CONFIRM_REMOVE_PAGE', { n: page }),
      confirm: this.t('COMMON.DELETE'),
      danger: true,
    });
    if (ok) this.store.removePage(page);
  }

  // ── Product search (debounced by the search component) ──
  async onQuery(term: string): Promise<void> {
    this.searching.set(true);
    try {
      const res = await this.service.listMenuProducts({ page: 1, limit: 20, searchTerm: term });
      this.results.set(res.list.map((p) => ({ id: p.id, name: p.name, defaultImage: p.defaultImage, color: p.color, price: p.price })));
    } catch {
      this.results.set([]);
    } finally {
      this.searching.set(false);
    }
  }

  /** Enter on a search result: into the first empty slot. */
  onPickResult(p: DraggedProduct): void { this.place(p); }

  /** A result dropped on a cell. */
  onProductDrop(e: { product: DraggedProduct; x: number; y: number }): void { this.place(e.product, { x: e.x, y: e.y }); }

  private place(p: DraggedProduct, at?: { x: number; y: number }): void {
    const r = this.store.placeProduct(p, at);
    if (r.ok) {
      this.setNotice(null);
      this.announce('MENU_BUILDER.A11Y.PRODUCT_ADDED', { name: p.name, slot: r.tile.y * 6 + r.tile.x + 1 });
      return;
    }
    const key = r.reason === 'duplicate' ? 'MENU_BUILDER.GRID.DUPLICATE' : r.reason === 'full' ? 'MENU_BUILDER.GRID.FULL' : 'MENU_BUILDER.GRID.OCCUPIED';
    const msg = this.translate.instant(key, { name: p.name });
    this.setNotice(msg);
    this.announce(key, { name: p.name });
  }

  /** The empty "+" cell: the picker (several products at once, existing flow). */
  async onPickAt(at: { x: number; y: number }): Promise<void> {
    const s = this.store.selectedSection();
    if (!s) return;
    const onPage = s.products.filter((p) => p.page === this.store.selectedPage());
    const maxPick = Math.max(0, 36 - onPage.reduce((n, p) => n + p.cols * p.rows, 0));
    const ref = this.modal.open<PickProductModalComponent, PickProductModalData, PickedProduct[]>(PickProductModalComponent, {
      size: 'lg',
      // Already on this page: hidden, so the same product cannot be picked twice.
      data: { excludeIds: new Set(onPage.map((p) => p.productId)), maxPick },
    });
    const picked = await ref.afterClosed();
    if (!picked?.length) return;
    const { placed, skipped } = this.store.placeMany(picked.map((p) => ({ id: p.id, name: p.name, defaultImage: p.defaultImage, color: p.color })), at);
    this.announce('MENU_BUILDER.A11Y.PRODUCTS_ADDED', { n: placed });
    this.setNotice(skipped > 0 ? this.translate.instant('MENU_BUILDER.GRID.SOME_SKIPPED', { n: skipped }) : null);
  }

  onTileMove(e: { key: string; to: { x: number; y: number } }): void {
    const name = this.store.pageProducts().find((p) => this.keyOf(p) === e.key)?.productName ?? '';
    const r = this.store.moveProduct(e.key, e.to);
    if (r.kind === 'blocked') { this.setNotice(this.t('MENU_BUILDER.GRID.CANT_MOVE')); return; }
    this.setNotice(null);
    this.announce(r.kind === 'swapped' ? 'MENU_BUILDER.A11Y.PRODUCT_SWAPPED' : 'MENU_BUILDER.A11Y.PRODUCT_MOVED', { name, slot: e.to.y * 6 + e.to.x + 1 });
  }

  onTileStep(e: { key: string; dir: Direction }): void {
    const t = this.store.pageProducts().find((p) => this.keyOf(p) === e.key);
    const r = this.store.stepProduct(e.key, e.dir);
    if (r.kind === 'blocked') { this.setNotice(this.t('MENU_BUILDER.GRID.CANT_MOVE')); return; }
    this.setNotice(null);
    const moved = this.store.pageProducts().find((p) => this.keyOf(p) === e.key);
    this.announce('MENU_BUILDER.A11Y.PRODUCT_MOVED', { name: t?.productName ?? '', slot: moved ? moved.y * 6 + moved.x + 1 : 0 });
  }

  onTileResize(e: { key: string; cols: number; rows: number }): void { this.store.resizeProduct(e.key, e.cols, e.rows); }

  onTileRemove(p: MenuSectionProduct): void {
    const removed = this.store.removeProduct(this.keyOf(p));
    if (!removed) return;
    this.announce('MENU_BUILDER.A11Y.PRODUCT_REMOVED', { name: removed.productName, slot: removed.y * 6 + removed.x + 1 });
    this.toast.info(this.translate.instant('MENU_BUILDER.GRID.REMOVED', { name: removed.productName }), undefined, 6000, {
      label: 'MENU_BUILDER.UNDO',
      run: () => { if (!this.store.restoreProduct(removed)) this.setNotice(this.t('MENU_BUILDER.GRID.FULL')); },
    });
  }

  async onTileColor(p: MenuSectionProduct): Promise<void> {
    const c = p.color || '#2691a4';
    const picked = await this.pickColor({ colorName: 'Custom', borderColor: c, colorStart: c, colorEnd: c });
    if (picked) this.store.setProductColor(this.keyOf(p), picked.borderColor);
  }

  // ── Save ──
  async save(): Promise<void> {
    const outcome = await this.store.save();
    switch (outcome) {
      case 'saved': {
        this.toast.success('COMMON.SAVED_OK');
        this.announce('MENU_BUILDER.A11Y.SAVED', {});
        const id = this.store.menu().id;
        // A new menu now has an address: stay on the page, under its own URL.
        if (id && this.route.snapshot.paramMap.get('id') === 'new') {
          void this.router.navigate(['/settings/menu-builder', id], { replaceUrl: true });
        }
        break;
      }
      case 'invalid':
        this.announce('MENU_BUILDER.A11Y.FIX_ERRORS', {});
        queueMicrotask(() => this.focusFirstInvalid());
        break;
      default:
        this.toast.error('COMMON.SAVE_FAILED', this.store.errors()['_general'] || undefined);
    }
  }

  /** Scroll to and focus the first field that is wrong (page order: name, hours, branches, then sections). */
  focusFirstInvalid(): void {
    const key = firstInvalidKey(this.store.errors(), this.store.sections().map(idOf));
    if (!key) return;
    if (key.startsWith('section:')) {
      this.store.select(key.slice(8));
      this.renameRequest.update((n) => n + 1);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-field="${key}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    const target = el.matches('input,select,textarea,button') ? el : el.querySelector<HTMLElement>('input,select,textarea,button');
    (target ?? el).focus({ preventScroll: true });
  }

  // ── Helpers ──
  private keyOf = (p: MenuSectionProduct): string => p.id ?? (p as any).__tempId ?? `${p.x},${p.y}`;
  private t = (k: string) => this.translate.instant(k);
  private announce(key: string, params: Record<string, unknown>): void { void this.announcer.announce(this.translate.instant(key, params), 'polite'); }

  private setNotice(msg: string | null): void {
    this.notice.set(msg);
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    if (msg) this.noticeTimer = setTimeout(() => this.notice.set(null), 5000);
  }

  private async pickColor(current: MenuSectionColor): Promise<MenuSectionColor | undefined> {
    const ref = this.modal.open<ColorPickerModalComponent, ColorPickerModalData, MenuSectionColor>(ColorPickerModalComponent, { size: 'md', data: { current } });
    return (await ref.afterClosed()) ?? undefined;
  }

  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, { size: 'sm', data, closeOnBackdrop: false });
    return (await ref.afterClosed()) === true;
  }

  readonly idOf = idOf;
}
