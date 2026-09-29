import '../../account-i18n';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { ModalRef, ModalService } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { InvoiceOptionsService } from '../../../settings/services/invoice-options.service';
import { CustomFieldsService } from '../../../settings/services/custom-fields.service';
import { CustomField, FIELD_TYPE_CARDS } from '../../../settings/models/custom-field.types';
import { CustomFieldTypeModalComponent } from '../../../settings/components/custom-field-type-modal/custom-field-type-modal.component';

interface InvoiceOptionsForm {
  note: string;
  term: string;
  enableWaste: boolean;
  enableVoidReason: boolean;
  isInvoiceOptionGroupVisible: boolean;
}

const newFieldId = () => 'tmp_' + Math.random().toString(36).slice(2, 10);
const slugify = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 40) || 'field';

/**
 * "Invoice Preferences" drawer, opened from the invoice view's "⋯" menu — a quick-access subset
 * of Settings ➜ Invoice Options (Preferences tab) plus a Fields tab that lets you add, rename,
 * require and remove invoice custom fields right here, without leaving the invoice. Validation
 * rules, options and layout width still need the full manager ("Manage all fields" below the list).
 * "All Preferences" opens the full settings page in a new tab for everything else.
 */
@Component({
  selector: 'app-invoice-preferences-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ToggleComponent],
  template: `
    <div class="ipd">
      <header class="ipd__head">
        <div class="ipd__tabs">
          <button type="button" class="ipd__tab" [class.is-active]="tab() === 'preferences'" (click)="tab.set('preferences')">{{ 'INVOICES.PREFS.PREFERENCES' | translate }}</button>
          <button type="button" class="ipd__tab" [class.is-active]="tab() === 'fields'" (click)="openFieldsTab()">{{ 'INVOICES.PREFS.FIELDS' | translate }}</button>
        </div>
        <a class="ipd__all" href="/settings/invoice-options" target="_blank" rel="noopener">{{ 'INVOICES.PREFS.ALL_PREFERENCES' | translate }}</a>
        <button type="button" class="ipd__close" (click)="ref.close()" aria-label="close">✕</button>
      </header>

      <div class="ipd__body">
        @if (tab() === 'preferences') {
          @if (loading()) {
            <p class="ipd__hint">{{ 'DOC_LINES.LOADING' | translate }}</p>
          } @else {
            <label class="ipd__check">
              <input type="checkbox" [(ngModel)]="form.enableWaste"/>
              {{ 'INVOICES.PREFS.ENABLE_WASTE' | translate }}
            </label>
            <label class="ipd__check">
              <input type="checkbox" [(ngModel)]="form.enableVoidReason"/>
              {{ 'INVOICES.PREFS.ENABLE_VOID_REASON' | translate }}
            </label>
            <label class="ipd__check">
              <input type="checkbox" [(ngModel)]="form.isInvoiceOptionGroupVisible"/>
              {{ 'INVOICES.PREFS.SHOW_OPTION_GROUP' | translate }}
            </label>

            <div class="ipd__field">
              <label>{{ 'INVOICES.PREFS.TERMS_CONDITIONS' | translate }}</label>
              <textarea rows="4" [(ngModel)]="form.term"></textarea>
            </div>
            <div class="ipd__field">
              <label>{{ 'INVOICES.FORM.CUSTOMER_NOTES' | translate }}</label>
              <textarea rows="3" [(ngModel)]="form.note"></textarea>
            </div>
          }
        } @else {
          @if (fieldsLoading()) {
            <p class="ipd__hint">{{ 'DOC_LINES.LOADING' | translate }}</p>
          } @else {
            <p class="ipd__fields-text">{{ 'INVOICES.PREFS.FIELDS_TEXT' | translate }}</p>

            <div class="ipd__fields-list">
              @for (f of fields(); track f.id) {
                <div class="ipd__field-row" [class.is-editing]="editingId() === f.id">
                  @if (editingId() === f.id) {
                    <input class="ipd__field-name" [(ngModel)]="editName" (keydown.enter)="commitEdit()" autofocus/>
                    <label class="ipd__req"><input type="checkbox" [(ngModel)]="editRequired"/> {{ 'COMMON.REQUIRED' | translate }}</label>
                    <button type="button" class="ipd__icon-btn" (click)="commitEdit()" [attr.aria-label]="'COMMON.SAVE' | translate">✓</button>
                    <button type="button" class="ipd__icon-btn" (click)="cancelEdit()" [attr.aria-label]="'COMMON.CANCEL' | translate">✕</button>
                  } @else {
                    <span class="ipd__field-name">{{ f.name || ('INVOICES.PREFS.UNNAMED_FIELD' | translate) }}</span>
                    <span class="ipd__field-type">{{ typeLabel(f.type) | translate }}</span>
                    @if (f.required) { <span class="ipd__req-badge">{{ 'COMMON.REQUIRED' | translate }}</span> }
                    @if (f.system) {
                      <span class="ipd__system-badge">{{ 'INVOICES.PREFS.SYSTEM_FIELD' | translate }}</span>
                    } @else {
                      <button type="button" class="ipd__icon-btn" (click)="startEdit(f)" [attr.aria-label]="'COMMON.EDIT' | translate">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      <button type="button" class="ipd__icon-btn ipd__icon-btn--danger" (click)="removeField(f)" [attr.aria-label]="'COMMON.DELETE' | translate">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                      </button>
                    }
                  }
                </div>
              } @empty {
                <p class="ipd__hint">{{ 'INVOICES.PREFS.NO_FIELDS' | translate }}</p>
              }
            </div>

            <button type="button" class="ipd__add-field" (click)="addField()">+ {{ 'INVOICES.PREFS.ADD_FIELD' | translate }}</button>
            <a class="ipd__manage-all" href="/settings/custom-fields/invoice" target="_blank" rel="noopener">{{ 'INVOICES.PREFS.MANAGE_FIELDS' | translate }}</a>
          }
        }
      </div>

      @if (tab() === 'preferences') {
        <footer class="ipd__footer">
          <button type="button" class="ipd__btn" (click)="ref.close()">{{ 'COMMON.CANCEL' | translate }}</button>
          <button type="button" class="ipd__btn ipd__btn--primary" [disabled]="saving()" (click)="save()">{{ 'COMMON.SAVE' | translate }}</button>
        </footer>
      }
    </div>
  `,
  styles: [`
    .ipd { display: flex; flex-direction: column; height: 100%; }
    .ipd__head { display: flex; align-items: center; gap: 16px; padding: 14px 16px; border-bottom: 1px solid #e4e7ec; }
    .ipd__tabs { display: flex; gap: 20px; }
    .ipd__tab { border: 0; background: none; padding: 4px 0; font-size: 14px; font-weight: 600; color: #64748b; cursor: pointer; border-bottom: 2px solid transparent;
      &.is-active { color: #0f172a; border-bottom-color: #2691a4; } }
    .ipd__all { margin-inline-start: auto; font-size: 13px; font-weight: 600; color: #2691a4; text-decoration: none; &:hover { text-decoration: underline; } }
    .ipd__close { border: 0; background: none; color: #64748b; font-size: 16px; cursor: pointer; padding: 4px; &:hover { color: #0f172a; } }
    .ipd__body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
    .ipd__hint { color: #94a3b8; margin: 0; }
    .ipd__check { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: #334155; }
    .ipd__field { display: flex; flex-direction: column; gap: 6px; }
    .ipd__field label { font-size: 13px; font-weight: 600; color: #334155; }
    .ipd__field textarea { border: 1px solid #d0d5dd; border-radius: 8px; padding: 8px 12px; font: inherit; resize: vertical;
      &:focus { outline: none; border-color: #2691a4; box-shadow: 0 0 0 3px rgba(38, 145, 164, .12); } }

    .ipd__fields-text { margin: 0; font-size: 13px; color: #64748b; }
    .ipd__fields-list { display: flex; flex-direction: column; gap: 4px; }
    .ipd__field-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #e4e7ec; border-radius: 8px; background: #fff;
      &.is-editing { border-color: #2691a4; box-shadow: 0 0 0 3px rgba(38, 145, 164, .12); } }
    .ipd__field-name { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      &:is(input) { border: 1px solid #d0d5dd; border-radius: 6px; padding: 5px 8px; font: inherit; font-weight: 500; } }
    .ipd__field-type { font-size: 11.5px; color: #94a3b8; flex: 0 0 auto; }
    .ipd__req-badge { font-size: 10.5px; font-weight: 700; color: #b45309; background: #fef3c7; border-radius: 999px; padding: 1px 8px; flex: 0 0 auto; }
    .ipd__system-badge { font-size: 10.5px; font-weight: 700; color: #64748b; background: #f1f5f9; border-radius: 999px; padding: 1px 8px; flex: 0 0 auto; }
    .ipd__req { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #475569; flex: 0 0 auto; white-space: nowrap; }
    .ipd__icon-btn { border: 0; background: none; color: #64748b; padding: 3px; cursor: pointer; display: inline-flex; flex: 0 0 auto;
      &:hover { color: #0f172a; } &--danger:hover { color: #dc2626; } }
    .ipd__add-field { align-self: flex-start; border: 1px dashed #cbd5e1; background: #fff; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600; color: #2691a4; cursor: pointer;
      &:hover { background: #f0fafb; } }
    .ipd__manage-all { font-size: 12.5px; color: #64748b; text-decoration: none; &:hover { text-decoration: underline; color: #2691a4; } }

    .ipd__footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 16px; border-top: 1px solid #e4e7ec; }
    .ipd__btn { padding: 9px 16px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-weight: 600; font-size: 13.5px; cursor: pointer;
      &--primary { border-color: #2691a4; background: #2691a4; color: #fff; } &:disabled { opacity: .6; cursor: not-allowed; } }
  `],
})
export class InvoicePreferencesDrawerComponent implements OnInit {
  ref = inject<ModalRef<void>>(MODAL_REF);
  private service = inject(InvoiceOptionsService);
  private company = inject(CompanyService);
  private toast = inject(ToastService);
  private customFields = inject(CustomFieldsService);
  private modal = inject(ModalService);

