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
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';

/** One editable field offered by the bulk editor. The caller decides which
 *  ones exist (visibility + privilege gating lives in the section). */
export interface BulkEditField {
  /** FormGroup control name the value is patched into. */
  key:   string;
  /** i18n key for the row label. */
  label: string;
  type:  'toggle' | 'number';
  /** Value the control starts on when the row is enabled. */
  value: boolean | number;
}

/** A branch the edit can target. `index` is the canonical FormArray index. */
export interface BulkEditBranch {
  index: number;
  name:  string;
}

export interface BulkEditData {
  /** Every branch, in list order — the picker lives in here now. */
  branches: BulkEditBranch[];
  /** Ticked when the modal opens (the branch the user has open). */
  preselected: number[];
  /** Source of the "copy settings from" mode — the active branch. */
  sourceIndex: number;
  sourceName:  string;
  fields: BulkEditField[];
}

export type BulkEditMode = 'fields' | 'copy';

export interface BulkEditResult {
  /** Canonical FormArray indexes to write to. Never empty. */
  targets: number[];
  mode:    BulkEditMode;
  /** Only the rows the user ticked — untouched fields stay untouched.
   *  Absent in `copy` mode, where the source branch supplies the values. */
  patch?:  Record<string, boolean | number>;
}

/**
 * Bulk edit for branches.
 *
 * Both halves of the operation live here: *which* branches to write to
 * (the checkbox list at the top) and *what* to write — either a set of
 * opt-in field values, or a straight copy of the active branch's settings.
 * The list behind the modal has no selection mode at all; the action is
 * always available and self-contained.
 *
 * Every field row is opt-in: a field with its checkbox off is not written
 * at all, so a bulk change can't silently reset something you didn't mean
 * to touch.
 */
