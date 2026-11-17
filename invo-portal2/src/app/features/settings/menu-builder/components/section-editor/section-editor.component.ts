import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { GRID_COLS, GRID_ROWS, MAX_PAGES, type MenuSection, type MenuSectionProduct } from '../../services/menu-builder.types';
import { SLOTS_PER_PAGE } from '../../utils/menu-layout';
import { ProductGridComponent, type DraggedProduct, type Direction } from '../product-grid/product-grid.component';
import { ProductSearchComponent } from '../product-search/product-search.component';

/**
 * The right column: one section's header (name with an inline rename, the product colours, the page pager), the product search,
 * the "{used} of 36 slots used" counter and the 6x6 grid. Presentational: everything it does is reported through outputs.
 */
@Component({
  selector: 'app-section-editor',
  standalone: true,
  imports: [TranslateModule, ProductGridComponent, ProductSearchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './section-editor.component.html',
  styleUrl: './section-editor.component.scss',
})
export class SectionEditorComponent {
  section = input.required<MenuSection>();
  page = input(1);
  /** Products on the open page. */
  products = input<MenuSectionProduct[]>([]);
  slotsUsed = input(0);
  canAddPage = input(false);
  nameError = input<string | null>(null);
  results = input<DraggedProduct[]>([]);
  searching = input(false);
  notice = input<string | null>(null);
  /** Bumped by the page to start renaming (after "Add section" or "Rename"): the name field opens and takes focus. */
  renameRequest = input(0);

  rename = output<string>();
  productColors = output<void>();
  selectPage = output<number>();
  addPage = output<void>();
  removePage = output<number>();
  query = output<string>();
  pickResult = output<DraggedProduct>();
  pickAt = output<{ x: number; y: number }>();
  tileMove = output<{ key: string; to: { x: number; y: number } }>();
  tileResize = output<{ key: string; cols: number; rows: number }>();
  tileStep = output<{ key: string; dir: Direction }>();
  tileRemove = output<MenuSectionProduct>();
  tileColor = output<MenuSectionProduct>();
  productDrop = output<{ product: DraggedProduct; x: number; y: number }>();

  readonly cols = GRID_COLS;
  readonly rows = GRID_ROWS;
  readonly total = SLOTS_PER_PAGE;
  readonly maxPages = MAX_PAGES;

  editing = signal(false);
  private nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  pageNumbers = computed(() => Array.from({ length: this.section().pages }, (_, i) => i + 1));

  constructor() {
    let last = 0;
    effect(() => {
      const n = this.renameRequest();
      if (n === last) return;
      last = n;
      this.startRename();
    });
  }

  startRename(): void {
    this.editing.set(true);
    // The input exists after the next render; select its text so typing replaces "New section".
    setTimeout(() => { const el = this.nameInput()?.nativeElement; el?.focus(); el?.select(); });
  }

  commit(value: string): void {
    if (!this.editing()) return;
    this.editing.set(false);
    if (value !== this.section().name) this.rename.emit(value);
  }

  cancel(): void { this.editing.set(false); }
}
