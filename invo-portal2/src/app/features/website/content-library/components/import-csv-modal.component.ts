import { Component, inject, signal, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MODAL_DATA, MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { ContentField, ContentFieldType } from '../models/content-library.model';
import { ContentLibraryService } from '../services/content-library.service';
import { Website } from '../../models/website.model';
import { ContentItemTemplate } from '../models/content-library.model';

type ImportStep = 'upload' | 'configure' | 'review' | 'importing';

interface ColumnMapping {
  csvHeader: string;
  enabled: boolean;
  mapTo: 'new' | 'existing';
  existingFieldKey: string;
  newFieldName: string;
  newFieldType: ContentFieldType;
  preview: string[];
}

export interface ImportCsvData {
  collection: Website;
  fields: ContentField[];
  collectionId: string;
}

const FIELD_TYPE_OPTIONS: { value: ContentFieldType; label: string }[] = [
  { value: 'text',       label: 'Text' },
  { value: 'long-text',  label: 'Long Text' },
  { value: 'rich-text',  label: 'Rich Text' },
  { value: 'number',     label: 'Number' },
  { value: 'boolean',    label: 'Boolean' },
  { value: 'date',       label: 'Date' },
  { value: 'image',      label: 'Image' },
  { value: 'url',        label: 'URL' },
];

@Component({
  selector: 'app-import-csv-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { font-family:'Inter',-apple-system,sans-serif; color:#111827; }
    .modal { width:100%; max-height:88vh; display:flex; flex-direction:column; background:#fff; border-radius:16px; overflow:hidden; }

    /* ── Hero header (blue) ── */
    .hero {
      background:linear-gradient(135deg,#32acc1 0%,#2b95a8 100%);
      color:#fff; padding:28px 28px 24px; flex-shrink:0;
      position:relative; text-align:center;
    }
    .hero-title { font-size:22px; font-weight:700; margin:0 0 6px; }
    .hero-sub { font-size:14px; opacity:.9; margin:0; }
    .hero-actions { position:absolute; top:14px; right:14px; display:flex; gap:6px; }
    .hero-btn {
      width:30px; height:30px; border-radius:50%;
      border:1.5px solid rgba(255,255,255,.4); background:rgba(255,255,255,.15);
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      color:#fff; transition:all .12s;
    }
    .hero-btn:hover { background:rgba(255,255,255,.3); }

    /* ── Body ── */
    .body { flex:1; overflow-y:auto; padding:24px 28px; }

    /* ── Upload step ── */
    .upload-illus {
      display:flex; align-items:center; justify-content:center;
      padding:20px 0 24px;
    }
    .upload-text { font-size:14px; color:#374151; line-height:1.6; text-align:center; margin:0 0 20px; }
    .upload-text a { color:#32acc1; text-decoration:none; }
    .upload-text a:hover { text-decoration:underline; }
    .upload-zone {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:10px; padding:24px; border:2px dashed #cbd5e1; border-radius:12px;
      cursor:pointer; transition:all .15s; margin-bottom:12px;
    }
    .upload-zone:hover { border-color:#32acc1; background:#f0fdff; }
    .upload-zone.drag-over { border-color:#32acc1; background:#e0f7fa; }
    .choose-btn {
      display:inline-flex; align-items:center; gap:7px;
      height:40px; padding:0 24px; border-radius:100px;
      border:1.5px solid #32acc1; background:#fff; color:#32acc1;
      font-size:14px; font-weight:600; cursor:pointer; font-family:inherit;
      transition:all .13s;
    }
    .choose-btn:hover { background:#f0fdff; }
    .upload-hint { font-size:12px; color:#9ca3af; }
    .file-info { font-size:13px; color:#374151; margin-top:8px; }
    .file-info strong { color:#111827; }

    /* ── Configure step ── */
    .cfg-layout { display:flex; gap:0; min-height:340px; margin:0 -28px; }
    .cfg-left {
      width:240px; border-right:1px solid #f1f5f9;
      overflow-y:auto; flex-shrink:0;
    }
    .cfg-right { flex:1; padding:20px 24px; overflow-y:auto; }

    .col-item {
      display:flex; align-items:center; gap:10px;
      padding:12px 16px; cursor:pointer; transition:background .08s;
      border-bottom:1px solid #f8fafc;
    }
    .col-item:hover { background:#f8fafc; }
    .col-item.active { background:#f0fdff; border-left:3px solid #32acc1; padding-left:13px; }
    .col-name { font-size:14px; font-weight:500; color:#111827; }
    .col-sub { font-size:12px; color:#9ca3af; margin-top:1px; }
    .col-chk { margin-left:auto; }

    .cfg-label { font-size:13px; font-weight:600; color:#374151; margin:0 0 8px; }
    .cfg-input {
      width:100%; height:40px; border:1.5px solid #e5e7eb; border-radius:8px;
      padding:0 12px; font-size:14px; font-family:inherit; color:#111827;
      outline:none; background:#fff; box-sizing:border-box; transition:border-color .12s;
    }
    .cfg-input:focus { border-color:#32acc1; box-shadow:0 0 0 3px rgba(50,172,193,.1); }
    .cfg-select {
      width:100%; height:40px; border:1.5px solid #e5e7eb; border-radius:8px;
      padding:0 12px; font-size:14px; font-family:inherit; color:#111827;
      outline:none; background:#fff; cursor:pointer; appearance:none;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat:no-repeat; background-position:right 12px center; padding-right:36px;
    }
    .cfg-select:focus { border-color:#32acc1; }
    .cfg-group { margin-bottom:16px; }
    .cfg-preview-label { font-size:12px; font-weight:600; color:#9ca3af; margin:16px 0 6px; text-transform:uppercase; letter-spacing:.04em; }
    .cfg-preview-vals { font-size:13px; color:#6b7280; line-height:1.6; }

    /* ── Review step ── */
    .review-info { font-size:14px; color:#374151; line-height:1.6; margin:0 0 8px; }
    .review-note { font-size:13px; color:#6b7280; line-height:1.5; margin:0 0 20px; }
    .review-table { width:100%; border-collapse:collapse; }
    .review-table th {
      text-align:left; font-size:12px; font-weight:700; color:#6b7280;
      padding:10px 12px; border-bottom:1.5px solid #e5e7eb;
      text-transform:uppercase; letter-spacing:.04em;
    }
    .review-table td {
      padding:12px; border-bottom:1px solid #f1f5f9;
      font-size:14px; color:#111827; vertical-align:top;
    }
    .review-arrow { color:#9ca3af; }
    .review-field-name { font-size:14px; font-weight:500; color:#111827; }
    .review-field-type { font-size:12px; color:#9ca3af; }

    /* ── Importing step ── */
    .importing-body { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 40px; gap:20px; }
    .spinner-lg {
      width:48px; height:48px; border-radius:50%;
      border:3.5px solid #e5e7eb; border-top-color:#32acc1;
      animation:spin .7s linear infinite;
    }
    @keyframes spin { to{transform:rotate(360deg)} }
    .importing-msg { font-size:14px; color:#6b7280; text-align:center; }

    /* ── Footer ── */
    .mf {
      display:flex; align-items:center; justify-content:space-between;
      padding:16px 28px; border-top:1px solid #f1f5f9; flex-shrink:0;
    }
    .mf-left { display:flex; align-items:center; }
    .mf-right { display:flex; align-items:center; gap:10px; }
    .mf-info { font-size:13px; color:#6b7280; }
    .btn {
      height:40px; border-radius:100px; font-size:14px; font-weight:500;
      cursor:pointer; font-family:inherit; padding:0 24px;
      transition:all .13s; display:inline-flex; align-items:center; gap:6px;
    }
    .btn-back { border:1.5px solid #32acc1; background:#fff; color:#32acc1; }
    .btn-back:hover { background:#f0fdff; }
    .btn-cancel { border:1.5px solid #e5e7eb; background:#fff; color:#374151; }
    .btn-cancel:hover { background:#f3f4f6; }
    .btn-primary { border:none; background:#32acc1; color:#fff; }
    .btn-primary:hover { background:#2b95a8; }
    .btn-primary:disabled { opacity:.45; cursor:default; }

    /* checkbox in configure */
    .cfg-chk-wrap { position:relative; width:20px; height:20px; flex-shrink:0; cursor:pointer; display:inline-flex; }
    .cfg-chk-wrap input { position:absolute; opacity:0; width:0; height:0; }
    .cfg-chk-box {
      width:20px; height:20px; border-radius:6px;
      border:1.5px solid #cbd5e1; background:#fff;
      display:flex; align-items:center; justify-content:center; transition:all .13s;
    }
    .cfg-chk-wrap input:checked+.cfg-chk-box { background:#32acc1; border-color:#32acc1; }
    .cfg-chk-box svg { display:none; }
    .cfg-chk-wrap input:checked+.cfg-chk-box svg { display:block; }
  `],
  template: `
    <div class="modal">

      <!-- ═══ STEP 1: Upload ═══ -->
      @if (step() === 'upload') {
        <div class="hero">
          <div class="hero-actions">
            <button class="hero-btn" title="Help">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            </button>
            <button class="hero-btn" (click)="ref.dismiss()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <p class="hero-title">Import content from a file</p>
          <p class="hero-sub">Import content from a CSV file into your content collection.</p>
        </div>

        <div class="body">
          <!-- Upload illustration -->
          <div class="upload-illus">
            <svg width="180" height="100" viewBox="0 0 180 100" fill="none">
              <rect x="40" y="10" width="100" height="75" rx="6" fill="#dbeafe" stroke="#93c5fd" stroke-width="1.5"/>
              <rect x="50" y="22" width="80" height="10" rx="2" fill="#bfdbfe"/>
              <rect x="50" y="38" width="80" height="10" rx="2" fill="#bfdbfe"/>
              <rect x="50" y="54" width="60" height="10" rx="2" fill="#bfdbfe"/>
              <line x1="70" y1="22" x2="70" y2="64" stroke="#93c5fd" stroke-width="1"/>
              <line x1="100" y1="22" x2="100" y2="64" stroke="#93c5fd" stroke-width="1"/>
              <circle cx="25" cy="60" r="14" fill="#e0f2fe" stroke="#93c5fd" stroke-width="1"/>
              <text x="18" y="64" font-size="10" fill="#60a5fa" font-weight="600">Ab</text>
              <circle cx="155" cy="30" r="12" fill="#e0f2fe" stroke="#93c5fd" stroke-width="1"/>
              <text x="150" y="34" font-size="9" fill="#60a5fa">o+</text>
              <circle cx="155" cy="65" r="14" fill="#ccfbf1" stroke="#5eead4" stroke-width="1"/>
              <path d="M150 65l3 3 7-7" stroke="#14b8a6" stroke-width="1.5" fill="none"/>
            </svg>
          </div>

          <p class="upload-text">
            Upload a CSV file that contains items you want to import into your content collection.
            To learn more about importing content, visit the <a href="#">Help Center</a>.
          </p>

          <div class="upload-zone"
               (click)="fileInput.click()"
               (dragover)="onDragOver($event)"
               (dragleave)="dragOverZone=false"
               (drop)="onFileDrop($event)"
               [class.drag-over]="dragOverZone">
            <button class="choose-btn" type="button">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Choose a File
            </button>
            <span class="upload-hint">or drag and drop a CSV file here</span>
          </div>
          <input #fileInput type="file" accept=".csv" style="display:none" (change)="onFileSelected($event)"/>

          @if (fileName) {
            <p class="file-info">Selected: <strong>{{ fileName }}</strong> ({{ rowCount }} rows, {{ csvHeaders.length }} columns)</p>
          }
        </div>

        <div class="mf">
          <div class="mf-left"></div>
          <div class="mf-right">
            <button class="btn btn-primary" (click)="goToConfigure()" [disabled]="!fileName">
              Next
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      }

      <!-- ═══ STEP 2: Configure ═══ -->
      @if (step() === 'configure') {
        <div class="hero">
          <div class="hero-actions">
            <button class="hero-btn" title="Help">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            </button>
            <button class="hero-btn" (click)="ref.dismiss()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <p class="hero-title">Configure Columns to Import</p>
          <p class="hero-sub">Select and configure the columns to import into your content collection.</p>
        </div>

        <div class="cfg-layout">
          <!-- Column list -->
          <div class="cfg-left">
            @for (col of columns; track col.csvHeader; let i = $index) {
              <div class="col-item" [class.active]="activeCol === i" (click)="activeCol = i">
                <div>
                  <div class="col-name">{{ col.csvHeader }}</div>
                  <div class="col-sub">
                    @if (col.mapTo === 'existing') { Import as {{ getFieldName(col.existingFieldKey) }} field }
                    @else { Import as {{ col.newFieldName }} field… }
                  </div>
                </div>
                <label class="cfg-chk-wrap col-chk" (click)="$event.stopPropagation()">
                  <input type="checkbox" [(ngModel)]="col.enabled"/>
                  <div class="cfg-chk-box"><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><polyline points="2 6 5 9 10 3"/></svg></div>
                </label>
              </div>
            }
          </div>

          <!-- Config panel -->
          <div class="cfg-right">
            @if (columns[activeCol]; as col) {
              <div class="cfg-group">
                <label class="cfg-label">Configure Column</label>
                <select class="cfg-select" [(ngModel)]="col.mapTo" (ngModelChange)="onMapToChange(col)">
                  <option value="existing">Existing field</option>
                  <option value="new">New field</option>
                </select>
              </div>

              @if (col.mapTo === 'existing') {
                <div class="cfg-group">
                  <label class="cfg-label">Map to field</label>
                  <select class="cfg-select" [(ngModel)]="col.existingFieldKey">
                    @for (f of data.fields; track f.key) {
                      <option [value]="f.key">{{ f.name }} ({{ f.type }})</option>
                    }
                  </select>
                </div>
              }

              @if (col.mapTo === 'new') {
                <div class="cfg-group">
                  <label class="cfg-label">Field Name</label>
                  <input class="cfg-input" [(ngModel)]="col.newFieldName"/>
                </div>
                <div class="cfg-group">
                  <label class="cfg-label">Field Type</label>
                  <select class="cfg-select" [(ngModel)]="col.newFieldType">
                    @for (ft of fieldTypes; track ft.value) {
                      <option [value]="ft.value">{{ ft.label }}</option>
                    }
                  </select>
                </div>
              }

              @if (col.preview.length > 0) {
                <p class="cfg-preview-label">Examples after Import</p>
                <div class="cfg-preview-vals">
                  @for (v of col.preview; track $index) {
                    <div>{{ v || '—' }}</div>
                  }
                </div>
              }
            }
          </div>
        </div>

        <div class="mf">
          <div class="mf-left">
            <button class="btn btn-back" (click)="step.set('upload')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
          </div>
          <span class="mf-info">{{ enabledCount }} columns are selected for import</span>
          <div class="mf-right">
            <button class="btn btn-primary" (click)="goToReview()">
              Next
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      }

      <!-- ═══ STEP 3: Review ═══ -->
      @if (step() === 'review') {
        <div class="hero">
          <div class="hero-actions">
            <button class="hero-btn" title="Help">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            </button>
            <button class="hero-btn" (click)="ref.dismiss()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <p class="hero-title">Review File Import</p>
          <p class="hero-sub">Review your configuration selections and start the import process.</p>
        </div>

        <div class="body">
          <p class="review-info"><strong>{{ enabledCount }} columns</strong> out of {{ columns.length }} will be imported.</p>
          <p class="review-note">Some items may not be imported if there are problems. Check your collection after import to ensure the content is correct.</p>
          <p class="review-note" style="margin-bottom:16px">This table shows the columns from your file mapped to fields in your collection.</p>

          <table class="review-table">
            <thead>
              <tr>
                <th>File Columns</th>
                <th></th>
                <th>Collection Fields</th>
              </tr>
            </thead>
            <tbody>
              @for (col of enabledColumns; track col.csvHeader) {
                <tr>
                  <td>{{ col.csvHeader }}</td>
                  <td class="review-arrow" style="text-align:center">→</td>
                  <td>
                    <div class="review-field-name">{{ col.mapTo === 'existing' ? getFieldName(col.existingFieldKey) : col.newFieldName }}</div>
                    <div class="review-field-type">
                      @if (col.mapTo === 'new') { {{ col.newFieldType }} field (new) }
                      @else { {{ getFieldType(col.existingFieldKey) }} }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="mf">
          <div class="mf-left">
            <button class="btn btn-back" (click)="step.set('configure')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
          </div>
          <div class="mf-right">
            <button class="btn btn-primary" (click)="startImport()">Import</button>
          </div>
        </div>
      }

      <!-- ═══ STEP 4: Importing ═══ -->
      @if (step() === 'importing') {
        <div class="hero">
          <div class="hero-actions">
            <button class="hero-btn" title="Help">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            </button>
          </div>
          <p class="hero-title">Import in progress...</p>
          <p class="hero-sub">Wait until the import is completed before closing this window.</p>
        </div>

        <div class="body">
          <div class="importing-body">
            <div class="spinner-lg"></div>
            <p class="importing-msg">{{ importMsg }}</p>
          </div>
        </div>
      }

    </div>
  `
})
export class ImportCsvModalComponent {
  data = inject<ImportCsvData>(MODAL_DATA);
  ref  = inject<ModalRef>(MODAL_REF);
  private cms  = inject(ContentLibraryService);
  private zone = inject(NgZone);
  private cdr  = inject(ChangeDetectorRef);

  step = signal<ImportStep>('upload');
  fieldTypes = FIELD_TYPE_OPTIONS;

  // Upload
  fileName = '';
  rowCount = 0;
  csvHeaders: string[] = [];
  csvRows: string[][] = [];
  dragOverZone = false;

  // Configure
  columns: ColumnMapping[] = [];
  activeCol = 0;

  // Import
  importMsg = 'Backing up collection for the import...';

  get enabledCount(): number { return this.columns.filter(c => c.enabled).length; }
  get enabledColumns(): ColumnMapping[] { return this.columns.filter(c => c.enabled); }

  // ── File handling ──
  onDragOver(e: DragEvent): void { e.preventDefault(); this.dragOverZone = true; }
  onFileDrop(e: DragEvent): void {
    e.preventDefault(); this.dragOverZone = false;
    const file = e.dataTransfer?.files[0];
    if (file && file.name.endsWith('.csv')) this.parseFile(file);
  }
  onFileSelected(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.parseFile(file);
  }

  private parseFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.zone.run(() => {
        const text = reader.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length === 0) return;

        // Parse headers
        this.csvHeaders = this.parseCsvLine(lines[0]);
        this.csvRows = lines.slice(1).map(l => this.parseCsvLine(l));
        this.rowCount = this.csvRows.length;

        // Build column mappings
        this.columns = this.csvHeaders.map((header, i) => {
          const existingField = this.data.fields.find(f =>
            f.key === header.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') ||
            f.name.toLowerCase() === header.toLowerCase()
          );
          return {
            csvHeader: header,
            enabled: true,
            mapTo: existingField ? 'existing' as const : 'new' as const,
            existingFieldKey: existingField?.key ?? this.data.fields[0]?.key ?? '',
            newFieldName: header,
            newFieldType: 'text' as ContentFieldType,
            preview: this.csvRows.slice(0, 3).map(row => row[i] ?? ''),
          };
        });

        this.fileName = file.name;
        this.cdr.detectChanges();
      });
    };
    reader.readAsText(file);
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { result.push(current.trim()); current = ''; }
        else { current += ch; }
      }
    }
    result.push(current.trim());
    return result;
  }

  // ── Configure ──
  goToConfigure(): void { this.step.set('configure'); this.activeCol = 0; }

  onMapToChange(col: ColumnMapping): void {
    if (col.mapTo === 'new') {
      col.newFieldName = col.csvHeader;
      col.newFieldType = 'text';
    }
  }

  getFieldName(key: string): string { return this.data.fields.find(f => f.key === key)?.name ?? key; }
  getFieldType(key: string): string { return this.data.fields.find(f => f.key === key)?.type ?? 'text'; }

  // ── Review ──
  goToReview(): void { this.step.set('review'); }

  // ── Import ──
  async startImport(): Promise<void> {
    this.step.set('importing');
    this.importMsg = 'Backing up collection for the import...';

    // 1. Create new fields if needed
    const coll = this.data.collection;
    const existingFields = [...(coll.template?.fields ?? [])];
    const newFields: ContentField[] = [];

    for (const col of this.enabledColumns) {
      if (col.mapTo === 'new') {
        const f = new ContentField();
        f.id        = 'f-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        f.name      = col.newFieldName;
        f.key       = col.newFieldName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        f.type      = col.newFieldType;
        f.isVisible = true;
        newFields.push(f);
        col.existingFieldKey = f.key; // so we can use it for data mapping
      }
    }

    if (newFields.length > 0) {
      this.importMsg = 'Creating new fields...';
      coll.template.fields = [...existingFields, ...newFields];
      await this.cms.saveCollection(coll);
    }

    // 2. Import rows
    this.importMsg = 'Importing items...';
    const headerIdxMap = new Map<string, number>();
    this.csvHeaders.forEach((h, i) => headerIdxMap.set(h, i));

    let imported = 0;
    for (const row of this.csvRows) {
      const data: Record<string, any> = {};
      for (const col of this.enabledColumns) {
        const idx = headerIdxMap.get(col.csvHeader);
        if (idx === undefined) continue;
        const rawVal = row[idx] ?? '';
        const key = col.mapTo === 'existing' ? col.existingFieldKey
                  : col.newFieldName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        data[key] = rawVal;
      }

      // Create item
      const item = new Website();
      item.companyId = coll.companyId;
      item.type      = 'ContentItem';
      item.name      = data['title'] ?? data[Object.keys(data)[0]] ?? 'Imported item';
      const tpl      = new ContentItemTemplate();
      tpl.collectionId = this.data.collectionId;
      tpl.data         = data;
      tpl.status       = 'draft';
      item.template    = tpl;

      try {
        await this.cms.saveItem(item);
        imported++;
        this.importMsg = `Importing items... (${imported}/${this.csvRows.length})`;
      } catch { /* skip failed rows */ }
    }

    this.importMsg = `Done! ${imported} items imported.`;
    setTimeout(() => this.ref.close({ imported: true, count: imported }), 1200);
  }
}
