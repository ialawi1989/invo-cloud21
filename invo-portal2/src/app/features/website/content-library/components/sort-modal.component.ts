import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { MODAL_DATA, MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { ModalHeaderComponent } from '../../../../shared/modal/modal-header.component';
import { ModalFooterComponent } from '../../../../shared/modal/modal-footer.component';
import { ContentField } from '../models/content-library.model';

export interface SortModalData {
  fields:  ContentField[];
  current: { field: string; dir: 'asc' | 'desc' } | null;
}
export interface SortResult {
  field: string;
  dir:   'asc' | 'desc';
}

@Component({
  selector: 'app-sort-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalHeaderComponent, ModalFooterComponent],
  styles: [`
    .body { padding:4px 0 8px; }
    .section-label { font-size:11px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:.05em; padding:12px 20px 6px; }
    .field-opt {
      display:flex; align-items:center; gap:10px;
      padding:9px 20px; cursor:pointer; transition:background .08s; font-size:13px; color:#111827;
      border:none; background:transparent; width:100%; text-align:left; font-family:inherit;
    }
    .field-opt:hover { background:#f8fafc; }
    .field-opt.on { background:#f0fdff; color:#0e7a8a; font-weight:500; }
    .field-ico { width:20px; height:20px; border-radius:4px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#6b7280; }
    .field-opt.on .field-ico { background:#e6f7fa; color:#32acc1; }
    .sep { height:1px; background:#f1f5f9; margin:6px 0; }
    .dir-row {
      display:flex; align-items:center; gap:12px;
      padding:10px 20px 10px 16px; cursor:pointer;
      border:none; background:transparent; width:100%; font-family:inherit; transition:background .08s;
    }
    .dir-row:hover { background:#f8fafc; }
    .dir-radio { width:16px; height:16px; border-radius:50%; border:2px solid #cbd5e1; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .12s; }
    .dir-row.on .dir-radio { border-color:#32acc1; background:#32acc1; }
    .dir-dot { width:6px; height:6px; border-radius:50%; background:#fff; }
    .dir-info { text-align:left; }
    .dir-name { font-size:13px; font-weight:500; color:#111827; }
    .dir-sub  { font-size:11px; color:#6b7280; margin-top:1px; }
    .btn-cancel { padding:9px 20px; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:8px; font-size:13px; cursor:pointer; font-family:inherit; }
    .btn-cancel:hover { background:#e5e7eb; }
    .btn-apply { padding:9px 24px; background:#32acc1; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; }
    .btn-apply:hover { background:#2b95a8; }
    .btn-remove { padding:9px 20px; background:#fef2f2; color:#ef4444; border:1px solid #fecaca; border-radius:8px; font-size:13px; cursor:pointer; font-family:inherit; margin-right:auto; }
    .btn-remove:hover { background:#fee2e2; }
  `],
  template: `
    <app-modal-header title="Sort items" icon="<line x1='12' y1='5' x2='12' y2='19'/><polyline points='19 12 12 5 5 12'/>"/>

    <div class="body">
      <div class="section-label">Sort by field</div>
      @for (field of data.fields; track field.id) {
        <button class="field-opt" [class.on]="sortField === field.key" (click)="sortField = field.key">
          <span class="field-ico">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" [innerHTML]="fieldIcon(field.type)"></svg>
          </span>
          {{ field.name }}
        </button>
      }

      <div class="sep"></div>
      <div class="section-label">Order</div>

      <button class="dir-row" [class.on]="sortDir === 'asc'" (click)="sortDir = 'asc'">
        <div class="dir-radio"><div class="dir-dot" [style.opacity]="sortDir==='asc'?1:0"></div></div>
        <div class="dir-info">
          <div class="dir-name">A → Z (Ascending)</div>
          <div class="dir-sub">Smallest or earliest first</div>
        </div>
      </button>
      <button class="dir-row" [class.on]="sortDir === 'desc'" (click)="sortDir = 'desc'">
        <div class="dir-radio"><div class="dir-dot" [style.opacity]="sortDir==='desc'?1:0"></div></div>
        <div class="dir-info">
          <div class="dir-name">Z → A (Descending)</div>
          <div class="dir-sub">Largest or most recent first</div>
        </div>
      </button>
    </div>

    <app-modal-footer>
      @if (data.current) {
        <button class="btn-remove" (click)="ref.close(null)">Remove sort</button>
      }
      <button class="btn-cancel" (click)="ref.dismiss()">Cancel</button>
      <button class="btn-apply" (click)="apply()">Apply Sort</button>
    </app-modal-footer>
  `
})
export class SortModalComponent {
  data      = inject<SortModalData>(MODAL_DATA);
  ref       = inject<ModalRef<SortResult | null>>(MODAL_REF);
  private sanitizer = inject(DomSanitizer);

  sortField = this.data.current?.field ?? this.data.fields[0]?.key ?? '';
  sortDir: 'asc' | 'desc' = this.data.current?.dir ?? 'asc';

  apply(): void { this.ref.close({ field: this.sortField, dir: this.sortDir }); }

  fieldIcon(type: string): SafeHtml {
    const map: Record<string,string> = {
      text:'<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
      'long-text':'<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/>',
      number:'<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
      boolean:'<rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="16" cy="12" r="3"/>',
      date:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
      image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
      url:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    };
    return this.sanitizer.bypassSecurityTrustHtml(map[type] ?? map['text']);
  }
}
