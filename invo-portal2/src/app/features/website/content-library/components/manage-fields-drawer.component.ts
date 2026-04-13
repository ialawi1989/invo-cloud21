import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MODAL_DATA, MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { ContentField } from '../models/content-library.model';
import { ContentLibraryService } from '../services/content-library.service';
import { Website } from '../../models/website.model';

export interface ManageFieldsDrawerData {
  collection: Website;
}

@Component({
  selector: 'app-manage-fields-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { display:flex; flex-direction:column; height:100%; font-family:'Inter',-apple-system,sans-serif; font-size:14px; }

    .mfd-head {
      padding:22px 20px 18px;
      border-bottom:1px solid #f1f5f9;
      flex-shrink:0;
    }
    .mfd-title { font-size:18px; font-weight:600; color:#111827; margin:0 0 5px; }
    .mfd-sub   { font-size:13px; color:#6b7280; line-height:1.5; margin:0; }

    .mfd-body  { flex:1; overflow-y:auto; padding:6px 0; }

    .mfd-row {
      display:flex; align-items:center; gap:12px;
      padding:11px 18px; transition:background .08s; position:relative;
      border-bottom:1px solid #f1f5f9;
    }
    .mfd-row:hover { background:#f8fafc; }
    .mfd-row.drag-over { border-top:2px solid #32acc1; }
    .mfd-row.dragging  { opacity:.3; }

    .mfd-grip {
      cursor:grab; display:flex; align-items:center;
      color:#cbd5e1; flex-shrink:0;
    }
    .mfd-grip:active { cursor:grabbing; }
    .mfd-row:hover .mfd-grip { color:#94a3b8; }

    .mfd-chk-wrap {
      width:20px; height:20px; flex-shrink:0; cursor:pointer; position:relative;
    }
    .mfd-chk-wrap.locked { cursor:not-allowed; }
    .mfd-chk-wrap input {
      position:absolute; opacity:0; width:0; height:0;
    }
    .mfd-chk-box {
      width:20px; height:20px; border-radius:6px;
      border:1.5px solid #cbd5e1;
      background:#fff;
      display:flex; align-items:center; justify-content:center;
      transition:all .13s;
    }
    .mfd-chk-wrap input:checked + .mfd-chk-box {
      background:#32acc1; border-color:#32acc1;
    }
    .mfd-chk-wrap.locked .mfd-chk-box {
      background:#f1f5f9; border-color:#e2e8f0;
    }
    .mfd-chk-wrap.locked input:checked + .mfd-chk-box {
      background:#a8d8e0; border-color:#a8d8e0;
    }
    .mfd-chk-box svg { display:none; }
    .mfd-chk-wrap input:checked + .mfd-chk-box svg { display:block; }

    /* system row locked style */
    .mfd-row.sys-locked .mfd-name { color:#6b7280; }
    .mfd-row.sys-locked .mfd-ico.sys { opacity:.6; }

    /* lock icon */
    .mfd-lock {
      display:flex; align-items:center; flex-shrink:0;
      color:#cbd5e1;
    }

    .mfd-ico {
      width:30px; height:30px; border-radius:7px;
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
    }
    .mfd-ico.sys  { background:#f1f5f9; color:#94a3b8; }
    .mfd-ico.cust { background:#e6f7fa; color:#32acc1; }

    .mfd-name { font-size:14px; color:#111827; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

    .mfd-tag {
      font-size:11px; font-weight:500; padding:2px 9px;
      border-radius:20px; flex-shrink:0;
    }
    .mfd-tag.sys { background:#f1f5f9; color:#6b7280; }
    .mfd-tag.pri { background:#e6f7fa; color:#0e7a8a; }

    /* 3-dot context menu */
    .ctx-wrap { position:relative; flex-shrink:0; }
    .ctx-btn {
      width:28px; height:28px; border:none; background:transparent;
      cursor:pointer; border-radius:6px; display:flex;
      align-items:center; justify-content:center; color:#9ca3af;
      opacity:0; transition:opacity .1s, background .1s;
    }
    .mfd-row:hover .ctx-btn { opacity:1; }
    .ctx-btn:hover { background:#e5e7eb; color:#374151; }
    .ctx-menu {
      position:absolute; right:0; top:100%;
      background:#fff; border:1px solid #e5e7eb; border-radius:10px;
      box-shadow:0 8px 24px rgba(0,0,0,.12); min-width:220px; z-index:600;
      padding:4px; animation:ctxIn .12s ease;
    }
    @keyframes ctxIn { from{opacity:0;transform:scale(.96) translateY(-4px)} to{opacity:1;transform:none} }
    .ctx-item {
      display:flex; align-items:center; gap:10px;
      padding:9px 12px; font-size:14px; color:#111827;
      cursor:pointer; border-radius:7px; transition:background .08s;
      border:none; background:transparent; width:100%; text-align:left; font-family:inherit;
    }
    .ctx-item:hover { background:#f3f4f6; }
    .ctx-item.danger { color:#ef4444; }
    .ctx-item.danger:hover { background:#fef2f2; }
    .ctx-sep { height:1px; background:#f1f5f9; margin:3px 0; }

    /* footer */
    .mfd-foot {
      padding:16px 18px;
      border-top:1px solid #f1f5f9;
      flex-shrink:0;
    }
    .mfd-add-btn {
      display:flex; align-items:center; justify-content:center; gap:7px;
      width:100%; height:44px; border-radius:11px;
      border:none; background:#32acc1; color:#fff;
      font-size:15px; font-weight:600; cursor:pointer;
      font-family:inherit; transition:background .13s;
    }
    .mfd-add-btn:hover { background:#2b95a8; }
  `],
  template: `
    <div class="mfd-head">
      <p class="mfd-title">Manage Fields</p>
      <p class="mfd-sub">Choose which fields appear in the collection.<br>Changes will only be shown in this view.</p>
    </div>

    <div class="mfd-body" (click)="ctxIdx.set(-1)">
      @for (field of fields(); track field.id; let i = $index) {
        <div class="mfd-row"
             [class.drag-over]="dragOver === i && dragIdx !== i"
             [class.dragging]="dragIdx === i"
             [class.sys-locked]="field.isSystem"
             draggable="true"
             (dragstart)="onDragStart(i, $event)"
             (dragover)="onDragOver($event, i)"
             (dragleave)="dragOver = null"
             (drop)="onDrop(i)"
             (dragend)="onDragEnd()">

          <span class="mfd-grip">
            <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
              <circle cx="4" cy="2.5" r="1.3" fill="currentColor"/>
              <circle cx="8" cy="2.5" r="1.3" fill="currentColor"/>
              <circle cx="4" cy="8"   r="1.3" fill="currentColor"/>
              <circle cx="8" cy="8"   r="1.3" fill="currentColor"/>
              <circle cx="4" cy="13.5" r="1.3" fill="currentColor"/>
              <circle cx="8" cy="13.5" r="1.3" fill="currentColor"/>
            </svg>
          </span>

          <label class="mfd-chk-wrap" [class.locked]="field.isSystem" (click)="$event.stopPropagation()">
            <input type="checkbox"
                   [checked]="field.isVisible !== false"
                   [disabled]="field.isSystem"
                   (change)="!field.isSystem && toggleVis(i, $event)"/>
            <div class="mfd-chk-box">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="2 6 5 9 10 3"/>
              </svg>
            </div>
          </label>

          <div class="mfd-ico" [class.sys]="field.isSystem" [class.cust]="!field.isSystem">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" [innerHTML]="fieldIcon(field.type)"></svg>
          </div>

          <span class="mfd-name">{{ field.name }}</span>

          @if (field.isSystem) { <span class="mfd-tag sys">System</span> }
          @if (field.id === 'sys-title') { <span class="mfd-tag pri">Primary</span> }

          @if (field.isSystem) {
            <span class="mfd-lock" title="System field — managed automatically">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </span>
          } @else {
            <div class="ctx-wrap" (click)="$event.stopPropagation()">
              <button class="ctx-btn" (click)="toggleCtx(i, $event)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
                </svg>
              </button>
              @if (ctxIdx() === i) {
                <div class="ctx-menu">
                  <button class="ctx-item" (click)="editField(i)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                  </button>
                  <button class="ctx-item" (click)="makePrimary(i)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    Make primary
                  </button>
                  <button class="ctx-item" (click)="duplicate(i)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Duplicate field
                  </button>
                  <button class="ctx-item" (click)="duplicate(i, true)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Duplicate with content
                  </button>
                  <div class="ctx-sep"></div>
                  <button class="ctx-item danger" (click)="deleteField(i)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    Delete
                  </button>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>

    <div class="mfd-foot">
      <button class="mfd-add-btn" (click)="openAddField()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Field
      </button>
    </div>
  `
})
export class ManageFieldsDrawerComponent implements OnInit, OnDestroy {
  data   = inject<ManageFieldsDrawerData>(MODAL_DATA);
  ref    = inject<ModalRef>(MODAL_REF);
  private cms       = inject(ContentLibraryService);
  private sanitizer = inject(DomSanitizer);

  fields  = signal<ContentField[]>([]);
  ctxIdx  = signal(-1);
  saving  = signal(false);
  dirty   = signal(false);

  dragIdx: number | null = null;
  dragOver: number | null = null;
  private _explicitClose = false;

  ngOnInit(): void {
    this.fields.set([...(this.data.collection.template?.fields ?? [])]);
  }

  ngOnDestroy(): void {
    // Fires when backdrop/X closes the drawer — set result so afterClosed resolves with updated fields
    if (!this._explicitClose) {
      this.ref.setResult({ saved: true, fields: this.fields() });
    }
  }

  // ── Visibility ──────────────────────────────────────────────────────────
  toggleVis(i: number, e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    this.fields.update(fs => fs.map((f, idx) => { if (idx !== i) return f; const nf = Object.assign(new ContentField(), f); nf.isVisible = checked; return nf; }));
    this.dirty.set(true);
    this.apply();
  }

  // ── Context menu ────────────────────────────────────────────────────────
  toggleCtx(i: number, e: Event): void {
    e.stopPropagation();
    this.ctxIdx.set(this.ctxIdx() === i ? -1 : i);
  }

  editField(i: number): void {
    this._explicitClose = true;
    this.ctxIdx.set(-1);
    this.ref.close({ action: 'edit', field: this.fields()[i] });
  }

  makePrimary(i: number): void {
    this.fields.update(fs => fs.map((f, idx) => { const nf = Object.assign(new ContentField(), f); nf.id = idx === i ? 'sys-title' : (f.id === 'sys-title' ? 'f-' + f.key : f.id); return nf; }));
    this.ctxIdx.set(-1);
    this.dirty.set(true);
    this.apply();
  }

  duplicate(i: number, withContent = false): void {
    const orig = this.fields()[i];
    const dup = Object.assign(new ContentField(), orig); dup.id = 'f-' + Date.now(); dup.name = orig.name + ' (copy)'; dup.key = orig.key + '_copy'; dup.isSystem = false;
    this.fields.update(fs => { const a = [...fs]; a.splice(i + 1, 0, dup); return a; });
    this.ctxIdx.set(-1);
    this.dirty.set(true);
    this.apply();
  }

  deleteField(i: number): void {
    if (!confirm('Delete this field?')) return;
    this.fields.update(fs => fs.filter((_, idx) => idx !== i));
    this.ctxIdx.set(-1);
    this.dirty.set(true);
    this.apply();
  }

  // ── Drag reorder ────────────────────────────────────────────────────────
  onDragStart(i: number, e: DragEvent): void {
    this.dragIdx = i;
    e.dataTransfer!.effectAllowed = 'move';
  }
  onDragOver(e: DragEvent, i: number): void {
    e.preventDefault();
    this.dragOver = i;
  }
  onDrop(targetIdx: number): void {
    if (this.dragIdx === null || this.dragIdx === targetIdx) return;
    this.fields.update(fs => {
      const arr = [...fs];
      const [removed] = arr.splice(this.dragIdx!, 1);
      arr.splice(targetIdx, 0, removed);
      return arr;
    });
    this.dragIdx = null;
    this.dragOver = null;
    this.dirty.set(true);
    this.apply();
  }
  onDragEnd(): void { this.dragIdx = null; this.dragOver = null; }

  // ── Add Field → close drawer, open manage fields modal ─────────────────
  openAddField(): void {
    this._explicitClose = true;
    this.ref.close({ action: 'addField', saved: true, fields: this.fields() });
  }

  // ── Apply & persist ─────────────────────────────────────────────────────
  async apply(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const coll = this.data.collection;
      coll.template.fields = this.fields();
      await this.cms.saveCollection(coll);
      this.dirty.set(false);
    } catch {}
    finally { this.saving.set(false); }
  }

  fieldIcon(type: string): SafeHtml {
    const map: Record<string, string> = {
      text:             '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
      'long-text':      '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/>',
      'rich-text':      '<path d="M4 6h16M4 10h12M4 14h8M4 18h10"/>',
      'rich-content':   '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="14" x2="15" y2="14"/>',
      number:           '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
      boolean:          '<rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="16" cy="12" r="3"/>',
      date:             '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
      datetime:         '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="16" cy="16" r="3"/><line x1="16" y1="14" x2="16" y2="16"/>',
      time:             '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      image:            '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
      'media-gallery':  '<rect x="3" y="3" width="18" height="14" rx="2"/><circle cx="8" cy="9" r="1"/><polyline points="19 13 15 9 8 16"/><path d="M7 21h14"/>',
      video:            '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
      audio:            '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
      document:         '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
      'multi-document': '<path d="M16 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M16 4v4h4"/><path d="M4 8v12a2 2 0 0 0 2 2h10"/>',
      url:              '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
      email:            '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
      tags:             '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
      color:            '<path d="M12 2C7 8 5 12 5 15a7 7 0 0 0 14 0c0-3-2-7-7-13z"/>',
      choice:           '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
      'multi-choice':   '<polyline points="9 11 12 14 22 4"/><polyline points="9 17 12 20 22 10"/>',
      reference:        '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/>',
      'multi-reference':'<rect x="2" y="5" width="6" height="14" rx="1"/><rect x="9" y="5" width="6" height="14" rx="1"/><rect x="16" y="5" width="6" height="14" rx="1"/>',
      address:          '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    };
    return this.sanitizer.bypassSecurityTrustHtml(map[type] ?? map['text']);
  }
}
