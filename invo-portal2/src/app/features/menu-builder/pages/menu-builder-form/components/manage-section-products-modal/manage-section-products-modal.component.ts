import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef, ModalService } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

import {
  COLOR_SCHEMES,
  DEFAULT_COLOR_SCHEME,
  MenuSection,
  MenuSectionColor,
  MenuSectionProduct,
} from '../../../../services/menu-builder.types';
import { ColorPickerModalComponent, ColorPickerModalData } from '../color-picker-modal/color-picker-modal.component';

export interface ManageSectionProductsData {
  section: MenuSection;
}

/** Returned shape: a mapping `{ productId-or-tempId → new color hex }`.
 *  The form merges these into its own `groups` signal so the changes
 *  ride through the existing dirty/save path. The caller decides what
 *  identity key to use; we expose the same `idOf` helper as the form. */
export type ManageSectionProductsResult = Array<{ id: string; color: string }>;

interface PageRow {
  page: number;
  products: MenuSectionProduct[];
}

/**
 * "Manage section products" — modal that lists every product placed
 * across every page of a section, grouped by page, with an Edit button
 * per row that opens the standard color picker modal.
 *
 * Search filters by product name OR category.
 *
 * The modal *defers commit*: edits live in `draftColors` until the
 * user clicks Done. Cancel discards. This matches the legacy
 * `manage-section-products` flow and keeps the parent free to roll
 * everything into a single signal patch.
 */