  tab = signal<'preferences' | 'fields'>('preferences');
  loading = signal(true);
  saving = signal(false);
  form: InvoiceOptionsForm = { note: '', term: '', enableWaste: false, enableVoidReason: false, isInvoiceOptionGroupVisible: false };

  fields = signal<CustomField[]>([]);
  fieldsLoading = signal(false);
  private fieldsLoaded = false;
  editingId = signal<string | null>(null);
  editName = '';
  editRequired = false;

  ngOnInit(): void {
    const opts = this.company.settings()?.invoiceOptions ?? {};
    this.form = {
      note: opts.note ?? '',
      term: opts.term ?? '',
      enableWaste: !!opts.enableWaste,
      enableVoidReason: !!opts.enableVoidReason,
      isInvoiceOptionGroupVisible: !!opts.isInvoiceOptionGroupVisible,
    };
    this.loading.set(false);
  }

  async openFieldsTab(): Promise<void> {
    this.tab.set('fields');
    if (this.fieldsLoaded) return;
    this.fieldsLoading.set(true);
    try {
      const list = await this.customFields.getByType('invoice');
      this.fields.set(list.filter(f => !f.isDeleted));
      this.fieldsLoaded = true;
    } finally {
      this.fieldsLoading.set(false);
    }
  }

  typeLabel(type: string): string {
    return FIELD_TYPE_CARDS.find(c => c.type === type)?.labelKey ?? type;
  }

