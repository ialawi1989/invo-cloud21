import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { TimePickerComponent } from '@shared/components/time-picker/time-picker.component';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { BranchSettingsService, BranchSummary } from '../../../settings/services/branch-settings.service';
import { MenuBuilderService } from '../../services/menu-builder.service';
import {
  COLOR_SCHEMES,
  DEFAULT_COLOR_SCHEME,
  GRID_COLS,
  GRID_ROWS,
  MAX_PAGES,
  Menu,
  MenuSection,
  MenuSectionColor,
  MenuSectionProduct,
} from '../../services/menu-builder.types';

import { MenuGridComponent } from './components/menu-grid/menu-grid.component';
import { PickProductModalComponent, PickProductModalData, PickedProduct } from './components/pick-product-modal/pick-product-modal.component';
import { ColorPickerModalComponent, ColorPickerModalData } from './components/color-picker-modal/color-picker-modal.component';
import {
  ManageSectionProductsModalComponent,
  ManageSectionProductsData,
  ManageSectionProductsResult,
} from './components/manage-section-products-modal/manage-section-products-modal.component';

const tempId = (): string => 'tmp_' + Math.random().toString(36).slice(2, 10);

const EMPTY_MENU = (): Menu => ({
  id:              null,
  name:            '',
  branchIds:       [],
  priceLabelId:    '',
  startAt:         '00:00:00',
  endAt:           '23:59:00',
  availableOnline: true,
  sections:        [],
  index:           0,
});

const EMPTY_SECTION = (translation: TranslateService): MenuSection => ({
  id:          null,
  name:        translation.instant('MENU_BUILDER.NEW_SECTION_DEFAULT'),
  translation: {},
  image:       '',
  pages:       1,
  color:       { ...DEFAULT_COLOR_SCHEME },
  products:    [],
});

/**
 * Menu Builder → form page.
 *
 * Layout:
 *   • Header card  — name, branches, price label, hours, online toggle.
 *   • Sections strip — pill buttons coloured per section + add button.
 *   • Section editor — page tabs (1..3) + custom 6×6 grid component.
 *   • Sticky footer — Save / Cancel.
 *
 * The whole menu is held in a single `menu` signal; nested patches go
 * through `patchSection` / `patchProduct` helpers that re-emit fresh
 * objects so OnPush + signals re-render correctly.
 */
@Component({
  selector: 'app-menu-builder-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    SearchDropdownComponent,
    TimePickerComponent,
    MenuGridComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-builder-form.component.html',
  styleUrl: './menu-builder-form.component.scss',
})
export class MenuBuilderFormComponent implements OnInit, CanLeaveComponent {
  private service        = inject(MenuBuilderService);
  private branchService  = inject(BranchSettingsService);
  private translate      = inject(TranslateService);
  private destroyRef     = inject(DestroyRef);
  private router         = inject(Router);
  private route          = inject(ActivatedRoute);
  private modal          = inject(ModalService);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** Whole menu state. Mutations always re-emit fresh objects. */
  menu = signal<Menu>(EMPTY_MENU());

  /** Snapshot string used for `isDirty`. Refreshed on load + save. */
  private snapshot = signal<string>(JSON.stringify(EMPTY_MENU()));

  branches      = signal<BranchSummary[]>([]);
  priceLabels   = signal<Array<{ id: string; name: string }>>([]);

  selectedSectionId = signal<string | null>(null);
  selectedPage      = signal<number>(1);

  readonly gridCols = GRID_COLS;
  readonly gridRows = GRID_ROWS;
  readonly maxPages = MAX_PAGES;
  readonly colorSchemes = COLOR_SCHEMES;

  /** Re-translate computed labels when ngx-translate finishes loading. */
  private i18nTick = signal(0);

