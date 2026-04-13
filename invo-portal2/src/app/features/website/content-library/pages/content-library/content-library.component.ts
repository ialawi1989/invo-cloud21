import { Component, inject, signal, OnInit, OnDestroy, computed, HostListener, Injector } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ContentLibraryService } from '../../services/content-library.service';
import { LayoutService } from '../../../../../core/layout/services/layout.service';
import { ModalService, ModalRef } from '../../../../../shared/modal/modal.service';
import { MODAL_REF, MODAL_DATA } from '../../../../../shared/modal/modal.tokens';
import { Website } from '../../../models/website.model';
import { ContentField, ContentLibraryView, ContentItemTemplate } from '../../models/content-library.model';
import { ManageFieldsModalComponent } from '../../components/manage-fields-modal.component';

import { ManageFieldsDrawerComponent } from '../../components/manage-fields-drawer.component';
import { SortModalComponent, SortResult }     from '../../components/sort-modal.component';
import { FilterModalComponent, FilterResult, FilterCondition } from '../../components/filter-modal.component';
import { ItemDetailDrawerComponent, ItemDrawerData } from '../../components/item-detail-panel.component';
import { CollectionSettingsModalComponent } from '../../components/collection-settings-modal.component';
import { TooltipDirective } from '../../../../../shared/directives/tooltip.directive';
import { ExportCsvModalComponent, ExportCsvData } from '../../components/export-csv-modal.component';
import { ImportCsvModalComponent, ImportCsvData } from '../../components/import-csv-modal.component';
import { BreadcrumbsComponent, BreadcrumbItem } from '../../../../../shared/components/breadcrumbs';
import { SpinnerComponent } from '../../../../../shared/components/spinner';
import { MediaPickerModalComponent, MediaPickerConfig } from '../../../../media/components/media-picker';
import { ImageUrlModalComponent } from '../../../../media/components/image-url-modal';
import { ReferencePickerComponent } from '../../components/reference-picker.component';

type ViewMode = 'table' | 'list' | 'gallery';
interface SortConfig   { field: string; dir: 'asc' | 'desc'; }
interface FilterConfig { field: string; condition: FilterCondition; value: string; }
interface LocalView {
  id: string; name: string; editing: boolean;
  sortConfig: SortConfig | null; filterConfig: FilterConfig | null; viewMode: ViewMode;
}

