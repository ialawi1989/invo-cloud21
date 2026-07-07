import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';

import { MatrixItemService } from '../../services/matrix-item.service';
import {
  Dimension,
  DimensionDisplayType,
  DimensionListRow,
  PREDEFINED_DIMENSIONS,
  emptyDimension,
  emptyTranslation,
} from '../../services/matrix-item.types';

export interface AddDimensionModalData {
  existingNames: string[];
}

/**
 * Add-dimension modal
 * ───────────────────
 * Builds a new dimension for a matrix item, or picks one from the saved
 * catalog. Offers `PREDEFINED_DIMENSIONS` shortcuts + a searchable,
 * infinite-scrolling list of saved dimensions. Returns a fully-formed
 * `Dimension` (loaded via the service when a saved one is chosen) or `null`.
 */
@Component({
  selector: 'app-add-dimension-modal',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    SegmentedToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './add-dimension-modal.component.html',
  styleUrl: './add-dimension-modal.component.scss',
})
export class AddDimensionModalComponent implements OnInit, AfterViewInit, OnDestroy {
  private service = inject(MatrixItemService);
  private modalRef = inject<ModalRef<Dimension | null>>(MODAL_REF);
  private data = inject<AddDimensionModalData>(MODAL_DATA) ?? { existingNames: [] };

  /** Lowercased set of names already on the matrix — used to reject
   *  duplicates and hide already-added suggestions/rows. */
  private takenNames = new Set(
    (this.data.existingNames ?? []).map((n) => n.trim().toLowerCase()),
  );

  // ── Form state ────────────────────────────────────────────────────
  name = signal<string>('');
  displayType = signal<DimensionDisplayType>('buttons');
  /** Id of a saved dimension the user picked — non-null means "return the
   *  loaded catalog record" instead of a freshly-built one. */
  private selectedSavedId = signal<string | null>(null);
  saving = signal<boolean>(false);

  readonly displayTypeOptions: SegmentedToggleOption<DimensionDisplayType>[] = [
    { value: 'buttons', label: 'MATRIX.DIMENSION.BUTTONS' },
    { value: 'radio', label: 'MATRIX.DIMENSION.RADIO' },
    { value: 'dropdown', label: 'MATRIX.DIMENSION.DROPDOWN' },
  ];

  /** Predefined shortcuts minus the ones already on the matrix. */
  readonly suggestions = computed(() =>
    PREDEFINED_DIMENSIONS.filter((p) => !this.takenNames.has(p.label.toLowerCase())),
  );

  readonly nameError = computed<string | null>(() => {
    const n = this.name().trim();
    if (!n) return null;
    if (this.takenNames.has(n.toLowerCase())) return 'DIMENSIONS.FORM.NAME_DUPLICATE';
    return null;
  });

  readonly canConfirm = computed<boolean>(
    () => !!this.name().trim() && !this.nameError() && !this.saving(),
  );

  // ── Saved-dimension list (search + infinite scroll) ───────────────
  search = signal<string>('');
  loading = signal<boolean>(false);
  private page = signal<number>(1);
  hasMore = signal<boolean>(false);
  rows = signal<DimensionListRow[]>([]);

  private readonly limit = 20;
  readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private scrollObserver?: IntersectionObserver;
  private debounce?: ReturnType<typeof setTimeout>;

  isSelectedRow(id: string): boolean {
    return this.selectedSavedId() === id;
  }

  isRowTaken(row: DimensionListRow): boolean {
    return this.takenNames.has((row.name || '').trim().toLowerCase());
  }

  constructor() {
    withTranslations('products/matrix-item');
  }

  ngOnInit(): void {
    void this.loadPage(1);
  }

  ngAfterViewInit(): void {
    const sentinel = this.scrollSentinel();
    if (!sentinel) return;
    this.scrollObserver = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && this.hasMore() && !this.loading()) {
        void this.loadPage(this.page() + 1);
      }
    });
    this.scrollObserver.observe(sentinel.nativeElement);
  }

  ngOnDestroy(): void {
    this.scrollObserver?.disconnect();
    clearTimeout(this.debounce);
  }

  // ── Field handlers ────────────────────────────────────────────────
  onNameInput(v: string): void {
    this.name.set(v);
    // Typing a name diverges from any saved pick — treat it as a fresh dim.
    this.selectedSavedId.set(null);
  }

  onDisplayTypeChange(t: DimensionDisplayType): void {
    this.displayType.set(t);
    this.selectedSavedId.set(null);
  }

  pickSuggestion(s: { label: string; type: string }): void {
    this.name.set(s.label);
    this.selectedSavedId.set(null);
  }

  pickSavedRow(row: DimensionListRow): void {
    if (this.isRowTaken(row)) return;
    this.selectedSavedId.set(row.id);
    this.name.set(row.name);
    this.displayType.set(row.displayType);
  }

  onSearchInput(v: string): void {
    this.search.set(v);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.loadPage(1), 300);
  }

  // ── Loading ───────────────────────────────────────────────────────
  private async loadPage(page: number): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.service.getDimensionList({
        page,
        limit: this.limit,
        searchTerm: this.search().trim(),
      });
      this.page.set(page);
      this.rows.set(page === 1 ? res.list : [...this.rows(), ...res.list]);
      this.hasMore.set(page * this.limit < res.count);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Close ─────────────────────────────────────────────────────────
  async confirm(): Promise<void> {
    if (!this.canConfirm()) return;
    this.saving.set(true);
    try {
      const savedId = this.selectedSavedId();
      if (savedId) {
        const full = await this.service.getDimension(savedId);
        if (full) {
          full.isNew = false;
          this.modalRef.close(full);
          return;
        }
      }
      // Fresh dimension.
      const name = this.name().trim();
      const dim = emptyDimension();
      dim.name = name;
      dim.type = name.toLowerCase().replace(/\s+/g, '');
      dim.displayType = this.displayType();
      dim.translation = emptyTranslation();
      dim.translation.name.en = name;
      this.modalRef.close(dim);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.modalRef.close(null);
  }
}
