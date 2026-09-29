import '../../account-i18n';
import { Component, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { SpinnerComponent } from '@shared/components/spinner';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { MediaService } from '../../../settings/media/services/media.service';

/** Media reference stored on a document's `attachment` array. Freshly-picked items carry a flat
 *  `size` (from `toAttachment()`); items reloaded from the backend carry `Media.size`'s raw JSONB
 *  shape (`{size, formatted}`) verbatim (`invoice.repo.ts`'s attachment JOIN) — `sizeMb()` below
 *  normalizes either shape rather than assuming one. */
export interface DocAttachment {
  id: string;
  size: number | { size: number; formatted?: string };
  mediaUrl: string;
  mediaType: string;
  mediaName: string;
}

// Matches legacy `AttachmentComponent`'s defaults exactly (`maxFiles = 3`, `MediaService.maxFileSize = 5242880`).
const MAX_FILES = 3;
const MAX_BYTES = 5242880;

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
  imports: [CommonModule, TranslateModule, DropdownMenuBtnComponent, SpinnerComponent],
  template: `
    <div class="da">
      <label class="da__label">{{ 'DOC_ATTACH.TITLE' | translate }}</label>
      <app-dropdown-menu-btn [items]="menu()" [appendToBody]="true" align="start" [disabled]="busy()" triggerClass="da__btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(180deg);"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        {{ 'DOC_ATTACH.UPLOAD' | translate }}
      </app-dropdown-menu-btn>
      <input #file type="file" multiple hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.odt,.ods,.rtf" (change)="fromDesktop(file)"/>
      <small class="da__hint">{{ 'DOC_ATTACH.LIMIT' | translate: { count: max, size: maxSizeMb } }}</small>

      @if (busy()) {
        <div class="da__uploading"><app-spinner size="xs" class="text-brand-600"/> {{ 'DOC_ATTACH.UPLOADING' | translate }}</div>
      }

      @if (items().length) {
        <ul class="da__list">
          @for (a of items(); track a.id) {
            <li>
              <span class="da__icon" [class]="'da__icon--' + iconKind(a)">
                @switch (iconKind(a)) {
                  @case ('image') {
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                  }
                  @default {
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><polyline points="14 2 14 8 20 8"/></svg>
                  }
                }
              </span>
              <div class="da__meta">
                <div class="da__name" [title]="a.mediaName || a.id">{{ a.mediaName || a.id }}</div>
                <div class="da__sub">
                  {{ sizeMb(a) }}MB
                  <span class="da__actions">
                    · <a href="javascript:void(0)" [class.da__link--disabled]="busy()" (click)="!busy() && preview(a)">{{ 'DOC_ATTACH.PREVIEW' | translate }}</a>
                    · <a href="javascript:void(0)" [class.da__link--disabled]="busy()" (click)="!busy() && download(a)">{{ 'DOC_ATTACH.DOWNLOAD' | translate }}</a>
                  </span>
                </div>
              </div>
              <button type="button" class="da__remove" [disabled]="busy()" (click)="remove(a)" aria-label="remove">✕</button>
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
    .da__list li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: #f8fafc; border-radius: 6px; }
    .da__icon { flex: 0 0 auto; width: 30px; height: 30px; border-radius: 6px; display: inline-grid; place-items: center; font-size: 10px; font-weight: 700; color: #fff; text-transform: uppercase;
      &--image { background: #16a34a; } &--pdf { background: #dc2626; } &--word { background: #2563eb; }
      &--excel { background: #15803d; } &--ppt { background: #ea580c; } &--file { background: #64748b; } }
    .da__meta { flex: 1; min-width: 0; }
    .da__name { color: #0f172a; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .da__sub { color: #64748b; font-size: 12px; }
    .da__actions a { color: #227d8d; &:hover { text-decoration: underline; } }
    .da__link--disabled { color: #cbd5e1 !important; pointer-events: none; text-decoration: none !important; }
    .da__remove { flex: 0 0 auto; border: 0; background: none; color: #dc2626; cursor: pointer;
      &:disabled { color: #cbd5e1; cursor: not-allowed; } }
    .da__uploading { display: flex; align-items: center; gap: 8px; color: #227d8d; font-size: 12.5px; font-weight: 500; }
  `],
})
export class DocAttachmentsComponent {
  private media = inject(MediaService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private lang = inject(LanguageService);

  /** The server may send `null` (or the string 'null') for a document with no files. */
  attachments = input<DocAttachment[] | null | undefined>([]);
  items = computed<DocAttachment[]>(() => { const a = this.attachments(); return Array.isArray(a) ? a : []; });
  /** Fires on every change (add or remove) with the full new list — for consumers that just track
   *  the array locally (the form pages, saved later as part of the whole document). */
  changed = output<DocAttachment[]>();
  /** Fires ONLY on add, with the full new list — an immediate-persist consumer (a view page) uses
   *  this with the add endpoint, which overwrites the whole column server-side and so needs the
   *  complete desired list, not just what's new. */
  added = output<DocAttachment[]>();
  /** Fires ONLY on remove, with the removed item — for an immediate-persist consumer that wants the
   *  real per-item delete endpoint (a server-side filter, matching legacy) instead of resending the
   *  whole list through the add endpoint's full-column overwrite. */
  removed = output<DocAttachment>();

  readonly max = MAX_FILES;
  /** Matches legacy's `FileSize` pipe (`{mega:true, precision:3}`) exactly, e.g. "5.000". */
  readonly maxSizeMb = (MAX_BYTES / (1024 * 1024)).toFixed(3);
  busy = signal(false);

  /** Warn before leaving mid-upload — the file wouldn't be attached, and there's no way to resume. */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent): void {
    if (!this.busy()) return;
    e.preventDefault();
    e.returnValue = '';
  }