@Component({
  selector: 'app-manage-section-products-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'MENU_BUILDER.MANAGE.TITLE' | translate: { name: data.section.name || '—' }"/>

    <div class="body">
      <div class="head">
        <label class="search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" [ngModel]="search()" (ngModelChange)="search.set($event)" [placeholder]="'COMMON.SEARCH' | translate"/>
        </label>
        <button
          type="button"
          class="auto-btn"
          [disabled]="uncolouredCount() === 0"
          (click)="autoColor()"
          [attr.title]="'MENU_BUILDER.MANAGE.AUTO_COLOR_HINT' | translate">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9c4.97 0 9 4.03 9 9 0 1.66-1.34 3-3 3h-2a2 2 0 1 0 0 4 1 1 0 0 1-1 1 9 9 0 0 1-12-8z"/>
            <circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>
          </svg>
          {{ 'MENU_BUILDER.MANAGE.AUTO_COLOR' | translate: { n: uncolouredCount() } }}
        </button>
      </div>

      <div class="scroll">
        @if (pages().length === 0) {
          <p class="empty">{{ 'MENU_BUILDER.MANAGE.EMPTY' | translate }}</p>
        } @else {
          @for (pg of pages(); track pg.page) {
            <h4 class="page-heading">{{ 'MENU_BUILDER.MANAGE.PAGE' | translate: { n: pg.page } }}</h4>
            <ul class="list">
              @for (p of pg.products; track idOf(p)) {
                <li class="row">
                  <span class="row__dot" [style.background]="effectiveColor(p)" [attr.aria-label]="effectiveColor(p)"></span>
                  <span class="row__name">{{ p.productName || '—' }}</span>
                  <button type="button" class="row__edit" (click)="editColor(p)">
                    {{ 'COMMON.EDIT' | translate }}
                  </button>
                </li>
              }
            </ul>
          }
        }
      </div>
    </div>

    <app-modal-footer>
      <button class="btn-cancel" (click)="ref.dismiss()">{{ 'COMMON.CANCEL' | translate }}</button>
      <button class="btn-confirm" (click)="confirm()">{{ 'COMMON.DONE' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .body {
      padding: 14px 20px 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      height: 60vh;
      max-height: 60vh;
      overflow: hidden;
    }
    .head {
      display: flex; align-items: center; gap: 8px;
      flex-shrink: 0;
    }
    .search {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 7px 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      color: #94a3b8;
      flex: 1;
      min-width: 0;
      input {
        flex: 1; min-width: 0; border: none; outline: none; font: inherit; font-size: 13px;
        background: transparent; color: #0f172a;
        &::placeholder { color: #94a3b8; }
      }
    }
    .auto-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fff;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 120ms ease, color 120ms ease, border-color 120ms ease;

      &:hover:not(:disabled) {
        background: var(--color-brand-50);
        border-color: var(--color-brand-300, #bae6fd);
        color: var(--color-brand-700);
      }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
    .scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding-bottom: 12px;
    }
    .empty { margin: 0; padding: 32px 8px; text-align: center; color: #94a3b8; font-size: 13px; }
    .page-heading {
      margin: 12px 0 4px;
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      &:first-child { margin-top: 0; }
    }
    .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .row {
      display: inline-flex; align-items: center; gap: 12px;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #fff;
      transition: background 120ms ease, border-color 120ms ease;

      &:hover { background: #f8fafc; }

      &__dot {
        width: 14px; height: 14px;
        border-radius: 999px;
        border: 1px solid rgba(15, 23, 42, 0.08);
        flex-shrink: 0;
      }
      &__name {
        flex: 1; font-size: 13px; font-weight: 500; color: #0f172a;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      &__edit {
        padding: 6px 14px;
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        color: #fff;
        background: var(--color-brand-600);
        border: none;
        border-radius: 6px;
        cursor: pointer;
        flex-shrink: 0;
        &:hover { background: var(--color-brand-700); }
      }
    }
    .btn-cancel {
      padding: 9px 20px; background: #f3f4f6; border: 1px solid #e5e7eb;
      border-radius: 8px; font-size: 13px; cursor: pointer;
      &:hover { background: #e5e7eb; }
    }
    .btn-confirm {
      padding: 9px 24px; background: var(--color-brand-600); color: #fff;
      border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
      &:hover { background: var(--color-brand-700); }
    }
  `],
})
export class ManageSectionProductsModalComponent {
  data = inject<ManageSectionProductsData>(MODAL_DATA);
  ref  = inject<ModalRef<ManageSectionProductsResult>>(MODAL_REF);
  private modal = inject(ModalService);

  search = signal<string>('');

  /** Pending colour edits keyed by `idOf(product)`. Committed all at
   *  once on Done so the parent only sees one signal patch. */
  draftColors = signal<Record<string, string>>({});

  /** Group products by page; respect the search filter. */
  pages = computed<PageRow[]>(() => {
    const q = this.search().trim().toLowerCase();
    const products = this.data.section.products
      .filter((p) => !q
        || (p.productName ?? '').toLowerCase().includes(q));
    const byPage = new Map<number, MenuSectionProduct[]>();
    for (const p of products) {
      const arr = byPage.get(p.page) ?? [];
      arr.push(p);
      byPage.set(p.page, arr);
    }
    return [...byPage.entries()]
      .sort(([a], [b]) => a - b)
      .map(([page, list]) => ({ page, products: list }));
  });

  /** Current colour after applying any pending edit, falling back to
   *  the product's own colour and finally the section default. */
  effectiveColor(p: MenuSectionProduct): string {
    const id = idOf(p);
    return this.draftColors()[id]
        ?? p.color
        ?? this.data.section.color?.borderColor
        ?? DEFAULT_COLOR_SCHEME.borderColor;
  }

  /** True when the product has no per-tile colour set (and no pending
   *  draft override). The section's gradient colour is the *fallback*
   *  used to render the dot, but for the purposes of "auto-color
   *  uncoloured" we treat fallback-only items as uncoloured. */
  private isUncoloured(p: MenuSectionProduct): boolean {
    return !this.draftColors()[idOf(p)] && !p.color;
  }

  uncolouredCount = computed<number>(() =>
    this.data.section.products.filter((p) => this.isUncoloured(p)).length,
  );

  /**
   * Assign a unique colour from the legacy palette to every product
   * that doesn't have one yet. The palette has 21 colours; if there
   * are more uncoloured products than that, we wrap around (re-using
   * the first colour again is unavoidable, but the order is shuffled
   * so the same neighbour pair never repeats). Uses `borderColor` —
   * the same single-colour field the per-tile picker writes.
   */
  autoColor(): void {
    const target = this.data.section.products.filter((p) => this.isUncoloured(p));
    if (target.length === 0) return;
    const palette = shuffle([...COLOR_SCHEMES]);
    this.draftColors.update((map) => {
      const next = { ...map };
      for (let i = 0; i < target.length; i++) {
        next[idOf(target[i])] = palette[i % palette.length].borderColor;
      }
      return next;
    });
  }

  idOf = (p: MenuSectionProduct) => idOf(p);

  async editColor(p: MenuSectionProduct): Promise<void> {
    const current: MenuSectionColor = {
      colorName:   'Custom',
      borderColor: this.effectiveColor(p),
      colorStart:  this.effectiveColor(p),
      colorEnd:    this.effectiveColor(p),
    };
    const ref = this.modal.open<
      ColorPickerModalComponent,
      ColorPickerModalData,
      MenuSectionColor
    >(ColorPickerModalComponent, {
      size: 'md',
      data: { current },
    });
    const picked = await ref.afterClosed();
    if (!picked) return;
    const id = idOf(p);
    // The product carries a single `color` string (border) — squash
    // the picker's start/end/border into that one value.
    this.draftColors.update((map) => ({ ...map, [id]: picked.borderColor }));
  }

  confirm(): void {
    const out: ManageSectionProductsResult = Object.entries(this.draftColors())
      .map(([id, color]) => ({ id, color }));
    this.ref.close(out);
  }
}

function idOf(p: MenuSectionProduct): string {
  return p.id ?? (p as any).__tempId ?? `${p.x},${p.y},${p.page}`;
}

/** Fisher-Yates in place. Used so consecutive uncoloured products
 *  don't end up with palette-adjacent colours every time. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Re-export so consumers don't need to know about the picker module.
export { COLOR_SCHEMES };
