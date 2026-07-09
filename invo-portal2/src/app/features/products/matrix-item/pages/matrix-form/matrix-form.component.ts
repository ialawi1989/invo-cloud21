import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BranchConnectionService } from '@core/layout/services/branch.service';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  TranslationModalComponent,
  TranslationModalData,
  TranslationLang,
} from '@shared/components/translation-modal/translation-modal.component';
import {
  MediaPickerModalComponent,
  MediaPickerConfig,
} from '../../../../settings/media/components/media-picker/media-picker-modal.component';
import type { Media } from '../../../../settings/media/models/media.model';
import { ProductsService } from '../../../services/products.service';
import {
  productBarcodeUniqueValidator,
  productNameUniqueValidator,
} from '../../../services/product-validators';

import { MatrixItemService } from '../../services/matrix-item.service';
import {
  BranchProduct,
  Dimension,
  MatrixItem,
  MatrixProduct,
  VariantImage,
  emptyMatrixItem,
  emptyTranslation,
} from '../../services/matrix-item.types';
import {
  allDimensionsHaveAttributes,
  buildBarcodeComparison,
  generateVariants,
  regenerateBarcodesAndSkus,
  stripCodelessAttributes,
} from '../../utils/variant-generator';
import {
  BranchFill,
  applyBranchToAll,
  copyBranchInto,
  deriveBranchCompletion,
} from '../../utils/branch-completion';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';
import { ManageDimensionsComponent } from '../../components/manage-dimensions/manage-dimensions.component';
import { BranchTabsComponent } from '../../../pages/product-form/components/branch-product-section/branch-tabs/branch-tabs.component';
import {
  BranchTabRef,
  provideBranchTabs,
} from '../../../pages/product-form/components/branch-product-section/branch-tabs/branch-tabs.service';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';
import {
  BarcodeChangeConfirmModalComponent,
  BarcodeChangeConfirmModalData,
} from '../../components/barcode-change-confirm-modal/barcode-change-confirm-modal.component';

/**
 * Matrix item editor (`/matrix-item/:id`, `:id === 'new' | '0'` → create).
 *
 * State model: a `matrixInfo` signal holds the whole graph (dimensions +
 * generated products) while a small reactive `FormGroup` owns validation of
 * the four scalar fields (name / barcode / default price / unit cost) and
 * drives the Save button. Variant generation runs on dimension/attribute
 * changes — and only in create mode, matching the legacy behaviour where
 * editing an existing matrix never regenerates its child products.
 */