  menu(): DropdownMenuBtnItem[] {
    const t = (k: string) => this.lang.instant(k);
    return [
      { label: t('DOC_ATTACH.FROM_DESKTOP'), click: () => document.querySelector<HTMLInputElement>('app-doc-attachments input[type=file]')?.click(), disabled: false, danger: false },
      { label: t('DOC_ATTACH.FROM_DOCUMENTS'), click: () => void this.fromDocuments(), disabled: false, danger: false },
    ];
  }

  private add(items: DocAttachment[]): void {
    const current = this.items();
    const seen = new Set(current.map(a => a.id));
    const next = [...current, ...items.filter(a => a.id && !seen.has(a.id))];
    if (next.length > MAX_FILES) {
      this.toast.error('DOC_ATTACH.TOO_MANY');
      return;
    }
    this.changed.emit(next);
    this.added.emit(next);
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
      data: { contentTypes: ['document'], title: this.lang.instant('DOC_ATTACH.FROM_DOCUMENTS'), multiple: true },
      closeOnBackdrop: true,
    }).afterClosed();
    if (!picked) return;
    this.add((Array.isArray(picked) ? picked : [picked]).map(toAttachment));
  }

  async remove(a: DocAttachment): Promise<void> {
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: {
        title: this.lang.instant('COMMON.DELETE'),
        message: this.lang.instant('DOC_ATTACH.CONFIRM_REMOVE', { name: a.mediaName || a.id }),
        danger: true,
      },
    }).afterClosed();
    if (!ok) return;
    this.changed.emit(this.items().filter(x => x.id !== a.id));
    this.removed.emit(a);
  }

  /** File extension (legacy shows a per-type icon, keyed off this). */
  extOf(a: DocAttachment): string {
    return (a.mediaName || '').split('.').pop()?.toLowerCase() ?? '';
  }

  /** Matches legacy `getFileIcon()`'s grouping exactly. */
  iconKind(a: DocAttachment): 'image' | 'pdf' | 'word' | 'excel' | 'ppt' | 'file' {
    const ext = this.extOf(a);
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'word';
    if (['xls', 'xlsx'].includes(ext)) return 'excel';
    if (['ppt', 'pptx'].includes(ext)) return 'ppt';
    return 'file';
  }

  /** Defensive against every shape `size` has shown up as on an already-saved attachment (a flat
   *  byte count from `toAttachment()`, but also `{size:N}` when the raw invoice payload's item was
   *  never run through it) — never lets a mismatch render as "NaN". */
  sizeMb(a: DocAttachment): string {
    const raw: any = a.size;
    const bytes = typeof raw === 'number' ? raw : Number(raw?.size ?? raw) || 0;
    return (bytes / (1024 * 1024)).toFixed(3);
  }

  preview(a: DocAttachment): void {
    if (a.mediaUrl) window.open(a.mediaUrl, '_blank', 'noopener');
  }

  download(a: DocAttachment): void {
    void this.media.downloadMediaRaw(a.id, a.mediaName || a.id);
  }
}