@Component({
  selector: 'app-content-library',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TooltipDirective, BreadcrumbsComponent, SpinnerComponent, ReferencePickerComponent],
  styles: [`
    /* ── Host tokens — uses CMS design system vars ── */
    :host {
      display:flex; flex-direction:column;
      height:100%; overflow:hidden; position:relative;
      background:var(--cl-bg);
      font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:var(--cl-fs-base); color:var(--cl-t1);
      -webkit-font-smoothing:antialiased;
      --brand:var(--cl-brand);
      --brand-dark:var(--cl-brand-dark);
      --brand-light:var(--cl-brand-light);
      --brand-mid:var(--cl-brand-mid);
      --border:var(--cl-border);
      --border-sub:var(--cl-border-sub);
      --surface:var(--cl-surface);
      --bg:var(--cl-bg);
      --t1:var(--cl-t1);
      --t2:var(--cl-t2);
      --t3:var(--cl-t3);
      --t4:var(--cl-t4);
      --sh:var(--cl-sh);
      --sh-card:var(--cl-sh-card);
    }

    /* ── Breadcrumb ── */
    .bc{display:flex;align-items:center;gap:8px;padding:16px 24px 6px;flex-shrink:0}
    .bc-link{font-size:13px;color:var(--t3);text-decoration:none;transition:color .13s}
    .bc-link:hover{color:var(--brand)}
    .bc-sep{color:var(--t4);display:flex;align-items:center}
    .bc-cur{font-size:13px;font-weight:500;color:var(--t1)}

    /* ── Top bar ── */
    .top-bar{display:flex;align-items:center;justify-content:space-between;padding:0 24px 16px;flex-shrink:0}
    .coll-title{font-size:24px;font-weight:700;color:var(--t1);letter-spacing:-.3px}
    .top-actions{display:flex;align-items:center;gap:12px}

    /* ── Buttons — aligned to CMS design system ── */
    .btn-primary{
      display:inline-flex;align-items:center;gap:7px;
      height:38px;padding:0 20px;border-radius:9px;
      border:none;background:var(--brand);color:#fff;
      font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;
      transition:background .13s;white-space:nowrap;
    }
    .btn-primary:hover{background:var(--brand-dark)}
    .btn-outline{
      display:inline-flex;align-items:center;gap:7px;
      height:38px;padding:0 18px;border-radius:9px;
      border:1.5px solid var(--border);background:var(--surface);
      font-size:14px;font-weight:500;color:var(--t1);
      cursor:pointer;font-family:inherit;transition:all .13s;white-space:nowrap;
    }
    .btn-outline:hover{border-color:#cbd5e1;background:#f9fafb}
    .btn-ghost{
      display:inline-flex;align-items:center;gap:6px;
      height:34px;padding:0 14px;border-radius:8px;
      border:1px solid var(--border);background:var(--surface);
      font-size:13px;font-weight:500;color:var(--t2);
      cursor:pointer;font-family:inherit;transition:all .11s;white-space:nowrap;
    }
    .btn-ghost:hover{background:#f3f4f6;border-color:#cbd5e1;color:var(--t1)}
    .btn-ghost.active{background:var(--brand-light);border-color:var(--brand-mid);color:var(--brand)}
    .btn-text{
      display:inline-flex;align-items:center;gap:5px;
      border:none;background:transparent;
      font-size:13px;font-weight:500;color:var(--t3);
      cursor:pointer;font-family:inherit;padding:0 8px;height:34px;border-radius:7px;
    }
    .btn-text:hover{color:var(--t1);background:#f3f4f6}
    .btn-text:disabled{opacity:.4;cursor:default}

    /* ── Dropdown ── */
    .dw{position:relative}
    .dm{
      position:absolute;top:calc(100% + 5px);right:0;
      background:var(--surface);border:1px solid var(--border);
      border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.1);
      min-width:190px;z-index:300;padding:4px;
      animation:menuIn .12s ease;
    }
    .dm.left{right:auto;left:0}
    @keyframes menuIn{from{opacity:0;transform:translateY(-4px) scale(.97)}to{opacity:1;transform:none}}
    .mi{
      display:flex;align-items:center;gap:8px;
      padding:8px 11px;font-size:14px;color:var(--t1);
      cursor:pointer;border-radius:7px;transition:background .08s;
      font-family:inherit;border:none;background:transparent;width:100%;text-align:left;
    }
    .mi:hover{background:#f3f4f6}
    .mi.danger{color:#ef4444}
    .mi.danger:hover{background:#fef2f2}
    .msep{height:1px;background:var(--border-sub);margin:4px 0}

    /* ── Card ── */
    .card{
      background:var(--surface);
      display:flex;flex-direction:column;overflow:hidden;
      margin:0;flex:1;min-height:0;
    }

    /* ── Toolbar ── */
    .toolbar{
      display:flex;align-items:center;justify-content:space-between;
      padding:10px 24px;min-height:52px;flex-shrink:0;
    }
    .tl{display:flex;align-items:center;gap:8px}
    .tr{display:flex;align-items:center;gap:8px}
    .tname{font-size:15px;font-weight:700;color:var(--t1);white-space:nowrap;margin-right:4px}
    .divider-line{height:1px;background:var(--border);flex-shrink:0}
    .tsep{width:1px;height:16px;background:var(--border);margin:0 2px;flex-shrink:0}
    .badge-count{
      display:inline-flex;align-items:center;justify-content:center;
      min-width:14px;height:14px;padding:0 3px;
      border-radius:7px;background:var(--brand);color:#fff;font-size:10px;font-weight:700;
    }

    /* layout toggle buttons */
    .view-toggles{display:flex;align-items:center;gap:0;border:1px solid var(--border);border-radius:8px;overflow:hidden}
    .vt-btn{
      display:flex;align-items:center;justify-content:center;
      width:36px;height:32px;
      border:none;background:var(--surface);
      cursor:pointer;color:var(--t3);
      transition:all .11s;border-right:1px solid var(--border);
    }
    .vt-btn svg{width:18px;height:18px}
    .vt-btn:last-child{border-right:none}
    .vt-btn:hover{color:var(--t1);background:#f3f4f6}
    .vt-btn.active{color:var(--brand);background:var(--brand-light)}

    /* search */
    .sw{
      display:flex;align-items:center;gap:8px;
      height:34px;border:1px solid var(--border);border-radius:8px;
      padding:0 12px;background:var(--surface);transition:all .13s;width:210px;
    }
    .sw:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px rgba(50,172,193,.1)}
    .sw input{border:none;outline:none;font-size:14px;font-family:inherit;background:transparent;color:var(--t1);width:100%}
    .sw input::placeholder{color:var(--t4)}

    /* chips */
    .chips{display:flex;align-items:center;gap:6px;padding:0 24px 8px;flex-shrink:0;flex-wrap:wrap}
    .chip{
      display:inline-flex;align-items:center;gap:4px;
      height:22px;padding:0 9px;border-radius:11px;
      background:var(--brand-light);border:1px solid var(--brand-mid);
      font-size:12px;font-weight:500;color:var(--brand);
    }
    .chip-x{
      display:flex;align-items:center;justify-content:center;
      width:13px;height:13px;border-radius:50%;
      background:var(--brand-mid);cursor:pointer;border:none;
      padding:0;color:var(--brand);font-size:9px;transition:background .1s;
    }
    .chip-x:hover{background:#7ecfe0}

    /* ── View tabs ── */
    .tabs-row{display:flex;align-items:stretch;gap:0;padding:0 24px;flex-shrink:0;border-bottom:1px solid var(--border)}
    .tab{
      display:flex;align-items:center;gap:6px;
      padding:10px 18px;
      font-size:13px;font-weight:500;color:var(--t3);
      cursor:pointer;font-family:inherit;
      border:none;background:transparent;
      border-bottom:2px solid transparent;
      margin-bottom:-1px;
      transition:all .12s;white-space:nowrap;
    }
    .tab:hover{color:var(--t1)}
    .tab.active{color:var(--brand);border-bottom-color:var(--brand);font-weight:600;background:var(--surface)}
    .tab-count{font-size:11px;color:var(--t4);margin-left:2px}
    .tab.active .tab-count{color:var(--brand-mid)}
    .tab input.rename-inp{background:transparent;border:none;outline:none;font:inherit;color:inherit;width:90px;padding:0}
    .tab-new{
      display:flex;align-items:center;gap:5px;padding:10px 16px;
      border:none;background:transparent;
      cursor:pointer;color:var(--t4);font-size:13px;font-weight:500;
      white-space:nowrap;font-family:inherit;transition:color .11s;
    }
    .tab-new:hover{color:var(--brand)}

    /* ── Content ── */
    .content{flex:1;display:flex;overflow:hidden}

    /* ── Table ── */
    .tw{flex:1;overflow:auto}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    thead th:not(:first-child):not(:last-child){width:220px;min-width:220px;max-width:220px}
    thead th{
      background:#f9fafb;border-bottom:1.5px solid var(--border);
      padding:0;height:44px;text-align:left;
      font-size:12px;font-weight:700;color:var(--t2);
      letter-spacing:.04em;text-transform:uppercase;
      position:sticky;top:0;z-index:2;user-select:none;cursor:pointer;
    }
    thead th:last-child{cursor:default}
    .thi{display:flex;align-items:center;justify-content:space-between;padding:0 14px;height:44px}
    .th-l{display:flex;align-items:center;gap:6px;flex:1;min-width:0;overflow:hidden}
    .th-l span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .th-ico{
      display:flex;align-items:center;justify-content:center;
      width:18px;height:18px;border-radius:4px;background:var(--border-sub);flex-shrink:0;color:var(--t4);
    }
    .th-flag{color:var(--brand);flex-shrink:0}
    .th-more{
      opacity:0;background:none;border:none;cursor:pointer;
      color:var(--t4);padding:2px;border-radius:4px;display:flex;align-items:center;
      transition:opacity .14s;flex-shrink:0;
    }
    thead th:hover .th-more{opacity:1}
    .th-more.open{opacity:1;background:#f3f4f6;color:var(--t2)}

    /* ── Column header menu ── */
    .col-menu-wrap{position:relative;flex-shrink:0}
    .col-menu{
      position:absolute;top:calc(100% + 4px);right:0;
      background:var(--surface);border:1px solid var(--border);
      border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.12);
      min-width:220px;z-index:400;padding:4px;
      animation:menuIn .12s ease;
    }
    .cmi{
      display:flex;align-items:center;gap:9px;
      padding:8px 11px;font-size:13px;color:var(--t1);
      cursor:pointer;border-radius:7px;transition:background .08s;
      border:none;background:transparent;width:100%;text-align:left;font-family:inherit;
    }
    .cmi:hover{background:#f3f4f6}
    .cmi.disabled{opacity:.4;cursor:default;pointer-events:none}
    .cmi.danger{color:#ef4444}
    .cmi.danger:hover{background:#fef2f2}
    .cmi-sep{height:1px;background:var(--border-sub);margin:3px 0}
    .cmi-ext{margin-left:auto;color:var(--t4)}

    .sort-arrows{display:flex;flex-direction:column;gap:0;opacity:.2;transition:opacity .12s;flex-shrink:0}
    .sort-arrows.on{opacity:1}
    .sa-up,.sa-dn{display:block;color:var(--t4)}
    .sa-up.hi,.sa-dn.hi{color:var(--brand)}
    .afth{display:flex;align-items:center;gap:5px;color:var(--brand);font-size:13px;font-weight:500;text-transform:none;letter-spacing:0;cursor:pointer}
    .afth:hover{text-decoration:underline}

    td{
      border-bottom:1px solid var(--border-sub);border-right:1px solid var(--border-sub);
      height:48px;padding:0;vertical-align:middle;
      font-size:14px;color:var(--t1);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
    }
    td:last-child{border-right:none}
    td .cell{padding:4px 14px;min-height:48px;display:flex;align-items:center;gap:8px}
    tr.br{cursor:pointer;transition:background .07s}
    tr.br:hover td{background:#f7f9fc}
    tr.br.sel td{background:#f0fdff!important}
    tr.br.dragging{opacity:.25;pointer-events:none}
    tr.br.drag-over{position:relative}
    tr.br.drag-over td{background:var(--brand-light)!important}
    tr.br.drag-over::after{
      content:'';position:absolute;left:0;right:0;top:-1px;height:2px;
      background:var(--brand);z-index:10;border-radius:1px;
      box-shadow:0 0 6px rgba(50,172,193,.35);
    }

    /* sticky status col */
    thead th:first-child{position:sticky;left:0;z-index:3;background:#f9fafb}
    tbody td:first-child{position:sticky;left:0;z-index:3;background:var(--surface)}
    tbody tr.br:hover td:first-child{background:#f7f9fc}
    tbody tr.br.sel td:first-child{background:#f0fdff!important}

    /* row counter cell */
    .rcc{display:flex;align-items:center;justify-content:center;height:48px;gap:6px;padding:0 8px;position:relative}
    .drag-grip{position:absolute;left:2px;display:flex;align-items:center;opacity:0;transition:opacity .14s;cursor:grab;color:#cbd5e1;flex-shrink:0}
    .drag-grip:active{cursor:grabbing}
    tr:hover .drag-grip{opacity:1}
    .rn{font-size:13px;color:var(--t4);width:20px;text-align:center;font-weight:500}
    /* Row number shown by default, hidden on hover; checkbox hidden by default, shown on hover */
    tr:hover .rn-default{display:none}
    .rn-checkbox{display:none}
    tr:hover .rn-checkbox{display:inline-flex}
    tr.br.sel .rn-default{display:none}
    tr.br.sel .rn-checkbox{display:inline-flex}


    /* checkboxes */
    /* custom checkbox */
    .chk-wrap{position:relative;width:18px;height:18px;flex-shrink:0;cursor:pointer;display:inline-flex}
    .chk-wrap input{position:absolute;opacity:0;width:0;height:0}
    .chk-box{
      width:18px;height:18px;border-radius:5px;
      border:1.5px solid #cbd5e1;background:#fff;
      display:flex;align-items:center;justify-content:center;
      transition:all .13s;
    }
    .chk-wrap input:checked+.chk-box{background:var(--brand);border-color:var(--brand)}
    .chk-box svg{display:none}
    .chk-wrap input:checked+.chk-box svg{display:block}

    /* visible badge */
    .badge-vis{display:inline-flex;align-items:center;background:#dcfce7;color:#166534;font-size:12px;font-weight:500;padding:2px 9px;border-radius:20px;white-space:nowrap}
    .badge-hid{display:inline-flex;align-items:center;background:#f1f5f9;color:var(--t3);font-size:12px;font-weight:500;padding:2px 9px;border-radius:20px;white-space:nowrap}

    /* status badges on title */
    .sl-open{display:inline-flex;align-items:center;background:#dcfce7;color:#15803d;font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;white-space:nowrap;margin-left:6px;flex-shrink:0}
    .sl-draft{display:inline-flex;align-items:center;background:#f1f5f9;color:var(--t3);font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;white-space:nowrap;margin-left:6px;flex-shrink:0}

    /* slug */
    .slug-fixed{color:var(--t4);font-size:13px}
    .slug-var{color:var(--t2);font-size:13px}

    /* image */
    .img-thumb{width:40px;height:28px;border-radius:4px;background:#f1f5f9;border:1px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
    .img-thumb img{width:100%;height:100%;object-fit:cover}
    .img-thumb svg{color:rgba(255,255,255,.7)}
    .img-full{width:48px;height:30px;border-radius:4px;overflow:hidden;flex-shrink:0}
    .img-full img{width:100%;height:100%;object-fit:cover}
    .img-cell-row{display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding:4px 0}
    .img-cell-sq{width:36px;height:36px;border-radius:5px;overflow:hidden;flex-shrink:0;border:1px solid #e2e8f0}
    .img-cell-sq img{width:100%;height:100%;object-fit:cover}
    .img-cell-sq--clickable{cursor:pointer;transition:.12s}
    .img-cell-sq--clickable:hover{border-color:var(--brand);box-shadow:0 0 0 2px var(--brand-light)}
    .img-cell-add{width:36px;height:36px;border-radius:5px;border:1.5px dashed #cbd5e1;background:none;display:flex;align-items:center;justify-content:center;color:#94a3b8;cursor:pointer;flex-shrink:0;transition:.12s}
    .img-cell-add:hover{border-color:var(--brand);color:var(--brand);background:var(--brand-light)}

    /* inline edit — input fills the cell exactly, border via td outline */
    td:has(.ei){
      background:#fff!important;
      box-shadow:inset 0 0 0 2px var(--brand);
      position:relative;z-index:1;
    }
    td:has(.ei) .cell{padding:0 14px}
    .ei{
      flex:1;width:100%;min-width:0;border:none;background:transparent;
      padding:0;font-size:14px;font-family:inherit;color:var(--t1);
      outline:none;height:100%;box-sizing:border-box;
      text-overflow:ellipsis;
    }

    /* list value tags */
    .list-tags { display:flex; flex-wrap:wrap; gap:4px; align-items:center; }
    .list-tag {
      display:inline-flex; align-items:center; height:22px;
      padding:0 8px; border-radius:4px;
      background:#f1f5f9; color:#475569; font-size:12px; font-weight:500;
      white-space:nowrap; max-width:120px; overflow:hidden; text-overflow:ellipsis;
    }
    .list-tag-more {
      display:inline-flex; align-items:center; height:22px;
      padding:0 6px; border-radius:4px;
      background:#e0f5f9; color:#0e7a8a; font-size:11px; font-weight:600;
    }
    .list-tag-x {
      width:14px;height:14px;border:none;background:none;cursor:pointer;
      color:#94a3b8;display:flex;align-items:center;justify-content:center;
      border-radius:50%;padding:0;flex-shrink:0;margin-left:2px;
    }
    .list-tag-x:hover{color:#dc2626;background:#fee2e2}
    .list-tag-add {
      display:inline-flex;align-items:center;gap:3px;height:22px;
      padding:0 8px;border:none;background:none;cursor:pointer;
      font-size:12px;font-weight:500;color:var(--brand);font-family:inherit;white-space:nowrap;
    }
    .list-tag-add:hover{color:var(--brand-dark)}

    /* inline drawer (inside modal) */
    .inline-drawer-backdrop {
      position:absolute;inset:0;background:rgba(0,0,0,.25);z-index:100;
    }
    .inline-drawer {
      position:absolute;top:0;right:0;bottom:0;width:380px;z-index:101;
      background:#fff;box-shadow:-4px 0 20px rgba(0,0,0,.1);
      animation:slide-in-right .18s ease-out;
      display:flex;flex-direction:column;
    }
    @keyframes slide-in-right {
      from{transform:translateX(100%)} to{transform:translateX(0)}
    }

    /* reference cell */
    td:has(app-reference-picker) { overflow:visible; }
    td:has(app-reference-picker) .cell { overflow:visible; }

    /* inline edit error */
    td:has(.ei-error){
      box-shadow:inset 0 0 0 2px #ef4444!important;
    }
    .ei-error-msg{
      position:absolute;bottom:-28px;left:0;right:0;z-index:10;
      background:#fef2f2;color:#dc2626;font-size:11px;font-weight:500;
      padding:4px 10px;border:1px solid #fecaca;border-radius:0 0 6px 6px;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      box-shadow:0 2px 6px rgba(0,0,0,.08);
    }
    .ei.ei-error{color:#dc2626}

    /* Excel-like focused cell */
    td.cell-focused{
      box-shadow:inset 0 0 0 2px var(--brand);
      background:#fff!important;
      position:relative;z-index:1;
    }

    /* Cell action buttons (Open / URL link / image add) */
    .cell-open-btn{
      display:inline-flex;align-items:center;
      height:24px;padding:0 12px;margin-left:auto;
      border:none;border-radius:100px;
      background:var(--brand);color:#fff;
      font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;
      transition:background .12s;flex-shrink:0;
    }
    .cell-open-btn:hover{background:var(--brand-dark)}

    .cell-action-link{
      display:inline-flex;align-items:center;
      height:22px;padding:0 8px;margin-left:auto;
      border:none;background:transparent;
      color:var(--brand);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;
      flex-shrink:0;
    }
    .cell-action-link:hover{text-decoration:underline}

    .cell-action-btn{
      display:inline-flex;align-items:center;justify-content:center;
      width:22px;height:22px;
      border:1px solid var(--border);background:#fff;
      border-radius:5px;cursor:pointer;color:var(--t2);flex-shrink:0;
      transition:all .12s;
    }
    .cell-action-btn:hover{background:#f3f4f6;border-color:#94a3b8;color:var(--t1)}
    .cell-action-btn--right{margin-left:auto}

    /* vis dropdown */
    .vis-btn{
      display:inline-flex;align-items:center;gap:4px;
      padding:3px 11px;border-radius:20px;font-size:12px;font-weight:600;
      cursor:pointer;border:none;font-family:inherit;transition:all .12s;white-space:nowrap;
    }
    .vis-btn.visible{background:#dcfce7;color:#15803d}
    .vis-btn.visible:hover{background:#bbf7d0}
    .vis-btn.hidden{background:#f1f5f9;color:var(--t3)}
    .vis-btn.hidden:hover{background:#e5e7eb}
    .vis-menu{
      position:fixed;
      background:var(--surface);border:1px solid var(--border);border-radius:10px;
      box-shadow:0 8px 24px rgba(0,0,0,.14);z-index:9999;min-width:210px;padding:4px;
      animation:menuIn .12s ease;
    }
    .vis-opt{display:flex;align-items:flex-start;gap:10px;padding:8px 10px;cursor:pointer;border-radius:7px;transition:background .08s}
    .vis-opt:hover{background:#f3f4f6}
    .vis-opt.active{background:var(--brand-light)}
    .vis-dot{width:11px;height:11px;border-radius:50%;margin-top:2px;flex-shrink:0}
    .vis-on{font-size:14px;font-weight:500;color:var(--t1)}
    .vis-sub{font-size:12px;color:var(--t3)}

    /* add row */
    .arb{
      display:inline-flex;align-items:center;gap:4px;
      background:none;border:none;color:var(--brand);
      font-family:inherit;font-size:14px;font-weight:500;cursor:pointer;padding:9px 12px;
    }
    .arb:hover{text-decoration:underline}

    /* List view */
    .lw{flex:1;overflow:auto}
    .lh{display:flex;align-items:center;gap:12px;padding:10px 16px;background:#f9fafb;border-bottom:1.5px solid var(--border);font-size:12px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.04em;position:sticky;top:0;z-index:5}
    .lr{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border-sub);cursor:pointer;transition:background .07s}
    .lr:hover{background:#f7f9fc}
    .lr.sel{background:var(--brand-light)!important}
    .lt{width:38px;height:38px;border-radius:7px;background:#f1f5f9;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .lt img{width:100%;height:100%;object-fit:cover}
    .li{flex:1;min-width:0}
    .ln{font-size:14px;font-weight:500;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .lm{font-size:12px;color:var(--t3);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ldel{width:26px;height:26px;border:none;background:transparent;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--t4);opacity:0;transition:all .1s}
    .lr:hover .ldel{opacity:1}
    .ldel:hover{background:#fef2f2;color:#ef4444}
    .alr{display:flex;align-items:center;gap:4px;padding:9px 12px;font-size:14px;color:var(--brand);cursor:pointer;transition:background .1s;border:none;background:none;font-family:inherit;font-weight:500}
    .alr:hover{text-decoration:underline}

    /* Gallery view */
    .gw{flex:1;overflow:auto;padding:16px 24px}
    .gg{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}
    .gc{border:1px solid var(--border);border-radius:10px;overflow:hidden;cursor:pointer;transition:all .15s;background:var(--surface);box-shadow:var(--sh)}
    .gc:hover{border-color:var(--brand);box-shadow:0 4px 14px rgba(0,0,0,.08);transform:translateY(-1px)}
    .gc.sel{border:2px solid var(--brand);box-shadow:0 0 0 3px rgba(50,172,193,.12)}
    .gi{height:140px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .gi img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
    .gc:hover .gi img{transform:scale(1.03)}
    .gb{padding:10px 12px 12px}
    .gt{font-size:14px;font-weight:500;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .gs{font-size:12px;color:var(--t3);margin-top:2px}
    .gst{margin-top:6px}
    .ga{border:1.5px dashed #cbd5e1;border-radius:10px;min-height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer;color:var(--t4);font-size:14px;transition:all .13s}
    .ga:hover{border-color:var(--brand);color:var(--brand);background:var(--brand-light)}

    /* empty / loading */
    .es{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:60px;color:var(--t4)}
    .ei2{width:50px;height:50px;border-radius:12px;background:#f3f4f6;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;margin-bottom:4px}
    .et{font-size:16px;font-weight:700;color:var(--t1)}
    .esub{font-size:14px;color:var(--t3);text-align:center;max-width:280px;line-height:1.5}
    .ld{flex:1;display:flex;align-items:center;justify-content:center;gap:10px;color:var(--t3);font-size:14px}
    .spin{width:17px;height:17px;border-radius:50%;border:2.5px solid #e5e7eb;border-top-color:var(--brand);animation:spin .65s linear infinite;display:inline-block}
    @keyframes spin{to{transform:rotate(360deg)}}

    @media(max-width:768px){
      .top-bar,.bc,.tabs-row,.card,.gw,.chips{padding-left:14px;padding-right:14px}
      .card{margin-left:0;margin-right:0}
      .tname{display:none}
    }
  `],
  template: `
    <!-- BREADCRUMB -->
    <div class="bc">
      <app-breadcrumbs [items]="collBreadcrumbs()" />
    </div>

    <!-- TOP BAR -->
    <div class="top-bar">
      <h1 class="coll-title">{{ collection()?.template?.displayName || '…' }}</h1>
      <div class="top-actions">
        <div class="dw">
          <button class="btn-outline" (click)="toggleMoreActions($event)">
            More Actions
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8.146 10.146a.5.5 0 0 1 .708 0L12.5 13.798l3.65-3.652a.5.5 0 0 1 .708.708L12.5 15.212 8.146 10.854a.5.5 0 0 1 0-.708Z"/></svg>
          </button>
          @if (moreOpen()) {
            <div class="dm" (click)="$event.stopPropagation()">
              <button class="mi" (click)="importCsv(); moreOpen.set(false)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Import items
              </button>
              <button class="mi" (click)="exportCsv(); moreOpen.set(false)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export to CSV
              </button>
              <div class="msep"></div>
              <button class="mi" (click)="openSettings(); moreOpen.set(false)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
                Collection settings
              </button>
              <div class="msep"></div>
              <button class="mi danger" (click)="moreOpen.set(false)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                Delete collection
              </button>
            </div>
          }
        </div>
        <button class="btn-primary" (click)="newItem()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Item
        </button>
      </div>
    </div>

    <!-- CHIPS -->
    @if (activeSort() || activeFilter()) {
      <div class="chips">
        @if (activeSort()) {
          <span class="chip">
            Sort: {{ getSortName() }} {{ activeSort()!.dir === 'asc' ? 'A→Z' : 'Z→A' }}
            <button class="chip-x" (click)="clearSort()">✕</button>
          </span>
        }
        @if (activeFilter()) {
          <span class="chip">
            {{ getFilterName() }} {{ activeFilter()!.condition }} "{{ activeFilter()!.value }}"
            <button class="chip-x" (click)="clearFilter()">✕</button>
          </span>
        }
      </div>
    }

    <!-- CARD -->
    <div class="card">
      <!-- TOOLBAR -->
      <div class="toolbar">
        <div class="tl">
          <!-- Layout toggle buttons -->
          <div class="view-toggles">
            <button class="vt-btn" [class.active]="viewMode()==='table'" (click)="setView('table')" appTooltip="Table view">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            </button>
            <button class="vt-btn" [class.active]="viewMode()==='list'" (click)="setView('list')" appTooltip="List view">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor"/></svg>
            </button>
            <button class="vt-btn" [class.active]="viewMode()==='gallery'" (click)="setView('gallery')" appTooltip="Gallery view">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
            </button>
          </div>

          <button class="btn-text" (click)="reloadItems()" appTooltip="Refresh to update item order.">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 19c-3.866 0-7-3.134-7-7h1c0 3.314 2.686 6 6 6 2.22 0 4.16-1.207 5.197-3H14v-1h5v5h-1v-3.392A6.99 6.99 0 0 1 12 19Zm-2-10V8H5V5h1v3.392A6.99 6.99 0 0 1 12 5c3.866 0 7 3.134 7 7h-1c0-3.314-2.686-6-6-6-2.221 0-4.16 1.207-5.197 3H10v1H5Z"/></svg>
            Refresh order
          </button>
        </div>
        <div class="tr">
          <button class="btn-ghost" [class.active]="manageFieldsActive()" (click)="openManageFieldsDrawer()" appTooltip="Add, remove, or reorder fields">
            <svg width="12" height="12" viewBox="0 0 18 18" fill="currentColor"><path d="M14 11H7v2h7v-2Zm0-3H7v2h7V8ZM4 11v2h2v-2H4Zm0-1h2V8H4v2Zm3-5v2h7V5H7ZM6 5H4v2h2V5ZM4 4h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/></svg>
            Manage Fields
          </button>
          <button class="btn-ghost" [class.active]="!!activeSort()" (click)="openSort()" appTooltip="Sort items by field">
            Sort
            @if (activeSort()) { <span class="badge-count">1</span> }
          </button>
          <button class="btn-ghost" [class.active]="!!activeFilter()" (click)="openFilter()" appTooltip="Filter items by condition">
            Filter
            @if (activeFilter()) { <span class="badge-count">1</span> }
          </button>
          <div class="sw">
            <svg width="13" height="13" viewBox="0 0 18 18" fill="currentColor" style="color:#9ca3af;flex-shrink:0"><path d="M14.854 14.147a.5.5 0 0 1-.704.703l-2.13-2.124A5 5 0 1 1 13 8.5a4.97 4.97 0 0 1-1.274 3.32l2.128 2.127ZM8.5 13a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z"/></svg>
            <input [(ngModel)]="searchQuery" placeholder="Search items…" (input)="onSearch()"/>
            @if (searchQuery) {
              <button style="border:none;background:transparent;cursor:pointer;color:#9ca3af;padding:0;font-size:15px;line-height:1" (click)="searchQuery='';onSearch()">×</button>
            }
          </div>
        </div>
      </div>
      <div class="divider-line"></div>

      <!-- CONTENT -->
      <div class="content" (click)="closePopovers()">
        @if (loading()) {
          <div class="ld"><app-spinner size="sm" class="text-brand-500" /> Loading items…</div>
        } @else if (processedItems().length === 0 && !searchQuery) {
          <div class="es">
            <div class="ei2"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg></div>
            <p class="et">No items yet</p>
            <p class="esub">Start by adding your first item to this collection.</p>
            <button class="btn-primary" (click)="newItem()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add First Item
            </button>
          </div>
        } @else if (processedItems().length === 0) {
          <div class="es">
            <div class="ei2"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
            <p class="et">No results</p>
            <p class="esub">Try a different search term or remove your filters.</p>
            <button class="btn-ghost" (click)="searchQuery='';onSearch()">Clear search</button>
          </div>
        } @else {

          <!-- TABLE -->
          @if (viewMode() === 'table') {
            <div class="tw">
              <table>
                <thead>
                  <tr>
                    <!-- Sticky selection / row-number col -->
                    <th style="width:64px;cursor:default;padding:0">
                      <div class="thi" style="justify-content:center;padding:0 14px">
                        <label class="chk-wrap">
                          <input type="checkbox"
                                 [checked]="selectedIds().size===processedItems().length&&processedItems().length>0"
                                 (change)="toggleSelectAll($event)"/>
                          <div class="chk-box"><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><polyline points="2 6 5 9 10 3"/></svg></div>
                        </label>
                      </div>
                    </th>
                    <!-- Field columns -->
                    @for (field of visibleFields(); track field.id) {
                      <th style="cursor:default">
                        <div class="thi">
                          <div class="th-l">
                            @if (field.id==='sys-title' || field.key==='title') {
                              <svg class="th-flag" viewBox="0 0 18 18" fill="currentColor" width="13" height="13"><path d="M6 11V15H5V4h8.5a.5.5 0 0 1 .407.791L12.1 7.5l1.829 2.744A.5.5 0 0 1 13.5 11H6Z"/></svg>
                            }
                            <span class="th-ico">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" [innerHTML]="fieldIcon(field.type)"></svg>
                            </span>
                            <span>{{ field.name }}</span>
                            <span class="sort-arrows" style="display:none">
                              <svg width="8" height="5" viewBox="0 0 8 5" fill="none" class="sa-up"><path d="M1 4l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                              <svg width="8" height="5" viewBox="0 0 8 5" fill="none" class="sa-dn"><path d="M1 1l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            </span>
                          </div>
                          <!-- 3-dot menu -->
                          <div class="col-menu-wrap" (click)="$event.stopPropagation()">
                            <button class="th-more" [class.open]="colMenuField()===field.id"
                                    (click)="toggleColMenu(field.id, $event)">
                              <svg viewBox="0 0 18 18" fill="currentColor" width="15" height="15"><path d="M4 8h2v2H4V8Zm4 0h2v2H8V8Zm4 0h2v2h-2V8Z"/></svg>
                            </button>
                            @if (colMenuField() === field.id) {
                              <div class="col-menu">
                                <!-- Edit -->
                                <button class="cmi" (click)="colMenuEdit(field)">
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
                                  Edit
                                </button>

                                @if (!field.isSystem) {
                                  <!-- Make primary -->
                                  <button class="cmi" [class.disabled]="field.id==='sys-title'" (click)="colMenuMakePrimary(field)">
                                    <svg width="13" height="13" viewBox="0 0 18 18" fill="currentColor"><path d="M6 11V15H5V4h8.5a.5.5 0 0 1 .407.791L12.1 7.5l1.829 2.744A.5.5 0 0 1 13.5 11H6Z"/></svg>
                                    Make primary
                                  </button>
                                }

                                <!-- Hide -->
                                <button class="cmi" (click)="colMenuHide(field)">
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                  Hide
                                </button>

                                @if (!field.isSystem) {
                                  <div class="cmi-sep"></div>
                                  <!-- Duplicate field -->
                                  <button class="cmi" (click)="colMenuDuplicate(field, false)">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                    Duplicate field
                                  </button>
                                  <!-- Duplicate with content -->
                                  <button class="cmi" (click)="colMenuDuplicate(field, true)">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                    Duplicate field with content
                                  </button>
                                }

                                <div class="cmi-sep"></div>

                                <!-- Sort options (not for image/boolean) -->
                                @if (!['image','boolean','rich-text'].includes(field.type)) {
                                  <button class="cmi" (click)="colMenuSort(field, 'asc')">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/></svg>
                                    Sort A → Z
                                  </button>
                                  <button class="cmi" (click)="colMenuSort(field, 'desc')">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="3" y1="18" x2="21" y2="18"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="6" x2="15" y2="6"/></svg>
                                    Sort Z → A
                                  </button>
                                }

                                <!-- Filter -->
                                <button class="cmi" (click)="colMenuFilter(field)">
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                                  Filter
                                </button>

                                @if (!field.isSystem) {
                                  <div class="cmi-sep"></div>
                                  <button class="cmi danger" (click)="colMenuDelete(field)">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                                    Delete
                                  </button>
                                }
                              </div>
                            }
                          </div>
                        </div>
                      </th>
                    }
                    <!-- Add Field -->
                    <th style="cursor:pointer" (click)="openManageFieldsDrawer()">
                      <div class="thi"><div class="afth">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Add Field
                      </div></div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of processedItems(); track item.id; let i = $index) {
                    <tr class="br" [class.sel]="selectedIds().has(item.id)"
                        [class.dragging]="dragIdx===i" [class.drag-over]="dragOver===i&&dragIdx!==i"
                        (click)="selectItem(item)" draggable="true"
                        (dragstart)="onDragStart(i,$event)" (dragover)="onDragOver($event,i)"
                        (dragleave)="dragOver=null" (drop)="onDrop($event,i)" (dragend)="onDragEnd()">

                      <!-- Sticky row-number col -->
                      <td style="width:64px;padding:0;position:relative;overflow:visible" (click)="$event.stopPropagation()">
                        <div class="rcc">
                          <span class="drag-grip">
                            <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
                              <circle cx="4" cy="2.5"  r="1.2" fill="#A8CAFF"/>
                              <circle cx="8" cy="2.5"  r="1.2" fill="#A8CAFF"/>
                              <circle cx="4" cy="8"    r="1.2" fill="#A8CAFF"/>
                              <circle cx="8" cy="8"    r="1.2" fill="#A8CAFF"/>
                              <circle cx="4" cy="13.5" r="1.2" fill="#A8CAFF"/>
                              <circle cx="8" cy="13.5" r="1.2" fill="#A8CAFF"/>
                            </svg>
                          </span>
                          <span class="rn rn-default">{{ i+1 }}</span>
                          <label class="chk-wrap rn-checkbox" (click)="$event.stopPropagation()">
                            <input type="checkbox" [checked]="selectedIds().has(item.id)"
                                   (change)="toggleSelect(item.id,$event)"/>
                            <div class="chk-box"><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><polyline points="2 6 5 9 10 3"/></svg></div>
                          </label>
                        </div>
                      </td>

                      <!-- Field cells -->
                      @for (field of visibleFields(); track field.id; let colIdx = $index) {
                        <td [class.cell-focused]="focusedCell()?.rowIdx===i&&focusedCell()?.colIdx===colIdx&&!(editCell()?.itemId===item.id&&editCell()?.fieldId===field.id)"
                            (click)="onCellClick(item, field, i, colIdx, $event)"
                            (dblclick)="onCellDblClick(item, field, $event)">
                          <div class="cell">
                            @if (editCell()?.itemId===item.id && editCell()?.fieldId===field.id) {
                              <!-- ══ EDIT MODE ══ -->
                              @if (field.type==='long-text' || field.type==='rich-text') {
                                <input class="ei" [class.ei-error]="editError()" [(ngModel)]="editValue"
                                       (blur)="saveEdit(item)" (keydown.enter)="saveEdit(item)"
                                       (keydown.escape)="cancelEdit()"
                                       (ngModelChange)="validateInline(field)"
                                       (click)="$event.stopPropagation()" autofocus/>
                              } @else if (field.type==='date') {
                                <input class="ei" [class.ei-error]="editError()" type="date" [(ngModel)]="editValue"
                                       (blur)="saveEdit(item)" (change)="saveEdit(item)"
                                       (keydown.enter)="saveEdit(item)" (keydown.escape)="cancelEdit()"
                                       (click)="$event.stopPropagation()" autofocus/>
                              } @else {
                                <input class="ei" [class.ei-error]="editError()" [(ngModel)]="editValue"
                                       [type]="field.type==='number' ? 'number' : 'text'"
                                       (blur)="saveEdit(item)" (keydown.enter)="saveEdit(item)"
                                       (keydown.escape)="cancelEdit()"
                                       (ngModelChange)="validateInline(field)"
                                       (click)="$event.stopPropagation()" autofocus/>
                              }
                              @if (editError()) {
                                <div class="ei-error-msg">{{ editError() }}</div>
                              }
                            } @else if (field.type==='image') {
                              <!-- ══ IMAGE CELL ══ -->
                              <div class="img-cell-row">
                                @if (isImageArray(item.template?.data?.[field.key])) {
                                  <!-- Multiple: squares + add button -->
                                  @for (img of item.template.data[field.key]; track $index) {
                                    <div class="img-cell-sq"><img [src]="img.url" alt=""/></div>
                                  }
                                  <button class="img-cell-add" (click)="openImagePicker(item, field, $event)" title="Add image">
                                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                  </button>
                                } @else if (item.template?.data?.[field.key]?.url) {
                                  <!-- Single with value: click to replace -->
                                  <div class="img-cell-sq img-cell-sq--clickable" (click)="openImagePicker(item, field, $event)"><img [src]="item.template.data[field.key].url" alt=""/></div>
                                } @else {
                                  <!-- Empty: add button -->
                                  <button class="img-cell-add" (click)="openImagePicker(item, field, $event)" title="Add image">
                                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                  </button>
                                }
                              </div>
                            } @else if (field.type==='video' || field.type==='audio' || field.type==='document' || field.type==='multi-document') {
                              <!-- ══ MEDIA CELL (video/audio/document) ══ -->
                              <div class="img-cell-row">
                                @if (item.template?.data?.[field.key]?.url) {
                                  <div class="img-cell-sq img-cell-sq--clickable" (click)="openMediaCellPicker(item, field, $event)">
                                    <svg width="16" height="16" fill="none" stroke="#64748b" stroke-width="1.5" viewBox="0 0 24 24" [innerHTML]="fieldIcon(field.type)"></svg>
                                  </div>
                                } @else {
                                  <button class="img-cell-add" (click)="openMediaCellPicker(item, field, $event)" [title]="'Add ' + field.type">
                                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                  </button>
                                }
                              </div>
                            } @else if (field.type==='boolean') {
                              <!-- ══ BOOLEAN CELL — direct checkbox ══ -->
                              <label class="chk-wrap" (click)="toggleBool(item, field, $event)">
                                <input type="checkbox" [checked]="!!item.template?.data?.[field.key]"/>
                                <div class="chk-box"><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><polyline points="2 6 5 9 10 3"/></svg></div>
                              </label>
                            } @else if (field.type==='url') {
                              <!-- ══ URL / SLUG CELL ══ -->
                              <span class="slug-var">{{ item.template?.data?.[field.key] || '' }}</span>
                              @if (focusedCell()?.rowIdx===i && focusedCell()?.colIdx===colIdx && item.template?.data?.[field.key]) {
                                <button class="cell-action-link" (click)="openSlugLink(item, field, $event)">Open Link</button>
                              }
                            } @else if (field.id==='sys-title' || field.key==='title') {
                              <!-- ══ TITLE CELL ══ -->
                              <span style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ displayCellValue(item.template?.data?.[field.key]) }}</span>
                              @if (focusedCell()?.rowIdx===i && focusedCell()?.colIdx===colIdx) {
                                <button class="cell-open-btn" (click)="openItemDrawerFromCell(item, $event)">Open</button>
                              }
                            } @else if (field.type==='reference' || field.type==='multi-reference') {
                              <!-- ══ REFERENCE CELL ══ -->
                              <app-reference-picker
                                [collectionId]="field.referenceCollectionId"
                                [multiple]="field.type==='multi-reference'"
                                [compact]="true"
                                [focused]="focusedCell()?.rowIdx===i && focusedCell()?.colIdx===colIdx"
                                [value]="item.template?.data?.[field.key] ?? null"
                                (valueChange)="onRefChange(item, field, $event)"
                              />
                            } @else if (field.cardinality === 'many' || isListValue(item.template?.data?.[field.key])) {
                              <!-- ══ LIST VALUES AS TAGS (editable) ══ -->
                              <div class="list-tags">
                                @for (tag of getListArray(item, field); track $index) {
                                  <span class="list-tag">
                                    {{ tag }}
                                    <button class="list-tag-x" (click)="removeListTag(item, field, $index, $event)">
                                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                  </span>
                                }
                                <button class="list-tag-add" (click)="addListTag(item, field, $event)">
                                  <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                  Add
                                </button>
                              </div>
                            } @else {
                              <span style="font-size:14px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ displayCellValue(item.template?.data?.[field.key]) }}</span>
                            }
                          </div>
                        </td>
                      }
                      <td style="border-right:none"></td>
                    </tr>
                  }
                </tbody>
              </table>
              <button class="arb" (click)="newItem()">
                <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17"><path d="M12 12V6h-1v6H5v1h6v6h1v-6h6v-1z"/></svg>
                Add Item
              </button>
            </div>
          }

          <!-- LIST -->
          @if (viewMode() === 'list') {
            <div class="lw">
              <div class="lh">
                <label class="chk-wrap">
                  <input type="checkbox" [checked]="selectedIds().size===processedItems().length" (change)="toggleSelectAll($event)"/>
                  <div class="chk-box"><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><polyline points="2 6 5 9 10 3"/></svg></div>
                </label>
                <span style="width:42px;flex-shrink:0">Image</span>
                <span style="flex:1">Title</span>
                <span style="width:80px;text-align:center">Status</span>
                <span style="width:28px"></span>
              </div>
              @for (item of processedItems(); track item.id) {
                <div class="lr" [class.sel]="selectedIds().has(item.id)" (click)="selectItem(item)">
                  <label class="chk-wrap" (click)="$event.stopPropagation()">
                    <input type="checkbox" [checked]="selectedIds().has(item.id)" (change)="toggleSelect(item.id,$event)"/>
                    <div class="chk-box"><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><polyline points="2 6 5 9 10 3"/></svg></div>
                  </label>
                  <div class="lt">
                    @if (getImgUrl(item)) { <img [src]="getImgUrl(item)" alt=""/> }
                    @else { <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> }
                  </div>
                  <div class="li">
                    <div class="ln">{{ item.template?.data?.['title'] || item.name }}</div>
                    <div class="lm">{{ item.template?.data?.['slug'] || '' }}</div>
                  </div>
                  <div style="width:80px;text-align:center;flex-shrink:0">
                    @if ((item.template?.status==='published' || item.template?.data?.['published']===true)) { <span class="sl-open">Open</span> }
                    @else { <span class="sl-draft">Draft</span> }
                  </div>
                  <button class="ldel" (click)="deleteItem($event,item)" title="Delete">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  </button>
                </div>
              }
              <button class="alr" (click)="newItem()">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 12V6h-1v6H5v1h6v6h1v-6h6v-1z"/></svg>
                Add Item
              </button>
            </div>
          }

          <!-- GALLERY -->
          @if (viewMode() === 'gallery') {
            <div class="gw">
              <div class="gg">
                @for (item of processedItems(); track item.id) {
                  <div class="gc" [class.sel]="selectedIds().has(item.id)" (click)="selectItem(item)">
                    <div class="gi">
                      @if (getImgUrl(item)) { <img [src]="getImgUrl(item)" alt=""/> }
                      @else { <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> }
                    </div>
                    <div class="gb">
                      <div class="gt">{{ item.template?.data?.['title'] || item.name }}</div>
                      <div class="gs">{{ item.template?.data?.['slug'] || '' }}</div>
                      <div class="gst">
                        @if ((item.template?.status==='published' || item.template?.data?.['published']===true)) { <span class="sl-open">Open</span> }
                        @else { <span class="sl-draft">Draft</span> }
                      </div>
                    </div>
                  </div>
                }
                <div class="ga" (click)="newItem()">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Item
                </div>
              </div>
            </div>
          }
        }

      </div>
    </div>

    <!-- Inline drawer (when inside a modal) -->
    @if (inlineDrawerOpen()) {
      <div class="inline-drawer-backdrop" (click)="closeInlineDrawer()"></div>
      <div class="inline-drawer">
        <ng-container *ngComponentOutlet="inlineDrawerComp; injector: inlineDrawerInjector"/>
      </div>
    }
  `
})
export class ContentLibraryComponent implements OnInit, OnDestroy {
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private cms       = inject(ContentLibraryService);
  private modalSvc  = inject(ModalService);
  private layoutSvc = inject(LayoutService);
  private sanitizer = inject(DomSanitizer);
  private parentModalRef = inject(MODAL_REF, { optional: true });
  private parentInjector = inject(Injector);

