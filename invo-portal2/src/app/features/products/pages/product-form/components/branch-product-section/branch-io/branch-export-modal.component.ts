import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

import {
  BranchIoBucket,
  BranchIoKind,
  ExportFormat,
  ExportScope,
  columnsFor,
} from './branch-io.config';

export interface BranchExportData {
  kind: BranchIoKind;
  /** Buckets per scope, prepared by the caller (canonical indexes kept). */
  buckets: Record<ExportScope, BranchIoBucket[]>;
  /** Name of the branch behind the `branch` scope. */
  activeBranchName: string;
  /** How many branches are currently multi-selected in the list. */
  selectedCount: number;
}

export interface BranchExportResult {
  scope:   ExportScope;
  format:  ExportFormat;
  columns: string[];
}

/**
 * Export side of the branch import/export pair. Picks a scope (this
 * branch / the selected branches / all), a format and the columns, then
 * hands the choice back — the section component owns the actual write so
 * the modal stays free of FormArray knowledge.
 */
@Component({
  selector: 'app-branch-export-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="title()"/>

    <div class="bx">
      <!-- Scope -->
      <div class="bx__field">
        <span class="bx__label">{{ 'PRODUCTS.FORM.IO_WHAT_TO_EXPORT' | translate }}</span>
        @for (opt of scopeOptions(); track opt.value) {
          <label class="bx__radio" [class.bx__radio--off]="opt.disabled">
            <input type="radio" name="scope" [value]="opt.value"
                   [checked]="scope() === opt.value"
                   [disabled]="opt.disabled"
                   (change)="scope.set(opt.value)"/>
            <span>{{ opt.label }}</span>
            <span class="bx__count">{{ opt.count }}</span>
          </label>
        }
      </div>

      <!-- Format -->
      <div class="bx__field">
        <span class="bx__label">{{ 'PRODUCTS.FORM.IO_FORMAT' | translate }}</span>
        <div class="bx__inline">
          <label class="bx__radio">
            <input type="radio" name="fmt" [checked]="format() === 'csv'" (change)="format.set('csv')"/>
            <span>CSV</span>
          </label>
          <label class="bx__radio">
            <input type="radio" name="fmt" [checked]="format() === 'xlsx'" (change)="format.set('xlsx')"/>
            <span>Excel (.xlsx)</span>
          </label>
        </div>
      </div>

      <!-- Columns -->
      <div class="bx__field">
        <span class="bx__label">{{ 'PRODUCTS.FORM.IO_COLUMNS' | translate }}</span>
        <div class="bx__cols">
          @for (col of allColumns; track col.key) {
            <label class="bx__check">
              <input type="checkbox"
                     [checked]="isOn(col.key)"
                     [disabled]="required.includes(col.key)"
                     (change)="toggle(col.key)"/>
              <span>{{ col.label | translate }}</span>
            </label>
          }
        </div>
      </div>

      <p class="bx__note">
        {{ 'PRODUCTS.FORM.IO_EXPORT_SUMMARY' | translate: { rows: rowCount(), branches: branchCount() } }}
        @if (kind === 'batches') {
          <span class="bx__note-strong">{{ 'PRODUCTS.FORM.IO_EXPORT_ID_NOTE' | translate }}</span>
        } @else {
          <span class="bx__note-strong">{{ 'PRODUCTS.FORM.IO_EXPORT_SERIAL_NOTE' | translate }}</span>
        }
      </p>
    </div>

    <app-modal-footer>
      <button type="button" class="btn btn-ghost" (click)="ref.close()">
        {{ 'COMMON.CANCEL' | translate }}
      </button>
      <button type="button" class="btn btn-primary" [disabled]="!rowCount()" (click)="confirm()">
        {{ 'PRODUCTS.FORM.IO_EXPORT' | translate }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .bx { padding: 18px; display: flex; flex-direction: column; gap: 18px; }
    .bx__field { display: flex; flex-direction: column; gap: 6px; }
    .bx__label { font-size: 12px; font-weight: 600; color: #64748b; }
    .bx__inline { display: flex; gap: 18px; }
    .bx__radio, .bx__check {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; color: #334155; cursor: pointer; padding: 3px 0;
    }
    .bx__radio--off { opacity: .45; cursor: not-allowed; }
    .bx__count { margin-inline-start: auto; font-size: 12px; color: #94a3b8; }
    .bx__cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 4px 14px; }
    .bx__note {
      margin: 0; padding: 10px 12px; border-radius: 8px;
      background: #eff6ff; color: #1e40af; font-size: 12px; line-height: 1.6;
    }
    .bx__note-strong { display: block; margin-top: 4px; }
  `],
})
export class BranchExportModalComponent {
  data = inject<BranchExportData>(MODAL_DATA);
  ref  = inject<ModalRef<BranchExportResult | undefined>>(MODAL_REF);
  private translate = inject(TranslateService);

  readonly kind = this.data.kind;
  readonly allColumns = columnsFor(this.kind);
  /** Always-on columns — the key that identifies the row. */
  readonly required = this.kind === 'serials' ? ['serial'] : ['batch', 'onHand'];

  scope   = signal<ExportScope>('branch');
  format  = signal<ExportFormat>('csv');
  picked  = signal<Set<string>>(new Set(this.allColumns.map(c => c.key)));

  title = computed(() =>
    this.translate.instant(
      this.kind === 'serials'
        ? 'PRODUCTS.FORM.IO_EXPORT_SERIALS'
        : 'PRODUCTS.FORM.IO_EXPORT_BATCHES',
    ),
  );

  scopeOptions = computed(() => {
    const b = this.data.buckets;
    return [
      {
        value: 'branch' as ExportScope,
        label: this.translate.instant('PRODUCTS.FORM.IO_SCOPE_BRANCH', { name: this.data.activeBranchName }),
        count: countRows(b.branch), disabled: false,
      },
      {
        value: 'selected' as ExportScope,
        label: this.translate.instant('PRODUCTS.FORM.IO_SCOPE_SELECTED', { count: this.data.selectedCount }),
        count: countRows(b.selected), disabled: this.data.selectedCount === 0,
      },
      {
        value: 'all' as ExportScope,
        label: this.translate.instant('PRODUCTS.FORM.IO_SCOPE_ALL'),
        count: countRows(b.all), disabled: false,
      },
    ];
  });

  rowCount    = computed(() => countRows(this.data.buckets[this.scope()]));
  branchCount = computed(() => this.data.buckets[this.scope()].length);

  isOn(key: string): boolean {
    return this.required.includes(key) || this.picked().has(key);
  }

  toggle(key: string): void {
    if (this.required.includes(key)) return;
    this.picked.update((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  confirm(): void {
    // Keep schema order so the file always reads the same way.
    const columns = this.allColumns.map(c => c.key).filter(k => this.isOn(k));
    this.ref.close({ scope: this.scope(), format: this.format(), columns });
  }
}

function countRows(buckets: BranchIoBucket[]): number {
  return buckets.reduce((n, b) => n + b.rows.length, 0);
}
