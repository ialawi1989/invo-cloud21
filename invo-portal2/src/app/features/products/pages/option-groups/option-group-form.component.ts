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
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { InfoNoteComponent } from '@shared/components/info-note/info-note.component';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { TranslateLinkComponent } from '@shared/components/translate-link/translate-link.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  TranslationModalComponent,
  TranslationModalData,
  TranslationLang,
} from '@shared/components/translation-modal/translation-modal.component';

import { OptionGroup, OptionGroupOption, OptionGroupService } from '../../services/option-group.service';
import {
  OptionPickerModalComponent,
  OptionPickerModalData,
  OptionPickerResult,
} from './components/option-picker-modal/option-picker-modal.component';

/**
 * Option Groups → form (create + edit). Translatable Title + Display name
 * (alias), min/max selectable (with an "unlimited" toggle), and the list of
 * member options each with a default quantity (add via picker, reorder,
 * remove). Ported from the legacy `option-group-form.component`.
 */
@Component({
  selector: 'app-option-group-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    TranslateLinkComponent,
    DragDropModule,
    MycurrencyPipe,
    InfoNoteComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './option-group-form.component.html',
  styleUrl: './option-group-form.component.scss',
})
export class OptionGroupFormComponent implements OnInit, CanLeaveComponent {
  private service = inject(OptionGroupService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  groupId = signal<string | null>(null);
  private original = signal<OptionGroup | null>(null);
  private i18nTick = signal(0);

  title = signal<string>('');
  alias = signal<string>('');
  minSelectable = signal<number>(0);
  maxSelectable = signal<number>(1);
  unlimited = signal<boolean>(false);
  options = signal<OptionGroupOption[]>([]);
  /** Local filter over the options-in-group list. */
  optionsSearch = signal<string>('');
  /** optionIds whose qty is being edited inline. */
  editingQty = signal<Set<string>>(new Set());
  private translation = signal<OptionGroup['translation']>({});
  private dirty = signal<boolean>(false);

  /** Options shown after applying the local search filter. */
  visibleOptions = computed<OptionGroupOption[]>(() => {
    const term = this.optionsSearch().trim().toLowerCase();
    if (!term) return this.options();
    return this.options().filter((o) => (o.name ?? '').toLowerCase().includes(term));
  });
  /** Drag reorder only makes sense over the full, unfiltered list. */
  reorderEnabled = computed<boolean>(() => !this.optionsSearch().trim());

  isNew = computed<boolean>(() => this.groupId() === null);
  titleInvalid = computed<boolean>(() => !this.title().trim());
  effectiveMax = computed<number>(() => (this.unlimited() ? this.options().length : this.maxSelectable()));
  canSave = computed<boolean>(() =>
    !this.titleInvalid() &&
    this.options().length > 0 &&
    this.effectiveMax() > 0 &&
    this.minSelectable() <= this.effectiveMax() &&
    !this.saving());

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('PRODUCTS.OPTION_GROUPS.TITLE'), routerLink: '/products/option-group' },
      { label: this.original()?.title || this.translate.instant(this.isNew() ? 'PRODUCTS.OPTION_GROUPS.ADD_NEW' : 'COMMON.EDIT') },
    ];
  });
  pageTitle = computed<string>(() => {
    this.i18nTick();
    if (this.isNew()) return this.translate.instant('PRODUCTS.OPTION_GROUPS.ADD_NEW');
    return this.original()?.title || this.translate.instant('COMMON.EDIT');
  });
  saveLabel = computed<string>(() => { this.i18nTick(); return this.translate.instant('COMMON.SAVING'); });

  constructor() {
    withTranslations('products');
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || id === 'new' || id === '0') {
      this.groupId.set(null);
      return;
    }
    // Clone reuses the source record's route with ?clone=true: load its data,
    // but keep the form in "create" mode so saving writes a new group. The
    // member options carry over as references — no new Option records.
    const isClone = this.route.snapshot.queryParamMap.get('clone') === 'true';
    this.groupId.set(isClone ? null : id);
    this.loading.set(true);
    try {
      const data = await this.service.getOne(id);
      if (!data) return;
      this.original.set(isClone ? { ...data, id: null } : data);
      this.title.set(isClone ? this.copyOf(data.title) : data.title);
      this.alias.set(isClone ? this.copyOf(data.alias) : data.alias);
      this.minSelectable.set(data.minSelectable);
      this.maxSelectable.set(data.maxSelectable);
      this.options.set([...data.options]);
      this.unlimited.set(data.maxSelectable >= data.options.length && data.options.length > 0);
      this.translation.set(data.translation ?? {});
    } finally {
      this.loading.set(false);
    }
  }

  /** "Copy of X" — the legacy clone prefix, translatable. Blank stays blank. */
  private copyOf(value: string): string {
    return value?.trim() ? this.translate.instant('COMMON.COPY_OF', { name: value }) : value;
  }

  // ── Simple setters ─────────────────────────────────────────────────────────
  onTitle(v: string): void { this.title.set(v); this.dirty.set(true); }
  onAlias(v: string): void { this.alias.set(v); this.dirty.set(true); }
  onMin(v: string): void { this.minSelectable.set(Math.max(0, Number(v) || 0)); this.dirty.set(true); }
  onMax(v: string): void { this.maxSelectable.set(Math.max(0, Number(v) || 0)); this.dirty.set(true); }
  toggleUnlimited(): void { this.unlimited.update((x) => !x); this.dirty.set(true); }

  // ── Member options ─────────────────────────────────────────────────────────
  async openOptionPicker(): Promise<void> {
    const ref = this.modal.open<OptionPickerModalComponent, OptionPickerModalData, OptionPickerResult>(
      OptionPickerModalComponent,
      {
        size: 'md',
        data: {
          excludedIds: this.options().map((o) => o.optionId).filter(Boolean),
          title: this.translate.instant('PRODUCTS.OPTION_GROUPS.ADD_OPTIONS'),
        },
        closeOnBackdrop: false,
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    if (result.removed?.length) {
      const drop = new Set(result.removed.map(String));
      this.options.update((list) => list.filter((o) => !drop.has(String(o.optionId))));
    }
    if (result.added?.length) {
      const seen = new Set(this.options().map((o) => String(o.optionId)));
      const fresh = result.added
        .filter((p) => !seen.has(String(p.id)))
        .map((p) => ({ optionId: p.id, name: p.name, price: p.price, qty: 1, thumbnailUrl: p.thumbnailUrl ?? undefined } as OptionGroupOption));
      this.options.update((list) => [...list, ...fresh].map((o, i) => ({ ...o, index: i })));
    }
    this.dirty.set(true);
  }

  setQty(optionId: string, value: string): void {
    const qty = Number(value);
    this.options.update((list) => list.map((o) => (o.optionId === optionId ? { ...o, qty: isNaN(qty) ? 0 : qty } : o)));
    this.dirty.set(true);
  }

  isEditingQty(optionId: string): boolean { return this.editingQty().has(optionId); }

  toggleQtyEdit(optionId: string): void {
    this.editingQty.update((set) => {
      const next = new Set(set);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  }

  onSearchOptions(v: string): void { this.optionsSearch.set(v); }
  clearOptionsSearch(): void { this.optionsSearch.set(''); }

  removeOption(optionId: string): void {
    this.options.update((list) => list.filter((o) => o.optionId !== optionId));
    this.dirty.set(true);
  }

  dropOption(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.options.update((list) => {
      const next = [...list];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return next.map((o, i) => ({ ...o, index: i }));
    });
    this.dirty.set(true);
  }

  // ── Translation ────────────────────────────────────────────────────────────
  openTitleTranslation(): void { void this.openTranslation('name', this.title()); }
  openAliasTranslation(): void { void this.openTranslation('alias', this.alias()); }

  private async openTranslation(field: 'name' | 'alias', currentEn: string): Promise<void> {
    const existing = (this.translation()?.[field] as Record<string, string>) ?? {};
    const ref = this.modal.open<TranslationModalComponent, TranslationModalData, TranslationLang | null>(
      TranslationModalComponent,
      {
        size: 'sm',
        data: {
          initial: { ...existing, en: currentEn },
          label: this.translate.instant(field === 'name' ? 'PRODUCTS.OPTION_GROUPS.NAME' : 'PRODUCTS.OPTION_GROUPS.ALIAS'),
        },
        closeOnBackdrop: false,
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    this.translation.update((t) => ({ ...(t ?? {}), [field]: { ...result } }));
    if (field === 'name') this.title.set(result.en);
    else this.alias.set(result.en);
    this.dirty.set(true);
  }

  // ── Save / cancel ────────────────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const original = this.original();
      const translation = { ...(this.translation() ?? {}) };
      translation['name'] = { ...(translation['name'] as Record<string, string> ?? {}), en: this.title().trim() };
      translation['alias'] = { ...(translation['alias'] as Record<string, string> ?? {}), en: this.alias().trim() };
      const payload: Partial<OptionGroup> = {
        ...(original ?? {}),
        id: original?.id ?? null,
        title: this.title().trim(),
        alias: this.alias().trim(),
        minSelectable: this.minSelectable(),
        maxSelectable: this.effectiveMax(),
        options: this.options(),
        translation,
      };
      const res = await this.service.save(payload);
      if (res.success) {
        this.dirty.set(false);
        this.toast.success('COMMON.SAVED_OK');
        this.router.navigate(['/products/option-group']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (e: any) {
      console.error('[option-group-form] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { this.router.navigate(['/products/option-group']); }
  hasUnsavedChanges(): boolean { return this.dirty() && !this.saving(); }
}