  // Inline drawer (used when component is inside a modal)
  inlineDrawerOpen     = signal(false);
  inlineDrawerComp: any = null;
  inlineDrawerInjector: Injector | undefined = undefined;

  collectionId = '';
  collection   = signal<Website | null>(null);

  collBreadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
    { label: 'Content Library', routerLink: '/website/content-library' },
    { label: this.collection()?.template?.displayName || '…' },
  ]);
  items        = signal<Website[]>([]);
  loading      = signal(true);
  searchQuery  = '';
  viewMode     = signal<ViewMode>('table');
  moreOpen     = signal(false);
  layoutOpen   = signal(false);
  selectedIds  = signal<Set<string>>(new Set());
  panelItem    = signal<Website | null | undefined>(undefined);
  editCell     = signal<{ itemId: string; fieldId: string; fieldKey: string } | null>(null);
  focusedCell  = signal<{ rowIdx: number; colIdx: number } | null>(null);
  editValue    = '';
  editError    = signal<string>('');
  visMenuId    = signal<string | null>(null);
  visMenuPos   = { top: 0, left: 0 };
  colMenuField = signal<string | null>(null);
  manageFieldsActive = signal(false);

  // Views
  views       = signal<LocalView[]>([{ id: 'default', name: 'Default view', editing: false, sortConfig: null, filterConfig: null, viewMode: 'table' }]);
  activeViewId = signal('default');

  // Drag
  dragIdx: number | null = null;
  dragOver: number | null = null;
  private dragPreview: HTMLElement | null = null;

  private clickListener = () => {
    this.moreOpen.set(false);
    this.layoutOpen.set(false);
    this.visMenuId.set(null);
    this.colMenuField.set(null);
    // Commit any pending edit, then clear the focused cell
    if (this.editCell()) this.commitEditByRef();
    this.focusedCell.set(null);
  };

  allFields     = computed<ContentField[]>(() => this.collection()?.template?.fields ?? []);
  visibleFields = computed<ContentField[]>(() => this.allFields().filter((f: ContentField) => f.isVisible !== false));

  activeView   = computed(() => this.views().find(v => v.id === this.activeViewId()) ?? this.views()[0]);
  activeViewName = computed(() => this.activeView()?.name ?? 'Default view');
  activeSort   = computed(() => this.activeView()?.sortConfig ?? null);
  activeFilter = computed(() => this.activeView()?.filterConfig ?? null);

  processedItems = computed(() => {
    let data = [...this.items()];
    const q = this.searchQuery.toLowerCase().trim();
    if (q) data = data.filter(it => Object.values(it.template?.data ?? {}).some((v: any) => String(v).toLowerCase().includes(q)));
    const fc = this.activeFilter();
    if (fc) {
      data = data.filter(it => {
        const val = String(it.template?.data?.[fc.field] ?? '').toLowerCase();
        const fv  = fc.value.toLowerCase();
        switch (fc.condition) {
          case 'is':          return val === fv;
          case 'contains':    return val.includes(fv);
          case 'starts-with': return val.startsWith(fv);
          case 'not-empty':   return val.trim() !== '';
          case 'empty':       return val.trim() === '';
          default:            return true;
        }
      });
    }
    const sc = this.activeSort();
    if (sc && sc.field !== '__index') {
      // Non-index sorts: sort by field data
      data.sort((a, b) => {
        const av = String(a.template?.data?.[sc.field] ?? '');
        const bv = String(b.template?.data?.[sc.field] ?? '');
        return sc.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    } else {
      // Default: sort by template.index
      data.sort((a, b) => {
        const ai = (a.template?.index ?? 9999) as number;
        const bi = (b.template?.index ?? 9999) as number;
        return ai - bi;
      });
    }
    return data;
  });

  ngOnInit(): void {
    if (!this.parentModalRef) this.layoutSvc.setNoPadding(true);
    document.addEventListener('click', this.clickListener);
    this.collectionId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadCollection().then(() => this.loadItems());
  }
  ngOnDestroy(): void {
    if (!this.parentModalRef) this.layoutSvc.setNoPadding(false);
    document.removeEventListener('click', this.clickListener);
    this.dragPreview?.remove();
  }

  async loadCollection(): Promise<void> { this.collection.set(await this.cms.getCollectionById(this.collectionId)); }
  async loadItems(): Promise<void> {
    this.loading.set(true);
    try {
      const { list } = await this.cms.getItems(this.collectionId);
      // Normalize: always hydrate template into a ContentItemTemplate instance.
      // The API response items don't include a 'type' field, so Website.ParseJson
      // never creates a ContentItemTemplate — template stays as a raw object.
      list.forEach((item, i) => {
        // Capture raw server values BEFORE ParseJson overwrites with defaults
        const rawTpl = item.template && typeof item.template === 'object' ? item.template as any : {};
        const rawIndex = 'index' in rawTpl ? rawTpl.index : undefined;
        const rawOrder = '_order' in rawTpl ? rawTpl._order : undefined;

        if (!(item.template instanceof ContentItemTemplate)) {
          const tpl = new ContentItemTemplate();
          tpl.ParseJson(rawTpl);
          item.template = tpl;
        }

        // Priority: index → _order (legacy) → server order
        if (rawIndex !== undefined && rawIndex !== null) {
          item.template.index = rawIndex;
        } else if (rawOrder !== undefined && rawOrder !== null) {
          item.template.index = rawOrder;
        } else {
          item.template.index = 1000 + i;
        }
      });

      // Sort items by their stored index (ascending) — create new array so the signal detects change
      const sorted = [...list].sort((a, b) => (a.template?.index ?? 9999) - (b.template?.index ?? 9999));

      this.items.set(sorted);
    }
    finally { this.loading.set(false); }
  }
  async reloadItems(): Promise<void> { await this.loadItems(); }

  // ── Views ──────────────────────────────────────────────────────────────────
  switchView(id: string): void { this.activeViewId.set(id); }
  addView(): void {
    const id = 'v-' + Date.now();
    const src = this.activeView();
    this.views.update(vs => [...vs, { id, name: 'Untitled View', editing: false, sortConfig: null, filterConfig: null, viewMode: src?.viewMode ?? 'table' }]);
    this.activeViewId.set(id);
  }
  startRename(id: string, e: Event): void {
    e.stopPropagation();
    this.views.update(vs => vs.map(v => ({ ...v, editing: v.id === id })));
  }
  finishRename(view: LocalView): void { this.views.update(vs => vs.map(v => v.id === view.id ? { ...v, editing: false, name: view.name || 'Untitled View' } : v)); }
  cancelRename(view: LocalView): void { this.views.update(vs => vs.map(v => ({ ...v, editing: false }))); }

  // ── Layout / toolbar ───────────────────────────────────────────────────────
  setView(mode: ViewMode): void {
    this.viewMode.set(mode);
    this.layoutOpen.set(false);
  }
  toggleMoreActions(e: Event): void { e.stopPropagation(); this.moreOpen.update(v => !v); this.layoutOpen.set(false); }
  toggleLayoutMenu(e: Event): void  { e.stopPropagation(); this.layoutOpen.update(v => !v); this.moreOpen.set(false); }
  closePopovers(): void { this.visMenuId.set(null); this.colMenuField.set(null); }
  onSearch(): void { /* reactive */ }
  openSettings(): void {
    const coll = this.collection(); if (!coll) return;
    const ref = this.modalSvc.open(CollectionSettingsModalComponent, {
      size: 'lg', closeOnBackdrop: false,
      data: { collection: coll }
    });
    ref.afterClosed().then((r: any) => { if (r?.saved) this.loadCollection(); });
  }

  // ── Column header 3-dot menu ───────────────────────────────────────────────
  toggleColMenu(fieldId: string, e: Event): void {
    e.stopPropagation();
    this.colMenuField.set(this.colMenuField() === fieldId ? null : fieldId);
  }

  colMenuEdit(field: ContentField): void {
    this.colMenuField.set(null);
    this.openManageFieldsModal(field);
  }

  colMenuMakePrimary(field: ContentField): void {
    this.colMenuField.set(null);
    const coll = this.collection(); if (!coll) return;
    const fields = coll.template.fields.map((f: ContentField) => {
      const nf = Object.assign(new ContentField(), f);
      nf.id = f.id === field.id ? 'sys-title' : (f.id === 'sys-title' ? 'f-' + f.key : f.id);
      return nf;
    });
    coll.template.fields = fields;
    this.collection.set({ ...coll } as any);
    this.cms.saveCollection(coll).then(() => this.loadCollection());
  }

  colMenuHide(field: ContentField): void {
    this.colMenuField.set(null);
    const coll = this.collection(); if (!coll) return;
    const fields = coll.template.fields.map((f: ContentField) => {
      if (f.id !== field.id) return f;
      const nf = Object.assign(new ContentField(), f);
      nf.isVisible = false;
      return nf;
    });
    coll.template.fields = fields;
    this.collection.set({ ...coll } as any);
    this.cms.saveCollection(coll);
  }

  async colMenuDuplicate(field: ContentField, withContent: boolean): Promise<void> {
    this.colMenuField.set(null);
    const coll = this.collection(); if (!coll) return;

    // 1. Duplicate the field definition
    const dup    = Object.assign(new ContentField(), field);
    dup.id       = 'f-' + Date.now();
    dup.name     = field.name + ' (copy)';
    dup.key      = field.key + '_copy';
    dup.isSystem = false;
    const idx    = coll.template.fields.findIndex((f: ContentField) => f.id === field.id);
    const fields = [...coll.template.fields];
    fields.splice(idx + 1, 0, dup);
    coll.template.fields = fields;
    this.collection.set({ ...coll } as any);
    await this.cms.saveCollection(coll);

    // 2. Copy item values into the new key when withContent
    if (withContent) {
      const saves = this.items().map(item => {
        const val = item.template?.data?.[field.key];
        if (val === undefined || val === null || val === '') return Promise.resolve();
        item.template.data = { ...(item.template.data ?? {}), [dup.key]: val };
        return this.cms.saveItem(item, this.collectionId).catch(() => {});
      });
      await Promise.all(saves);
      // Refresh items signal so cells re-render
      this.items.set([...this.items()]);
    }
  }

  colMenuSort(field: ContentField, dir: 'asc' | 'desc'): void {
    this.colMenuField.set(null);
    this.views.update(vs => vs.map(v =>
      v.id === this.activeViewId() ? { ...v, sortConfig: { field: field.key, dir } } : v
    ));
  }

  colMenuFilter(field: ContentField): void {
    this.colMenuField.set(null);
    const ref = this.modalSvc.open(FilterModalComponent, {
      size: 'sm',
      data: { fields: this.visibleFields(), current: { field: field.key, condition: 'contains' as any, value: '' } }
    });
    ref.afterClosed().then((r: FilterResult | null | undefined) => {
      if (r === undefined) return;
      this.views.update(vs => vs.map(v => v.id === this.activeViewId() ? { ...v, filterConfig: r } : v));
    });
  }

  async colMenuDelete(field: ContentField): Promise<void> {
    this.colMenuField.set(null);
    if (!confirm(`Delete field "${field.name}"? This cannot be undone.`)) return;
    const coll = this.collection(); if (!coll) return;
    coll.template.fields = coll.template.fields.filter((f: ContentField) => f.id !== field.id);
    this.collection.set({ ...coll } as any);
    await this.cms.saveCollection(coll);
  }

  // ── Sort / Filter – use ModalService ──────────────────────────────────────
  toggleSort(field: string): void {
    const sc = this.activeSort();
    const next = sc?.field === field ? { field, dir: (sc.dir === 'asc' ? 'desc' : 'asc') as 'asc'|'desc' } : { field, dir: 'asc' as const };
    this.views.update(vs => vs.map(v => v.id === this.activeViewId() ? { ...v, sortConfig: next } : v));
  }
  clearSort(): void  { this.views.update(vs => vs.map(v => v.id === this.activeViewId() ? { ...v, sortConfig: null } : v)); }
  clearFilter(): void { this.views.update(vs => vs.map(v => v.id === this.activeViewId() ? { ...v, filterConfig: null } : v)); }

  openSort(): void {
    const ref = this.modalSvc.open(SortModalComponent, {
      size: 'sm',
      data: { fields: this.visibleFields(), current: this.activeSort() }
    });
    ref.afterClosed().then((r: SortResult | null | undefined) => {
      if (r === undefined) return; // dismissed
      this.views.update(vs => vs.map(v => v.id === this.activeViewId() ? { ...v, sortConfig: r } : v));
    });
  }

  openFilter(): void {
    const ref = this.modalSvc.open(FilterModalComponent, {
      size: 'sm',
      data: { fields: this.visibleFields(), current: this.activeFilter() }
    });
    ref.afterClosed().then((r: FilterResult | null | undefined) => {
      if (r === undefined) return;
      this.views.update(vs => vs.map(v => v.id === this.activeViewId() ? { ...v, filterConfig: r } : v));
    });
  }

  getSortName(): string   {
    const f = this.activeSort()?.field;
    if (f === '__index') return 'Order';
    return this.visibleFields().find(v => v.key === f)?.name ?? '';
  }
  getFilterName(): string { return this.visibleFields().find(f => f.key === this.activeFilter()?.field)?.name ?? ''; }

  // ── Manage Fields Drawer ──────────────────────────────────────────────────
  openManageFieldsDrawer(): void {
    const coll = this.collection(); if (!coll) return;
    this.manageFieldsActive.set(true);

    if (this.parentModalRef) {
      let _result: any;
      const fakeRef = {
        close: (result: any) => {
          _result = result;
          this.inlineDrawerOpen.set(false);
          this.manageFieldsActive.set(false);
          this.handleManageFieldsResult(result);
        },
        dismiss: () => {
          this.inlineDrawerOpen.set(false);
          this.manageFieldsActive.set(false);
          if (_result) this.handleManageFieldsResult(_result);
        },
        setResult: (r: any) => { _result = r; },
        afterClosed: () => Promise.resolve(undefined),
      };
      this.inlineDrawerComp = ManageFieldsDrawerComponent;
      this.inlineDrawerInjector = Injector.create({
        parent: this.parentInjector,
        providers: [
          { provide: MODAL_REF, useValue: fakeRef },
          { provide: MODAL_DATA, useValue: { collection: coll } },
        ],
      });
      this.inlineDrawerOpen.set(true);
      return;
    }

    const ref = this.modalSvc.open(ManageFieldsDrawerComponent, {
      drawer: true, drawerWidth: '340px', closeOnBackdrop: true,
      data: { collection: coll }
    });
    ref.afterClosed().then((result: any) => {
      this.manageFieldsActive.set(false);
      this.handleManageFieldsResult(result);
    });
  }

  private handleManageFieldsResult(result: any): void {
    if (result?.action === 'addField') {
      this.openManageFieldsModal();
    } else if (result?.action === 'edit') {
      this.openManageFieldsModal(result.field);
    } else if (result?.saved) {
      const coll = this.collection();
      if (coll && result.fields) {
        coll.template.fields = result.fields;
        this.collection.set({ ...coll } as any);
      }
      this.loadCollection();
    }
  }

  openManageFieldsModal(field?: any): void {
    const coll = this.collection(); if (!coll) return;
    const ref = this.modalSvc.open(ManageFieldsModalComponent, { size: 'md', closeOnBackdrop: false, data: { collection: coll, field: field ?? null } });
    ref.afterClosed().then((r: any) => { if (r?.saved) this.loadCollection(); });
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  toggleSelect(id: string, e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    const next = new Set(this.selectedIds()); if (checked) next.add(id); else next.delete(id);
    this.selectedIds.set(next);
  }
  toggleSelectAll(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    this.selectedIds.set(checked ? new Set(this.processedItems().map(i => i.id)) : new Set());
  }

  // ── Row drag ──────────────────────────────────────────────────────────────
  onDragStart(i: number, e: DragEvent): void {
    this.dragIdx = i; e.dataTransfer!.effectAllowed = 'move';
    const title = this.processedItems()[i]?.template?.data?.['title'] ?? `Item ${i+1}`;
    const preview = document.createElement('div');
    preview.style.cssText = 'position:fixed;top:-200px;left:0;background:#fff;border:1.5px solid #32acc1;border-radius:9px;padding:7px 16px;font-size:13px;font-weight:500;color:#111827;box-shadow:0 4px 14px rgba(50,172,193,.25);display:flex;align-items:center;gap:8px;white-space:nowrap;pointer-events:none;font-family:Inter,sans-serif';
    preview.innerHTML = `<svg width="10" height="14" viewBox="0 0 10 14" fill="none"><circle cx="3" cy="2.5" r="1.2" fill="#A8CAFF"/><circle cx="7" cy="2.5" r="1.2" fill="#A8CAFF"/><circle cx="3" cy="7" r="1.2" fill="#A8CAFF"/><circle cx="7" cy="7" r="1.2" fill="#A8CAFF"/><circle cx="3" cy="11.5" r="1.2" fill="#A8CAFF"/><circle cx="7" cy="11.5" r="1.2" fill="#A8CAFF"/></svg>${title}`;
    document.body.appendChild(preview); this.dragPreview = preview;
    e.dataTransfer!.setDragImage(preview, -16, 22);
  }
  onDragOver(e: DragEvent, i: number): void { e.preventDefault(); e.dataTransfer!.dropEffect = 'move'; this.dragOver = i; }
  onDrop(e: DragEvent, targetIdx: number): void {
    e.preventDefault();
    if (this.dragIdx === null || this.dragIdx === targetIdx) return;

    // Reorder by index: work with the currently-displayed (sorted) items
    const arr = [...this.processedItems()];
    const [r] = arr.splice(this.dragIdx, 1);
    arr.splice(targetIdx, 0, r);

    // Assign new indices so the sort reflects the new order
    arr.forEach((item, i) => { if (item.template) item.template.index = i; });

    this.items.set(arr);
    this.dragIdx = targetIdx;
    this.saveOrder(arr);
  }
  onDragEnd(): void { this.dragIdx = null; this.dragOver = null; this.dragPreview?.remove(); this.dragPreview = null; }

  private async saveOrder(items: Website[]): Promise<void> {
    // Assign new index on each item's template and force re-render
    items.forEach((item, i) => {
      if (item.template) item.template.index = i;
    });
    this.items.set([...items]);

    // Save each item — build payload manually to guarantee index is included
    const saves = items.map((item, i) => {
      const payload = item.toCleanJson();
      payload.template = { ...(payload.template ?? {}), index: i };
      return this.cms.saveRaw(payload).catch(() => {});
    });
    await Promise.all(saves);
  }

  // ── Visibility ────────────────────────────────────────────────────────────
  getVis(item: Website): 'visible' | 'hidden' {
    const isPublished = item.template?.status === 'published' || item.template?.data?.['published'] === true;
    return item.template?.data?.['_visibility'] ?? (isPublished ? 'visible' : 'hidden');
  }
  toggleVisMenu(id: string, e: Event): void {
    e.stopPropagation();
    if (this.visMenuId() === id) { this.visMenuId.set(null); return; }
    const btn = (e.target as HTMLElement).closest('.vis-btn') as HTMLElement;
    if (btn) {
      const r = btn.getBoundingClientRect();
      this.visMenuPos = { top: r.bottom + 4, left: r.left };
    }
    this.visMenuId.set(id);
  }
  async setVis(item: Website, val: 'visible' | 'hidden'): Promise<void> {
    item.template.data = { ...(item.template.data ?? {}), _visibility: val };
    item.template.status = val === 'visible' ? 'published' : 'draft';
    this.items.set([...this.items()]); this.visMenuId.set(null);
    try { await this.cms.saveItem(item, this.collectionId); } catch {}
  }

  // ── Inline edit (Excel-like) ──────────────────────────────────────────────
  onCellClick(item: Website, field: ContentField, rowIdx: number, colIdx: number, e: Event): void {
    e.stopPropagation();
    // If already editing this cell, let the click pass through to the input
    const ec = this.editCell();
    if (ec?.itemId === item.id && ec?.fieldKey === field.key) return;

    // Commit any pending edit first
    if (ec) this.commitEditByRef();

    // Single-click just focuses the cell (Excel behavior)
    this.focusedCell.set({ rowIdx, colIdx });
  }

  onCellDblClick(item: Website, field: ContentField, e: Event): void {
    e.stopPropagation();
    // Image/reference → open drawer (can't be edited inline)
    if (['image','reference','multi-reference','video','audio','document','multi-document'].includes(field.type)) {
      return; // handled by dedicated cell components
    }
    this.startEdit(item.id, field, item.template?.data?.[field.key], e);
  }

  private commitEditByRef(): void {
    const ec = this.editCell(); if (!ec) return;
    const item = this.items().find(it => it.id === ec.itemId);
    if (item) this.saveEdit(item);
  }

  // Title cell — Open button opens item drawer
  openItemDrawerFromCell(item: Website, e: Event): void {
    e.stopPropagation();
    this.openItemDrawer(item);
  }

  // Boolean cell — direct toggle
  async toggleBool(item: Website, field: ContentField, e: Event): Promise<void> {
    e.stopPropagation();
    e.preventDefault();
    const current = !!item.template?.data?.[field.key];
    item.template.data = { ...(item.template.data ?? {}), [field.key]: !current };
    this.items.set([...this.items()]);
    try { await this.cms.saveItem(item, this.collectionId); } catch {}
  }

  // URL/slug cell — open the link
  openSlugLink(item: Website, field: ContentField, e: Event): void {
    e.stopPropagation();
    const val = item.template?.data?.[field.key];
    if (val) {
      const url = String(val).startsWith('http') ? val : `/items/${val}`;
      window.open(url, '_blank');
    }
  }

  /** Media cell (video/audio/document) — open picker */
  async openMediaCellPicker(item: Website, field: ContentField, e: Event): Promise<void> {
    e.stopPropagation();
    const typeMap: Record<string, string> = { video: 'video', audio: 'audio', document: 'document', 'multi-document': 'document' };
    const mediaType = typeMap[field.type] || 'image';
    const titleMap: Record<string, string> = { video: 'Choose a Video', audio: 'Choose Audio', document: 'Choose a Document' };
    const ref = this.modalSvc.open<any, any, any>(
      MediaPickerModalComponent,
      { size: 'xl', data: { contentTypes: [mediaType], multiple: false, title: titleMap[mediaType] || 'Choose Media' } },
    );
    const selected = await ref.afterClosed();
    if (selected) {
      const val = { url: selected.imageUrl || selected.thumbUrl || selected.url?.defaultUrl || '', id: selected.id, name: selected.name };
      item.template.data = { ...(item.template.data ?? {}), [field.key]: val };
      this.items.set([...this.items()]);
      try { await this.cms.saveItem(item, this.collectionId); } catch {}
    }
  }

  /** Reference cell — value changed from picker */
  async onRefChange(item: Website, field: ContentField, val: any): Promise<void> {
    item.template.data = { ...(item.template.data ?? {}), [field.key]: val };
    this.items.set([...this.items()]);
    try { await this.cms.saveItem(item, this.collectionId); } catch {}
  }

  /** Check if a value is an array of images (for multi-image fields). */
  isImageArray(val: any): boolean {
    return Array.isArray(val) && val.length > 0 && val[0]?.url;
  }

  /** Get list value as array — handles string (legacy) or array */
  getListArray(item: Website, field: ContentField): string[] {
    const val = item.template?.data?.[field.key];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.length > 0) {
      // Convert legacy comma string to array and save back
      const arr = val.split(',').map((s: string) => s.trim()).filter(Boolean);
      item.template.data = { ...(item.template.data ?? {}), [field.key]: arr };
      return arr;
    }
    return [];
  }

  /** List tag operations for cardinality=many text fields */
  async addListTag(item: Website, field: ContentField, e: Event): Promise<void> {
    e.stopPropagation();
    const val = prompt('Enter value:');
    if (!val?.trim()) return;
    const arr = Array.isArray(item.template?.data?.[field.key]) ? [...item.template.data[field.key]] : [];
    arr.push(val.trim());
    item.template.data = { ...(item.template.data ?? {}), [field.key]: arr };
    this.items.set([...this.items()]);
    try { await this.cms.saveItem(item, this.collectionId); } catch {}
  }
  async removeListTag(item: Website, field: ContentField, idx: number, e: Event): Promise<void> {
    e.stopPropagation();
    const arr = [...(item.template?.data?.[field.key] || [])];
    arr.splice(idx, 1);
    item.template.data = { ...(item.template.data ?? {}), [field.key]: arr };
    this.items.set([...this.items()]);
    try { await this.cms.saveItem(item, this.collectionId); } catch {}
  }

  /** Check if value is a list of strings (not images). */
  isListValue(val: any): boolean {
    return Array.isArray(val) && val.length > 0 && typeof val[0] === 'string';
  }
  /** Get first N tags for display. */
  getListTags(val: any): string[] {
    if (!Array.isArray(val)) return [];
    return val.slice(0, 3).map((v: any) => typeof v === 'string' ? v : String(v));
  }
  /** Get count of extra items beyond 3, or 0 if none. */
  getListExtra(val: any): number {
    if (!Array.isArray(val) || val.length <= 3) return 0;
    return val.length - 3;
  }

  /** Safely display a cell value — handles objects, arrays (list fields) gracefully. */
  displayCellValue(val: any): string {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    // List field (cardinality many) — array of strings or objects
    if (Array.isArray(val)) {
      const strs = val.map((v: any) => {
        if (typeof v === 'string') return v;
        if (v?.name) return v.name;
        if (v?.url) return v.url;
        return String(v);
      }).filter(Boolean);
      if (strs.length === 0) return '';
      if (strs.length <= 3) return strs.join(', ');
      return `${strs.slice(0, 2).join(', ')} +${strs.length - 2} more`;
    }
    // Image field stores { url, id, name } — show the name or URL
    if (typeof val === 'object') {
      if (val.name) return val.name;
      if (val.url) return typeof val.url === 'string' ? val.url : '';
      return '';
    }
    return String(val);
  }

  // Image cell — choose from media library
  async openImagePicker(item: Website, field: ContentField, e: Event): Promise<void> {
    e.stopPropagation();
    const isMany = field.cardinality === 'many';
    const existing = item.template?.data?.[field.key];
    const idSet = new Set<string>();
    if (isMany && Array.isArray(existing)) {
      existing.forEach((e: any) => { if (e?.id) idSet.add(e.id); });
    } else if (existing?.id) {
      idSet.add(existing.id);
    }
    const preSelectedIds = [...idSet];

    const ref = this.modalSvc.open<MediaPickerModalComponent, MediaPickerConfig, any>(
      MediaPickerModalComponent,
      {
        size: 'xl',
        data: {
          contentTypes: ['image'],
          multiple: isMany,
          title: isMany ? 'Choose Images' : 'Choose an Image',
          preSelectedIds,
        },
      },
    );
    const selected = await ref.afterClosed();
    if (!selected) return;

    if (isMany) {
      // Replace with full selection — deduplicate by id
      const items = Array.isArray(selected) ? selected : [selected];
      const seen = new Set<string>();
      const newImages: any[] = [];
      for (const m of items) {
        const id = m.id || '';
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        newImages.push({
          url: m.imageUrl || m.thumbUrl || m.url?.defaultUrl || '',
          id: m.id,
          name: m.name,
        });
      }
      item.template.data = { ...(item.template.data ?? {}), [field.key]: newImages };
    } else {
      if (!selected?.url && !selected?.imageUrl) return;
      const url = selected.imageUrl || selected.thumbUrl || '';
      item.template.data = { ...(item.template.data ?? {}), [field.key]: { url, id: selected.id, name: selected.name } };
    }

    this.items.set([...this.items()]);
    try { await this.cms.saveItem(item, this.collectionId); } catch {}
  }

  // Image cell — import from custom URL (fetches + uploads as new media)
  async openImageUrlDialog(item: Website, field: ContentField, e: Event): Promise<void> {
    e.stopPropagation();
    const ref = this.modalSvc.open<ImageUrlModalComponent, void, any>(
      ImageUrlModalComponent,
      { size: 'sm' },
    );
    const media = await ref.afterClosed();
    if (!media) return;
    const url = media.imageUrl || media.thumbUrl || media.url?.defaultUrl || '';
    item.template.data = { ...(item.template.data ?? {}), [field.key]: { url, id: media.id, name: media.name } };
    this.items.set([...this.items()]);
    try { await this.cms.saveItem(item, this.collectionId); } catch {}
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(e: KeyboardEvent): void {
    const fc = this.focusedCell();
    if (!fc) return;
    const ec = this.editCell();
    const rows = this.processedItems();
    const cols = this.visibleFields();
    if (rows.length === 0 || cols.length === 0) return;

    // If editing: Enter saves + moves down, Tab saves + moves right, Escape cancels
    if (ec) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = rows.find(r => r.id === ec.itemId);
        if (item) this.saveEdit(item);
        const nextRow = Math.min(fc.rowIdx + 1, rows.length - 1);
        this.focusedCell.set({ rowIdx: nextRow, colIdx: fc.colIdx });
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const item = rows.find(r => r.id === ec.itemId);
        if (item) this.saveEdit(item);
        const nextCol = e.shiftKey ? Math.max(fc.colIdx - 1, 0) : Math.min(fc.colIdx + 1, cols.length - 1);
        this.focusedCell.set({ rowIdx: fc.rowIdx, colIdx: nextCol });
      }
      return;
    }

    // Not editing — arrow key navigation
    let handled = true;
    let { rowIdx, colIdx } = fc;
    switch (e.key) {
      case 'ArrowUp':    rowIdx = Math.max(rowIdx - 1, 0); break;
      case 'ArrowDown':  rowIdx = Math.min(rowIdx + 1, rows.length - 1); break;
      case 'ArrowLeft':  colIdx = Math.max(colIdx - 1, 0); break;
      case 'ArrowRight': colIdx = Math.min(colIdx + 1, cols.length - 1); break;
      case 'Tab':
        colIdx = e.shiftKey ? Math.max(colIdx - 1, 0) : Math.min(colIdx + 1, cols.length - 1);
        break;
      case 'Enter':
      case 'F2': {
        const item = rows[rowIdx];
        const field = cols[colIdx];
        if (!item || !field) return;
        // Boolean → toggle directly
        if (field.type === 'boolean') {
          this.toggleBool(item, field, e);
        }
        // Image → open media picker
        else if (field.type === 'image') {
          this.openImagePicker(item, field, e);
        }
        // Reference / Multi-reference — no-op (handled by picker component)
        else if (field.type === 'reference' || field.type === 'multi-reference') {
          // handled by dedicated reference picker component in the cell
        }
        // Title → open drawer on Enter
        else if ((field.id === 'sys-title' || field.key === 'title') && e.key === 'Enter') {
          this.openItemDrawer(item);
        }
        // Everything else → inline edit
        else {
          this.startEdit(item.id, field, item.template?.data?.[field.key], e);
        }
        e.preventDefault();
        return;
      }
      case 'Delete':
      case 'Backspace': {
        // Clear the cell value
        const item = rows[rowIdx];
        const field = cols[colIdx];
        if (item && field && !['image','reference','multi-reference','video','audio','document','multi-document'].includes(field.type)) {
          this.editValue = '';
          this.editCell.set({ itemId: item.id, fieldId: field.id, fieldKey: field.key });
          this.saveEdit(item);
        }
        e.preventDefault();
        return;
      }
      default:
        // If user starts typing a printable character, start editing with that char
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const item = rows[rowIdx];
          const field = cols[colIdx];
          if (item && field && !['image','reference','multi-reference','video','audio','document','multi-document','boolean'].includes(field.type)) {
            this.editCell.set({ itemId: item.id, fieldId: field.id, fieldKey: field.key });
            this.editValue = e.key;
            e.preventDefault();
          }
          return;
        }
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      this.focusedCell.set({ rowIdx, colIdx });
    }
  }
  startEdit(itemId: string, field: ContentField, value: any, e: Event): void {
    e.stopPropagation();
    this.editCell.set({ itemId, fieldId: field.id, fieldKey: field.key });
    this.editValue = String(value ?? '');
  }
  validateInline(field: ContentField): void {
    const f: any = field;
    const val = this.editValue;
    const len = (val || '').length;

    if (f.limitCharCount) {
      if (f.minLength != null && len > 0 && len < f.minLength) {
        this.editError.set(`Min ${f.minLength} characters (${len} entered)`);
        return;
      }
      if (f.maxLength != null && len > f.maxLength) {
        this.editError.set(`Max ${f.maxLength} characters (${len} entered)`);
        return;
      }
    }
    if (f.regex && len > 0) {
      try {
        if (!new RegExp(f.regex).test(val)) {
          this.editError.set('Does not match required pattern');
          return;
        }
      } catch {}
    }
    if (f.limitRange && field.type === 'number' && val !== '') {
      const num = Number(val);
      if (f.rangeMin != null && num < f.rangeMin) { this.editError.set(`Min value is ${f.rangeMin}`); return; }
      if (f.rangeMax != null && num > f.rangeMax) { this.editError.set(`Max value is ${f.rangeMax}`); return; }
    }
    this.editError.set('');
  }
  cancelEdit(): void {
    this.editCell.set(null);
    this.editError.set('');
  }
  async saveEdit(item: Website): Promise<void> {
    const ec = this.editCell(); if (!ec) return;
    const field = this.allFields().find(f => f.id === ec.fieldId);
    // Block save if validation error
    if (field) this.validateInline(field);
    if (this.editError()) return;

    let val: any = this.editValue;
    if (field?.type === 'boolean') val = this.editValue === 'true' || this.editValue === true as any;
    else if (field?.type === 'number') val = this.editValue === '' ? null : Number(this.editValue);
    const ud = { ...item.template.data, [ec.fieldKey]: val };
    item.template.data = ud; item.name = ud['title'] ?? item.name;
    this.items.set([...this.items()]); this.editCell.set(null); this.editError.set('');
    try { await this.cms.saveItem(item, this.collectionId); } catch {}
  }

  // ── Panel ──────────────────────────────────────────────────────────────────
  newItem(): void { this.openItemDrawer(null); }
  selectItem(item: Website): void { this.openItemDrawer(item); }
  onItemSaved(saved: Website): void {
    const exists = this.items().find(i => i.id === saved.id);
    if (exists) this.items.set(this.items().map(i => i.id === saved.id ? saved : i));
    else this.items.set([saved, ...this.items()]);
  }
  async deleteItem(e: Event, item: Website): Promise<void> {
    e.stopPropagation();
    if (!confirm(`Delete "${item.template?.data?.['title'] || item.name}"?`)) return;
    await this.cms.deleteItem(item.id);
    this.items.update(list => list.filter(i => i.id !== item.id));
    if (this.panelItem()?.id === item.id) this.panelItem.set(undefined);
  }

  openItemDrawer(item: Website | null): void {
    if (this.parentModalRef) {
      // Inside a modal — open inline drawer
      let _itemResult: any;
      const fakeModalRef = {
        close: (result: any) => {
          this.inlineDrawerOpen.set(false);
          if (result?.saved) this.onItemSaved(result.saved);
        },
        dismiss: () => {
          this.inlineDrawerOpen.set(false);
          if (_itemResult?.saved) this.onItemSaved(_itemResult.saved);
        },
        setResult: (r: any) => { _itemResult = r; },
        afterClosed: () => Promise.resolve(undefined),
      };
      this.inlineDrawerComp = ItemDetailDrawerComponent;
      this.inlineDrawerInjector = Injector.create({
        parent: this.parentInjector,
        providers: [
          { provide: MODAL_REF, useValue: fakeModalRef },
          { provide: MODAL_DATA, useValue: { item, fields: this.allFields(), collectionId: this.collectionId } as ItemDrawerData },
        ],
      });
      this.inlineDrawerOpen.set(true);
      return;
    }
    const itemId = item?.id || 'new';
    this.router.navigate(['/website/content-library', this.collectionId, 'item', itemId]);
  }

  closeInlineDrawer(): void {
    this.inlineDrawerOpen.set(false);
  }

  exportCsv(): void {
    this.modalSvc.open(ExportCsvModalComponent, {
      size: 'sm', closeOnBackdrop: false,
      data: {
        collectionName: this.collection()?.template?.displayName ?? 'export',
        allFields:      this.allFields(),
        visibleFields:  this.visibleFields(),
        allItems:       this.items(),
        filteredItems:  this.processedItems(),
      } as ExportCsvData,
    });
  }

  importCsv(): void {
    const coll = this.collection(); if (!coll) return;
    const ref = this.modalSvc.open(ImportCsvModalComponent, {
      size: 'lg', closeOnBackdrop: false,
      data: {
        collection: coll,
        fields: this.allFields(),
        collectionId: this.collectionId,
      } as ImportCsvData,
    });
    ref.afterClosed().then((r: any) => { if (r?.imported) this.loadItems(); });
  }

  getImgUrl(item: Website): string | null {
    const f = this.allFields().find((f: ContentField) => f.type === 'image');
    return f ? item.template?.data?.[f.key]?.url ?? null : null;
  }

  fieldIcon(type: string): SafeHtml {
    const map: Record<string,string> = {
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
