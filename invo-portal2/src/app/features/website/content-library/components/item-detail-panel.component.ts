import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MODAL_DATA, MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef, ModalService } from '../../../../shared/modal/modal.service';
import { ContentField, ContentItemTemplate } from '../models/content-library.model';
import { ContentLibraryService } from '../services/content-library.service';
import { Website } from '../../models/website.model';
import { MediaPickerModalComponent, MediaPickerConfig } from '../../../media/components/media-picker';
import { ReferencePickerComponent, RefItem } from './reference-picker.component';

export interface ItemDrawerData {
  item:         Website | null;   // null = new item
  fields:       ContentField[];
  collectionId: string;
}

export interface ItemDrawerResult {
  saved: Website;
}

@Component({
  selector: 'app-item-detail-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, ReferencePickerComponent],
  styles: [`
    :host {
      display: flex; flex-direction: column; height: 100%;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 13px; color: #111827;
    }

    /* Header */
    .dh {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px 14px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0;
    }
    .dh-title { font-size: 15px; font-weight: 600; color: #111827; }
    .dh-close {
      width: 28px; height: 28px; border: none; background: transparent;
      cursor: pointer; border-radius: 6px; display: flex; align-items: center;
      justify-content: center; color: #9ca3af; transition: all .1s;
    }
    .dh-close:hover { background: #f3f4f6; color: #374151; }

    /* Subheader */
    .ds {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 20px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0;
    }
    .ds-label { font-size: 12px; font-weight: 600; color: #374151; }
    .ds-link {
      font-size: 12px; color: #32acc1; cursor: pointer;
      background: none; border: none; font-family: inherit;
    }
    .ds-link:hover { text-decoration: underline; }

    /* Body */
    .db { flex: 1; overflow-y: auto; padding: 16px 20px; }

    .fg { margin-bottom: 16px; }
    .fl {
      font-size: 12px; font-weight: 500; color: #374151;
      margin-bottom: 5px; display: flex; align-items: center; gap: 4px;
    }
    .req { color: #ef4444; }

    .fi {
      width: 100%; height: 36px; border: 1px solid #e5e7eb; border-radius: 7px;
      padding: 0 11px; font-size: 13px; font-family: inherit; color: #111827;
      outline: none; background: #fff; box-sizing: border-box; transition: border-color .12s;
    }
    .fi:focus { border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.1); }

    .fta {
      width: 100%; min-height: 80px; border: 1px solid #e5e7eb; border-radius: 7px;
      padding: 9px 11px; font-size: 13px; font-family: inherit; color: #111827;
      outline: none; background: #fff; box-sizing: border-box; resize: vertical; transition: border-color .12s;
    }
    .fta:focus { border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.1); }

    .fsel {
      width: 100%; height: 36px; border: 1px solid #e5e7eb; border-radius: 7px;
      padding: 0 11px; font-size: 13px; font-family: inherit; color: #111827;
      outline: none; background: #fff; box-sizing: border-box;
    }

    /* URL field */
    .url-row { display: flex; gap: 6px; align-items: center; }
    .url-val {
      flex: 1; height: 36px; border: 1px solid #f1f5f9; border-radius: 7px;
      padding: 0 11px; font-size: 12px; font-family: monospace; color: #6b7280;
      background: #f9fafb; display: flex; align-items: center;
      overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
    }
    .url-btn {
      height: 28px; padding: 0 12px; border-radius: 6px;
      border: 1px solid #e5e7eb; background: #fff; font-size: 12px;
      color: #374151; cursor: pointer; font-family: inherit; white-space: nowrap;
    }
    .url-btn:hover { background: #f9fafb; }

    /* Toggle */
    .tog-row { display: flex; align-items: center; gap: 10px; }
    .tog {
      width: 38px; height: 20px; border-radius: 10px; position: relative;
      cursor: pointer; transition: background .2s; flex-shrink: 0; border: none;
    }
    .tog-knob {
      position: absolute; top: 2px; width: 16px; height: 16px;
      border-radius: 50%; background: #fff; transition: left .2s;
      box-shadow: 0 1px 3px rgba(0,0,0,.2);
    }
    .tog-lbl { font-size: 13px; color: #374151; }

    /* Image */
    .img-zone {
      border: 1.5px dashed #e5e7eb; border-radius: 8px; min-height: 100px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 6px; cursor: pointer; transition: all .14s; background: #fafafa;
    }
    .img-zone:hover { border-color: #32acc1; background: #f0fdff; }
    .img-zone img { max-width: 100%; max-height: 100px; border-radius: 6px; object-fit: cover; }
    .img-actions { display: flex; gap: 6px; margin-top: 6px; }
    .img-btn { height: 26px; padding: 0 11px; border-radius: 20px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; }
    .img-btn-p { border: 1px solid #b2e4ed; background: #e6f7fa; color: #32acc1; }
    .img-btn-d { border: 1px solid #fecaca; background: #fef2f2; color: #ef4444; }

    /* Validation */
    .field-error {
      font-size: 11px; color: #ef4444; margin-top: 4px;
      display: flex; align-items: center; gap: 4px;
    }
    .field-hint {
      font-size: 11px; color: #9ca3af; margin-top: 3px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .char-count { font-size: 11px; color: #9ca3af; font-variant-numeric: tabular-nums; }
    .char-count.warn { color: #f59e0b; }
    .char-count.over { color: #ef4444; font-weight: 500; }
    .fi.invalid, .fta.invalid { border-color: #ef4444; }
    .fi.invalid:focus, .fta.invalid:focus { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,.1); }

    /* Add Field */
    .add-field {
      display: flex; align-items: center; gap: 6px; padding: 10px 0;
      font-size: 12px; color: #32acc1; cursor: pointer;
      border: none; background: transparent; font-family: inherit;
    }
    .add-field:hover { text-decoration: underline; }

    /* Footer */
    .df {
      padding: 12px 20px; border-top: 1px solid #f1f5f9;
      display: flex; gap: 8px; flex-shrink: 0;
    }
    .btn-cancel {
      flex: 1; height: 36px; border-radius: 20px; border: 1px solid #e5e7eb;
      background: #fff; font-size: 13px; font-weight: 500; cursor: pointer;
      font-family: inherit; color: #374151;
    }
    .btn-cancel:hover { background: #f9fafb; }
    .btn-save {
      flex: 1; height: 36px; border-radius: 20px; border: none;
      background: #32acc1; color: #fff; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit; display: flex; align-items: center;
      justify-content: center; gap: 6px; transition: background .13s;
    }
    .btn-save:hover { background: #2b95a8; }
    .btn-save:disabled { opacity: .6; cursor: not-allowed; }
    .spin {
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
      animation: sp .6s linear infinite; display: inline-block;
    }
    @keyframes sp { to { transform: rotate(360deg); } }
  `],
  template: `
    <!-- Header -->
    <div class="dh">
      <span class="dh-title">{{ data.item ? (data.item.template?.data?.['title'] || 'Edit Item') : 'New Item' }}</span>
      <button class="dh-close" (click)="ref.dismiss()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- Subheader -->
    <div class="ds">
      <span class="ds-label">Item content</span>
      <button class="ds-link" (click)="ref.close({ action: 'manageFields' })">Manage Fields</button>
    </div>

    <!-- Body -->
    <div class="db">
      @for (field of data.fields; track field.id) {
        <div class="fg">
          <div class="fl">
            {{ field.name }}
            @if (field.required) { <span class="req">*</span> }
          </div>

          @switch (field.type) {
            @case ('url') {
              <div class="url-row">
                <div class="url-val">{{ formData[field.key] || ('/' + (formData['title'] || '').toLowerCase().replace(/\s+/g, '-')) }}</div>
                <button class="url-btn">Edit URL</button>
              </div>
            }
            @case ('long-text') {
              <textarea class="fta" [(ngModel)]="formData[field.key]"
                        [class.invalid]="getFieldError(field)"
                        [placeholder]="'Enter ' + field.name"></textarea>
              @if ($any(field).limitCharCount && $any(field).maxLength) {
                <div class="field-hint">
                  <span></span>
                  <span class="char-count"
                        [class.warn]="(formData[field.key]?.length || 0) > ($any(field).maxLength * 0.9)"
                        [class.over]="(formData[field.key]?.length || 0) > $any(field).maxLength">
                    {{ formData[field.key]?.length || 0 }} / {{ $any(field).maxLength }}
                  </span>
                </div>
              }
              @if (getFieldError(field); as err) {
                <div class="field-error">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {{ err }}
                </div>
              }
            }
            @case ('boolean') {
              <div class="tog-row">
                <button class="tog" [style.background]="formData[field.key] ? '#32acc1' : '#e5e7eb'"
                        (click)="formData[field.key] = !formData[field.key]">
                  <div class="tog-knob" [style.left]="formData[field.key] ? '20px' : '2px'"></div>
                </button>
                <span class="tog-lbl">{{ formData[field.key] ? 'Enabled' : 'Disabled' }}</span>
              </div>
            }
            @case ('choice') {
              <select class="fsel" [(ngModel)]="formData[field.key]">
                <option value="">— Select —</option>
                @for (opt of field.options; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            }
            @case ('image') {
              <div>
                <div class="img-zone" (click)="openMediaPicker(field.key)">
                  @if (formData[field.key]?.url) {
                    <img [src]="formData[field.key].url"/>
                  } @else {
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c4c9d4" stroke-width="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span style="font-size:12px;color:#9ca3af">Click to choose image</span>
                  }
                </div>
                <div class="img-actions">
                  <button class="img-btn img-btn-p" (click)="openMediaPicker(field.key)">{{ formData[field.key]?.url ? 'Change' : 'Choose' }}</button>
                  @if (formData[field.key]?.url) {
                    <button class="img-btn img-btn-d" (click)="formData[field.key] = null">Remove</button>
                  }
                </div>
              </div>
            }
            @case ('number') {
              <input type="number" class="fi" [(ngModel)]="formData[field.key]"
                     [class.invalid]="getFieldError(field)"
                     [placeholder]="'Enter ' + field.name"/>
              @if (getFieldError(field); as err) {
                <div class="field-error">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {{ err }}
                </div>
              }
            }
            @case ('date') {
              <input type="date" class="fi" [(ngModel)]="formData[field.key]"/>
            }
            @case ('reference') {
              <app-reference-picker
                [collectionId]="field.referenceCollectionId"
                [multiple]="false"
                [value]="formData[field.key] ?? null"
                (valueChange)="formData[field.key] = $event"
              />
            }
            @case ('multi-reference') {
              <app-reference-picker
                [collectionId]="field.referenceCollectionId"
                [multiple]="true"
                [value]="formData[field.key] ?? null"
                (valueChange)="formData[field.key] = $event"
              />
            }
            @default {
              <input type="text" class="fi" [(ngModel)]="formData[field.key]"
                     [class.invalid]="getFieldError(field)"
                     [placeholder]="'Enter ' + field.name"
                     (ngModelChange)="field.key === 'title' && onTitleChange($event)"/>
              @if ($any(field).limitCharCount && $any(field).maxLength) {
                <div class="field-hint">
                  <span></span>
                  <span class="char-count"
                        [class.warn]="(formData[field.key]?.length || 0) > ($any(field).maxLength * 0.9)"
                        [class.over]="(formData[field.key]?.length || 0) > $any(field).maxLength">
                    {{ formData[field.key]?.length || 0 }} / {{ $any(field).maxLength }}
                  </span>
                </div>
              }
              @if (getFieldError(field); as err) {
                <div class="field-error">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {{ err }}
                </div>
              }
            }
          }
        </div>
      }

      <button class="add-field" (click)="ref.close({ action: 'manageFields' })">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Field
      </button>
    </div>

    <!-- Footer -->
    <div class="df">
      <button class="btn-cancel" (click)="ref.dismiss()">Cancel</button>
      <button class="btn-save" (click)="save()" [disabled]="saving() || hasErrors()">
        @if (saving()) { <span class="spin"></span> }
        Save
      </button>
    </div>
  `
})
export class ItemDetailDrawerComponent implements OnInit {
  data       = inject<ItemDrawerData>(MODAL_DATA);
  ref        = inject<ModalRef<ItemDrawerResult | { action: string }>>(MODAL_REF);
  private cms      = inject(ContentLibraryService);
  private modalSvc = inject(ModalService);

