import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

export type TablePreset = 'plain' | 'header' | 'striped' | 'minimal' | 'borderless';
export interface AddTableResult { cols: number; rows: number; preset: TablePreset; }

const MAX_COLS = 10;
const MAX_ROWS = 8;

/** "Add a table" dialog — Columns / Rows steppers kept in sync with a
 *  hover-to-size visual grid (Wix-style). Returns { cols, rows }. */
@Component({
  selector: 'app-add-table-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'BLOG.COMPOSER.TABLE_MODAL_TITLE' | translate" />

    <div class="tm__body">
      <div class="tm__fields">
        <label class="tm__field">
          <span class="tm__label">{{ 'BLOG.COMPOSER.TABLE_COLUMNS' | translate }}</span>
          <input type="number" min="1" [max]="maxCols" class="tm__input"
                 [ngModel]="cols()" (ngModelChange)="setCols($event)"/>
        </label>
        <label class="tm__field">
          <span class="tm__label">{{ 'BLOG.COMPOSER.TABLE_ROWS' | translate }}</span>
          <input type="number" min="1" [max]="maxRows" class="tm__input"
                 [ngModel]="rows()" (ngModelChange)="setRows($event)"/>
        </label>
      </div>

      <div class="tm__grid" (mouseleave)="hover.set(null)">
        @for (r of rowsArr; track r) {
          <div class="tm__gridRow">
            @for (c of colsArr; track c) {
              <span class="tm__cell" [class.is-on]="isOn(r, c)"
                    (mouseenter)="hover.set({ r, c })"
                    (click)="commit(r, c)"></span>
            }
          </div>
        }
      </div>

      <div class="tm__presets">
        <span class="tm__label">{{ 'BLOG.COMPOSER.TABLE_STYLE' | translate }}</span>
        <div class="tm__presetRow">
          @for (p of presets; track p.id) {
            <button type="button" class="tm__preset" [class.is-on]="preset() === p.id"
                    (click)="preset.set(p.id)" [title]="p.name">
              <span class="tm__thumb tm__thumb--{{ p.id }}">
                <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
              </span>
              <span class="tm__presetName">{{ p.name }}</span>
            </button>
          }
        </div>
      </div>
    </div>

    <app-modal-footer>
      <button class="tm__btn tm__btn--ghost" (click)="ref.dismiss()">{{ 'COMMON.CANCEL' | translate }}</button>
      <button class="tm__btn tm__btn--primary" (click)="add()">{{ 'BLOG.COMPOSER.TABLE_ADD' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .tm__body { padding: 16px 20px 8px; display: flex; flex-direction: column; gap: 16px; }
    .tm__fields { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .tm__field { display: flex; flex-direction: column; gap: 6px; }
    .tm__label { font-size: 13px; color: #475569; }
    .tm__input {
      width: 100%; padding: 9px 12px; font: inherit; font-size: 14px;
      border: 1px solid #e2e8f0; border-radius: 8px; color: #0f172a; box-sizing: border-box;
    }
    .tm__input:focus { outline: none; border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.15); }
    .tm__grid { display: flex; flex-direction: column; gap: 4px; padding: 4px 0; }
    .tm__gridRow { display: flex; gap: 4px; }
    .tm__cell {
      width: 30px; height: 30px; border: 1px solid #e2e8f0; border-radius: 4px;
      background: #fff; cursor: pointer; transition: background .08s, border-color .08s;
    }
    .tm__cell:hover { border-color: #c7d2da; }
    .tm__cell.is-on { background: #dbe7fb; border-color: #b6cdf3; }
    /* Presets */
    .tm__presets { display: flex; flex-direction: column; gap: 8px; }
    .tm__presetRow { display: flex; gap: 8px; flex-wrap: wrap; }
    .tm__preset {
      display: flex; flex-direction: column; align-items: center; gap: 5px;
      padding: 6px; border: 1.5px solid #e2e8f0; border-radius: 8px; background: #fff; cursor: pointer;
    }
    .tm__preset:hover { border-color: #c7d2da; }
    .tm__preset.is-on { border-color: #32acc1; background: #f0fafc; }
    .tm__presetName { font-size: 11px; color: #475569; }
    /* Mini table thumbnail — 3×3 cells styled per preset. */
    .tm__thumb { display: grid; grid-template-columns: repeat(3, 1fr); width: 48px; height: 36px; gap: 0; }
    .tm__thumb i { display: block; box-sizing: border-box; }
    .tm__thumb--plain i      { border: 0.5px solid #94a3b8; }
    .tm__thumb--header i     { border: 0.5px solid #cbd5e1; }
    .tm__thumb--header i:nth-child(-n+3) { background: #94a3b8; }
    .tm__thumb--striped i    { border: 0.5px solid #e2e8f0; }
    .tm__thumb--striped i:nth-child(n+4):nth-child(-n+6) { background: #e2e8f0; }
    .tm__thumb--minimal i    { border-bottom: 1px solid #94a3b8; }
    .tm__thumb--borderless i { border: 0.5px solid #f1f5f9; }
    .tm__btn { padding: 8px 20px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
    .tm__btn--ghost { background: #d4eef3; color: #0e7490; }
    .tm__btn--ghost:hover { background: #b9e4ec; }
    .tm__btn--primary { background: #32acc1; color: #fff; }
    .tm__btn--primary:hover { background: #2a93a6; }
  `],
})
export class AddTableModalComponent {
  ref = inject<ModalRef<AddTableResult | undefined>>(MODAL_REF);

  readonly maxCols = MAX_COLS;
  readonly maxRows = MAX_ROWS;
  readonly colsArr = Array.from({ length: MAX_COLS }, (_, i) => i + 1);
  readonly rowsArr = Array.from({ length: MAX_ROWS }, (_, i) => i + 1);

  cols  = signal(4);
  rows  = signal(4);
  preset = signal<TablePreset>('plain');
  /** Hovered cell (1-based) — drives the live grid preview. */
  hover = signal<{ r: number; c: number } | null>(null);

  readonly presets: { id: TablePreset; name: string }[] = [
    { id: 'plain',      name: 'Plain' },
    { id: 'header',     name: 'Header' },
    { id: 'striped',    name: 'Striped' },
    { id: 'minimal',    name: 'Lines' },
    { id: 'borderless', name: 'Clean' },
  ];

  /** Effective highlighted size: the hover preview when hovering, else
   *  the committed cols/rows. */
  private size = computed(() => {
    const h = this.hover();
    return h ? { c: h.c, r: h.r } : { c: this.cols(), r: this.rows() };
  });

  isOn(r: number, c: number): boolean {
    const s = this.size();
    return r <= s.r && c <= s.c;
  }

  setCols(v: number): void { this.cols.set(this.clamp(v, MAX_COLS)); }
  setRows(v: number): void { this.rows.set(this.clamp(v, MAX_ROWS)); }

  commit(r: number, c: number): void {
    this.cols.set(c);
    this.rows.set(r);
    this.add();
  }

  add(): void { this.ref.close({ cols: this.cols(), rows: this.rows(), preset: this.preset() }); }

  private clamp(v: number, max: number): number {
    const n = Math.round(Number(v) || 1);
    return Math.max(1, Math.min(max, n));
  }
}
