import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MODAL_REF, MODAL_DATA } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { ContentField, ContentFieldType, ContentFieldOption } from '../models/content-library.model';
import { ContentLibraryService } from '../services/content-library.service';
import { Website } from '../../models/website.model';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';

type FieldStep = 'choose-type' | 'configure';
type ConfigTab  = 'settings' | 'validations' | 'default';

interface FieldTypeCard { type: ContentFieldType; label: string; desc: string; svgPath: string; section: 'essentials' | 'media' | 'time'; }

const FIELD_CARDS: FieldTypeCard[] = [
  // ── Essentials ──
  { section: 'essentials', type: 'text',            label: 'Text',            desc: 'Titles, paragraph',                  svgPath: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>' },
  { section: 'essentials', type: 'rich-text',       label: 'Rich text',       desc: 'Text with formatting',               svgPath: '<path d="M4 6h16M4 10h12M4 14h8M4 18h10"/>' },
  { section: 'essentials', type: 'rich-content',    label: 'Rich content',    desc: 'Text with links and media',          svgPath: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="14" x2="15" y2="14"/>' },
  { section: 'essentials', type: 'url',             label: 'URL',             desc: 'Links',                              svgPath: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' },
  { section: 'essentials', type: 'email',           label: 'Email',           desc: 'Email addresses',                    svgPath: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>' },
  { section: 'essentials', type: 'number',          label: 'Number',          desc: 'ID, rating, order number',           svgPath: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>' },
  { section: 'essentials', type: 'tags',            label: 'Tags',            desc: 'Tagging items, filters',             svgPath: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>' },
  { section: 'essentials', type: 'boolean',         label: 'Boolean',         desc: 'Yes or no, true or false',           svgPath: '<rect x="3" y="7" width="18" height="10" rx="5"/><rect x="13" y="9" width="6" height="6" rx="3" fill="currentColor"/>' },
  { section: 'essentials', type: 'reference',       label: 'Reference',       desc: 'Link to another collection',         svgPath: '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/>' },
  { section: 'essentials', type: 'multi-reference', label: 'Multi-reference', desc: 'Link to multiple items in another collection', svgPath: '<rect x="2" y="5" width="6" height="14" rx="1"/><rect x="9" y="5" width="6" height="14" rx="1"/><rect x="16" y="5" width="6" height="14" rx="1"/>' },
  { section: 'essentials', type: 'color',           label: 'Color',           desc: 'Pick a HEX color',                   svgPath: '<path d="M12 2C7 8 5 12 5 15a7 7 0 0 0 14 0c0-3-2-7-7-13z"/>' },
  { section: 'essentials', type: 'choice',          label: 'Choice',          desc: 'Pick one from a list',               svgPath: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' },
  { section: 'essentials', type: 'multi-choice',    label: 'Multi-choice',    desc: 'Pick many from a list',              svgPath: '<polyline points="9 11 12 14 22 4"/><polyline points="9 17 12 20 22 10"/>' },

  // ── Media ──
  { section: 'media', type: 'image',          label: 'Image',             desc: 'Upload a single image',                      svgPath: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' },
  { section: 'media', type: 'media-gallery',  label: 'Media gallery',     desc: 'Upload multiple images or videos',           svgPath: '<rect x="3" y="3" width="18" height="14" rx="2"/><circle cx="8" cy="9" r="1"/><polyline points="19 13 15 9 8 16"/><path d="M7 21h14"/>' },
  { section: 'media', type: 'video',          label: 'Video',             desc: 'Upload a single video',                      svgPath: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>' },
  { section: 'media', type: 'audio',          label: 'Audio',             desc: 'Upload an audio file',                       svgPath: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
  { section: 'media', type: 'document',       label: 'Document',          desc: 'Add files to a collection',                  svgPath: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
  { section: 'media', type: 'multi-document', label: 'Multiple documents',desc: 'Upload files, let visitors upload to collection', svgPath: '<path d="M16 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M16 4v4h4"/><path d="M4 8v12a2 2 0 0 0 2 2h10"/>' },

  // ── Time and location ──
  { section: 'time', type: 'date',     label: 'Date',          desc: 'Date of event, date added',          svgPath: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
  { section: 'time', type: 'datetime', label: 'Date and Time', desc: 'Scheduled events and appointments',  svgPath: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="16" cy="16" r="3"/><line x1="16" y1="14" x2="16" y2="16"/>' },
  { section: 'time', type: 'time',     label: 'Time',          desc: 'Opening hours',                      svgPath: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
  { section: 'time', type: 'address',  label: 'Address',       desc: 'Location',                           svgPath: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' },
];

interface FormState {
  name: string; key: string; helpText: string; encrypted: boolean;
  required: boolean;
  cardinality: 'one' | 'many';
  referenceCollectionId: string;
  limitCharCount: boolean; minLength: number|null; maxLength: number|null;
  acceptSpecific: boolean; specificValues: string;
  limitRange: boolean; rangeMin: number|null; rangeMax: number|null;
  regex: string;
  limitItemCount: boolean; minItems: number|null; maxItems: number|null;
  defaultText: string; defaultBool: boolean; defaultNum: number|null;
  options: { label: string; value: string }[];
  newOption: string;
}

function blankForm(): FormState {
  return {
    name:'', key:'', helpText:'', encrypted: false,
    required: false,
    cardinality: 'one',
    referenceCollectionId: '',
    limitCharCount: false, minLength: null, maxLength: null,
    acceptSpecific: false, specificValues: '',
    limitRange: false, rangeMin: null, rangeMax: null,
    regex: '',
    limitItemCount: false, minItems: null, maxItems: null,
    defaultText: '', defaultBool: false, defaultNum: null,
    options: [], newOption: '',
  };
}

@Component({
  selector: 'app-manage-fields-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective],
  styles: [`
    :host { font-family:'Inter',-apple-system,sans-serif; color:#111827; }

    /* ── Shell ── */
    .modal { width:100%; max-height:82vh; display:flex; flex-direction:column; }

    /* ── Header ── */
    .mh { display:flex; align-items:flex-start; justify-content:space-between; padding:22px 24px 18px; border-bottom:1px solid #f1f5f9; flex-shrink:0; }
    .mh-title { font-size:18px; font-weight:700; color:#111827; margin:0 0 4px; }
    .mh-sub   { font-size:13px; color:#6b7280; margin:0; line-height:1.45; }
    .close-btn { border:none; background:transparent; cursor:pointer; color:#9ca3af; width:30px; height:30px; border-radius:7px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .close-btn:hover { background:#f3f4f6; color:#374151; }

    /* ── Body ── */
    .body { flex:1; overflow-y:auto; }

    /* ══ STEP 1 ══ */
    .section-lbl { padding:16px 24px 8px; font-size:11px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:.06em; }
    .type-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; padding:0 24px 20px; }
    .type-card {
      display:flex; align-items:flex-start; gap:11px;
      padding:13px 14px; border:1.5px solid #e5e7eb; border-radius:10px;
      cursor:pointer; transition:all .13s; background:#fff;
    }
    .type-card:hover { border-color:#94a3b8; background:#fafafa; }
    .type-card.sel { border-color:#32acc1; background:#f0fdff; }
    .tc-ico {
      width:32px; height:32px; border-radius:8px; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      background:#f1f5f9; color:#6b7280;
    }
    .type-card.sel .tc-ico { background:#d0f0f7; color:#1a8fa3; }
    .tc-name { font-size:13px; font-weight:600; color:#111827; margin-bottom:2px; }
    .tc-desc { font-size:11px; color:#9ca3af; line-height:1.4; }

    /* ══ STEP 2 ══ */
    /* tabs */
    .tabs { display:flex; gap:0; border-bottom:1px solid #e5e7eb; padding:0 24px; flex-shrink:0; }
    .tab-btn {
      padding:14px 4px; margin-right:24px; font-size:14px; font-weight:500; color:#6b7280;
      border:none; background:transparent; cursor:pointer; border-bottom:2px solid transparent;
      margin-bottom:-1px; font-family:inherit; transition:color .12s, border-color .12s;
    }
    .tab-btn:hover { color:#111827; }
    .tab-btn.active { color:#32acc1; border-bottom-color:#32acc1; }

    /* form */
    .form-body { padding:20px 24px; display:flex; flex-direction:column; gap:18px; }

    .form-group { display:flex; flex-direction:column; gap:6px; }
    .form-label { font-size:13px; font-weight:500; color:#374151; display:flex; align-items:center; gap:5px; }
    .req-star { color:#ef4444; }
    .info-ico { color:#9ca3af; cursor:help; display:flex; align-items:center; }

    .form-input {
      height:40px; border:1.5px solid #e5e7eb; border-radius:8px;
      padding:0 13px; font-size:14px; font-family:inherit; color:#111827;
      outline:none; background:#fff; transition:border-color .13s, box-shadow .13s;
    }
    .form-input:focus { border-color:#32acc1; box-shadow:0 0 0 3px rgba(50,172,193,.1); }
    .form-input.readonly { background:#f8fafc; color:#6b7280; cursor:default; }
    .form-textarea {
      min-height:80px; border:1.5px solid #e5e7eb; border-radius:8px;
      padding:10px 13px; font-size:14px; font-family:inherit; color:#111827;
      outline:none; background:#fff; resize:vertical; transition:border-color .13s;
    }
    .form-textarea:focus { border-color:#32acc1; box-shadow:0 0 0 3px rgba(50,172,193,.1); }

    /* field type display row */
    .ft-row {
      display:flex; align-items:center; gap:10px;
      height:40px; border:1.5px solid #e5e7eb; border-radius:8px;
      padding:0 13px; background:#f8fafc;
    }
    .ft-ico { width:22px; height:22px; border-radius:6px; background:#e0f5f9; color:#1a8fa3; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .ft-name { font-size:14px; color:#111827; flex:1; }
    .ft-change { border:none; background:transparent; font-size:13px; color:#32acc1; cursor:pointer; font-family:inherit; font-weight:500; padding:0; }
    .ft-change:hover { text-decoration:underline; }

    /* divider */
    .form-divider { height:1px; background:#f1f5f9; }
    .card-toggle { display:flex; gap:8px; }
    .card-toggle-btn {
      flex:1; display:inline-flex; align-items:center; justify-content:center; gap:8px;
      padding:10px 14px; border-radius:8px; border:1.5px solid #e2e8f0;
      background:#fff; color:#475569; font-size:13px; font-weight:500;
      cursor:pointer; font-family:inherit; transition:.12s;
    }
    .card-toggle-btn:hover { border-color:#cbd5e1; }
    .card-toggle-btn--active {
      border-color:var(--color-brand-500, #32acc1); background:var(--color-brand-50, #effbfd);
      color:var(--color-brand-700, #207484);
    }

    /* toggle */
    .toggle-row { display:flex; align-items:center; gap:12px; }
    .toggle-label { font-size:14px; color:#374151; display:flex; align-items:center; gap:6px; cursor:pointer; flex:1; }
    .tog {
      position:relative; width:40px; height:22px; flex-shrink:0; cursor:pointer;
    }
    .tog input { position:absolute; opacity:0; width:0; height:0; }
    .tog-track {
      position:absolute; inset:0; border-radius:11px;
      background:#e5e7eb; transition:background .2s;
    }
    .tog input:checked ~ .tog-track { background:#32acc1; }
    .tog-thumb {
      position:absolute; top:3px; left:3px;
      width:16px; height:16px; border-radius:50%;
      background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.2);
      transition:transform .2s;
    }
    .tog input:checked ~ .tog-track .tog-thumb { transform:translateX(18px); }

    /* sub-fields that appear when toggle is on */
    .sub-fields { display:flex; flex-direction:column; gap:10px; padding:10px 0 0 52px; }
    .sub-row { display:flex; align-items:center; gap:10px; }
    .sub-label { font-size:13px; color:#6b7280; min-width:60px; }
    .sub-input { height:34px; border:1.5px solid #e5e7eb; border-radius:7px; padding:0 10px; font-size:13px; font-family:inherit; color:#111827; outline:none; width:100px; }
    .sub-input:focus { border-color:#32acc1; }

    /* options list (choice types) */
    .opts-list { display:flex; flex-direction:column; gap:6px; }
    .opt-row { display:flex; align-items:center; gap:8px; }
    .opt-input { flex:1; height:36px; border:1.5px solid #e5e7eb; border-radius:7px; padding:0 11px; font-size:13px; font-family:inherit; outline:none; }
    .opt-input:focus { border-color:#32acc1; }
    .opt-del { width:28px; height:28px; border:none; background:transparent; cursor:pointer; color:#9ca3af; border-radius:6px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .opt-del:hover { background:#fef2f2; color:#ef4444; }
    .opt-add { display:flex; align-items:center; gap:6px; border:1.5px dashed #e5e7eb; border-radius:7px; padding:8px 12px; font-size:13px; color:#6b7280; cursor:pointer; background:transparent; font-family:inherit; transition:all .12s; }
    .opt-add:hover { border-color:#32acc1; color:#32acc1; }

    /* default-value tab: select input */
    .form-select { height:40px; border:1.5px solid #e5e7eb; border-radius:8px; padding:0 13px; font-size:14px; font-family:inherit; color:#111827; outline:none; background:#fff; cursor:pointer; }
    .form-select:focus { border-color:#32acc1; box-shadow:0 0 0 3px rgba(50,172,193,.1); }

    /* ── Footer ── */
    .mf { display:flex; align-items:center; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid #f1f5f9; flex-shrink:0; }
    .btn {
      height:40px; border-radius:100px; font-size:14px; font-weight:500;
      cursor:pointer; font-family:inherit; padding:0 22px; display:inline-flex; align-items:center; gap:7px;
      transition:all .13s;
    }
    .btn-cancel { border:1.5px solid #e5e7eb; background:#fff; color:#374151; }
    .btn-cancel:hover { background:#f3f4f6; }
    .btn-primary { border:none; background:#32acc1; color:#fff; }
    .btn-primary:hover { background:#2b95a8; }
    .btn-primary:disabled { opacity:.55; cursor:default; }

    .spin { width:14px; height:14px; border-radius:50%; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; animation:spin .6s linear infinite; }
    @keyframes spin { to{transform:rotate(360deg)} }

    /* empty state */
    .empty-opts { font-size:13px; color:#9ca3af; text-align:center; padding:12px 0; }
  `],
  template: `
    <div class="modal">

      <!-- ════ STEP 1: Choose field type ════ -->
      @if (step() === 'choose-type') {
        <div class="mh">
          <div>
            <p class="mh-title">Choose field type</p>
            <p class="mh-sub">You can connect each field to a page element to display its content on your site.</p>
          </div>
          <button class="close-btn" (click)="ref.dismiss()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="body">
          <!-- Essentials -->
          <p class="section-lbl">Essentials</p>
          <div class="type-grid">
            @for (card of essentialCards; track card.type) {
              <div class="type-card" [class.sel]="selectedType()===card.type" (click)="selectType(card.type)">
                <div class="tc-ico">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" [innerHTML]="svgHtml(card.svgPath)"></svg>
                </div>
                <div>
                  <div class="tc-name">{{ card.label }}</div>
                  <div class="tc-desc">{{ card.desc }}</div>
                </div>
              </div>
            }
          </div>

          <!-- Media -->
          <p class="section-lbl">Media</p>
          <div class="type-grid">
            @for (card of mediaCards; track card.type) {
              <div class="type-card" [class.sel]="selectedType()===card.type" (click)="selectType(card.type)">
                <div class="tc-ico">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" [innerHTML]="svgHtml(card.svgPath)"></svg>
                </div>
                <div>
                  <div class="tc-name">{{ card.label }}</div>
                  <div class="tc-desc">{{ card.desc }}</div>
                </div>
              </div>
            }
          </div>

          <!-- Time and location -->
          <p class="section-lbl">Time and location</p>
          <div class="type-grid">
            @for (card of timeCards; track card.type) {
              <div class="type-card" [class.sel]="selectedType()===card.type" (click)="selectType(card.type)">
                <div class="tc-ico">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" [innerHTML]="svgHtml(card.svgPath)"></svg>
                </div>
                <div>
                  <div class="tc-name">{{ card.label }}</div>
                  <div class="tc-desc">{{ card.desc }}</div>
                </div>
              </div>
            }
          </div>
        </div>

        <div class="mf">
          <button class="btn btn-cancel" (click)="ref.dismiss()">Cancel</button>
          <button class="btn btn-primary" (click)="goToConfigure()">
            Choose Field Type
          </button>
        </div>
      }

      <!-- ════ STEP 2: Configure field ════ -->
      @if (step() === 'configure') {
        <div class="mh">
          <div>
            <p class="mh-title">{{ editingField ? 'Edit field' : 'Add a field' }}</p>
          </div>
          <button class="close-btn" (click)="ref.dismiss()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="tabs">
          <button class="tab-btn" [class.active]="tab()==='settings'"    (click)="tab.set('settings')">Settings</button>
          <button class="tab-btn" [class.active]="tab()==='validations'" (click)="tab.set('validations')">Validations</button>
          <button class="tab-btn" [class.active]="tab()==='default'"     (click)="tab.set('default')">Default value</button>
        </div>

        <div class="body">

          <!-- ── Settings tab ── -->
          @if (tab() === 'settings') {
            <div class="form-body">

              <!-- Field type -->
              <div class="form-group">
                <label class="form-label">Field type <span class="req-star">*</span></label>
                <div class="ft-row">
                  <div class="ft-ico">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" [innerHTML]="svgHtml(selectedCard().svgPath)"></svg>
                  </div>
                  <span class="ft-name">{{ selectedCard().label }}</span>
                  @if (!editingField) {
                    <button class="ft-change" (click)="step.set('choose-type')">Change</button>
                  }
                </div>
              </div>

              <!-- Field name -->
              <div class="form-group">
                <label class="form-label">Field name <span class="req-star">*</span></label>
                <input class="form-input" [(ngModel)]="form.name" (ngModelChange)="onNameChange()" placeholder="e.g. Cover Image"/>
              </div>

              <!-- Cardinality: One value or List of values -->
              <div class="form-group">
                <label class="form-label">Values</label>
                <div class="card-toggle">
                  <button
                    [class]="'card-toggle-btn ' + (form.cardinality === 'one' ? 'card-toggle-btn--active' : '')"
                    (click)="form.cardinality = 'one'">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg>
                    One value
                  </button>
                  <button
                    [class]="'card-toggle-btn ' + (form.cardinality === 'many' ? 'card-toggle-btn--active' : '')"
                    (click)="form.cardinality = 'many'">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    List of values
                  </button>
                </div>
              </div>

              <!-- Referenced Collection (reference / multi-reference) -->
              @if (selectedType()==='reference' || selectedType()==='multi-reference') {
                <div class="form-group">
                  <label class="form-label">Referenced Collection <span class="req-star">*</span></label>
                  <select class="form-select" [(ngModel)]="form.referenceCollectionId">
                    <option value="">— Select a collection —</option>
                    @for (coll of collections(); track coll.id) {
                      @if (coll.id !== data.collection.id) {
                        <option [value]="coll.id">{{ coll.template?.displayName || coll.name }}</option>
                      }
                    }
                  </select>
                </div>
              }

              <div class="form-divider"></div>

              <!-- Help text -->
              <div class="form-group">
                <label class="form-label">
                  Help text (optional)
                  <span class="info-ico"
                        [appTooltip]="'Shown as a hint below the field in the CMS editor so authors know what to enter.'"
                        aria-label="Help text info">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  </span>
                </label>
                <input class="form-input" [(ngModel)]="form.helpText" placeholder="Describe this field…"/>
              </div>

              <!-- Options list (for choice / multi-choice) -->
              @if (selectedType()==='choice' || selectedType()==='multi-choice') {
                <div class="form-group">
                  <label class="form-label">Options</label>
                  <div class="opts-list">
                    @if (form.options.length === 0) {
                      <p class="empty-opts">No options yet. Add some below.</p>
                    }
                    @for (opt of form.options; track $index; let i = $index) {
                      <div class="opt-row">
                        <input class="opt-input" [(ngModel)]="opt.label" (ngModelChange)="opt.value = toKey(opt.label)" placeholder="Option label"/>
                        <button class="opt-del" (click)="removeOption(i)" title="Remove">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    }
                    <button class="opt-add" (click)="addOption()">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Add option
                    </button>
                  </div>
                </div>
              }

              <!-- Encrypt toggle (text / url types) -->
              @if (selectedType()==='text' || selectedType()==='url' || selectedType()==='long-text') {
                <div class="toggle-row">
                  <label class="tog">
                    <input type="checkbox" [(ngModel)]="form.encrypted"/>
                    <div class="tog-track"><div class="tog-thumb"></div></div>
                  </label>
                  <span class="toggle-label">
                    Encrypt this field content as Personally Identifiable Information
                    <span class="info-ico" title="Encrypted fields are not searchable or sortable">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </span>
                  </span>
                </div>
              }

            </div>
          }

          <!-- ── Validations tab ── -->
          @if (tab() === 'validations') {
            <div class="form-body">

              <!-- Required (all types) -->
              <div class="toggle-row">
                <label class="tog">
                  <input type="checkbox" [(ngModel)]="form.required"/>
                  <div class="tog-track"><div class="tog-thumb"></div></div>
                </label>
                <span class="toggle-label">
                  Make this a required field
                  <span class="info-ico" title="Prevents saving an item if this field is empty">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  </span>
                </span>
              </div>

              <!-- text / long-text / rich-text / url -->
              @if (['text','long-text','rich-text','url'].includes(selectedType())) {
                <div class="toggle-row">
                  <label class="tog">
                    <input type="checkbox" [(ngModel)]="form.limitCharCount"/>
                    <div class="tog-track"><div class="tog-thumb"></div></div>
                  </label>
                  <span class="toggle-label">
                    Limit character count
                    <span class="info-ico" title="Set minimum and maximum character lengths">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </span>
                  </span>
                </div>
                @if (form.limitCharCount) {
                  <div class="sub-fields">
                    <div class="sub-row">
                      <span class="sub-label">Min</span>
                      <input class="sub-input" type="number" [(ngModel)]="form.minLength" placeholder="0" min="0"/>
                    </div>
                    <div class="sub-row">
                      <span class="sub-label">Max</span>
                      <input class="sub-input" type="number" [(ngModel)]="form.maxLength" placeholder="∞" min="0"/>
                    </div>
                  </div>
                }

                <div class="toggle-row">
                  <label class="tog">
                    <input type="checkbox" [(ngModel)]="form.acceptSpecific"/>
                    <div class="tog-track"><div class="tog-thumb"></div></div>
                  </label>
                  <span class="toggle-label">
                    Accept specific values only
                    <span class="info-ico" title="Comma-separated list of allowed values">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </span>
                  </span>
                </div>
                @if (form.acceptSpecific) {
                  <div class="sub-fields">
                    <input class="form-input" [(ngModel)]="form.specificValues" placeholder="value1, value2, value3"/>
                  </div>
                }
              }

              <!-- regex (text types) -->
              @if (['text','long-text','url','email'].includes(selectedType())) {
                <div class="form-group">
                  <label class="form-label">
                    Regular expression
                    <span class="info-ico" title="Values must match this regex pattern">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </span>
                  </label>
                  <input class="form-input" [(ngModel)]="form.regex" placeholder="e.g. ^[A-Z]{2}\\d{4}$" style="font-family:monospace;font-size:13px"/>
                </div>
              }

              <!-- item count (list fields) -->
              @if (form.cardinality === 'many') {
                <div class="toggle-row">
                  <label class="tog">
                    <input type="checkbox" [(ngModel)]="form.limitItemCount"/>
                    <div class="tog-track"><div class="tog-thumb"></div></div>
                  </label>
                  <span class="toggle-label">
                    Limit number of items
                    <span class="info-ico" title="Set minimum and maximum number of items in the list">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </span>
                  </span>
                </div>
                @if (form.limitItemCount) {
                  <div class="sub-fields">
                    <div class="sub-row">
                      <span class="sub-label">Min items</span>
                      <input class="sub-input" type="number" [(ngModel)]="form.minItems" placeholder="0" min="0"/>
                    </div>
                    <div class="sub-row">
                      <span class="sub-label">Max items</span>
                      <input class="sub-input" type="number" [(ngModel)]="form.maxItems" placeholder="∞" min="1"/>
                    </div>
                  </div>
                }
              }

              <!-- number -->
              @if (selectedType() === 'number') {
                <div class="toggle-row">
                  <label class="tog">
                    <input type="checkbox" [(ngModel)]="form.limitRange"/>
                    <div class="tog-track"><div class="tog-thumb"></div></div>
                  </label>
                  <span class="toggle-label">
                    Set value range
                    <span class="info-ico" title="Restrict values to a min/max range">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </span>
                  </span>
                </div>
                @if (form.limitRange) {
                  <div class="sub-fields">
                    <div class="sub-row">
                      <span class="sub-label">Min</span>
                      <input class="sub-input" type="number" [(ngModel)]="form.rangeMin"/>
                    </div>
                    <div class="sub-row">
                      <span class="sub-label">Max</span>
                      <input class="sub-input" type="number" [(ngModel)]="form.rangeMax"/>
                    </div>
                  </div>
                }
                <div class="toggle-row">
                  <label class="tog">
                    <input type="checkbox" [(ngModel)]="form.acceptSpecific"/>
                    <div class="tog-track"><div class="tog-thumb"></div></div>
                  </label>
                  <span class="toggle-label">
                    Accept specific values only
                    <span class="info-ico" title="Comma-separated list of allowed numbers">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </span>
                  </span>
                </div>
                @if (form.acceptSpecific) {
                  <div class="sub-fields">
                    <input class="form-input" [(ngModel)]="form.specificValues" placeholder="1, 2, 3, 5, 10…"/>
                  </div>
                }
              }

              <!-- date -->
              @if (selectedType() === 'date') {
                <div class="toggle-row">
                  <label class="tog">
                    <input type="checkbox" [(ngModel)]="form.limitRange"/>
                    <div class="tog-track"><div class="tog-thumb"></div></div>
                  </label>
                  <span class="toggle-label">
                    Set date range
                    <span class="info-ico" title="Restrict to a min/max date">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </span>
                  </span>
                </div>
                @if (form.limitRange) {
                  <div class="sub-fields">
                    <div class="sub-row">
                      <span class="sub-label">From</span>
                      <input class="sub-input" type="date" [(ngModel)]="form.specificValues" style="width:160px"/>
                    </div>
                  </div>
                }
              }

              <!-- image -->
              @if (selectedType() === 'image') {
                <div class="toggle-row">
                  <label class="tog">
                    <input type="checkbox" [(ngModel)]="form.limitCharCount"/>
                    <div class="tog-track"><div class="tog-thumb"></div></div>
                  </label>
                  <span class="toggle-label">
                    Set max file size (MB)
                    <span class="info-ico" title="Reject images exceeding this size">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </span>
                  </span>
                </div>
                @if (form.limitCharCount) {
                  <div class="sub-fields">
                    <input class="sub-input" type="number" [(ngModel)]="form.maxLength" placeholder="e.g. 5" min="0"/>
                  </div>
                }
              }

            </div>
          }

          <!-- ── Default value tab ── -->
          @if (tab() === 'default') {
            <div class="form-body">
              <div class="form-group">
                <label class="form-label">
                  Default value
                  <span class="info-ico" title="Pre-fills the field when creating new items">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  </span>
                </label>

                @if (selectedType()==='text' || selectedType()==='long-text' || selectedType()==='rich-text' || selectedType()==='url') {
                  <input class="form-input" [(ngModel)]="form.defaultText" [placeholder]="selectedType()==='url'?'https://…':'Enter default text…'"/>
                }
                @if (selectedType()==='number') {
                  <input class="form-input" type="number" [(ngModel)]="form.defaultNum" placeholder="0"/>
                }
                @if (selectedType()==='boolean') {
                  <div class="toggle-row" style="padding-top:4px">
                    <label class="tog">
                      <input type="checkbox" [(ngModel)]="form.defaultBool"/>
                      <div class="tog-track"><div class="tog-thumb"></div></div>
                    </label>
                    <span class="toggle-label">Default on</span>
                  </div>
                }
                @if (selectedType()==='date') {
                  <input class="form-input" type="date" [(ngModel)]="form.defaultText"/>
                }
                @if (selectedType()==='choice' || selectedType()==='multi-choice') {
                  @if (form.options.length > 0) {
                    <select class="form-select" [(ngModel)]="form.defaultText">
                      <option value="">— None —</option>
                      @for (opt of form.options; track opt.value) {
                        <option [value]="opt.value">{{ opt.label }}</option>
                      }
                    </select>
                  } @else {
                    <p class="empty-opts">Add options in the Settings tab first.</p>
                  }
                }
                @if (selectedType()==='image' || selectedType()==='reference') {
                  <p class="empty-opts" style="padding:0">No default value for this field type.</p>
                }
              </div>
            </div>
          }

        </div><!-- /body -->

        <div class="mf">
          <button class="btn btn-cancel" (click)="step.set('choose-type')">Back</button>
          <button class="btn btn-primary" (click)="save()" [disabled]="saving() || !form.name.trim()">
            @if (saving()) { <span class="spin"></span> }
            Save
          </button>
        </div>
      }

    </div>
  `
})
export class ManageFieldsModalComponent implements OnInit {
  ref  = inject<ModalRef>(MODAL_REF);
  data = inject<{ collection: Website; field?: ContentField }>(MODAL_DATA);
  private cms       = inject(ContentLibraryService);
  private sanitizer = inject(DomSanitizer);

  fieldCards     = FIELD_CARDS;
  essentialCards = FIELD_CARDS.filter(c => c.section === 'essentials');
  mediaCards     = FIELD_CARDS.filter(c => c.section === 'media');
  timeCards      = FIELD_CARDS.filter(c => c.section === 'time');
  step         = signal<FieldStep>('choose-type');
  tab          = signal<ConfigTab>('settings');
  selectedType = signal<ContentFieldType>('text');
  saving       = signal(false);
  editingField: ContentField | null = null;
  collections  = signal<Website[]>([]);

  form: FormState = blankForm();

  ngOnInit(): void {
    this.cms.getCollections().then(c => this.collections.set(c));
    if (this.data.field) {
      this.editingField = this.data.field;
      this.selectedType.set(this.data.field.type);
      this.form.name        = this.data.field.name;
      this.form.key         = this.data.field.key;
      this.form.required    = this.data.field.required;
      this.form.cardinality = this.data.field.cardinality === 'many' ? 'many' : 'one';
      this.form.referenceCollectionId = this.data.field.referenceCollectionId || '';
      this.form.options     = (this.data.field.options ?? []).map(o => ({ label: o.label, value: o.value }));
      // Load validation constraints
      const fd = this.data.field as any;
      this.form.limitCharCount = fd.limitCharCount ?? false;
      this.form.minLength      = fd.minLength ?? null;
      this.form.maxLength      = fd.maxLength ?? null;
      this.form.acceptSpecific = fd.acceptSpecific ?? false;
      this.form.specificValues = fd.specificValues ?? '';
      this.form.limitRange     = fd.limitRange ?? false;
      this.form.rangeMin       = fd.rangeMin ?? null;
      this.form.rangeMax       = fd.rangeMax ?? null;
      this.form.regex          = fd.regex ?? '';
      this.form.limitItemCount = (fd.minItems != null || fd.maxItems != null);
      this.form.minItems       = fd.minItems ?? null;
      this.form.maxItems       = fd.maxItems ?? null;
      this.step.set('configure');
    }
  }

  selectedCard() {
    return FIELD_CARDS.find(c => c.type === this.selectedType()) ?? FIELD_CARDS[0];
  }

  svgHtml(path: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(path);
  }

  selectType(type: ContentFieldType): void {
    this.selectedType.set(type);
  }

  goToConfigure(): void {
    if (!this.editingField) {
      this.form = blankForm();
      this.form.name = this.selectedCard().label;
      this.onNameChange();
    }
    this.step.set('configure');
    this.tab.set('settings');
  }

  onNameChange(): void {
    this.form.key = this.form.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  toKey(label: string): string {
    return label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  addOption(): void {
    this.form.options.push({ label: '', value: '' });
  }

  removeOption(i: number): void {
    this.form.options.splice(i, 1);
  }

  private applyConstraints(f: ContentField): void {
    const a = f as any;
    a.limitCharCount = this.form.limitCharCount;
    a.minLength      = this.form.limitCharCount ? this.form.minLength : null;
    a.maxLength      = this.form.limitCharCount ? this.form.maxLength : null;
    a.acceptSpecific = this.form.acceptSpecific;
    a.specificValues = this.form.acceptSpecific ? this.form.specificValues : '';
    a.limitRange     = this.form.limitRange;
    a.rangeMin       = this.form.limitRange ? this.form.rangeMin : null;
    a.rangeMax       = this.form.limitRange ? this.form.rangeMax : null;
    a.regex          = this.form.regex || '';
    a.minItems       = this.form.limitItemCount ? this.form.minItems : null;
    a.maxItems       = this.form.limitItemCount ? this.form.maxItems : null;
  }

  async save(): Promise<void> {
    if (!this.form.name.trim()) return;
    this.saving.set(true);
    try {
      const coll   = this.data.collection;
      const fields = [...(coll.template?.fields ?? [])];

      if (this.editingField) {
        const idx = fields.findIndex(f => f.id === this.editingField!.id);
        if (idx > -1) {
          const f        = Object.assign(new ContentField(), fields[idx]);
          f.name         = this.form.name;
          f.key          = this.form.key;
          f.type         = this.selectedType();
          f.required     = this.form.required;
          (f as any).cardinality = this.form.cardinality;
          f.options      = this.form.options.map(o => { const opt = new ContentFieldOption(); opt.label = o.label; opt.value = o.value; return opt; });
          f.referenceCollectionId = this.form.referenceCollectionId;
          this.applyConstraints(f);
          fields[idx]    = f;
        }
      } else {
        const f    = new ContentField();
        f.id       = 'f-' + Date.now();
        f.name        = this.form.name;
        f.key         = this.form.key;
        f.type        = this.selectedType();
        f.required    = this.form.required;
        (f as any).cardinality = this.form.cardinality;
        f.isVisible   = true;
        f.options     = this.form.options.map(o => { const opt = new ContentFieldOption(); opt.label = o.label; opt.value = o.value; return opt; });
        f.referenceCollectionId = this.form.referenceCollectionId;
        this.applyConstraints(f);
        fields.push(f);
      }

      coll.template.fields = fields;
      await this.cms.saveCollection(coll);
      this.ref.close({ saved: true, fields });
    } finally {
      this.saving.set(false);
    }
  }
}