@Component({
  selector: 'app-branch-bulk-edit-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    ToggleComponent,
    SegmentedToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'PRODUCTS.FORM.BULK_EDIT_TITLE' | translate"/>

    <div class="be">
      <!-- ── What to apply ── -->
      <app-segmented-toggle
        [options]="modeOptions()"
        [value]="mode()"
        size="sm"
        (valueChange)="setMode($any($event))"/>

      <!-- Two columns: who it lands on (left) and what lands (right). Both
           halves scroll independently so a long branch list never pushes the
           fields out of reach. Stacks below 720px. -->
      <div class="be__cols">
        <!-- ── Which branches ── -->
        <section class="be__col be__col--pick">
          <div class="be__col-head">
            <span class="be__section">{{ 'PRODUCTS.FORM.BULK_EDIT_TARGETS' | translate }}</span>
            <button type="button" class="be__link" (click)="toggleAll()">
              {{ (allPicked() ? 'PRODUCTS.FORM.CLEAR_SELECTION' : 'PRODUCTS.FORM.BULK_EDIT_SELECT_ALL') | translate }}
            </button>
          </div>

          <input type="search"
                 class="be__search"
                 [value]="search()"
                 [attr.aria-label]="'PRODUCTS.FORM.SEARCH_BRANCHES' | translate"
                 [placeholder]="'PRODUCTS.FORM.SEARCH_BRANCHES' | translate"
                 (input)="search.set($any($event.target).value)"/>

          <div class="be__list">
            @for (b of visibleBranches(); track b.index) {
              <label class="be__branch" [class.be__branch--on]="isPicked(b.index)">
                <input type="checkbox"
                       class="be__check"
                       [checked]="isPicked(b.index)"
                       (change)="togglePick(b.index)"/>
                <span class="be__branch-name">{{ b.name }}</span>
                @if (b.index === data.sourceIndex) {
                  <span class="be__tag">{{ 'PRODUCTS.FORM.BULK_EDIT_SOURCE_TAG' | translate }}</span>
                }
              </label>
            } @empty {
              <p class="be__empty">{{ 'PRODUCTS.FORM.NO_BRANCHES_MATCH' | translate }}</p>
            }
          </div>
        </section>

        <!-- ── Fields ── -->
        <section class="be__col be__col--fields">
          @if (mode() === 'fields') {
            <div class="be__col-head">
              <span class="be__section">{{ 'PRODUCTS.FORM.BULK_EDIT_FIELDS_LABEL' | translate }}</span>
            </div>
            <p class="be__hint">{{ 'PRODUCTS.FORM.BULK_EDIT_HINT' | translate: { count: targetCount() } }}</p>

            <div class="be__rows">
              @for (f of data.fields; track f.key) {
                <label class="be__row" [class.be__row--on]="isOn(f.key)">
                  <input type="checkbox"
                         class="be__check"
                         [checked]="isOn(f.key)"
                         (change)="toggleField(f.key)"/>
                  <span class="be__label">{{ f.label | translate }}</span>

                  <span class="be__control">
                    @if (f.type === 'toggle') {
                      <app-toggle
                        [checked]="$any(valueOf(f.key))"
                        [disabled]="!isOn(f.key)"
                        (checkedChange)="setValue(f.key, $event)"/>
                    } @else {
                      <input type="number"
                             class="be__num"
                             min="0"
                             [disabled]="!isOn(f.key)"
                             [value]="valueOf(f.key)"
                             (input)="setValue(f.key, $any($event.target).value)"/>
                    }
                  </span>
                </label>
              }
            </div>
          } @else {
            <div class="be__col-head">
              <span class="be__section">{{ 'PRODUCTS.FORM.BULK_EDIT_WHAT_COPIES' | translate }}</span>
            </div>
            <p class="be__note">
              {{ 'PRODUCTS.FORM.BULK_COPY_HINT' | translate: { name: data.sourceName } }}
            </p>
          }
        </section>
      </div>
    </div>

    <app-modal-footer>
      <button type="button" class="btn btn-ghost" (click)="ref.close()">
        {{ 'COMMON.CANCEL' | translate }}
      </button>
      <button type="button" class="btn btn-primary" [disabled]="!canApply()" (click)="apply()">
        {{ applyLabelKey() | translate: { count: targetCount() } }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .be { padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; }
    .be__hint { margin: 0; font-size: 12.5px; color: #64748b; }

    /* ── Two-column body ── */
    .be__cols {
      display: grid;
      grid-template-columns: minmax(0, 300px) minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }
    .be__col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    /* Both columns cap at the same height so the modal never grows past the
       viewport on a company with dozens of branches. */
    .be__col--fields .be__rows,
    .be__col--pick   .be__list { max-height: 320px; overflow-y: auto; }
    .be__col-head { display: flex; align-items: center; gap: 8px; min-height: 20px; }
    .be__section { flex: 1; font-size: 12px; font-weight: 600; color: #64748b; }
    .be__link {
      background: none; border: 0; padding: 0; font: inherit; font-size: 12px;
      color: #0f7c8c; text-decoration: underline; cursor: pointer;
    }
    .be__link:hover { color: #0b5c68; }
    .be__search {
      width: 100%; padding: 6px 9px; font-size: 13px;
      border: 1px solid #dbe2ea; border-radius: 7px; background: #fff; color: #1e293b;
    }
    .be__search:focus { outline: 2px solid #32acc1; outline-offset: 1px; }
    .be__list { border: 1px solid #eef2f7; border-radius: 8px; background: #fff; }
    .be__branch {
      display: flex; align-items: center; gap: 9px;
      padding: 7px 10px; font-size: 13px; color: #334155; cursor: pointer;
      border-bottom: 1px solid #f4f6fa;
    }
    .be__branch:last-child { border-bottom: 0; }
    .be__branch:hover { background: #f8fafc; }
    .be__branch--on { background: #f4fbfc; }
    .be__branch-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .be__tag {
      flex: none; padding: 1px 7px; border-radius: 999px;
      background: #e2f6f9; color: #0f7c8c; font-size: 11px; font-weight: 600;
    }
    .be__empty { margin: 0; padding: 14px 10px; text-align: center; font-size: 12.5px; color: #94a3b8; }
    .be__note {
      margin: 0; padding: 10px 12px; border-radius: 8px;
      background: #eff6ff; color: #1e40af; font-size: 12.5px; line-height: 1.6;
    }

    /* ── Field rows ── */
    .be__rows { display: flex; flex-direction: column; gap: 2px; padding-inline-end: 2px; }
    .be__row {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 10px; border: 1px solid #eef2f7; border-radius: 8px;
      cursor: pointer; background: #fff;
    }
    .be__row--on { border-color: #a5dde6; background: #f4fbfc; }
    .be__check { width: 16px; height: 16px; accent-color: #32acc1; cursor: pointer; flex: none; }
    .be__label { flex: 1; min-width: 0; font-size: 13px; color: #1e293b; }
    .be__control { display: inline-flex; align-items: center; }
    .be__num {
      width: 110px; padding: 6px 8px; font-size: 13px;
      border: 1px solid #dbe2ea; border-radius: 6px; background: #fff; color: #1e293b;
    }
    .be__num:focus { outline: 2px solid #32acc1; outline-offset: 1px; }
    .be__num:disabled { background: #f8fafc; color: #94a3b8; }

    /* Side by side stops paying off once each column is too narrow to hold
       a label and its control on one line. */
    @media (max-width: 720px) {
      .be__cols { grid-template-columns: minmax(0, 1fr); gap: 16px; }
      .be__col--fields .be__rows,
      .be__col--pick   .be__list { max-height: 220px; }
    }
  `],
})
export class BranchBulkEditModalComponent {
  data = inject<BulkEditData>(MODAL_DATA);
  ref  = inject<ModalRef<BulkEditResult | undefined>>(MODAL_REF);
  private translate = inject(TranslateService);

  /** With no editable fields on offer (everything hidden by field options
   *  or privileges) copying is the only thing left to do. */
  mode = signal<BulkEditMode>(this.data.fields.length ? 'fields' : 'copy');

  /** Branch indexes the edit will be written to. */
  private picked = signal<Set<number>>(new Set(this.data.preselected));
  search = signal<string>('');

  /** Control names the user opted into. */
  enabled = signal<Set<string>>(new Set());
  /** Working values, seeded from the field defs. */
  private values = signal<Record<string, boolean | number>>(
    Object.fromEntries(this.data.fields.map(f => [f.key, f.value])),
  );

  modeOptions = computed<SegmentedToggleOption<BulkEditMode>[]>(() => [
    {
      value: 'fields',
      label: 'PRODUCTS.FORM.BULK_EDIT_MODE_FIELDS',
      // `disabled` hides the segment — nothing to set means nothing to show.
      disabled: !this.data.fields.length,
    },
    {
      value: 'copy',
      // The label carries the source branch name, so it's resolved here
      // rather than through the option's own `translate` pipe.
      label: this.translate.instant('PRODUCTS.FORM.BULK_COPY_FROM', { name: this.data.sourceName }),
      translate: false,
    },
  ]);

  /** Copying onto the source branch is a no-op — it isn't offered. */
  private selectableBranches = computed<BulkEditBranch[]>(() =>
    this.mode() === 'copy'
      ? this.data.branches.filter(b => b.index !== this.data.sourceIndex)
      : this.data.branches,
  );

  visibleBranches = computed<BulkEditBranch[]>(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.selectableBranches();
    return term ? list.filter(b => b.name.toLowerCase().includes(term)) : list;
  });

  /** Only branches the current mode can actually write to count as targets. */
  private effectiveTargets = computed<number[]>(() => {
    const picked = this.picked();
    return this.selectableBranches().filter(b => picked.has(b.index)).map(b => b.index);
  });

  targetCount = computed<number>(() => this.effectiveTargets().length);

  /** "Select all" applies to what's on screen — the filtered list. */
  allPicked = computed<boolean>(() => {
    const vis = this.visibleBranches();
    if (!vis.length) return false;
    const picked = this.picked();
    return vis.every(b => picked.has(b.index));
  });

  /** ngx-translate has no plural rules — one key per form. */
  applyLabelKey = computed<string>(() => {
    const one = this.targetCount() === 1;
    if (this.mode() === 'copy') {
      return one ? 'PRODUCTS.FORM.BULK_COPY_APPLY_ONE' : 'PRODUCTS.FORM.BULK_COPY_APPLY';
    }
    return one ? 'PRODUCTS.FORM.BULK_EDIT_APPLY_ONE' : 'PRODUCTS.FORM.BULK_EDIT_APPLY';
  });

  canApply = computed<boolean>(() =>
    this.targetCount() > 0 && (this.mode() === 'copy' || this.enabled().size > 0),
  );

  setMode(mode: BulkEditMode): void { this.mode.set(mode); }

  isPicked(index: number): boolean { return this.picked().has(index); }

  togglePick(index: number): void {
    this.picked.update((s) => {
      const next = new Set(s);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }

  toggleAll(): void {
    const vis = this.visibleBranches();
    const clear = this.allPicked();
    this.picked.update((s) => {
      const next = new Set(s);
      vis.forEach(b => clear ? next.delete(b.index) : next.add(b.index));
      return next;
    });
  }

  isOn(key: string): boolean { return this.enabled().has(key); }
  valueOf(key: string): boolean | number { return this.values()[key]; }

  toggleField(key: string): void {
    this.enabled.update((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  setValue(key: string, value: boolean | string): void {
    const field = this.data.fields.find(f => f.key === key);
    const parsed = field?.type === 'number' ? Number(value) : !!value;
    this.values.update(v => ({ ...v, [key]: parsed as boolean | number }));
    // Touching a control implies you want it applied.
    if (!this.isOn(key)) this.toggleField(key);
  }

  apply(): void {
    const targets = this.effectiveTargets();
    if (!targets.length) return;

    if (this.mode() === 'copy') {
      this.ref.close({ targets, mode: 'copy' });
      return;
    }

    const patch: Record<string, boolean | number> = {};
    for (const key of this.enabled()) {
      const value = this.values()[key];
      const field = this.data.fields.find(f => f.key === key);
      // A blank / non-numeric number field would patch NaN — skip it.
      if (field?.type === 'number' && !Number.isFinite(Number(value))) continue;
      patch[key] = value;
    }
    this.ref.close(Object.keys(patch).length ? { targets, mode: 'fields', patch } : undefined);
  }
}
