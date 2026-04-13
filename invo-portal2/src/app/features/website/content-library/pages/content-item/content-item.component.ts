import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ContentLibraryService } from '../../services/content-library.service';
import { ModalService } from '../../../../../shared/modal/modal.service';
import { Website } from '../../../models/website.model';
import { ContentField } from '../../models/content-library.model';
import { ManageFieldsModalComponent } from '../../components/manage-fields-modal.component';
import { BreadcrumbsComponent, BreadcrumbItem } from '../../../../../shared/components/breadcrumbs';
import { SpinnerComponent } from '../../../../../shared/components/spinner';
import { MediaPickerModalComponent, MediaPickerConfig } from '../../../../media/components/media-picker';
import { ImageUrlModalComponent } from '../../../../media/components/image-url-modal';
import { ReferencePickerComponent } from '../../components/reference-picker.component';

@Component({
  selector: 'app-content-item',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BreadcrumbsComponent, SpinnerComponent, ReferencePickerComponent],
  styles: [`
    :host { display:block; }
    .page-header { background:#fff; border-bottom:1px solid #e2e8f0; padding:0 40px; height:56px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:10; }
    .header-actions { display:flex; align-items:center; gap:10px; }
    .btn { display:inline-flex; align-items:center; gap:6px; height:36px; padding:0 20px; border-radius:100px; font-size:13px; font-weight:500; cursor:pointer; font-family:inherit; transition:.15s; }
    .btn-cancel { background:#fff; border:1px solid #dfe3eb; color:#374151; }
    .btn-cancel:hover { background:#f8fafc; }
    .btn-save { background:var(--color-brand-600); border:none; color:#fff; }
    .btn-save:hover { background:var(--color-brand-700); }
    .btn-save:disabled { opacity:.6; cursor:not-allowed; }
    .btn-del { background:transparent; border:none; width:36px; height:36px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:50%; color:#9ca3af; cursor:pointer; }
    .btn-del:hover { background:#fef2f2; color:#e53e3e; }
    .item-title-bar { padding:24px 40px 0; }
    .item-title { font-size:26px; font-weight:700; color:#1b2533; margin:0; }
    .content-wrap { display:flex; justify-content:center; padding:24px 40px 60px; }
    .card { background:#fff; border:1px solid #e5e8ed; border-radius:10px; width:100%; max-width:680px; overflow:hidden; }
    .card-head { display:flex; align-items:center; justify-content:space-between; padding:16px 24px; border-bottom:1px solid #f0f2f5; }
    .card-title { font-size:14px; font-weight:600; color:#1b2533; }
    .mf-btn { font-size:13px; color:var(--color-brand-600); background:none; border:none; cursor:pointer; font-family:inherit; }
    .mf-btn:hover { text-decoration:underline; }
    .fields-body { padding:24px; }
    .field-group { margin-bottom:22px; }
    .field-label { font-size:13px; font-weight:500; color:#374151; margin-bottom:7px; display:block; }
    .field-hint { font-size:11px; color:#9ca3af; margin-top:5px; }
    .field-input { width:100%; height:42px; border:1px solid #dfe3eb; border-radius:6px; padding:0 14px; font-size:14px; font-family:inherit; color:#1b2533; outline:none; background:#fff; box-sizing:border-box; transition:.12s; }
    .field-input:focus { border-color:var(--color-brand-500); box-shadow:0 0 0 3px rgba(50,172,193,.1); }
    .field-textarea { width:100%; min-height:100px; border:1px solid #dfe3eb; border-radius:6px; padding:12px 14px; font-size:14px; font-family:inherit; color:#1b2533; outline:none; background:#fff; box-sizing:border-box; resize:vertical; transition:.12s; }
    .field-textarea:focus { border-color:var(--color-brand-500); box-shadow:0 0 0 3px rgba(50,172,193,.1); }
    .field-select { width:100%; height:42px; border:1px solid #dfe3eb; border-radius:6px; padding:0 14px; font-size:14px; font-family:inherit; color:#1b2533; outline:none; background:#fff; box-sizing:border-box; }
    .url-row { display:flex; gap:8px; align-items:center; }
    .url-display { flex:1; height:42px; border:1px solid #f0f2f5; border-radius:6px; padding:0 14px; font-size:13px; font-family:monospace; color:#6b7280; background:#f8fafc; display:flex; align-items:center; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; min-width:0; }
    .url-edit { height:34px; padding:0 14px; border-radius:100px; border:1px solid #dfe3eb; background:#fff; font-size:13px; color:#374151; cursor:pointer; font-family:inherit; white-space:nowrap; }
    .url-edit:hover { background:#f8fafc; }
    .toggle-row { display:flex; align-items:center; gap:12px; }
    .toggle { width:42px; height:24px; border-radius:12px; cursor:pointer; transition:.2s; position:relative; flex-shrink:0; }
    .toggle-knob { position:absolute; top:3px; width:18px; height:18px; border-radius:50%; background:#fff; transition:.2s; box-shadow:0 1px 4px rgba(0,0,0,.2); }
    .toggle-lbl { font-size:14px; color:#374151; }
    .img-zone { border:1.5px dashed #dfe3eb; border-radius:8px; min-height:140px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; cursor:pointer; transition:.15s; background:#fafbfc; padding:20px; }
    .list-field { display:flex; flex-direction:column; gap:8px; }
    .list-field-row { display:flex; align-items:center; gap:8px; }
    .list-field-drag { color:#cbd5e1; cursor:grab; font-size:14px; flex-shrink:0; user-select:none; }
    .list-field-row .field-input { flex:1; }
    .list-field-remove { width:32px; height:32px; border:none; background:none; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#94a3b8; cursor:pointer; flex-shrink:0; }
    .list-field-remove:hover { background:#fef2f2; color:#dc2626; }
    .list-field-actions { display:flex; align-items:center; gap:12px; margin-top:4px; }
    .list-field-add { padding:6px 14px; border:1px solid #e2e8f0; border-radius:6px; background:#fff; color:#334155; font-size:13px; font-weight:500; cursor:pointer; font-family:inherit; }
    .list-field-add:hover { background:#f8fafc; border-color:#cbd5e1; }
    .list-field-clear { background:none; border:none; color:var(--color-brand-600); font-size:13px; font-weight:500; cursor:pointer; font-family:inherit; }
    .list-field-clear:hover { text-decoration:underline; }
    .img-zone:hover { border-color:var(--color-brand-500); background:color-mix(in srgb, var(--color-brand-50), transparent 40%); }
    .img-zone--small { width:100px; height:100px; min-height:auto; padding:10px; }
    .img-gallery { display:flex; flex-wrap:wrap; gap:10px; }
    .img-gallery-item { position:relative; width:100px; height:100px; border-radius:8px; overflow:hidden; border:1px solid #e2e8f0; }
    .img-gallery-item img { width:100%; height:100%; object-fit:cover; }
    .img-gallery-remove {
      position:absolute; top:4px; right:4px; width:22px; height:22px;
      border-radius:50%; background:rgba(0,0,0,.6); border:none;
      display:flex; align-items:center; justify-content:center;
      color:#fff; cursor:pointer; opacity:0; transition:.12s;
    }
    .img-gallery-item:hover .img-gallery-remove { opacity:1; }
    .img-hint { font-size:13px; color:#64748b; margin-top:8px; }
    .img-hint a { color:var(--color-brand-600); text-decoration:none; font-weight:500; }
    .img-hint a:hover { text-decoration:underline; }
    .img-zone img { max-width:100%; max-height:180px; border-radius:6px; object-fit:cover; }
    .img-zone-label { font-size:13px; color:#9ca3af; }
    .img-actions { display:flex; gap:8px; margin-top:8px; }
    .img-btn { height:30px; padding:0 16px; border-radius:100px; font-size:13px; font-weight:500; cursor:pointer; font-family:inherit; }
    .img-btn-up { border:1px solid #b2e4ed; background:#e6f7f9; color:#0a8da0; }
    .img-btn-up:hover { background:#d0f0f6; }
    .img-btn-del { border:1px solid #fecaca; background:#fef2f2; color:#e53e3e; }
    .add-field-row { display:flex; align-items:center; gap:8px; padding:16px 24px; border-top:1px solid #f0f2f5; }
    .add-field-btn { display:inline-flex; align-items:center; gap:7px; font-size:13px; color:var(--color-brand-600); background:none; border:none; cursor:pointer; font-family:inherit; font-weight:500; }
    .add-field-btn:hover { text-decoration:underline; }
    .spin { width:14px; height:14px; border-radius:50%; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; animation:spin .6s linear infinite; display:inline-block; }
    .loading { display:flex; align-items:center; justify-content:center; gap:12px; padding:100px; color:#9ca3af; font-size:14px; }
    .spin-gray { width:18px; height:18px; border-radius:50%; border:2.5px solid #e5e8ed; border-top-color:var(--color-brand-600); animation:spin .6s linear infinite; display:inline-block; }
    @keyframes spin { to { transform:rotate(360deg); } }
  `],
  template: `
    <!-- Header -->
    <div class="page-header">
      <app-breadcrumbs [items]="itemBreadcrumbs()" />
      <div class="header-actions">
        <button class="btn-del" title="Delete item" (click)="deleteItem()" *ngIf="!isNew">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
        <button class="btn btn-cancel" [routerLink]="['/website/content-library', collectionId]">Cancel</button>
        <button class="btn btn-save" (click)="save()" [disabled]="saving()">
          @if (saving()) { <app-spinner size="xs" /> }
          Save
        </button>
      </div>
    </div>

    @if (loading()) {
      <div class="loading"><app-spinner size="sm" class="text-brand-500" /> Loading...</div>
    } @else {
      <!-- Item title -->
      <div class="item-title-bar">
        <h1 class="item-title">{{ isNew ? 'New Item' : (formData['title'] || 'Edit Item') }}</h1>
      </div>

      <div class="content-wrap">
        <div class="card">
          <div class="card-head">
            <span class="card-title">Item content</span>
            <button class="mf-btn" (click)="openManageFields()">Manage Fields</button>
          </div>

          <div class="fields-body">
            @for (field of fields(); track field.id) {
              <div class="field-group">
                <label class="field-label">
                  {{ field.name }}
                  @if (field.required) { <span style="color:#e53e3e">*</span> }
                </label>

                @switch (field.type) {
                  @case ('url') {
                    <div class="url-row">
                      <div class="url-display">
                        {{ formData[field.key] || ('/' + (formData['title'] || '').toLowerCase().replace(/\s+/g, '-')) }}
                      </div>
                      <button class="url-edit">Edit URL</button>
                    </div>
                    @if (field.key === 'slug') {
                      <div class="field-hint">
                        {{ baseUrl }}/items/<strong>{{ (formData['title'] || '').toLowerCase().replace(/\s+/g, '-') || '...' }}</strong>
                      </div>
                    }
                  }
                  @case ('long-text') {
                    <textarea class="field-textarea" [(ngModel)]="formData[field.key]"
                              [placeholder]="'Enter ' + field.name"></textarea>
                  }
                  @case ('boolean') {
                    <div class="toggle-row">
                      <div class="toggle"
                           [style.background]="formData[field.key] ? 'var(--color-brand-500)' : '#dfe3eb'"
                           (click)="formData[field.key] = !formData[field.key]">
                        <div class="toggle-knob" [style.left]="formData[field.key] ? '21px' : '3px'"></div>
                      </div>
                      <span class="toggle-lbl">{{ formData[field.key] ? 'Enabled' : 'Disabled' }}</span>
                    </div>
                  }
                  @case ('choice') {
                    <select class="field-select" [(ngModel)]="formData[field.key]">
                      <option value="">— Select —</option>
                      @for (opt of field.options; track opt.value) {
                        <option [value]="opt.value">{{ opt.label }}</option>
                      }
                    </select>
                  }
                  @case ('image') {
                    <div>
                      <!-- Multiple images (gallery) -->
                      @if (field.cardinality === 'many') {
                        <div class="img-gallery">
                          @for (img of (formData[field.key] || []); track $index) {
                            <div class="img-gallery-item">
                              <img [src]="img.url" />
                              <button class="img-gallery-remove" (click)="removeGalleryImage(field.key, $index)" title="Remove">
                                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                              </button>
                            </div>
                          }
                          <div class="img-zone img-zone--small" (click)="openMediaPicker(field.key, true)">
                            <svg width="24" height="24" fill="none" stroke="#c4c9d4" stroke-width="1.5" viewBox="0 0 24 24"><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                          </div>
                        </div>
                      } @else {
                        <!-- Single image -->
                        <div class="img-zone" (click)="openMediaPicker(field.key, false)">
                          @if (formData[field.key]?.url) {
                            <img [src]="formData[field.key].url"/>
                          } @else {
                            <svg width="32" height="32" fill="none" stroke="#c4c9d4" stroke-width="1.5" viewBox="0 0 24 24"><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                          }
                        </div>
                        @if (formData[field.key]?.url) {
                          <div class="img-actions">
                            <button class="img-btn img-btn-up" (click)="openMediaPicker(field.key, false)">Change</button>
                            <button class="img-btn img-btn-del" (click)="formData[field.key]=null">Remove</button>
                          </div>
                        } @else {
                          <div class="img-hint">
                            Upload an image or <a (click)="addImageUrl(field.key); $event.preventDefault()" href="#">add an image URL</a>
                          </div>
                        }
                      }
                    </div>
                  }
                  @case ('video') {
                    <div>
                      @if (formData[field.key]?.url) {
                        <div style="border-radius:8px;overflow:hidden;background:#000;max-height:240px">
                          <video [src]="formData[field.key].url" controls style="width:100%;max-height:240px"></video>
                        </div>
                        <div class="img-actions">
                          <button class="img-btn img-btn-up" (click)="openMediaPicker(field.key, false, 'video')">Change</button>
                          <button class="img-btn img-btn-del" (click)="formData[field.key]=null">Remove</button>
                        </div>
                      } @else {
                        <div class="img-zone" (click)="openMediaPicker(field.key, false, 'video')">
                          <svg width="32" height="32" fill="none" stroke="#c4c9d4" stroke-width="1.5" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                          <span class="img-zone-label">Click to choose a video</span>
                        </div>
                        <div class="img-hint">
                          Upload a video or <a (click)="addVideoUrl(field.key); $event.preventDefault()" href="#">add a video URL</a>
                        </div>
                      }
                    </div>
                  }
                  @case ('audio') {
                    <div>
                      @if (formData[field.key]?.url) {
                        <audio [src]="formData[field.key].url" controls style="width:100%"></audio>
                        <div class="img-actions">
                          <button class="img-btn img-btn-up" (click)="openMediaPicker(field.key, false, 'audio')">Change</button>
                          <button class="img-btn img-btn-del" (click)="formData[field.key]=null">Remove</button>
                        </div>
                      } @else {
                        <div class="img-zone" (click)="openMediaPicker(field.key, false, 'audio')">
                          <svg width="32" height="32" fill="none" stroke="#c4c9d4" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                          <span class="img-zone-label">Click to choose audio</span>
                        </div>
                      }
                    </div>
                  }
                  @case ('document') {
                    <div>
                      @if (formData[field.key]?.url) {
                        <div style="display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb">
                          <svg width="20" height="20" fill="none" stroke="#6b7280" stroke-width="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <span style="flex:1;font-size:13px;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ formData[field.key].name || 'Document' }}</span>
                        </div>
                        <div class="img-actions">
                          <button class="img-btn img-btn-up" (click)="openMediaPicker(field.key, false, 'document')">Change</button>
                          <button class="img-btn img-btn-del" (click)="formData[field.key]=null">Remove</button>
                        </div>
                      } @else {
                        <div class="img-zone" (click)="openMediaPicker(field.key, false, 'document')">
                          <svg width="32" height="32" fill="none" stroke="#c4c9d4" stroke-width="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <span class="img-zone-label">Click to choose a document</span>
                        </div>
                      }
                    </div>
                  }
                  @case ('number') {
                    <input type="number" class="field-input" [(ngModel)]="formData[field.key]"
                           [placeholder]="'Enter ' + field.name"/>
                  }
                  @case ('date') {
                    <input type="date" class="field-input" [(ngModel)]="formData[field.key]"/>
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
                    @if (field.cardinality === 'many') {
                      <!-- List of values -->
                      <div class="list-field">
                        @for (val of (formData[field.key] || []); track $index) {
                          <div class="list-field-row">
                            <span class="list-field-drag">⠿</span>
                            <input type="text" class="field-input" [(ngModel)]="formData[field.key][$index]"
                                   [placeholder]="'Item ' + ($index + 1)"/>
                            <button class="list-field-remove" (click)="removeListItem(field.key, $index)" title="Remove">
                              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                          </div>
                        }
                        <div class="list-field-actions">
                          <button class="list-field-add" (click)="addListItem(field.key)">Add item</button>
                          @if ((formData[field.key] || []).length > 0) {
                            <button class="list-field-clear" (click)="formData[field.key] = []">Clear all</button>
                          }
                        </div>
                      </div>
                    } @else {
                      <input type="text" class="field-input" [(ngModel)]="formData[field.key]"
                             [placeholder]="'Enter ' + field.name"
                             (ngModelChange)="field.key==='title' && onTitleChange($event)"/>
                    }
                  }
                }
              </div>
            }
          </div>

          <div class="add-field-row">
            <button class="add-field-btn" (click)="openManageFields()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Field
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ContentItemPageComponent implements OnInit {
  private route    = inject(ActivatedRoute);
  private router   = inject(Router);
  private cms      = inject(ContentLibraryService);
  private modalSvc = inject(ModalService);

  collectionId   = '';
  itemId         = '';
  isNew          = false;
  collectionName = signal('Items');

  itemBreadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
    { label: 'Content Library', routerLink: '/website/content-library' },
    { label: this.collectionName(), routerLink: `/website/content-library/${this.collectionId}` },
    { label: this.isNew ? 'New Item' : (this.formData['title'] || 'Edit Item') },
  ]);
  fields         = signal<ContentField[]>([]);
  loading        = signal(true);
  saving         = signal(false);
  formData: Record<string, any> = {};
  baseUrl        = window.location.hostname;

  private collection: Website | null = null;
  private item:       Website | null = null;

  async ngOnInit(): Promise<void> {
    this.collectionId = this.route.snapshot.paramMap.get('collectionId') ?? '';
    this.itemId       = this.route.snapshot.paramMap.get('itemId') ?? '';
    this.isNew        = !this.itemId || this.itemId === 'new';

    await this.loadCollection();
    if (!this.isNew) await this.loadItem();
    this.loading.set(false);
  }

  async loadCollection(): Promise<void> {
    this.collection = await this.cms.getCollectionById(this.collectionId);
    this.collectionName.set(this.collection?.template?.displayName ?? 'Items');
    this.fields.set(this.collection?.template?.fields ?? []);
    // init boolean defaults
    this.fields().filter((f: ContentField) => f.type === 'boolean').forEach((f: ContentField) => {
      if (!(f.key in this.formData)) this.formData[f.key] = false;
    });
  }

  async loadItem(): Promise<void> {
    this.item = await this.cms.getItemById(this.itemId);
    this.formData = { ...(this.item?.template?.data ?? {}) };
  }

  onTitleChange(value: string): void {
    const slugField = this.fields().find((f: ContentField) => f.type === 'url');
    if (slugField) {
      this.formData[slugField.key] = '/' + value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const website        = this.item ?? this.cms.buildNewItem(this.collectionId, {});
      website.template.data         = { ...this.formData };
      website.template.collectionId = this.collectionId;
      website.template.status       = website.template.status || 'draft';
      website.name                  = this.formData['title'] ?? 'Untitled';
      const res = await this.cms.saveItem(website);
      this.router.navigate(['/website/content-library', this.collectionId]);
    } finally {
      this.saving.set(false);
    }
  }

  async deleteItem(): Promise<void> {
    if (!confirm('Delete this item?')) return;
    await this.cms.deleteItem(this.itemId);
    this.router.navigate(['/website/content-library', this.collectionId]);
  }

  openManageFields(): void {
    if (!this.collection) return;
    const ref = this.modalSvc.open(ManageFieldsModalComponent, {
      size: 'md', closeOnBackdrop: false, data: { collection: this.collection }
    });
    ref.afterClosed().then((result: any) => {
      if (result?.saved) this.loadCollection();
    });
  }

  addListItem(fieldKey: string): void {
    if (!Array.isArray(this.formData[fieldKey])) this.formData[fieldKey] = [];
    this.formData[fieldKey] = [...this.formData[fieldKey], ''];
  }

  removeListItem(fieldKey: string, index: number): void {
    if (!Array.isArray(this.formData[fieldKey])) return;
    this.formData[fieldKey].splice(index, 1);
    this.formData[fieldKey] = [...this.formData[fieldKey]];
  }

  removeGalleryImage(fieldKey: string, index: number): void {
    const arr = this.formData[fieldKey];
    if (Array.isArray(arr)) {
      arr.splice(index, 1);
      this.formData[fieldKey] = [...arr];
    }
  }

  async addVideoUrl(fieldKey: string): Promise<void> {
    const ref = this.modalSvc.open<ImageUrlModalComponent, any, any>(
      ImageUrlModalComponent,
      { size: 'sm', data: { title: 'Add video link (URL)', label: 'Video URL', placeholder: 'https://example.com/video.mp4' } },
    );
    const media = await ref.afterClosed();
    if (media) {
      this.formData[fieldKey] = {
        url: media.imageUrl || media.thumbUrl || media.url?.defaultUrl || '',
        id: media.id,
        name: media.name,
      };
    }
  }

  async addImageUrl(fieldKey: string): Promise<void> {
    const ref = this.modalSvc.open<ImageUrlModalComponent, void, any>(
      ImageUrlModalComponent,
      { size: 'sm' },
    );
    const media = await ref.afterClosed();
    if (media) {
      this.formData[fieldKey] = {
        url: media.imageUrl || media.thumbUrl || media.url?.defaultUrl || '',
        id: media.id,
        name: media.name,
      };
    }
  }

  async openMediaPicker(fieldKey: string, multiple = false, mediaType: string = 'image'): Promise<void> {
    const existing = this.formData[fieldKey];
    const idSet = new Set<string>();
    if (multiple && Array.isArray(existing)) {
      existing.forEach((e: any) => { if (e?.id) idSet.add(e.id); });
    } else if (existing?.id) {
      idSet.add(existing.id);
    }
    const preSelectedIds = [...idSet];
    const titleMap: Record<string, string> = {
      image: multiple ? 'Choose Images' : 'Choose an Image',
      video: 'Choose a Video',
      audio: 'Choose Audio',
      document: 'Choose a Document',
    };

    const ref = this.modalSvc.open<MediaPickerModalComponent, MediaPickerConfig, any>(
      MediaPickerModalComponent,
      {
        size: 'xl',
        data: {
          contentTypes: [mediaType],
          multiple,
          title: titleMap[mediaType] || 'Choose Media',
          preSelectedIds,
        },
      },
    );

    const selected = await ref.afterClosed();
    if (!selected) return;

    if (multiple) {
      // Multi-select: replace with full selection — deduplicate by id
      const items = Array.isArray(selected) ? selected : [selected];
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (const m of items) {
        const id = m.id || '';
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        deduped.push({
          url: m.imageUrl || m.thumbUrl || m.url?.defaultUrl || '',
          id: m.id,
          name: m.name,
        });
      }
      this.formData[fieldKey] = deduped;
    } else {
      // Single-select: selected is a single Media
      if (selected.url || selected.imageUrl) {
        this.formData[fieldKey] = {
          url: selected.imageUrl || selected.thumbUrl || '',
          id: selected.id,
          name: selected.name,
        };
      }
    }
  }
}