  saving   = signal(false);
  formData: Record<string, any> = {};

  ngOnInit(): void {
    this.formData = { ...(this.data.item?.template?.data ?? {}) };
    if (!this.data.item) {
      this.data.fields.filter(f => f.type === 'boolean').forEach(f => this.formData[f.key] = false);
    }
  }

  onTitleChange(value: string): void {
    const slug = this.data.fields.find(f => f.type === 'url');
    if (slug) {
      this.formData[slug.key] = '/' + value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
  }

  /** Returns an error string for the field, or '' if valid. */
  getFieldError(field: ContentField): string {
    const f: any = field;
    const val = this.formData[field.key];
    const str = typeof val === 'string' ? val : '';
    const len = str.length;

    // Character limits (text types)
    if (f.limitCharCount) {
      if (f.minLength != null && len > 0 && len < f.minLength) {
        return `Minimum ${f.minLength} characters required (${len} entered)`;
      }
      if (f.maxLength != null && len > f.maxLength) {
        return `Maximum ${f.maxLength} characters allowed (${len} entered)`;
      }
    }

    // Regex (text types)
    if (f.regex && str.length > 0) {
      try {
        if (!new RegExp(f.regex).test(str)) {
          return `Value does not match the required pattern`;
        }
      } catch { /* invalid regex, skip */ }
    }

    // Number range
    if (f.limitRange && field.type === 'number' && val != null && val !== '') {
      const num = Number(val);
      if (f.rangeMin != null && num < f.rangeMin) return `Minimum value is ${f.rangeMin}`;
      if (f.rangeMax != null && num > f.rangeMax) return `Maximum value is ${f.rangeMax}`;
    }

    // Item count (list fields)
    if (field.cardinality === 'many' && Array.isArray(val)) {
      if (f.minItems != null && val.length < f.minItems) {
        return `At least ${f.minItems} item(s) required (${val.length} added)`;
      }
      if (f.maxItems != null && val.length > f.maxItems) {
        return `Maximum ${f.maxItems} item(s) allowed (${val.length} added)`;
      }
    }

    // Required
    if (field.required) {
      if (val == null || val === '' || (Array.isArray(val) && val.length === 0)) {
        return `${field.name} is required`;
      }
    }

    return '';
  }

  /** Returns true if any field has a validation error. */
  hasErrors(): boolean {
    return this.data.fields.some(f => !!this.getFieldError(f));
  }

  async save(): Promise<void> {
    if (this.hasErrors()) return;
    this.saving.set(true);
    try {
      // Ensure template is a proper ContentItemTemplate instance
      const website = this.data.item ?? this.cms.buildNewItem(this.data.collectionId, {});
      if (!(website.template instanceof ContentItemTemplate)) {
        const tpl = new ContentItemTemplate();
        tpl.ParseJson(website.template ?? {});
        website.template = tpl;
      }
      website.template.data         = { ...this.formData };
      website.template.collectionId = this.data.collectionId;
      website.template.status       = website.template.status || 'draft';
      website.name                  = this.formData['title'] ?? 'Untitled';

      const res = await this.cms.saveItem(website);
      if (!this.data.item && res?.data?.id) website.id = res.data.id;

      this.ref.close({ saved: website } as ItemDrawerResult);
    } finally {
      this.saving.set(false);
    }
  }

  async openMediaPicker(fieldKey: string): Promise<void> {
    const pickerRef = this.modalSvc.open<MediaPickerModalComponent, MediaPickerConfig, any>(
      MediaPickerModalComponent,
      {
        size: 'xl',
        data: { contentTypes: ['image'], multiple: false, title: 'Choose an Image' },
      },
    );
    const selected = await pickerRef.afterClosed();
    if (selected?.url) {
      this.formData[fieldKey] = {
        url: selected.imageUrl || selected.thumbUrl || '',
        id: selected.id,
        name: selected.name,
      };
    }
  }
}
