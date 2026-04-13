import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MODAL_DATA, MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { ContentField } from '../models/content-library.model';

export type FilterCondition = 'is' | 'contains' | 'starts-with' | 'not-empty' | 'empty';

export interface FilterModalData {
  fields:  ContentField[];
  current: { field: string; condition: FilterCondition; value: string } | null;
}
export interface FilterResult {
  field:     string;
  condition: FilterCondition;
  value:     string;
}

const ALL_CONDITIONS: { value: FilterCondition; label: string }[] = [
  { value: 'is',          label: 'Is' },
  { value: 'contains',    label: 'Contains' },
  { value: 'starts-with', label: 'Starts with' },
  { value: 'not-empty',   label: 'Is not empty' },
  { value: 'empty',       label: 'Is empty' },
];

const FIELD_ICONS: Record<string, string> = {
  text:          '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  'long-text':   '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/>',
  'rich-text':   '<path d="M4 6h16M4 10h12M4 14h8M4 18h10"/>',
  number:        '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  boolean:       '<rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="16" cy="12" r="3"/>',
  date:          '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  image:         '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  url:           '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  choice:        '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  'multi-choice':'<polyline points="9 11 12 14 22 4"/><polyline points="9 17 12 20 22 10"/>',
  reference:     '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
};

@Component({
  selector: 'app-filter-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { font-family:'Inter',-apple-system,sans-serif; color:#111827; display:flex; flex-direction:column; }

    /* header */
    .fm-head {
      display:flex; align-items:center; justify-content:space-between;
      padding:18px 20px 14px;
      border-bottom:1px solid #f1f5f9;
      flex-shrink:0;
    }
    .fm-back {
      display:flex; align-items:center; gap:6px;
      border:none; background:transparent; cursor:pointer;
      font-size:14px; font-weight:500; color:#32acc1; font-family:inherit; padding:0;
    }
    .fm-back:hover { text-decoration:underline; }
    .fm-close {
      width:28px; height:28px; border:none; background:transparent; cursor:pointer;
      color:#9ca3af; border-radius:6px; display:flex; align-items:center; justify-content:center;
    }
    .fm-close:hover { background:#f3f4f6; color:#374151; }

    /* body */
    .fm-body { padding:20px 20px 0; display:flex; flex-direction:column; gap:16px; flex:1; }

    .fm-label { font-size:13px; font-weight:500; color:#374151; margin:0 0 6px; }

    /* field select */
    .field-sel-wrap { position:relative; }
    .field-sel-btn {
      width:100%; height:42px; border:1.5px solid #32acc1; border-radius:8px;
      padding:0 12px; font-size:14px; font-family:inherit; color:#111827;
      background:#fff; cursor:pointer; display:flex; align-items:center; gap:9px;
      transition:border-color .12s;
    }
    .field-sel-btn:hover { border-color:#2b95a8; }
    .fsi { width:22px; height:22px; border-radius:5px; background:#e8f4f9; color:#32acc1; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .fsi-name { flex:1; text-align:left; }
    .fsi-chev { color:#9ca3af; flex-shrink:0; }

    .field-dd {
      position:absolute; top:calc(100% + 4px); left:0; right:0;
      background:#fff; border:1px solid #e5e7eb; border-radius:10px;
      box-shadow:0 8px 24px rgba(0,0,0,.1); z-index:500; padding:4px;
      max-height:220px; overflow-y:auto;
    }
    .fdd-opt {
      display:flex; align-items:center; gap:9px;
      padding:8px 11px; font-size:13px; color:#111827;
      border-radius:7px; cursor:pointer; transition:background .08s;
    }
    .fdd-opt:hover { background:#f3f4f6; }
    .fdd-opt.sel { background:#f0fdff; color:#0e7a8a; font-weight:500; }

    /* condition select */
    .cond-sel {
      width:100%; height:42px; border:1.5px solid #e5e7eb; border-radius:8px;
      padding:0 12px; font-size:14px; font-family:inherit; color:#111827;
      background:#fff; cursor:pointer; outline:none; appearance:none;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat:no-repeat; background-position:right 12px center;
      padding-right:36px;
      transition:border-color .12s;
    }
    .cond-sel:focus { border-color:#32acc1; box-shadow:0 0 0 3px rgba(50,172,193,.1); }

    /* value input */
    .val-input {
      width:100%; height:42px; border:1.5px solid #e5e7eb; border-radius:8px;
      padding:0 13px; font-size:14px; font-family:inherit; color:#111827;
      outline:none; background:#fff; box-sizing:border-box;
      transition:border-color .12s;
    }
    .val-input:focus { border-color:#32acc1; box-shadow:0 0 0 3px rgba(50,172,193,.1); }

    /* note */
    .fm-note {
      background:#eef4ff; border-radius:9px; padding:12px 14px;
      font-size:13px; color:#374151; line-height:1.5;
    }
    .fm-note strong { font-weight:600; }
    .fm-note a { color:#32acc1; text-decoration:none; }
    .fm-note a:hover { text-decoration:underline; }

    /* footer */
    .fm-foot {
      display:flex; align-items:center; gap:10px;
      padding:16px 20px;
      border-top:1px solid #f1f5f9; flex-shrink:0;
      margin-top:16px;
    }
    .btn {
      height:40px; border-radius:100px; font-size:14px; font-weight:500;
      cursor:pointer; font-family:inherit; padding:0 22px;
      transition:all .13s;
    }
    .btn-cancel { border:1.5px solid #e5e7eb; background:#fff; color:#374151; }
    .btn-cancel:hover { background:#f3f4f6; }
    .btn-primary { border:none; background:#32acc1; color:#fff; margin-left:auto; }
    .btn-primary:hover { background:#2b95a8; }
    .btn-remove { border:1.5px solid #fecaca; background:#fef2f2; color:#ef4444; margin-right:auto; }
    .btn-remove:hover { background:#fee2e2; }
  `],
  template: `
    <!-- Header -->
    <div class="fm-head">
      <button class="fm-back" (click)="ref.dismiss()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        All fields
      </button>
      <button class="fm-close" (click)="ref.dismiss()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <!-- Body -->
    <div class="fm-body">

      <!-- Select field -->
      <div>
        <p class="fm-label">Select field</p>
        <div class="field-sel-wrap">
          <button class="field-sel-btn" (click)="fieldDdOpen = !fieldDdOpen">
            <span class="fsi">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" [innerHTML]="iconHtml(selectedField().type)"></svg>
            </span>
            <span class="fsi-name">{{ selectedField().name }}</span>
            <svg class="fsi-chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          @if (fieldDdOpen) {
            <div class="field-dd">
              @for (f of data.fields; track f.id) {
                <div class="fdd-opt" [class.sel]="filterField === f.key" (click)="selectField(f.key)">
                  <span class="fsi">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" [innerHTML]="iconHtml(f.type)"></svg>
                  </span>
                  {{ f.name }}
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Choose a condition -->
      <div>
        <p class="fm-label">Choose a condition</p>
        <select class="cond-sel" [(ngModel)]="filterCond">
          @for (c of conditions; track c.value) {
            <option [value]="c.value">{{ c.label }}</option>
          }
        </select>
      </div>

      <!-- Enter a value -->
      @if (filterCond !== 'empty' && filterCond !== 'not-empty') {
        <div>
          <p class="fm-label">Enter a value</p>
          <input class="val-input" [(ngModel)]="filterValue" placeholder=""/>
        </div>
      }

      <!-- Note -->
      <div class="fm-note">
        <strong>Note:</strong> Collection filters won't apply to the item order on site pages.
        <a href="#">Learn more about filters</a>
      </div>

    </div>

    <!-- Footer -->
    <div class="fm-foot">
      @if (data.current) {
        <button class="btn btn-remove" (click)="ref.close(null)">Remove filter</button>
      }
      <button class="btn btn-cancel" (click)="ref.dismiss()">Cancel</button>
      <button class="btn btn-primary" (click)="apply()">Add Filter</button>
    </div>
  `
})
export class FilterModalComponent {
  data = inject<FilterModalData>(MODAL_DATA);
  ref  = inject<ModalRef<FilterResult | null>>(MODAL_REF);
  private sanitizer = inject(DomSanitizer);

  conditions  = ALL_CONDITIONS;
  filterField = this.data.current?.field     ?? this.data.fields[0]?.key ?? '';
  filterCond: FilterCondition = this.data.current?.condition ?? 'is';
  filterValue = this.data.current?.value     ?? '';
  fieldDdOpen = false;

  selectedField(): ContentField {
    return this.data.fields.find(f => f.key === this.filterField) ?? this.data.fields[0];
  }

  selectField(key: string): void {
    this.filterField = key;
    this.fieldDdOpen = false;
  }

  iconHtml(type: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(FIELD_ICONS[type] ?? FIELD_ICONS['text']);
  }

  apply(): void {
    this.ref.close({ field: this.filterField, condition: this.filterCond, value: this.filterValue });
  }
}
