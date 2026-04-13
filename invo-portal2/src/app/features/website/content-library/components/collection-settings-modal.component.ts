import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MODAL_DATA, MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { ContentLibraryService } from '../services/content-library.service';
import { Website } from '../../models/website.model';

type SettingsTab = 'settings' | 'permissions';
type PermMode    = 'show' | 'collect' | 'advanced';
type Audience    = 'everyone' | 'members' | 'collaborators';

interface PermRow { role: string; tooltip: string; view: boolean; add: boolean; update: boolean; del: boolean; locked?: boolean; }

export interface CollectionSettingsData {
  collection: Website;
}

@Component({
  selector: 'app-collection-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { font-family:'Inter',-apple-system,sans-serif; color:#111827; }

    .modal { width:100%; max-height:85vh; display:flex; flex-direction:column; }

    /* ── Header ── */
    .mh { display:flex; align-items:center; justify-content:space-between; padding:22px 24px 0; flex-shrink:0; }
    .mh-title { font-size:18px; font-weight:700; color:#111827; margin:0; }
    .mh-actions { display:flex; align-items:center; gap:6px; }
    .help-btn, .close-btn {
      width:30px; height:30px; border:none; background:transparent; cursor:pointer;
      color:#9ca3af; border-radius:7px; display:flex; align-items:center; justify-content:center;
    }
    .help-btn:hover, .close-btn:hover { background:#f3f4f6; color:#374151; }

    /* ── Tabs ── */
    .tabs { display:flex; gap:0; border-bottom:2px solid #e5e7eb; padding:0 24px; margin-top:16px; flex-shrink:0; }
    .tab-btn {
      padding:12px 4px; margin-right:32px; font-size:14px; font-weight:500; color:#6b7280;
      border:none; background:transparent; cursor:pointer; border-bottom:2px solid transparent;
      margin-bottom:-2px; font-family:inherit; transition:color .12s, border-color .12s;
    }
    .tab-btn:hover { color:#111827; }
    .tab-btn.active { color:#32acc1; border-bottom-color:#32acc1; }

    /* ── Body ── */
    .body { flex:1; overflow-y:auto; padding:20px 24px 4px; }

    /* form elements */
    .form-label { font-size:14px; font-weight:600; color:#111827; margin:0 0 8px; }
    .form-input {
      width:100%; height:44px; border:1.5px solid #e5e7eb; border-radius:9px;
      padding:0 14px; font-size:14px; font-family:inherit; color:#111827;
      outline:none; background:#fff; box-sizing:border-box; transition:border-color .12s;
    }
    .form-input:focus { border-color:#32acc1; box-shadow:0 0 0 3px rgba(50,172,193,.1); }

    .divider { height:1px; background:#f1f5f9; margin:20px 0; }

    /* toggle */
    .tog-row { display:flex; align-items:flex-start; gap:14px; padding:12px 0; }
    .tog {
      position:relative; width:44px; height:24px; flex-shrink:0; cursor:pointer; margin-top:1px;
    }
    .tog input { position:absolute; opacity:0; width:0; height:0; }
    .tog-track {
      position:absolute; inset:0; border-radius:12px;
      background:#e5e7eb; transition:background .2s;
    }
    .tog input:checked ~ .tog-track { background:#32acc1; }
    .tog-thumb {
      position:absolute; top:3px; left:3px;
      width:18px; height:18px; border-radius:50%;
      background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.2);
      transition:transform .2s;
    }
    .tog input:checked ~ .tog-track .tog-thumb { transform:translateX(20px); }
    .tog-text { flex:1; }
    .tog-title { font-size:14px; font-weight:500; color:#111827; margin:0 0 3px; }
    .tog-desc  { font-size:13px; color:#6b7280; margin:0; line-height:1.45; }
    .tog-desc a { color:#32acc1; text-decoration:none; }
    .tog-desc a:hover { text-decoration:underline; }

    /* sub-options under toggle */
    .sub-opts { padding:10px 0 0 58px; display:flex; flex-direction:column; gap:4px; }
    .sub-label { font-size:13px; color:#6b7280; margin:0 0 6px; }
    .radio-row { display:flex; align-items:center; gap:10px; font-size:14px; color:#111827; cursor:pointer; padding:6px 0; }
    .radio-row input[type="radio"] {
      width:18px; height:18px; accent-color:#32acc1; cursor:pointer;
      appearance:none; -webkit-appearance:none;
      border:2px solid #cbd5e1; border-radius:50%; position:relative;
      flex-shrink:0; transition:all .12s;
    }
    .radio-row input[type="radio"]:checked {
      border-color:#32acc1; background:#32acc1;
    }
    .radio-row input[type="radio"]:checked::after {
      content:''; position:absolute; top:4px; left:4px;
      width:6px; height:6px; border-radius:50%; background:#fff;
    }

    /* ══ Permissions tab ══ */
    .perm-question { font-size:14px; font-weight:500; color:#374151; margin:0 0 12px; }

    /* mode cards */
    .mode-cards { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:20px; }
    .mode-card {
      position:relative; border:1.5px solid #e5e7eb; border-radius:10px;
      padding:14px 14px 16px; cursor:pointer; transition:all .13s; text-align:center;
    }
    .mode-card:hover { border-color:#94a3b8; }
    .mode-card.sel { border-color:#32acc1; background:#f0fdff; }
    .mode-card .mc-check {
      position:absolute; top:-6px; right:-6px;
      width:20px; height:20px; border-radius:50%;
      background:#32acc1; display:none; align-items:center; justify-content:center;
    }
    .mode-card.sel .mc-check { display:flex; }
    .mc-title { font-size:13px; font-weight:600; color:#111827; margin:0 0 4px; }
    .mc-desc  { font-size:11px; color:#6b7280; line-height:1.4; margin:0; }

    /* audience dropdown */
    .aud-group { margin-bottom:16px; }
    .aud-label { font-size:13px; font-weight:500; color:#374151; margin:0 0 6px; }
    .aud-select {
      height:40px; border:1.5px solid #e5e7eb; border-radius:8px;
      padding:0 36px 0 12px; font-size:14px; font-family:inherit; color:#111827;
      background:#fff; cursor:pointer; outline:none; min-width:200px;
      appearance:none;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat:no-repeat; background-position:right 12px center;
      transition:border-color .12s;
    }
    .aud-select:focus { border-color:#32acc1; box-shadow:0 0 0 3px rgba(50,172,193,.1); }

    /* advanced: permissions table */
    .perm-table-label { font-size:14px; font-weight:500; color:#374151; margin:0 0 10px; }
    .perm-table { width:100%; border-collapse:collapse; margin-bottom:8px; }
    .perm-table th {
      text-align:center; font-size:12px; font-weight:600; color:#6b7280;
      padding:10px 8px; border-bottom:1.5px solid #e5e7eb;
      text-transform:uppercase; letter-spacing:.03em;
    }
    .perm-table th:first-child { text-align:left; }
    .perm-table td {
      padding:10px 8px; border-bottom:1px solid #f1f5f9;
      font-size:14px; color:#111827; text-align:center;
    }
    .perm-table td:first-child { text-align:left; }
    .perm-table tr:last-child td { border-bottom:none; }
    .role-cell { display:flex; align-items:center; gap:6px; }
    .info-ico { color:#9ca3af; cursor:help; display:flex; align-items:center; }
    .perm-chk {
      width:18px; height:18px; accent-color:#32acc1; cursor:pointer;
    }
    .perm-chk:disabled { opacity:.5; cursor:default; }
    .perm-table tr.locked td { color:#9ca3af; }

    /* ── Footer ── */
    .mf { display:flex; align-items:center; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid #f1f5f9; flex-shrink:0; }
    .btn {
      height:40px; border-radius:100px; font-size:14px; font-weight:500;
      cursor:pointer; font-family:inherit; padding:0 24px;
      transition:all .13s;
    }
    .btn-cancel { border:1.5px solid #e5e7eb; background:#fff; color:#374151; }
    .btn-cancel:hover { background:#f3f4f6; }
    .btn-primary { border:none; background:#32acc1; color:#fff; }
    .btn-primary:hover { background:#2b95a8; }
    .btn-primary:disabled { opacity:.5; cursor:default; }

    .spin { width:14px; height:14px; border-radius:50%; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; animation:spin .6s linear infinite; display:inline-flex; }
    @keyframes spin { to{transform:rotate(360deg)} }
  `],
  template: `
    <div class="modal">

      <!-- Header -->
      <div class="mh">
        <p class="mh-title">Manage "{{ collName }}" Collection</p>
        <div class="mh-actions">
          <button class="help-btn" title="Help">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
          </button>
          <button class="close-btn" (click)="ref.dismiss()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab-btn" [class.active]="tab()==='settings'" (click)="tab.set('settings')">Settings</button>
        <button class="tab-btn" [class.active]="tab()==='permissions'" (click)="tab.set('permissions')">Permissions &amp; privacy</button>
      </div>

      <!-- Body -->
      <div class="body">

        <!-- ════ Settings tab ════ -->
        @if (tab() === 'settings') {

          <!-- Collection name -->
          <p class="form-label">Library name</p>
          <input class="form-input" [(ngModel)]="collName"/>

          <div class="divider"></div>

          <!-- Control item visibility -->
          <div class="tog-row">
            <label class="tog">
              <input type="checkbox" [(ngModel)]="controlVisibility"/>
              <div class="tog-track"><div class="tog-thumb"></div></div>
            </label>
            <div class="tog-text">
              <p class="tog-title">Control item visibility</p>
              <p class="tog-desc">Choose which items are visible on your site and set schedules to show or hide them.</p>
            </div>
          </div>

          @if (controlVisibility) {
            <div class="sub-opts">
              <p class="sub-label">Set default status for new items</p>
              <label class="radio-row">
                <input type="radio" name="defVis" value="visible" [(ngModel)]="defaultVisibility"/>
                Visible
              </label>
              <label class="radio-row">
                <input type="radio" name="defVis" value="hidden" [(ngModel)]="defaultVisibility"/>
                Hidden
              </label>
            </div>
          }

          <div class="divider"></div>

          <!-- Hide table layout -->
          <div class="tog-row">
            <label class="tog">
              <input type="checkbox" [(ngModel)]="hideTableLayout"/>
              <div class="tog-track"><div class="tog-thumb"></div></div>
            </label>
            <div class="tog-text">
              <p class="tog-title">Hide table layout</p>
              <p class="tog-desc">Hide the table layout option so field validations work everywhere.
                <a href="#">Learn about field validations</a>
              </p>
            </div>
          </div>
        }

        <!-- ════ Permissions tab ════ -->
        @if (tab() === 'permissions') {

          <p class="perm-question">What do you want to do with this collection on the live site?</p>

          <!-- Mode cards -->
          <div class="mode-cards">
            <div class="mode-card" [class.sel]="permMode==='show'" (click)="permMode='show'">
              <div class="mc-check">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><polyline points="2 6 5 9 10 3"/></svg>
              </div>
              <p class="mc-title">Show content</p>
              <p class="mc-desc">Show content on your site to visitors or members</p>
            </div>
            <div class="mode-card" [class.sel]="permMode==='collect'" (click)="permMode='collect'">
              <div class="mc-check">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><polyline points="2 6 5 9 10 3"/></svg>
              </div>
              <p class="mc-title">Collect content</p>
              <p class="mc-desc">Allow adding to your collection by submitting forms</p>
            </div>
            <div class="mode-card" [class.sel]="permMode==='advanced'" (click)="permMode='advanced'">
              <div class="mc-check">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><polyline points="2 6 5 9 10 3"/></svg>
              </div>
              <p class="mc-title">Advanced</p>
              <p class="mc-desc">Set custom permissions per role for the site and CMS</p>
            </div>
          </div>

          <!-- Show content mode -->
          @if (permMode === 'show') {
            <div class="aud-group">
              <p class="aud-label">Who can view this content?</p>
              <select class="aud-select" [(ngModel)]="viewAudience">
                <option value="everyone">Everyone</option>
                <option value="members">Members only</option>
              </select>
            </div>
          }

          <!-- Collect content mode -->
          @if (permMode === 'collect') {
            <div class="aud-group">
              <p class="aud-label">Who can add content to this collection?</p>
              <select class="aud-select" [(ngModel)]="addAudience">
                <option value="everyone">Everyone</option>
                <option value="members">Members only</option>
                <option value="collaborators">Collaborators</option>
              </select>
            </div>
            <div class="aud-group">
              <p class="aud-label">Who can view this content?</p>
              <select class="aud-select" [(ngModel)]="viewAudience">
                <option value="everyone">Everyone</option>
                <option value="members">Members only</option>
                <option value="collaborators">Collaborators</option>
              </select>
            </div>
          }

          <!-- Advanced mode -->
          @if (permMode === 'advanced') {
            <p class="perm-table-label">Set the permissions for this collection:</p>
            <table class="perm-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>View</th>
                  <th>Add</th>
                  <th>Update</th>
                  <th>Delete</th>
                </tr>
              </thead>
              <tbody>
                @for (r of permRows; track r.role) {
                  <tr [class.locked]="r.locked">
                    <td>
                      <span class="role-cell">
                        {{ r.role }}
                        <span class="info-ico" [title]="r.tooltip">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                        </span>
                      </span>
                    </td>
                    <td><input class="perm-chk" type="checkbox" [(ngModel)]="r.view"   [disabled]="!!r.locked"/></td>
                    <td><input class="perm-chk" type="checkbox" [(ngModel)]="r.add"     [disabled]="!!r.locked"/></td>
                    <td><input class="perm-chk" type="checkbox" [(ngModel)]="r.update"  [disabled]="!!r.locked"/></td>
                    <td><input class="perm-chk" type="checkbox" [(ngModel)]="r.del"     [disabled]="!!r.locked"/></td>
                  </tr>
                }
              </tbody>
            </table>
          }

        }

      </div>

      <!-- Footer -->
      <div class="mf">
        <button class="btn btn-cancel" (click)="ref.dismiss()">Cancel</button>
        <button class="btn btn-primary" (click)="save()" [disabled]="saving()">
          @if (saving()) { <span class="spin"></span> }
          Save
        </button>
      </div>

    </div>
  `
})
export class CollectionSettingsModalComponent {
  data = inject<CollectionSettingsData>(MODAL_DATA);
  ref  = inject<ModalRef>(MODAL_REF);
  private cms = inject(ContentLibraryService);

  tab    = signal<SettingsTab>('settings');
  saving = signal(false);

  // ── Settings tab state ──
  collName: string;
  controlVisibility = false;
  defaultVisibility: 'visible' | 'hidden' = 'visible';
  hideTableLayout   = false;

  // ── Permissions tab state ──
  permMode: PermMode     = 'show';
  viewAudience: Audience = 'everyone';
  addAudience: Audience  = 'everyone';
  permRows: PermRow[] = [
    { role: 'Everyone',       tooltip: 'Anyone visiting your site',                    view: false, add: false, update: false, del: false },
    { role: 'Members',        tooltip: 'Logged-in site members',                       view: false, add: false, update: false, del: false },
    { role: "Item's creator", tooltip: 'The user who created the item',                view: false, add: false, update: false, del: false },
    { role: 'Collaborators',  tooltip: 'Team members you have added to your site',     view: true,  add: true,  update: true,  del: true },
    { role: 'Admin',          tooltip: 'Full access — cannot be changed',              view: true,  add: true,  update: true,  del: true, locked: true },
  ];

  constructor() {
    const tpl = this.data.collection.template;
    this.collName          = tpl?.displayName ?? this.data.collection.name ?? '';
    this.controlVisibility = tpl?.controlVisibility ?? false;
    this.defaultVisibility = tpl?.defaultVisibility ?? 'visible';
    this.hideTableLayout   = tpl?.hideTableLayout   ?? false;
    this.permMode          = tpl?.permMode           ?? 'show';
    this.viewAudience      = tpl?.viewAudience       ?? 'everyone';
    this.addAudience       = tpl?.addAudience        ?? 'everyone';

    if (tpl?.permRows?.length) {
      // Merge server rows with defaults — server rows may be missing boolean fields
      const defaults = this.permRows;
      this.permRows = defaults.map(def => {
        const srv = tpl.permRows.find((r: any) => r.role === def.role);
        if (!srv) return { ...def };
        return {
          role:    srv.role    ?? def.role,
          tooltip: srv.tooltip ?? def.tooltip,
          view:    srv.view    ?? false,
          add:     srv.add     ?? false,
          update:  srv.update  ?? false,
          del:     srv.del     ?? false,
          locked:  srv.locked  ?? def.locked,
        };
      });
    }
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const coll = this.data.collection;
      const tpl  = coll.template;

      tpl.displayName        = this.collName;
      tpl.controlVisibility  = this.controlVisibility;
      tpl.defaultVisibility  = this.defaultVisibility;
      tpl.hideTableLayout    = this.hideTableLayout;
      tpl.permMode           = this.permMode;
      tpl.viewAudience       = this.viewAudience;
      tpl.addAudience        = this.addAudience;
      tpl.permRows           = this.permRows.map(r => ({ ...r }));

      coll.name = this.collName;

      await this.cms.saveCollection(coll);
      this.ref.close({ saved: true });
    } finally {
      this.saving.set(false);
    }
  }
}
