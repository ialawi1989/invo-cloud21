import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { AccountService } from '../../../services/account.service';
import { ACCOUNT_TYPES, findAccountType, accountTypeKey } from '../../../utils/account-types';

export interface AccountsBulkEditData {
  /** How many rows are selected (shown in the hint). */
  count: number;
  /** The single type shared by every selected row, or `null` when the
   *  selection mixes types (used to seed the parent-account options when
   *  the user isn't also changing the type). */
  commonType: string | null;
}

export interface AccountsBulkEditResult {
  /** New account type to apply (parent-type is derived). Omitted = unchanged. */
  type?: string;
  /** New parent account id to roll selected accounts under. Omitted = unchanged. */
  parentId?: string;
}

interface TypeOption   { id: string; name: string; parentType: string; }
interface ParentOption { id: string; name: string; }

/**
 * accounts-bulk-edit-modal
 * ────────────────────────
 * Apply shared changes to several accounts at once: set the Type (parent
 * type follows automatically) and/or roll them under a Parent account.
 * Only the fields the user fills are applied; empty fields are left
 * untouched on each record.
 */
@Component({
  selector: 'app-accounts-bulk-edit-modal',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'CHART_OF_ACCOUNTS.BULK.TITLE' | translate" />

    <div class="body">
      <p class="hint">
        {{ 'CHART_OF_ACCOUNTS.BULK.HINT' | translate: { count: data.count } }}
      </p>

      <!-- Type -->
      <div class="field">
        <label class="lbl">{{ 'CHART_OF_ACCOUNTS.LIST.TYPE' | translate }}</label>
        <app-search-dropdown
          [items]="typeOptions"
          [displayWith]="typeDisplay"
          [compareWith]="typeCompare"
          [value]="selectedType()"
          [placeholder]="'CHART_OF_ACCOUNTS.BULK.KEEP_UNCHANGED' | translate"
          (valueChange)="onTypePick($any($event))" />
        @if (derivedParentType()) {
          <p class="field-hint">
            {{ 'CHART_OF_ACCOUNTS.LIST.PARENT_TYPE' | translate }}: <b>{{ derivedParentType() }}</b>
          </p>
        }
      </div>

      <!-- Parent account -->
      <div class="field">
        <label class="lbl">{{ 'CHART_OF_ACCOUNTS.BULK.PARENT_ACCOUNT' | translate }}</label>
        <app-search-dropdown
          [items]="parentOptions()"
          [displayWith]="parentDisplay"
          [compareWith]="parentCompare"
          [value]="selectedParent()"
          [disabled]="!effectiveType() || parentLoading()"
          [placeholder]="(parentLoading()
            ? 'COMMON.LOADING'
            : (effectiveType() ? 'CHART_OF_ACCOUNTS.BULK.KEEP_UNCHANGED' : 'CHART_OF_ACCOUNTS.BULK.PARENT_NEED_TYPE')) | translate"
          (valueChange)="onParentPick($any($event))" />
      </div>
    </div>

    <app-modal-footer>
      <button type="button" class="btn-cancel" (click)="cancel()">
        {{ 'COMMON.CANCEL' | translate }}
      </button>
      <button type="button" class="btn-save" [disabled]="!canSave()" (click)="save()">
        {{ 'COMMON.SAVE' | translate }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .body { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
    .hint { margin: 0; font-size: 13px; color: #64748b; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .lbl { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
    .field-hint { margin: 0; font-size: 12px; color: #94a3b8; b { color: #475569; } }
    .btn-cancel {
      padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
      background: #fff; border: 1px solid #e5e7eb; color: #475569; cursor: pointer;
      &:hover { background: #f8fafc; }
    }
    .btn-save {
      margin-inline-start: 8px;
      padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;
      background: var(--color-brand-600, #2691a4); color: #fff; border: none; cursor: pointer;
      &:hover { background: var(--color-brand-700, #207484); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
  `],
})
export class AccountsBulkEditModalComponent {
  data = inject<AccountsBulkEditData>(MODAL_DATA);
  private ref = inject<ModalRef<AccountsBulkEditResult>>(MODAL_REF);
  private service = inject(AccountService);
  private translate = inject(TranslateService);

  readonly typeOptions: TypeOption[] = ACCOUNT_TYPES.map((t) => ({ id: t.id, name: t.name, parentType: t.parentType }));

  type     = signal<string | null>(null);
  parentId = signal<string | null>(null);
  parentOptions = signal<ParentOption[]>([]);
  parentLoading = signal<boolean>(false);

  /** Translate an account-type value, falling back to the raw string. */
  private label(value: string): string {
    const key = accountTypeKey(value);
    const l = this.translate.instant(key);
    return l && l !== key ? l : value;
  }

  typeDisplay = (o: TypeOption) => (o ? this.label(o.id) : '');
  typeCompare = (a: TypeOption, b: TypeOption) => a?.id === b?.id;
  parentDisplay = (o: ParentOption) => o?.name ?? '';
  parentCompare = (a: ParentOption, b: ParentOption) => a?.id === b?.id;

  selectedType = computed<TypeOption | null>(() => this.typeOptions.find((o) => o.id === this.type()) ?? null);
  selectedParent = computed<ParentOption | null>(() => this.parentOptions().find((o) => o.id === this.parentId()) ?? null);

  /** Type used to source the parent list: the chosen type, else the type
   *  the whole selection already shares. */
  effectiveType = computed<string | null>(() => this.type() ?? this.data.commonType);
  derivedParentType = computed<string>(() => {
    const t = this.type();
    if (!t) return '';
    return this.label(findAccountType(t)?.parentType ?? t);
  });

  canSave = computed<boolean>(() => this.type() != null || this.parentId() != null);

  constructor() {
    // Seed parent options from the selection's shared type (if any).
    if (this.data.commonType) void this.loadParents(this.data.commonType);
  }

  onTypePick(option: TypeOption | TypeOption[] | null): void {
    const opt = Array.isArray(option) ? option[0] ?? null : option;
    this.type.set(opt?.id ?? null);
    this.parentId.set(null);
    void this.loadParents(this.effectiveType());
  }

  onParentPick(option: ParentOption | ParentOption[] | null): void {
    const opt = Array.isArray(option) ? option[0] ?? null : option;
    this.parentId.set(opt?.id ?? null);
  }

  private async loadParents(type: string | null): Promise<void> {
    if (!type) { this.parentOptions.set([]); return; }
    this.parentLoading.set(true);
    try {
      const list = await this.service.getParentsByType(type);
      this.parentOptions.set(list.map((a) => ({ id: a.id, name: a.name })));
    } finally {
      this.parentLoading.set(false);
    }
  }

  save(): void {
    const result: AccountsBulkEditResult = {};
    if (this.type() != null)     result.type = this.type()!;
    if (this.parentId() != null) result.parentId = this.parentId()!;
    this.ref.close(result);
  }

  cancel(): void { this.ref.dismiss(); }
}
