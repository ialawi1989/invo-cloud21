import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { MediaService } from '../../../settings/media/services/media.service';

/** Media reference stored on a document's `attachment` array (the backend joins on `id`). */
export interface DocAttachment {
  id: string;
  size: number;
  mediaUrl: string;
  mediaType: string;
  mediaName: string;
}

const MAX_FILES = 10;
const MAX_BYTES = 10 * 1024 * 1024;

const toAttachment = (m: any): DocAttachment => ({
  id: String(m?.id ?? m?._id ?? ''),
  size: typeof m?.getSize === 'number' ? m.getSize : Number(m?.size?.size ?? m?.mediaSize ?? 0) || 0,
  mediaUrl: m?.imageUrl || m?.url?.defaultUrl || m?.url?.original || m?.url?.thumbnail || '',
  mediaType: m?.mediaType?.fileType || m?.contentType || '',
  mediaName: m?.name || '',
});

/**
 * "Attach File(s)" block shared by every document form: upload from the desktop or pick from the
 * Documents library. The parent owns the array (`attachments`) and is told through `changed`.
 */
@Component({
  selector: 'app-doc-attachments',
  standalone: true,
  imports: [CommonModule, TranslateModule, DropdownMenuBtnComponent],
  template: `
    <div class="da">
      <label class="da__label">{{ 'DOC_ATTACH.TITLE' | translate }}</label>
      <app-dropdown-menu-btn [items]="menu()" [appendToBody]="true" align="start" [disabled]="busy()" triggerClass="da__btn">
        ⤒ {{ 'DOC_ATTACH.UPLOAD' | translate }}
      </app-dropdown-menu-btn>
      <input #file type="file" multiple hidden (change)="fromDesktop(file)"/>
      <small class="da__hint">{{ 'DOC_ATTACH.LIMIT' | translate: { files: max, size: '10MB' } }}</small>

      @if (attachments().length) {
        <ul class="da__list">
          @for (a of attachments(); track a.id) {
            <li>
              <a [href]="a.mediaUrl" target="_blank" rel="noopener">{{ a.mediaName || a.id }}</a>
              <button type="button" (click)="remove(a)" aria-label="remove">✕</button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    .da { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .da__label { font-size: 13px; color: #334155; }
    :host ::ng-deep .da__btn { border: 1px dashed #cbd5e1; background: #fff; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-weight: 500; }
    .da__hint { color: #64748b; font-size: 12px; }
    .da__list { list-style: none; margin: 0; padding: 0; width: 100%; display: flex; flex-direction: column; gap: 4px; }
    .da__list li { display: flex; justify-content: space-between; gap: 8px; padding: 6px 10px; background: #f8fafc; border-radius: 6px; }
    .da__list a { color: #227d8d; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .da__list button { border: 0; background: none; color: #dc2626; cursor: pointer; }
  `],
})
export class DocAttachmentsComponent {
  private media = inject(MediaService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private lang = inject(LanguageService);

  attachments = input<DocAttachment[]>([]);
  changed = output<DocAttachment[]>();

  readonly max = MAX_FILES;
  busy = signal(false);

  menu(): DropdownMenuBtnItem[] {
    const t = (k: string) => this.lang.instant(k);
    return [
      { label: t('DOC_ATTACH.FROM_DESKTOP'), click: () => document.querySelector<HTMLInputElement>('app-doc-attachments input[type=file]')?.click(), disabled: false, danger: false },
      { label: t('DOC_ATTACH.FROM_DOCUMENTS'), click: () => void this.fromDocuments(), disabled: false, danger: false },
    ];
  }

  private add(items: DocAttachment[]): void {
    const current = this.attachments();
    const seen = new Set(current.map(a => a.id));
    const next = [...current, ...items.filter(a => a.id && !seen.has(a.id))];
    if (next.length > MAX_FILES) {
      this.toast.error('DOC_ATTACH.TOO_MANY');
      return;
    }
    this.changed.emit(next);
  }

  async fromDesktop(input: HTMLInputElement): Promise<void> {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    this.busy.set(true);
    try {
      const added: DocAttachment[] = [];
      for (const f of files) {
        if (f.size > MAX_BYTES) { this.toast.error('DOC_ATTACH.TOO_BIG', f.name); continue; }
        const res = await this.media.uploadFile(f);
        (res.data ?? []).forEach(m => added.push(toAttachment(m)));
      }
      this.add(added);
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.message ?? '');
    } finally {
      this.busy.set(false);
    }
  }

  async fromDocuments(): Promise<void> {
    const { MediaPickerModalComponent } =
      await import('../../../settings/media/components/media-picker/media-picker-modal.component');
    const picked = await this.modal.open<any, any, any>(MediaPickerModalComponent, {
      size: 'xl',
      data: { contentTypes: ['image', 'document'], title: this.lang.instant('DOC_ATTACH.FROM_DOCUMENTS'), multiple: true },
      closeOnBackdrop: true,
    }).afterClosed();
    if (!picked) return;
    this.add((Array.isArray(picked) ? picked : [picked]).map(toAttachment));
  }

  remove(a: DocAttachment): void {
    this.changed.emit(this.attachments().filter(x => x.id !== a.id));
  }
}