@Component({
  selector: 'app-matrix-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    ManageDimensionsComponent,
    BranchTabsComponent,
    SegmentedToggleComponent,
  ],
  // The branch-tabs picker persists its open/pinned/active state per namespace.
  providers: [provideBranchTabs('matrixForm.branches')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matrix-form.component.html',
  styleUrl: './matrix-form.component.scss',
})
export class MatrixFormComponent implements OnInit, CanLeaveComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(MatrixItemService);
  private products = inject(ProductsService);
  private branchSvc = inject(BranchConnectionService);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);

  matrixInfo = signal<MatrixItem>(emptyMatrixItem());
  formStatus = signal<'new' | 'edit'>('new');
  matrixId = signal<string | null>(null);
  branches = signal<{ id: string; name: string }[]>([]);
  activeBranch = signal<number>(0);

  /** Bumped on every inline cell edit. Inline `[(ngModel)]` mutates the
   *  branchProduct object in place (no `matrixInfo.set`), so completion-style
   *  computed values must depend on this to recompute live. */
  private formTick = signal<number>(0);

  /** Branch pane mode — mirrors the product form. Defaults to 'bulk' so all
   *  branches show at once (the requested default for matrix). */
  mode = signal<'single' | 'bulk'>('bulk');
  setMode(m: 'single' | 'bulk'): void { this.mode.set(m); }

  readonly modeOptions: SegmentedToggleOption<'single' | 'bulk'>[] = [
    { value: 'single', label: 'MATRIX.FORM.SINGLE_BRANCH' },
    { value: 'bulk',   label: 'MATRIX.FORM.BULK_EDIT' },
  ];

  /** Viewport flag — the single-branch selector renders as a compact dropdown
   *  on mobile (where a 210px sidebar doesn't fit) and a sidebar on desktop. */
  private isMobile = signal<boolean>(typeof window !== 'undefined' && window.innerWidth < 640);
  @HostListener('window:resize')
  onWindowResize(): void {
    if (typeof window !== 'undefined') this.isMobile.set(window.innerWidth < 640);
  }
  branchSelectorMode = computed<'sidebar' | 'dropdown'>(() =>
    this.isMobile() ? 'dropdown' : 'sidebar',
  );

  /** Branch directory for the shared `<app-pf-branch-tabs>` chips picker. */
  branchTabRefs = computed<BranchTabRef[]>(() =>
    this.branches().map((b) => ({ id: b.id, name: b.name, isOnline: true })),
  );

  /** Bridge the chips picker (branchId) to the index-based activeBranch. */
  onBranchTabChange(branchId: string): void {
    const idx = this.branches().findIndex((b) => b.id === branchId);
    if (idx >= 0 && idx !== this.activeBranch()) this.activeBranch.set(idx);
  }

  /** Id of the branch currently shown in the single-branch detail pane. */
  activeBranchId = computed<string>(() => this.branches()[this.activeBranch()]?.id ?? '');

  /** Per-branch fill state for the sidebar completion indicator. Depends on
   *  `formTick` so it recomputes live as the user types into the cells. */
  branchCompletion = computed<Record<string, BranchFill>>(() => {
    this.formTick();
    return deriveBranchCompletion(this.matrixInfo().products, this.branches().map((b) => b.id));
  });

  /**
   * Bulk: copy the active branch's opening balance / cost / price onto every
   * other branch, for every variant — after a translated confirm.
   */
  async applyCurrentToAll(): Promise<void> {
    const srcId = this.activeBranchId();
    if (!srcId || this.branches().length < 2) return;
    const branchName = this.branches()[this.activeBranch()]?.name ?? '';
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'md',
        data: {
          title: this.translate.instant('MATRIX.FORM.APPLY_ALL_TITLE'),
          message: this.translate.instant('MATRIX.FORM.APPLY_ALL_MESSAGE', { branch: branchName }),
          confirm: this.translate.instant('MATRIX.FORM.APPLY_ALL_CONFIRM'),
        },
      },
    );
    if (!(await ref.afterClosed())) return;
    const ids = this.branches().map((b) => b.id);
    this.patchModel((m) => (m.products = applyBranchToAll(m.products, srcId, ids)));
  }

  /** Bulk: copy the picked source branch's values into the active branch. */
  copyValuesFrom(sourceBranchId: string): void {
    const targetId = this.activeBranchId();
    if (!sourceBranchId || !targetId || sourceBranchId === targetId) return;
    this.patchModel((m) => (m.products = copyBranchInto(m.products, sourceBranchId, targetId)));
  }

  /** Manual dirty flag — set on any edit, cleared on load/save. Powers the
   *  unsaved-changes guard (the reactive form only covers 4 scalars). */
  private dirty = signal<boolean>(false);
  private originalBarcode = '';
  private barcodeChangeInProgress = false;
  /** List query params captured on entry, forwarded back on save/cancel. */
  private listParams: Record<string, string> = {};

  private i18nTick = signal(0);

  /** Reactive validation group for the scalar fields. */
  form = new FormGroup({
    matrixName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
      asyncValidators: [
        productNameUniqueValidator(this.products, {
          getProductId: () => this.matrixId(),
          tableName: 'matrix',
        }),
      ],
    }),
    matrixBarcode: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
      asyncValidators: [
        productBarcodeUniqueValidator(this.products, {
          getProductId: () => this.matrixId(),
          tableName: 'matrix',
          getIsMatrix: () => true,
        }),
      ],
    }),
    defaultPrice: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    unitCost: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  isEdit = computed(() => this.formStatus() === 'edit');

  pageTitle = computed<string>(() => {
    this.i18nTick();
    return this.isEdit()
      ? this.translate.instant('MATRIX.FORM.EDIT_TITLE')
      : this.translate.instant('MATRIX.FORM.NEW_TITLE');
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('MATRIX.LIST.TITLE'), routerLink: '/matrix-item' },
      { label: this.pageTitle() },
    ];
  });

  // ─── Derived product-table state ──────────────────────────────────────
  hasProducts = computed(() => this.matrixInfo().products.length > 0);
  showProducts = computed(
    () =>
      this.branches().length > 0 &&
      allDimensionsHaveAttributes(this.matrixInfo().dimensions),
  );
  hasNewProducts = computed(() => this.matrixInfo().products.some((p) => !p.id));
  hasExistingProducts = computed(() => this.matrixInfo().products.some((p) => !!p.id));

  constructor() {
    withTranslations('products/matrix-item');
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));

    // Mirror validated scalars into the model + react to price/cost edits.
    this.form.controls.defaultPrice.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => this.patchModel((m) => (m.defaultPrice = Number(v) || 0)));
    this.form.controls.unitCost.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => this.onUnitCostChange(Number(v) || 0));
  }

  async ngOnInit(): Promise<void> {
    for (const key of ['page', 'limit', 'q', 'sortBy', 'dir']) {
      const val = this.route.snapshot.queryParamMap.get(key);
      if (val) this.listParams[key] = val;
    }

    this.loading.set(true);
    try {
      if (!this.branchSvc.loaded()) {
        try {
          await this.branchSvc.load();
        } catch {
          /* empty branch list = no product tabs */
        }
      }
      this.branches.set(this.branchSvc.branches().map((b) => ({ id: b.id, name: b.name })));

      const id = this.route.snapshot.paramMap.get('id');
      if (id && id !== 'new' && id !== '0') {
        this.formStatus.set('edit');
        this.matrixId.set(id);
        const loaded = await this.service.getMatrix(id);
        if (loaded) {
          await this.backfillAttributeIds(loaded);
          this.ensureBranchRows(loaded);
          this.matrixInfo.set(loaded);
          this.originalBarcode = loaded.barcode;
        }
      }

      const info = this.matrixInfo();
      // Keep translation.name.en aligned with the primary name.
      if (info.translation?.name) info.translation.name.en = info.name || '';

      this.form.patchValue(
        {
          matrixName: info.name,
          matrixBarcode: info.barcode,
          defaultPrice: info.defaultPrice,
          unitCost: info.unitCost,
        },
        { emitEvent: false },
      );
      // Name + barcode are locked once the matrix exists (legacy rule).
      if (this.isEdit()) {
        this.form.controls.matrixName.disable({ emitEvent: false });
        this.form.controls.matrixBarcode.disable({ emitEvent: false });
        this.form.controls.unitCost.disable({ emitEvent: false });
      }
      this.dirty.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Model helpers ────────────────────────────────────────────────────
  private patchModel(mutate: (m: MatrixItem) => void, markDirty = true): void {
    const next = { ...this.matrixInfo() };
    mutate(next);
    this.matrixInfo.set(next);
    if (markDirty) this.dirty.set(true);
  }

  /**
   * Recover missing attribute ids after load.
   *
   * Older matrices stored their `dimensions` JSON with the attribute ids blank
   * (only the dimension itself carried an id). Sending those back on save makes
   * the backend re-insert the attributes and trip the uniqueness check
   * (`attribute name/code already used`). Since the dimension exists in the
   * catalog, its attributes are persisted there with real ids — so for any
   * existing dimension whose attributes are missing ids, fetch the catalog
   * dimension and backfill by matching code (then name). Best-effort: never
   * blocks the load, leaves ids untouched on any failure.
   */
  private async backfillAttributeIds(info: MatrixItem): Promise<void> {
    const gaps = info.dimensions.filter(
      (d) => d.id && d.attributes.some((a) => !a.id),
    );
    if (gaps.length === 0) return;
    await Promise.all(
      gaps.map(async (d) => {
        try {
          const catalog = await this.service.getDimension(d.id);
          if (!catalog?.attributes?.length) return;
          const byCode = new Map<string, string>();
          const byName = new Map<string, string>();
          for (const ca of catalog.attributes) {
            if (!ca.id) continue;
            if (ca.code) byCode.set(ca.code.toLowerCase(), ca.id);
            if (ca.name) byName.set(ca.name.toLowerCase(), ca.id);
          }
          for (const a of d.attributes) {
            if (a.id) continue;
            const match =
              byCode.get((a.code || '').toLowerCase()) ??
              byName.get((a.name || '').toLowerCase());
            if (match) {
              a.id = match;
              a.isNew = false;
            }
          }
        } catch {
          /* leave ids as-is — save() still guards, and the user can re-pick */
        }
      }),
    );
  }

  /** Ensure every product has a branchProduct row for every branch so the
   *  template's two-way `ngModel` bindings target stable objects. */
  private ensureBranchRows(info: MatrixItem): void {
    for (const p of info.products) {
      if (!Array.isArray(p.branchProduct)) p.branchProduct = [];
      for (const b of this.branches()) {
        if (!p.branchProduct.some((bp) => bp.branchId === b.id)) {
          p.branchProduct.push({
            branchId: b.id,
            onHand: 0,
            price: info.defaultPrice || 0,
            openingBalance: 0,
            openingBalanceCost: info.unitCost || 0,
          });
        }
      }
    }
  }

  // ─── Name / barcode / cost ────────────────────────────────────────────
  onNameChange(): void {
    if (this.isEdit()) return;
    const name = this.form.controls.matrixName.value ?? '';
    this.patchModel((m) => {
      m.name = name;
      if (m.translation?.name) m.translation.name.en = name;
    });
    this.regenerate();
  }

  async onBarcodeBlur(): Promise<void> {
    const newBarcode = this.form.controls.matrixBarcode.value ?? '';
    this.patchModel((m) => (m.barcode = newBarcode), false);

    // Only prompt when an existing product graph would be rewritten.
    if (
      this.originalBarcode &&
      newBarcode !== this.originalBarcode &&
      !this.barcodeChangeInProgress &&
      this.matrixInfo().products.length > 0
    ) {
      this.barcodeChangeInProgress = true;
      const comparison = buildBarcodeComparison(
        this.matrixInfo().products,
        this.originalBarcode,
        newBarcode,
      );
      const confirmed = await this.confirmBarcodeChange(comparison);
      if (confirmed) {
        this.patchModel((m) => {
          m.products = regenerateBarcodesAndSkus(m.products, this.originalBarcode, newBarcode);
        });
        this.originalBarcode = newBarcode;
      } else {
        this.form.controls.matrixBarcode.setValue(this.originalBarcode, { emitEvent: false });
        this.patchModel((m) => (m.barcode = this.originalBarcode), false);
      }
      this.barcodeChangeInProgress = false;
    } else if (!this.originalBarcode) {
      // First barcode entered — regenerate products (create mode).
      this.originalBarcode = newBarcode;
      this.regenerate();
    }
  }

  generateBarcode(): void {
    const newBarcode = this.products.generateRandomEan13();
    this.form.controls.matrixBarcode.setValue(newBarcode);
    this.patchModel((m) => {
      m.barcode = newBarcode;
      if (m.products.length > 0) {
        m.products = regenerateBarcodesAndSkus(m.products, this.originalBarcode || newBarcode, newBarcode);
      }
    });
    this.originalBarcode = newBarcode;
    if (this.matrixInfo().products.length === 0) this.regenerate();
  }

  private onUnitCostChange(cost: number): void {
    this.patchModel((m) => {
      m.unitCost = cost;
      for (const p of m.products) {
        p.openingBalanceCost = cost;
        for (const bp of p.branchProduct) bp.openingBalanceCost = cost;
      }
    });
  }

  // ─── Dimensions + variant generation ──────────────────────────────────
  onDimensionsChange(dimensions: Dimension[]): void {
    // Guard: code-less attributes (e.g. brought in by a picked saved dimension)
    // are invalid — the backend needs every attribute's code to build the
    // variant SKU/barcode. Strip them here so no malformed variant (`..._` SKU)
    // is ever generated, and tell the user what was dropped.
    const { dimensions: cleaned, removed } = stripCodelessAttributes(dimensions);
    if (removed.length) this.notifyCodelessStripped(removed);
    this.patchModel((m) => (m.dimensions = cleaned));
    // Legacy: only create mode regenerates products from dimension edits.
    if (!this.isEdit()) this.regenerate();
  }

  /** Warn the user that invalid (code-less) attributes were dropped. */
  private notifyCodelessStripped(removed: { dimension: string; attribute: string }[]): void {
    const detail = removed.map((r) => `${r.attribute} — ${r.dimension}`).join(', ');
    this.toast.warning('MATRIX.FORM.CODELESS_STRIPPED', detail);
  }

  regenerate(): void {
    if (this.isEdit()) return;
    const info = this.matrixInfo();
    const products = generateVariants({
      matrixName: info.name,
      matrixBarcode: info.barcode,
      unitCost: info.unitCost,
      dimensions: info.dimensions,
      branches: this.branches(),
      previous: info.products,
    });
    this.patchModel((m) => (m.products = products));
  }

  // ─── Product-table binding helpers ────────────────────────────────────
  branchProductFor(product: MatrixProduct, branchId: string): BranchProduct {
    let row = product.branchProduct.find((bp) => bp.branchId === branchId);
    if (!row) {
      row = {
        branchId,
        onHand: 0,
        price: this.matrixInfo().defaultPrice || 0,
        openingBalance: 0,
        openingBalanceCost: this.matrixInfo().unitCost || 0,
      };
      product.branchProduct.push(row);
    }
    return row;
  }

  clampNonNegative(row: BranchProduct, field: 'openingBalance' | 'price'): void {
    if (row[field] < 0) row[field] = 0;
    this.dirty.set(true);
    this.formTick.update((n) => n + 1);
  }

  printBarcode(product: MatrixProduct): void {
    this.products.showGenerateBarcode(product as any);
  }

  /**
   * Open an already-saved variant in the standard product editor, pre-selecting
   * the branch whose table the user clicked from (`?branch=<id>`). The product
   * form self-corrects the `:type` segment after it loads, so `inventory` is a
   * safe default here — the branch param survives that redirect. New (unsaved)
   * variants have no id yet and aren't linkable.
   */
  openProduct(product: MatrixProduct, branchId: string): void {
    if (!product.id) return;
    void this.router.navigate(['/products/form', 'inventory', product.id], {
      queryParams: { branch: branchId },
    });
  }

  // ─── Image ────────────────────────────────────────────────────────────
  imageUrl = computed<string>(() => this.matrixInfo().mediaUrl?.defaultUrl ?? '');
  hasImage = computed<boolean>(() => !!this.matrixInfo().mediaId);

  /** Mark the form dirty after an inline cell edit that isn't captured by the
   *  reactive FormGroup (opening-balance cost etc.). */
  markDirty(): void {
    this.dirty.set(true);
    this.formTick.update((n) => n + 1);
  }

  async chooseImage(): Promise<void> {
    const config: MediaPickerConfig = {
      contentTypes: ['image'],
      multiple: false,
      title: this.translate.instant('MATRIX.FORM.CHOOSE_IMAGE'),
    };
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      { data: config, size: 'xl' },
    );
    const result = await ref.afterClosed();
    const picked = Array.isArray(result) ? result[0] : result;
    if (!picked) return;
    this.patchModel((m) => {
      m.mediaId = picked.id ?? null;
      m.mediaUrl = {
        defaultUrl: picked.url?.defaultUrl ?? picked.url?.original ?? '',
        thumbnailUrl: picked.url?.thumbnail ?? picked.url?.defaultUrl ?? '',
      };
    });
  }

  removeImage(): void {
    this.patchModel((m) => {
      m.mediaId = null;
      m.mediaUrl = { defaultUrl: '', thumbnailUrl: '' };
    });
  }

  // ─── Per-variant images (bulkProductMedia) ────────────────────────────
  /** SKUs of saved variants whose image set was edited this session — drives
   *  the `bulkProductMedia` call on save (SKU is stable across the payload). */
  private editedImageSkus = new Set<string>();

  /** How many images a variant currently has — for the table badge. */
  variantImageCount(prod: MatrixProduct): number {
    return prod.mediaIds?.length ?? 0;
  }

  /** Thumbnail URL of a variant's first image (empty when it has none). */
  variantThumb(prod: MatrixProduct): string {
    const first = prod.mediaIds?.[0];
    return first ? first.thumbnailUrl || first.defaultUrl : '';
  }

  /**
   * Open the media picker (multiple) for one saved variant, pre-seeded with its
   * current images. The picked set replaces the variant's `mediaIds`; nothing
   * hits the network until Save, which flushes the edits via `bulkProductMedia`.
   */
  async openVariantImages(prod: MatrixProduct): Promise<void> {
    const config: MediaPickerConfig = {
      contentTypes: ['image'],
      multiple: true,
      title: this.translate.instant('MATRIX.FORM.VARIANT_IMAGES'),
      preSelectedIds: (prod.mediaIds ?? []).map((m) => m.id).filter(Boolean),
    };
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      { data: config, size: 'xl' },
    );
    const result = await ref.afterClosed();
    if (result === undefined) return; // dismissed — keep current images
    const picked = Array.isArray(result) ? result : [result];
    const images: VariantImage[] = picked.map((m) => ({
      id: m.id ?? '',
      defaultUrl: m.url?.defaultUrl ?? m.url?.original ?? '',
      thumbnailUrl: m.url?.thumbnail ?? m.url?.defaultUrl ?? '',
    }));
    this.patchModel((m) => {
      const target = m.products.find((p) => p.sku === prod.sku);
      if (target) target.mediaIds = images;
    });
    this.editedImageSkus.add(prod.sku);
  }

  /**
   * Push edited variant image sets to the backend. Runs after `saveMatrix`.
   *
   * For existing variants the product `id` is already known; for a freshly
   * created matrix the backend returns `productIds` in the same order as the
   * `products` array we sent, so brand-new variants are matched positionally.
   * No-op when nothing was edited.
   */
  private async persistVariantImages(newProductIds?: string[]): Promise<void> {
    if (this.editedImageSkus.size === 0) return;
    const products = this.matrixInfo().products;
    // Positional matching is only trustworthy when the returned id count lines
    // up 1:1 with the products we sent; otherwise fall back to known ids only.
    const positional = !!newProductIds && newProductIds.length === products.length;
    const payload: { productId: string; mediaIds: string[] }[] = [];
    products.forEach((p, i) => {
      if (!this.editedImageSkus.has(p.sku)) return;
      const productId = p.id || (positional ? newProductIds![i] : undefined);
      if (!productId) return;
      payload.push({ productId, mediaIds: (p.mediaIds ?? []).map((m) => m.id) });
    });
    if (payload.length === 0) return;
    await this.products.bulkProductMedia(payload);
    this.editedImageSkus.clear();
  }

  // ─── Name translation ─────────────────────────────────────────────────
  async translateName(): Promise<void> {
    const info = this.matrixInfo();
    const initial: TranslationLang = {
      en: info.translation?.name?.en || info.name,
      ar: info.translation?.name?.ar || '',
    };
    const ref = this.modal.open<TranslationModalComponent, TranslationModalData, TranslationLang | null>(
      TranslationModalComponent,
      { size: 'md', data: { initial, label: this.translate.instant('MATRIX.FORM.NAME') } },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    this.patchModel((m) => {
      const t = m.translation ?? emptyTranslation();
      m.translation = { ...t, name: { en: result.en, ar: result.ar } };
      m.name = result.en;
    });
    this.form.controls.matrixName.setValue(result.en, { emitEvent: false });
    if (!this.isEdit()) this.regenerate();
  }

  private async confirmBarcodeChange(comparison: ReturnType<typeof buildBarcodeComparison>): Promise<boolean> {
    const ref = this.modal.open<BarcodeChangeConfirmModalComponent, BarcodeChangeConfirmModalData, boolean>(
      BarcodeChangeConfirmModalComponent,
      { size: 'xl', data: { comparison } },
    );
    return !!(await ref.afterClosed());
  }

  // ─── Save / cancel ────────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void this.save();
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;

    // Final safety net: never send an attribute with a blank code — the
    // backend rejects it (`Attribute code is required`) and it yields malformed
    // `..._` variant SKUs. `onDimensionsChange` already strips these as they're
    // added, but re-check here to also catch data loaded in edit mode or via
    // any path that bypassed that handler.
    const { dimensions: sanitizedDims, removed } = stripCodelessAttributes(this.matrixInfo().dimensions);
    if (removed.length) {
      this.patchModel((m) => (m.dimensions = sanitizedDims), false);
      // Rebuild variants (create mode) so the products payload drops the ones
      // that referenced the removed attribute.
      if (!this.isEdit()) this.regenerate();
      this.notifyCodelessStripped(removed);
    }

    this.saving.set(true);
    const payload: MatrixItem = JSON.parse(JSON.stringify(this.matrixInfo()));
    // Per-variant images are persisted separately via `bulkProductMedia`, so
    // strip them from the matrix save payload (saveMatrix ignores them anyway).
    // `matrixInfo()` keeps its copy for `persistVariantImages()` below.
    for (const p of payload.products) delete p.mediaIds;
    // In edit mode the backend updates each `BranchProducts` row by its id and
    // expects an existing row per branch. `ensureBranchRows()` may have added
    // display-only rows for branches added after this matrix was created —
    // those have no id, so drop them here rather than send an idless row that
    // the backend rejects. (Create mode sends every row; ids are minted then.)
    if (this.isEdit()) {
      for (const p of payload.products) {
        p.branchProduct = (p.branchProduct ?? []).filter((bp) => !!bp.id);
      }
    }
    // Dimension / attribute id normalisation (both create and edit).
    //
    // The backend decides insert-vs-reuse by id presence: a row with an id is
    // treated as existing, a blank id is inserted as new. So the rule is:
    //   • An EXISTING dimension (real id) → keep it, and every attribute under
    //     it that already exists MUST keep its real id. If we blank an existing
    //     attribute's id the backend re-inserts it and trips the uniqueness
    //     check ("attribute name/code already used").
    //   • A BRAND-NEW dimension carries only a client-side uuid — drop it in
    //     create mode so the backend mints its own (in edit mode existing
    //     dimensions are locked, so there's nothing new to shed).
    //   • `isNew` is advisory; derive it from id presence so it can never
    //     disagree with the id we actually send.
    for (const d of payload.dimensions) {
      if (!this.isEdit() && d.isNew && d.id) d.id = ''; // brand-new dim → let backend mint the id
      d.isNew = !d.id;
      for (const a of d.attributes) {
        a.isNew = !a.id; // NEVER blank a real attribute id — only flag id-less ones as new
      }
    }
    try {
      const res = await this.service.saveMatrix(payload);
      if (res.success) {
        // Flush any per-variant image edits (variants now have product ids —
        // existing rows already had them, new rows come back in `productIds`).
        try {
          await this.persistVariantImages(res.productIds);
        } catch (imgErr: any) {
          // The matrix itself saved — surface the image failure without losing it.
          this.toast.error('MATRIX.FORM.IMAGES_SAVE_FAILED', imgErr?.message);
        }
        // Clear BOTH dirty sources so the unsaved-changes guard doesn't prompt
        // on the post-save navigation (the reactive form stays dirty otherwise).
        this.dirty.set(false);
        this.form.markAsPristine();
        this.toast.success('MATRIX.FORM.SAVED_OK');
        void this.router.navigate(['/matrix-item'], { queryParams: this.listParams });
      } else {
        this.toast.error('MATRIX.FORM.SAVE_FAILED', res.msg);
      }
    } catch (err: any) {
      this.toast.error('MATRIX.FORM.SAVE_FAILED', err?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/matrix-item'], { queryParams: this.listParams });
  }

  hasUnsavedChanges(): boolean {
    return this.dirty() || this.form.dirty;
  }
}
