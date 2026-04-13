import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { ContentLibraryService } from '../services/content-library.service';

@Component({
  selector: 'app-new-collection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="min-width:360px">
      <div style="padding:20px 24px 14px;border-bottom:1px solid #f0f2f5;display:flex;align-items:center;justify-content:space-between">
        <h3 style="font-size:16px;font-weight:600;color:#111827;margin:0">New Library</h3>
        <button (click)="ref.dismiss()" style="border:none;background:transparent;cursor:pointer;color:#9ca3af;font-size:18px;line-height:1">✕</button>
      </div>
      <div style="padding:20px 24px">
        <div style="margin-bottom:16px">
          <label style="display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:6px">Library name</label>
          <input [(ngModel)]="name" (ngModelChange)="onNameChange()" (keydown.enter)="confirm()"
                 placeholder="e.g. Blog Posts"
                 style="width:100%;height:40px;border:1.5px solid #e5e7eb;border-radius:8px;padding:0 12px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box"/>
          @if (submitted() && !name.trim()) {
            <span style="font-size:12px;color:#ef4444">Name is required</span>
          }
        </div>
        <div style="margin-bottom:16px">
          <label style="display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:6px">Slug</label>
          <input [value]="slug" readonly
                 style="width:100%;height:40px;border:1.5px solid #e5e7eb;border-radius:8px;padding:0 12px;font-size:13px;font-family:monospace;background:#f8fafc;color:#6b7280;outline:none;box-sizing:border-box"/>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:8px">Icon</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            @for (ic of icons; track ic) {
              <button (click)="icon=ic"
                      [style.border]="icon===ic ? '2px solid #32acc1' : '1.5px solid #e5e7eb'"
                      [style.background]="icon===ic ? '#e6f7f9' : '#fff'"
                      style="width:36px;height:36px;border-radius:8px;font-size:18px;cursor:pointer;transition:.12s">
                {{ ic }}
              </button>
            }
          </div>
        </div>
      </div>
      <div style="padding:12px 24px 20px;border-top:1px solid #f0f2f5;display:flex;gap:10px">
        <button (click)="ref.dismiss()"
                style="flex:1;height:40px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;border:none;background:#f4f5f7;color:#374151;font-family:inherit">Cancel</button>
        <button (click)="confirm()" [disabled]="loading()"
                style="flex:1;height:40px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;border:none;background:#32acc1;color:#fff;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px">
          @if (loading()) { <span style="width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;animation:spin .6s linear infinite;display:inline-block"></span> }
          Create Library
        </button>
      </div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `
})
export class NewCollectionModalComponent {
  ref     = inject<ModalRef>(MODAL_REF);
  private cms = inject(ContentLibraryService);

  name      = '';
  slug      = '';
  icon      = '📝';
  submitted = signal(false);
  loading   = signal(false);
  icons     = ['📝','🖼','👥','⭐','📦','🎯','📊','🔗','💬','🏷','📅','🎨'];

  onNameChange(): void {
    this.slug = '/' + this.name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  }

  async confirm(): Promise<void> {
    this.submitted.set(true);
    if (!this.name.trim()) return;
    this.loading.set(true);
    try {
      const collection = this.cms.buildNewCollection(this.name.trim());
      collection.template.icon = this.icon;
      const res = await this.cms.saveCollection(collection);
      this.ref.close({ created: true, id: res?.data?.id ?? res?.id });
    } catch (err: any) {
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }
}