  startEdit(f: CustomField): void {
    this.editingId.set(f.id);
    this.editName = f.name;
    this.editRequired = f.required;
  }
  cancelEdit(): void { this.editingId.set(null); }

  async commitEdit(): Promise<void> {
    const id = this.editingId();
    if (!id) return;
    const name = this.editName.trim();
    if (!name) { this.toast.error('COMMON.REQUIRED'); return; }
    this.fields.update(list => list.map(f => (f.id === id ? { ...f, name, required: this.editRequired } : f)));
    this.editingId.set(null);
    await this.persistFields();
  }

  async addField(): Promise<void> {
    const type = await this.modal.open<CustomFieldTypeModalComponent, void, any>(CustomFieldTypeModalComponent, { size: 'lg' }).afterClosed();
    if (!type) return;
    const field: CustomField = {
      id: newFieldId(), type, name: '', abbr: slugify(type) + '_' + Date.now().toString(36).slice(-4),
      required: false, gridTemplate: 'col-12', isDeleted: false,
    } as CustomField;
    this.fields.update(list => [...list, field]);
    this.startEdit(field);
  }

  async removeField(f: CustomField): Promise<void> {
    this.fields.update(list => list.filter(x => x.id !== f.id));
    await this.persistFields();
  }

  /** Full field set includes fields not shown here too (deleted / system) — merge instead of overwriting. */
  private async persistFields(): Promise<void> {
    const all = await this.customFields.getByType('invoice');
    const shown = this.fields();
    const shownIds = new Set(shown.map(f => f.id));
    const merged = [...shown, ...all.filter(f => !shownIds.has(f.id))];
    const ok = await this.customFields.save('invoice', merged);
    if (ok) this.toast.success('COMMON.SAVED_OK');
    else this.toast.error('COMMON.SAVE_FAILED');
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const current = this.company.settings() ?? {};
      const res = await this.service.saveCompany({ ...current, invoiceOptions: { ...current.invoiceOptions, ...this.form } });
      if (res?.success) {
        await this.company.loadSettings(true);
        this.toast.success('COMMON.SAVED_OK');
        this.ref.close();
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } finally {
      this.saving.set(false);
    }
  }
}
