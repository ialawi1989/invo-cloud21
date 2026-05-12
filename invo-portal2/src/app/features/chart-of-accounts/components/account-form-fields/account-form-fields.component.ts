import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { AccountService } from '../../services/account.service';
import { Account } from '../../services/account.types';
import {
  ACCOUNT_TYPES,
  AccountType,
} from '../../utils/account-types';

/**
 * Shared form-field block for editing an Account.
 *
 * Reused by:
 *   • the standalone Chart-of-Accounts form page
 *     (`/account/chart-of-accounts/:id`), and
 *   • the inline "+ Create new account" modal that the
 *     payment-methods form launches from its GL-account picker.
 *
 * Fully controlled — the parent owns the `value` signal and
 * receives the patched account back via `valueChange`. A separate
 * `typeChange` event fires whenever the user picks a different
 * type so the parent can refetch the parent-account list (the
 * legacy `getParentAccountListByType` endpoint is keyed by type).
 *
 * Modes:
 *   • `compact` — drop the optional fields (code, description,
 *     parent) and render a tight 2-field surface for the modal.
 *   • `locked` — gate type editability:
 *       'none'    — fully editable
 *       'type'    — type disabled (saved record / has children)
 *       'all'     — type + name disabled (system default account)
 */
@Component({
  selector: 'app-account-form-fields',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-form-fields.component.html',
  styleUrl:    './account-form-fields.component.scss',
})
export class AccountFormFieldsComponent implements OnChanges {
  private service = inject(AccountService);

  /** The current value to render. Pass the same object back via
   *  `valueChange` after each mutation. */
  @Input({ required: true }) value!: Account;
  /** Hide the optional fields (code/description/parent). Used by
   *  the inline payment-methods modal. */
  @Input() compact = false;
  /** Fine-grained edit gating — see component doc. */
  @Input() locked: 'none' | 'type' | 'all' = 'none';
  /** Translation key for the name placeholder so consumers can
   *  customise it (e.g. "e.g. BHD Cash · Visa POS" in the modal
   *  vs. "e.g. Cash · Bank · Sales" on the form page). */
  @Input() namePlaceholderKey = 'CHART_OF_ACCOUNTS.FIELDS.NAME_PLACEHOLDER';

  /** Emitted on every field change with the patched value. The
   *  parent component is the source of truth for the live state. */
  @Output() valueChange = new EventEmitter<Account>();
  /** Fires when the user picks a different type. Parent should
   *  refetch parent candidates via `getParentsByType()`. */
  @Output() typeChange = new EventEmitter<string>();

  // `<app-search-dropdown>` declares `items` as mutable, so spread
  // the readonly registry into a fresh array. The list is constant
  // at runtime; the spread is for type compatibility only.
  readonly types: AccountType[] = [...ACCOUNT_TYPES];
  /** Sub-account candidates for the Parent dropdown — fetched
   *  internally whenever the type changes, so the parent component
   *  doesn't have to wire it up. Empty until a type is picked. */
  parents = signal<Account[]>([]);
  private parentsForType = signal<string>('');

  // ─── Edit gates ────────────────────────────────────────────────
  nameDisabled = computed<boolean>(() => this.locked === 'all');
  typeDisabled = computed<boolean>(() => this.locked !== 'none');

  // ─── Dropdown adapters ─────────────────────────────────────────
  typeDisplay  = (t: AccountType | null) => t?.name ?? '';
  typeCompare  = (a: AccountType | null, b: AccountType | null) => (a?.id ?? '') === (b?.id ?? '');
  typeToValue  = (t: AccountType | null) => t?.id ?? '';
  selectedType = (): AccountType | null =>
    this.types.find(t => t.id === this.value?.type) ?? null;

  parentDisplay = (a: Account | null) => a?.name ?? '';
  parentCompare = (a: Account | null, b: Account | null) => (a?.id ?? '') === (b?.id ?? '');
  parentToValue = (a: Account | null) => a?.id ?? '';
  selectedParent = (): Account | null => {
    const id = this.value?.parentId;
    if (!id) return null;
    return this.parents().find(p => p.id === id) ?? { ...this.value, id, name: id };
  };

  ngOnChanges(ch: SimpleChanges): void {
    if ('value' in ch && this.value?.type && this.value.type !== this.parentsForType()) {
      void this.loadParents(this.value.type);
    }
  }

  // ─── Field handlers ────────────────────────────────────────────
  setName(name: string): void {
    this.valueChange.emit({ ...this.value, name });
  }
  setType(t: AccountType | AccountType[] | null): void {
    const picked = Array.isArray(t) ? t[0] ?? null : t;
    const id = picked?.id ?? '';
    this.valueChange.emit({
      ...this.value,
      type:       id,
      parentType: picked?.parentType ?? '',
      // Clearing the parent when type changes — the old parent
      // candidates were keyed by the prior type and won't match
      // the new one. The user re-picks if they need a parent.
      parentId:   null,
    });
    this.typeChange.emit(id);
    void this.loadParents(id);
  }
  setCode(code: string): void {
    this.valueChange.emit({ ...this.value, code });
  }
  setDescription(description: string): void {
    this.valueChange.emit({ ...this.value, description });
  }
  setParent(a: Account | Account[] | null): void {
    const picked = Array.isArray(a) ? a[0] ?? null : a;
    this.valueChange.emit({ ...this.value, parentId: picked?.id ?? null });
  }

  private async loadParents(type: string): Promise<void> {
    if (!type) {
      this.parents.set([]);
      this.parentsForType.set('');
      return;
    }
    if (this.parentsForType() === type) return;
    this.parentsForType.set(type);
    try {
      const rows = await this.service.getParentsByType(type);
      // Drop the row being edited from its own parent picker so
      // users can't self-reference.
      const editingId = this.value?.id;
      this.parents.set(editingId ? rows.filter(r => r.id !== editingId) : rows);
    } catch {
      this.parents.set([]);
    }
  }
}
