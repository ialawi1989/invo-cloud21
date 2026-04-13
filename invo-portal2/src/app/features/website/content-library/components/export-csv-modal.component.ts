import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MODAL_DATA, MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { ContentField } from '../models/content-library.model';
import { Website } from '../../models/website.model';

type ExportStep = 'choose' | 'exporting' | 'ready';
type ExportMode = 'all' | 'filtered' | 'fields';

export interface ExportCsvData {
  collectionName: string;
  allFields: ContentField[];
  visibleFields: ContentField[];
  allItems: Website[];
  filteredItems: Website[];
}

@Component({
  selector: 'app-export-csv-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { font-family:'Inter',-apple-system,sans-serif; color:#111827; }

    .modal { width:100%; max-height:80vh; display:flex; flex-direction:column; }

    /* header */
    .mh {
      display:flex; align-items:flex-start; justify-content:space-between;
      padding:22px 24px 16px; flex-shrink:0;
    }
    .mh-title { font-size:18px; font-weight:700; color:#111827; margin:0 0 4px; }
    .mh-sub { font-size:13px; color:#6b7280; margin:0; line-height:1.45; }
    .mh-actions { display:flex; align-items:center; gap:6px; }
    .icon-btn {
      width:30px; height:30px; border:none; background:transparent; cursor:pointer;
      color:#9ca3af; border-radius:7px; display:flex; align-items:center; justify-content:center;
    }
    .icon-btn:hover { background:#f3f4f6; color:#374151; }

    /* body */
    .body { flex:1; overflow-y:auto; padding:8px 24px 24px; }

    /* radio options */
    .opt {
      display:flex; align-items:flex-start; gap:14px;
      padding:16px 0; border-bottom:1px solid #f1f5f9;
      cursor:pointer; transition:background .08s;
    }
    .opt:last-child { border-bottom:none; }
    .opt:hover { background:#fafbfc; margin:0 -24px; padding:16px 24px; border-radius:0; }

    /* custom radio */
    .opt-radio-wrap {
      position:relative; width:20px; height:20px; flex-shrink:0; margin-top:2px; cursor:pointer;
    }
    .opt-radio-wrap input {
      position:absolute; opacity:0; width:0; height:0;
    }
    .opt-radio-circle {
      width:20px; height:20px; border-radius:50%;
      border:2px solid #cbd5e1; background:#fff;
      display:flex; align-items:center; justify-content:center;
      transition:all .15s;
    }
    .opt-radio-circle::after {
      content:''; width:10px; height:10px; border-radius:50%;
      background:transparent; transition:background .15s;
    }
    .opt-radio-wrap input:checked + .opt-radio-circle {
      border-color:#32acc1;
    }
    .opt-radio-wrap input:checked + .opt-radio-circle::after {
      background:#32acc1;
    }
    .opt-text { flex:1; }
    .opt-title { font-size:15px; font-weight:600; color:#111827; margin:0 0 3px; }
    .opt-desc { font-size:13px; color:#6b7280; margin:0; line-height:1.4; }

    /* progress */
    .progress-wrap { padding:40px 0; text-align:center; }
    .progress-bar-bg {
      width:100%; height:6px; background:#e5e7eb; border-radius:3px;
      overflow:hidden; margin-bottom:12px;
    }
    .progress-bar-fill {
      height:100%; background:#32acc1; border-radius:3px;
      transition:width .3s ease;
    }
    .progress-pct { font-size:14px; font-weight:600; color:#111827; margin-bottom:6px; }
    .progress-msg { font-size:13px; color:#6b7280; }

    /* ready */
    .ready-wrap { padding:32px 0; display:flex; flex-direction:column; align-items:center; gap:16px; }
    .ready-icon {
      width:80px; height:80px; position:relative;
      display:flex; align-items:center; justify-content:center;
    }
    .ready-title { font-size:18px; font-weight:700; color:#111827; margin:0; }
    .ready-desc { font-size:14px; color:#6b7280; text-align:center; max-width:340px; line-height:1.5; margin:0; }
    .download-btn {
      display:inline-flex; align-items:center; gap:8px;
      height:44px; padding:0 28px; border-radius:100px;
      border:none; background:#32acc1; color:#fff;
      font-size:15px; font-weight:600; cursor:pointer; font-family:inherit;
      transition:background .13s; margin-top:4px;
    }
    .download-btn:hover { background:#2b95a8; }

    /* footer */
    .mf {
      display:flex; align-items:center; justify-content:flex-end; gap:10px;
      padding:16px 24px; border-top:1px solid #f1f5f9; flex-shrink:0;
    }
    .btn {
      height:40px; border-radius:100px; font-size:14px; font-weight:500;
      cursor:pointer; font-family:inherit; padding:0 24px;
      transition:all .13s; display:inline-flex; align-items:center; gap:7px;
    }
    .btn-cancel { border:1.5px solid #e5e7eb; background:#fff; color:#374151; }
    .btn-cancel:hover { background:#f3f4f6; }
    .btn-primary { border:none; background:#32acc1; color:#fff; }
    .btn-primary:hover { background:#2b95a8; }
    .btn-primary:disabled { opacity:.55; cursor:default; }
  `],
  template: `
    <div class="modal">

      <!-- ═══ STEP 1: Choose ═══ -->
      @if (step() === 'choose') {
        <div class="mh">
          <div>
            <p class="mh-title">Export collection as a CSV file</p>
            <p class="mh-sub">Choose which parts of your collection you want on your file.</p>
          </div>
          <div class="mh-actions">
            <button class="icon-btn" title="Help">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            </button>
            <button class="icon-btn" (click)="ref.dismiss()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div class="body">
          <label class="opt" (click)="mode='all'">
            <label class="opt-radio-wrap"><input type="radio" name="mode" value="all" [(ngModel)]="mode"/><div class="opt-radio-circle"></div></label>
            <div class="opt-text">
              <p class="opt-title">The entire collection ({{ data.allItems.length }} {{ data.allItems.length === 1 ? 'row' : 'rows' }})</p>
              <p class="opt-desc">Export all items and fields, including hidden and system fields.</p>
            </div>
          </label>

          <label class="opt" (click)="mode='filtered'">
            <label class="opt-radio-wrap"><input type="radio" name="mode" value="filtered" [(ngModel)]="mode"/><div class="opt-radio-circle"></div></label>
            <div class="opt-text">
              <p class="opt-title">Filtered data ({{ data.filteredItems.length }} {{ data.filteredItems.length === 1 ? 'row' : 'rows' }})</p>
              <p class="opt-desc">Export filtered items only.</p>
            </div>
          </label>

          <label class="opt" (click)="mode='fields'">
            <label class="opt-radio-wrap"><input type="radio" name="mode" value="fields" [(ngModel)]="mode"/><div class="opt-radio-circle"></div></label>
            <div class="opt-text">
              <p class="opt-title">Collection fields (0 rows)</p>
              <p class="opt-desc">Export all fields without content.</p>
            </div>
          </label>
        </div>

        <div class="mf">
          <button class="btn btn-cancel" (click)="ref.dismiss()">Cancel</button>
          <button class="btn btn-primary" (click)="startExport()">Export</button>
        </div>
      }

      <!-- ═══ STEP 2: Exporting ═══ -->
      @if (step() === 'exporting') {
        <div class="mh">
          <div>
            <p class="mh-title">Exporting collection...</p>
          </div>
          <div class="mh-actions">
            <button class="icon-btn" title="Help">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            </button>
            <button class="icon-btn" (click)="ref.dismiss()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div class="body">
          <div class="progress-wrap">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" [style.width.%]="progress()"></div>
            </div>
            <p class="progress-pct">{{ progress() }}%</p>
            <p class="progress-msg">Please wait. This could take a few minutes...</p>
          </div>
        </div>

        <div class="mf">
          <button class="btn btn-cancel" (click)="ref.dismiss()">Cancel</button>
          <button class="btn btn-primary" disabled>Exporting</button>
        </div>
      }

      <!-- ═══ STEP 3: Ready ═══ -->
      @if (step() === 'ready') {
        <div style="display:flex;justify-content:flex-end;padding:16px 20px 0">
          <button class="icon-btn" (click)="ref.dismiss()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="body">
          <div class="ready-wrap">
            <!-- Document icon -->
            <div class="ready-icon">
              <svg width="64" height="72" viewBox="0 0 64 72" fill="none">
                <rect x="4" y="0" width="48" height="64" rx="6" fill="#dbeafe" stroke="#93c5fd" stroke-width="1.5"/>
                <path d="M16 18h20M16 26h14M16 34h18" stroke="#93c5fd" stroke-width="2" stroke-linecap="round"/>
                <rect x="36" y="0" width="16" height="16" rx="2" fill="#bfdbfe" stroke="#93c5fd" stroke-width="1"/>
                <path d="M40 4l8 8" stroke="#93c5fd" stroke-width="1.5"/>
                <circle cx="42" cy="56" r="12" fill="#32acc1"/>
                <path d="M42 50v8M38 55l4 4 4-4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>

            <p class="ready-title">Your download is ready</p>
            <p class="ready-desc">After downloading your CSV file, check your file to make sure everything looks ok.</p>

            <button class="download-btn" (click)="downloadFile()">Download File</button>
          </div>
        </div>
      }

    </div>
  `
})
export class ExportCsvModalComponent {
  data = inject<ExportCsvData>(MODAL_DATA);
  ref  = inject<ModalRef>(MODAL_REF);

  step     = signal<ExportStep>('choose');
  progress = signal(0);
  mode: ExportMode = 'all';

  private csvBlob: Blob | null = null;

  startExport(): void {
    this.step.set('exporting');
    this.progress.set(0);

    // Build CSV content
    const fields = this.mode === 'fields'
      ? this.data.allFields
      : (this.mode === 'all' ? this.data.allFields : this.data.visibleFields);

    const items = this.mode === 'fields'
      ? []
      : (this.mode === 'all' ? this.data.allItems : this.data.filteredItems);

    const header = fields.map(f => `"${f.name}"`).join(',');
    const rows = items.map(item =>
      fields.map(f => {
        const val = item.template?.data?.[f.key];
        const str = val === null || val === undefined ? '' :
                    typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    this.csvBlob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });

    // Simulate progress
    const total = Math.max(rows.length, 1);
    let current = 0;
    const tick = () => {
      current += Math.ceil(total * 0.15) + Math.floor(Math.random() * 5);
      if (current >= total) {
        this.progress.set(100);
        setTimeout(() => this.step.set('ready'), 400);
        return;
      }
      this.progress.set(Math.min(Math.round((current / total) * 100), 99));
      setTimeout(tick, 120 + Math.random() * 200);
    };
    setTimeout(tick, 300);
  }

  downloadFile(): void {
    if (!this.csvBlob) return;
    const url = URL.createObjectURL(this.csvBlob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `${this.data.collectionName || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.ref.close({ exported: true });
  }
}
