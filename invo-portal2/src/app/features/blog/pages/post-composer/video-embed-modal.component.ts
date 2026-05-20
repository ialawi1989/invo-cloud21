import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

/** Possible outcomes from the "Add a video" modal. The composer uses
 *  the discriminant to decide whether to insert an iframe (embed) or
 *  open the media picker (upload). */
export type VideoEmbedResult =
  | { kind: 'embed';  url: string }
  | { kind: 'upload' };

/**
 * Wix-style "Add a video" dialog. Two tabs:
 *   - Embed — paste a YouTube / Vimeo URL → returned to the caller
 *             as `{ kind: 'embed', url }`. The caller is responsible
 *             for converting the URL into an iframe.
 *   - Upload — closes with `{ kind: 'upload' }` so the caller can
 *             hand off to the shared MediaPickerModal in the next
 *             tick. Keeps this dialog focused on choosing a source.
 */
@Component({
  selector: 'app-video-embed-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'BLOG.COMPOSER.VIDEO_MODAL_TITLE' | translate" />

    <div class="vm__body">
      <p class="vm__label">{{ 'BLOG.COMPOSER.VIDEO_SELECT_SOURCE' | translate }}</p>
      <div class="vm__tabs">
        <button type="button"
                class="vm__tab"
                [class.is-on]="tab() === 'embed'"
                (click)="tab.set('embed')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          {{ 'BLOG.COMPOSER.VIDEO_EMBED' | translate }}
        </button>
        <button type="button"
                class="vm__tab"
                [class.is-on]="tab() === 'upload'"
                (click)="tab.set('upload')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {{ 'BLOG.COMPOSER.VIDEO_UPLOAD' | translate }}
        </button>
      </div>

      @if (tab() === 'embed') {
        <p class="vm__hint">{{ 'BLOG.COMPOSER.VIDEO_PASTE_HINT' | translate }}</p>
        <input class="vm__input"
               type="url"
               [ngModel]="url()"
               (ngModelChange)="url.set($event); error.set('')"
               (keydown.enter)="submitEmbed()"
               placeholder="e.g., www.youtube.com/example"
               autofocus/>
        @if (error()) { <p class="vm__error">{{ error() }}</p> }
      } @else {
        <p class="vm__hint">{{ 'BLOG.COMPOSER.VIDEO_UPLOAD_HINT' | translate }}</p>
      }
    </div>

    <app-modal-footer>
      <button class="vm__btn vm__btn--ghost" (click)="ref.dismiss()">{{ 'COMMON.CANCEL' | translate }}</button>
      @if (tab() === 'embed') {
        <button class="vm__btn vm__btn--primary"
                [disabled]="!canSubmit()"
                (click)="submitEmbed()">
          {{ 'BLOG.COMPOSER.VIDEO_EMBED_ACTION' | translate }}
        </button>
      } @else {
        <button class="vm__btn vm__btn--primary" (click)="ref.close({ kind: 'upload' })">
          {{ 'BLOG.COMPOSER.VIDEO_OPEN_LIBRARY' | translate }}
        </button>
      }
    </app-modal-footer>
  `,
  styles: [`
    .vm__body { padding: 16px 20px 8px; display: flex; flex-direction: column; gap: 10px; }
    .vm__label { margin: 0; font-size: 12px; font-weight: 600; color: #475569; }
    .vm__tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .vm__tab {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 10px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      color: #475569;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: border-color 120ms, color 120ms, background 120ms;
    }
    .vm__tab:hover { color: #0f172a; border-color: #cbd5e1; }
    .vm__tab.is-on {
      border-color: #32acc1;
      color: #0e7490;
      background: #e6f7fa;
    }
    .vm__hint { margin: 6px 0 0; font-size: 12px; color: #64748b; }
    .vm__input {
      width: 100%;
      padding: 10px 12px;
      font: inherit;
      font-size: 13px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      color: #0f172a;
    }
    .vm__input:focus { outline: none; border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.15); }
    .vm__error { margin: 0; font-size: 12px; color: #b91c1c; }
    .vm__btn {
      padding: 8px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
    }
    /* Match the project's existing pill-button language (see the
       ConfirmModal). Secondary is a soft teal tint, primary is solid
       teal — same shape and rhythm across modals. */
    .vm__btn--ghost { background: #d4eef3; color: #0e7490; }
    .vm__btn--ghost:hover { background: #b9e4ec; color: #0e7490; }
    .vm__btn--primary { background: #32acc1; color: #fff; box-shadow: 0 0 0 2px #fff inset; }
    .vm__btn--primary:hover:not(:disabled) { background: #2a93a6; }
    .vm__btn--primary:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class VideoEmbedModalComponent {
  ref = inject<ModalRef<VideoEmbedResult | undefined>>(MODAL_REF);

  tab   = signal<'embed' | 'upload'>('embed');
  url   = signal<string>('');
  error = signal<string>('');

  canSubmit = computed(() => this.url().trim().length > 0);

  submitEmbed(): void {
    const url = this.url().trim();
    if (!url) return;
    if (!isLikelyVideoUrl(url)) {
      this.error.set('Couldn\'t recognise that video URL.');
      return;
    }
    this.ref.close({ kind: 'embed', url });
  }
}

function isLikelyVideoUrl(url: string): boolean {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, '');
    return (
      host === 'youtu.be' ||
      host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' ||
      host === 'vimeo.com'   || host.endsWith('.vimeo.com') ||
      host === 'facebook.com'|| host.endsWith('.facebook.com') ||
      host === 'fb.watch'
    );
  } catch {
    return false;
  }
}