  // ─── Derived ───────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'),     routerLink: '/settings' },
      { label: this.translate.instant('MENU_BUILDER.TITLE'), routerLink: '/settings/menu-builder' },
      { label: this.menu().name || this.translate.instant('MENU_BUILDER.NEW_MENU') },
    ];
  });

  selectedSection = computed<MenuSection | null>(() => {
    const id = this.selectedSectionId();
    if (!id) return null;
    return this.menu().sections.find((s) => idOf(s) === id) ?? null;
  });

  /** Products on the active page of the active section. */
  pageProducts = computed<MenuSectionProduct[]>(() => {
    const s = this.selectedSection();
    if (!s) return [];
    const page = this.selectedPage();
    return s.products.filter((p) => p.page === page);
  });

  /** Used by the pagination chip — number of pages with content +
   *  one extra slot for "add page" if not at MAX_PAGES. */
  sectionPageCount = computed<number>(() => this.selectedSection()?.pages ?? 1);

  /** Adding a new page is only allowed when the current last page has
   *  at least one product (matches legacy `canAddPage`). */
  canAddPage = computed<boolean>(() => {
    const s = this.selectedSection();
    if (!s) return false;
    if (s.pages >= this.maxPages) return false;
    return s.products.some((p) => p.page === s.pages);
  });

  isDirty = computed<boolean>(() => JSON.stringify(this.menu()) !== this.snapshot());

  // ─── Lifecycle ─────────────────────────────────────────────────────────
  constructor() {
    withTranslations('menu-builder');
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [branchesPage, labels] = await Promise.all([
        this.branchService.getList({ page: 1, limit: 200 }),
        this.service.getPriceLabels(),
      ]);
      this.branches.set(branchesPage.list);
      this.priceLabels.set(labels);

      const id = this.route.snapshot.paramMap.get('id');
      if (id && id !== 'new') {
        const loaded = await this.service.getMenu(id);
        if (loaded) {
          this.stampTempIds(loaded);
          this.menu.set(loaded);
          this.selectedSectionId.set(loaded.sections[0] ? idOf(loaded.sections[0]) : null);
        }
      }
      this.snapshot.set(JSON.stringify(this.menu()));
    } finally {
      this.loading.set(false);
    }
  }

  hasUnsavedChanges(): boolean { return this.isDirty() && !this.saving(); }

  // ─── Branches dropdown adapters ────────────────────────────────────────
  // The dropdown is bound to BranchSummary rows (not the projected
  // ids) so `compareWith` is invoked row-against-row; we equate by id.
  // `selectedBranches` resolves the current `menu().branchIds` (a
  // string[]) back to the matching rows so the dropdown can render
  // per-row checked state.
  branchLabel  = (b: BranchSummary) => b.name || b.id;
  branchValue  = (b: BranchSummary) => b.id;
  branchEquals = (a: BranchSummary, b: BranchSummary) => a?.id === b?.id;

  selectedBranches = computed<BranchSummary[]>(() => {
    const ids = new Set(this.menu().branchIds);
    return this.branches().filter((b) => ids.has(b.id));
  });

  /**
   * The dropdown's `value` is a `model()` so `valueChange` auto-emits
   * — but it emits the **items** (BranchSummary[]), NOT the `toValue`
   * projections. We project to ids here so the model only ever stores
   * `string[]` (matches the wire shape the backend wants).
   */
  onBranchesChange(next: BranchSummary | BranchSummary[] | null): void {
    if (next == null)              { this.patchMenu('branchIds', []); return; }
    const list = Array.isArray(next) ? next : [next];
    this.patchMenu('branchIds', list.map((b) => b.id));
  }

  // ─── Price-label dropdown adapters ─────────────────────────────────────
  // The dropdown's `[value]` is bound to `menu().priceLabelId` (a plain
  // string) so `compareWith` is invoked against `string`-shaped sides
  // and `toValue` returns the id, not the whole row.
  priceLabelLabel  = (p: { id: string; name: string }) => p.name || '—';
  priceLabelValue  = (p: { id: string; name: string }) => p.id;
  // SearchDropdown invokes `compareWith` with the *items* on both sides
  // (not the toValue projection), so this signature compares row-by-id.
  priceLabelEquals = (a: { id: string; name: string }, b: { id: string; name: string }) => a?.id === b?.id;

  /** Resolve the row for the currently-selected price-label id so the
   *  dropdown's `[value]` input has the right object shape. */
  priceLabelSelected = computed<{ id: string; name: string } | null>(() => {
    const id = this.menu().priceLabelId;
    if (!id) return null;
    return this.priceLabels().find((p) => p.id === id) ?? null;
  });

  /**
   * Same lesson as `onBranchesChange`: the dropdown's `valueChange`
   * (a `model()` output) emits the *item* (the full row), not the
   * `toValue` projection. We extract `.id` here so the model stores
   * the bare string the wire wants — `priceLabelId: "<uuid>"` rather
   * than the row object.
   */
  onPriceLabelChange(next: { id: string; name: string } | null): void {
    this.patchMenu('priceLabelId', next?.id ?? '');
  }

  // ─── Header field updates ──────────────────────────────────────────────
  patchMenu<K extends keyof Menu>(key: K, value: Menu[K]): void {
    this.menu.update((m) => ({ ...m, [key]: value }));
  }

  /** TimePicker uses `HH:mm`; the model stores `HH:mm:ss` (legacy wire
   *  shape). Convert in both directions so neither side has to. */
  toShortTime(t: string): string { return (t || '').slice(0, 5); }
  fromShortTime(t: string): string { return t ? `${t}:00` : '00:00:00'; }

  // ─── Sections ──────────────────────────────────────────────────────────
  addSection(): void {
    const fresh = EMPTY_SECTION(this.translate);
    (fresh as any).__tempId = tempId();
    // Cycle through the colour scheme so every new section gets a
    // distinct accent without the user having to pick.
    const idx = this.menu().sections.length % this.colorSchemes.length;
    fresh.color = { ...this.colorSchemes[idx] };
    this.menu.update((m) => ({ ...m, sections: [...m.sections, fresh] }));
    this.selectedSectionId.set(idOf(fresh));
    this.selectedPage.set(1);
  }

  selectSection(id: string): void {
    this.selectedSectionId.set(id);
    this.selectedPage.set(1);
  }

  patchSection<K extends keyof MenuSection>(id: string, key: K, value: MenuSection[K]): void {
    this.menu.update((m) => ({
      ...m,
      sections: m.sections.map((s) => idOf(s) === id ? { ...s, [key]: value } : s),
    }));
  }

  /**
   * Open the "Product color in (Section)" modal — lists every product
   * across every page of the section with an inline Edit-color button.
   * Edits are batched: the modal returns a `[{id, color}]` list which
   * we merge into the section's products in a single signal patch so
   * isDirty + the save path see one update, not N.
   */
  async openSectionProducts(s: MenuSection): Promise<void> {
    const ref = this.modal.open<
      ManageSectionProductsModalComponent,
      ManageSectionProductsData,
      ManageSectionProductsResult
    >(ManageSectionProductsModalComponent, {
      size: 'md',
      data: { section: s },
    });
    const edits = await ref.afterClosed();
    if (!edits || edits.length === 0) return;
    // Build an `id → color` map for O(1) lookup while remapping.
    const map = new Map(edits.map((e) => [e.id, e.color] as const));
    this.patchSection(idOf(s), 'products', s.products.map((p) => {
      const c = map.get(idOf(p));
      return c == null ? p : { ...p, color: c };
    }));
  }

  async openSectionColor(s: MenuSection): Promise<void> {
    const ref = this.modal.open<
      ColorPickerModalComponent,
      ColorPickerModalData,
      MenuSectionColor
    >(ColorPickerModalComponent, {
      size: 'md',
      data: { current: s.color },
    });
    const picked = await ref.afterClosed();
    if (picked) this.patchSection(idOf(s), 'color', picked);
  }

  async removeSection(id: string, ev: Event): Promise<void> {
    ev.stopPropagation();
    const s = this.menu().sections.find((x) => idOf(x) === id);
    if (!s) return;
    const ok = await this.confirm({
      title:   this.translate.instant('COMMON.DELETE'),
      message: this.translate.instant('MENU_BUILDER.CONFIRM_DELETE_SECTION', { name: s.name || '—' }),
      confirm: this.translate.instant('COMMON.DELETE'),
      danger:  true,
    });
    if (!ok) return;
    this.menu.update((m) => ({ ...m, sections: m.sections.filter((x) => idOf(x) !== id) }));
    if (this.selectedSectionId() === id) {
      const next = this.menu().sections[0];
      this.selectedSectionId.set(next ? idOf(next) : null);
      this.selectedPage.set(1);
    }
  }

  // ─── Pages within a section ────────────────────────────────────────────
  selectPage(page: number): void { this.selectedPage.set(page); }

  addPage(): void {
    const s = this.selectedSection();
    if (!s || !this.canAddPage()) return;
    this.patchSection(idOf(s), 'pages', Math.min(s.pages + 1, this.maxPages));
    this.selectedPage.set(s.pages + 1);
  }

  async removePage(page: number): Promise<void> {
    const s = this.selectedSection();
    if (!s || page <= 1) return;
    const ok = await this.confirm({
      title:   this.translate.instant('MENU_BUILDER.REMOVE_PAGE'),
      message: this.translate.instant('MENU_BUILDER.CONFIRM_REMOVE_PAGE', { n: page }),
      confirm: this.translate.instant('COMMON.DELETE'),
      danger:  true,
    });
    if (!ok) return;
    // Drop products on this page; renumber pages above it.
    const products = s.products
      .filter((p) => p.page !== page)
      .map((p) => p.page > page ? { ...p, page: p.page - 1 } : p);
    this.menu.update((m) => ({
      ...m,
      sections: m.sections.map((sec) => idOf(sec) === idOf(s)
        ? { ...sec, pages: Math.max(1, sec.pages - 1), products }
        : sec),
    }));
    if (this.selectedPage() >= page) this.selectedPage.set(Math.max(1, this.selectedPage() - 1));
  }

  // ─── Products on the grid ──────────────────────────────────────────────
  /** Called from the grid component when an empty cell is clicked. */
  async pickProduct(at: { x: number; y: number; cols: number; rows: number }): Promise<void> {
    const s = this.selectedSection();
    if (!s) return;
    // Capacity = total cells on the active page minus cells already
    // covered by existing tiles (factoring their cols × rows). New
    // tiles are 1×1, so this is also the max number of products the
    // user is allowed to pick at once.
    const pageProducts = s.products.filter((p) => p.page === this.selectedPage());
    const occupiedCells = pageProducts.reduce((sum, p) => sum + p.cols * p.rows, 0);
    const totalCells    = this.gridCols * this.gridRows;
    const maxPick       = Math.max(0, totalCells - occupiedCells);
    const ref = this.modal.open<
      PickProductModalComponent,
      PickProductModalData,
      PickedProduct[]
    >(PickProductModalComponent, {
      size: 'lg',
      data: {
        // Hide already-placed products so the user can't double-pick
        // the same product on the same page.
        excludeIds: new Set(pageProducts.map((p) => p.productId)),
        maxPick,
      },
    });
    const picked = await ref.afterClosed();
    if (!picked || picked.length === 0) return;

    const occupied = new Set(s.products
      .filter((p) => p.page === this.selectedPage())
      .map((p) => `${p.x},${p.y}`));

    const newProducts: MenuSectionProduct[] = [];
    let cursor = at.x;
    let row    = at.y;
    for (const prod of picked) {
      // Find the next free cell starting at (cursor, row).
      while (occupied.has(`${cursor},${row}`)) {
        cursor++;
        if (cursor >= GRID_COLS) { cursor = 0; row++; }
        if (row >= GRID_ROWS)    { return; } // grid full
      }
      const newProd: MenuSectionProduct = {
        id:           null,
        productId:    prod.id,
        productName:  prod.name,
        page:         this.selectedPage(),
        x:            cursor,
        y:            row,
        cols:         at.cols,
        rows:         at.rows,
        color:        prod.color || s.color.borderColor,
        defaultImage: prod.defaultImage,
        mediaId:      null,
      };
      (newProd as any).__tempId = tempId();
      newProducts.push(newProd);
      occupied.add(`${cursor},${row}`);
      cursor += at.cols;
      if (cursor >= GRID_COLS) { cursor = 0; row++; }
    }
    this.patchSection(idOf(s), 'products', [...s.products, ...newProducts]);
  }

  /** Move/resize from the grid component. */
  updateProductPlacement(p: MenuSectionProduct, next: { x: number; y: number; cols: number; rows: number }): void {
    const s = this.selectedSection();
    if (!s) return;
    this.patchSection(idOf(s), 'products', s.products.map((q) => idOf(q) === idOf(p)
      ? { ...q, x: next.x, y: next.y, cols: next.cols, rows: next.rows }
      : q));
  }

  removeProduct(p: MenuSectionProduct): void {
    const s = this.selectedSection();
    if (!s) return;
    this.patchSection(idOf(s), 'products', s.products.filter((q) => idOf(q) !== idOf(p)));
  }

  async openProductColor(p: MenuSectionProduct): Promise<void> {
    const ref = this.modal.open<
      ColorPickerModalComponent,
      ColorPickerModalData,
      MenuSectionColor
    >(ColorPickerModalComponent, {
      size: 'md',
      data: { current: this.colorFromHex(p.color) },
    });
    const picked = await ref.afterClosed();
    if (!picked) return;
    const s = this.selectedSection();
    if (!s) return;
    this.patchSection(idOf(s), 'products', s.products.map((q) => idOf(q) === idOf(p)
      ? { ...q, color: picked.borderColor }
      : q));
  }

  // ─── Save / Cancel ─────────────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.menu().name.trim()) return;
    this.saving.set(true);
    try {
      const res = await this.service.save(this.menu());
      if (res.success) {
        if (res.data) {
          this.stampTempIds(res.data);
          this.menu.set(res.data);
          this.selectedSectionId.set(res.data.sections[0] ? idOf(res.data.sections[0]) : null);
        }
        this.snapshot.set(JSON.stringify(this.menu()));
        this.router.navigate(['/settings/menu-builder']);
      }
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { this.router.navigate(['/settings/menu-builder']); }

  // ─── Helpers ───────────────────────────────────────────────────────────
  /** Guarantee every entity has a stable identity, server-given or local. */
  private stampTempIds(m: Menu): void {
    for (const s of m.sections) {
      if (!s.id) (s as any).__tempId = tempId();
      for (const p of s.products) {
        if (!p.id) (p as any).__tempId = tempId();
      }
    }
  }

  /** Convert a single-colour string into a `MenuSectionColor` for the
   *  product colour picker (start === end === border). */
  private colorFromHex(c: string): MenuSectionColor {
    const safe = c || DEFAULT_COLOR_SCHEME.borderColor;
    return { colorName: 'Custom', borderColor: safe, colorStart: safe, colorEnd: safe };
  }

  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      { size: 'sm', data, closeOnBackdrop: false },
    );
    return (await ref.afterClosed()) === true;
  }

  // ─── Identity helpers used by the template ─────────────────────────────
  idOf = (e: MenuSection | MenuSectionProduct) => idOf(e);
  trackSection = (_: number, s: MenuSection) => idOf(s);
}

function idOf(entity: any): string {
  return entity?.id ?? entity?.__tempId ?? '';
}
