import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

/** Possible outcomes from the "Add audio file" modal. Mirrors
 *  {@link VideoEmbedResult}: either an embed URL (SoundCloud / Spotify)
 *  or a hand-off to the media picker for an uploaded audio file. */
export type AudioEmbedResult =
  | { kind: 'embed';  url: string }
  | { kind: 'upload' };

/**
 * Wix-style "Add audio file" dialog — the audio twin of
 * {@link VideoEmbedModalComponent}. Two source tabs:
 *   - Embed — paste a SoundCloud / Spotify URL → `{ kind: 'embed', url }`.
 *             The caller converts it into the right player iframe.
 *   - Upload — `{ kind: 'upload' }` so the caller can open the shared
 *             MediaPickerModal scoped to audio files.
 */
@Component({
  selector: 'app-audio-embed-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'BLOG.COMPOSER.AUDIO_MODAL_TITLE' | translate" />

    <div class="am__body">
      <p class="am__label">{{ 'BLOG.COMPOSER.VIDEO_SELECT_SOURCE' | translate }}</p>
      <div class="am__tabs">
        <button type="button" class="am__tab" [class.is-on]="tab() === 'embed'" (click)="tab.set('embed')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          {{ 'BLOG.COMPOSER.VIDEO_EMBED' | translate }}
        </button>
        <button type="button" class="am__tab" [class.is-on]="tab() === 'upload'" (click)="tab.set('upload')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          {{ 'BLOG.COMPOSER.VIDEO_UPLOAD' | translate }}
        </button>
      </div>

      @if (tab() === 'embed') {
        <p class="am__hint">{{ 'BLOG.COMPOSER.AUDIO_PASTE_HINT' | translate }}</p>
        <input class="am__input"
               type="url"
               [ngModel]="url()"
               (ngModelChange)="url.set($event); error.set('')"
               (keydown.enter)="submitEmbed()"
               placeholder="e.g., www.soundcloud.com/example"
               autofocus/>
        @if (error()) { <p class="am__error">{{ error() }}</p> }
      } @else {
        <p class="am__hint">{{ 'BLOG.COMPOSER.AUDIO_UPLOAD_HINT' | translate }}</p>
      }
    </div>

    <app-modal-footer>
      <button class="am__btn am__btn--ghost" (click)="ref.dismiss()">{{ 'COMMON.CANCEL' | translate }}</button>
      @if (tab() === 'embed') {
        <button class="am__btn am__btn--primary"
                [disabled]="!canSubmit()"
                (click)="submitEmbed()">
          {{ 'BLOG.COMPOSER.AUDIO_EMBED_ACTION' | translate }}
        </button>
      } @else {
        <button class="am__btn am__btn--primary" (click)="ref.close({ kind: 'upload' })">
          {{ 'BLOG.COMPOSER.AUDIO_OPEN_LIBRARY' | translate }}
        </button>
      }
    </app-modal-footer>
  `,
  styles: [`
    .am__body { padding: 16px 20px 8px; display: flex; flex-direction: column; gap: 10px; }
    .am__label { margin: 0; font-size: 12px; font-weight: 600; color: #475569; }
    .am__tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .am__tab {
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
    .am__tab:hover { color: #0f172a; border-color: #cbd5e1; }
    .am__tab.is-on {
      border-color: #32acc1;
      color: #0e7490;
      background: #e6f7fa;
    }
    .am__hint { margin: 6px 0 0; font-size: 12px; color: #64748b; }
    .am__input {
      width: 100%;
      padding: 10px 12px;
      font: inherit;
      font-size: 13px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      color: #0f172a;
    }
    .am__input:focus { outline: none; border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.15); }
    .am__error { margin: 0; font-size: 12px; color: #b91c1c; }
    .am__btn {
      padding: 8px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .am__btn--ghost { background: #d4eef3; color: #0e7490; }
    .am__btn--ghost:hover { background: #b9e4ec; color: #0e7490; }
    .am__btn--primary { background: #32acc1; color: #fff; box-shadow: 0 0 0 2px #fff inset; }
    .am__btn--primary:hover:not(:disabled) { background: #2a93a6; }
    .am__btn--primary:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class AudioEmbedModalComponent {
  ref = inject<ModalRef<AudioEmbedResult | undefined>>(MODAL_REF);

  tab   = signal<'embed' | 'upload'>('embed');
  url   = signal<string>('');
  error = signal<string>('');

  canSubmit = computed(() => this.url().trim().length > 0);

  submitEmbed(): void {
    const url = this.url().trim();
    if (!url) return;
    if (!isLikelyAudioUrl(url)) {
      this.error.set('Couldn\'t recognise that audio URL.');
      return;
    }
    this.ref.close({ kind: 'embed', url });
  }
}

function isLikelyAudioUrl(url: string): boolean {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, '');
    return (
      host === 'soundcloud.com' || host.endsWith('.soundcloud.com') ||
      host === 'spotify.com'    || host.endsWith('.spotify.com')
    );
  } catch {
    return false;
  }
}
