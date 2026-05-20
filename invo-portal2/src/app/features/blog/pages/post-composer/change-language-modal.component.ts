import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { LanguageService } from '@core/i18n/language.service';

export interface ChangeLanguageModalData {
  /** Current draft language code (e.g. 'en'). */
  current: string;
  /** Codes of languages already activated for this post — those are
   *  not eligible as the *new* default (the user can already switch
   *  to them via the language tabs). */
  active: string[];
  /** Codes the merchant has configured in Blog Settings. */
  supported: string[];
}

/**
 * "Change the draft language" dialog. Lets the editor pick a new
 * default language for the draft when one was set in error or never
 * set at all. Returns the picked language code (or undefined on
 * cancel) via `ref.afterClosed()`.
 */
@Component({
  selector: 'app-change-language-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'Change the draft language'" />

    <div class="cl__body">
      <p class="cl__hint">
        This draft is currently set as <strong>{{ currentLabel() }}</strong>.
        Change the language to:
      </p>
      @if (options().length === 0) {
        <p class="cl__empty">
          No other languages are configured. Add them in Blog Settings first.
        </p>
      } @else {
        <ul class="cl__list">
          @for (opt of options(); track opt.code) {
            <li>
              <label class="cl__row" [class.is-on]="picked() === opt.code">
                <input type="radio" name="lang"
                       [value]="opt.code"
                       [checked]="picked() === opt.code"
                       (change)="picked.set(opt.code)"/>
                <span class="cl__flag">{{ opt.flag }}</span>
                <span class="cl__label">{{ opt.label }}</span>
              </label>
            </li>
          }
        </ul>
      }
    </div>

    <app-modal-footer>
      <button class="cl__btn cl__btn--ghost" (click)="ref.dismiss()">Cancel</button>
      <button class="cl__btn cl__btn--primary"
              [disabled]="!picked() || picked() === data.current"
              (click)="confirm()">
        Change
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .cl__body  { padding: 14px 20px 6px; display: flex; flex-direction: column; gap: 10px; }
    .cl__hint  { margin: 0; font-size: 13px; color: #475569; line-height: 1.5; }
    .cl__hint strong { color: #0f172a; }
    .cl__empty { margin: 8px 0; font-size: 13px; color: #94a3b8; font-style: italic; }
    .cl__list  { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .cl__row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: 1px solid transparent;
      border-radius: 8px;
      cursor: pointer;
      transition: background 120ms, border-color 120ms;
    }
    .cl__row:hover { background: #f8fafc; }
    .cl__row.is-on { background: #e6f7fa; border-color: #32acc1; }
    .cl__row input { accent-color: #32acc1; }
    .cl__flag  { font-size: 18px; line-height: 1; }
    .cl__label { font-size: 14px; color: #0f172a; }
    .cl__btn {
      padding: 8px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .cl__btn--ghost   { background: #d4eef3; color: #0e7490; }
    .cl__btn--ghost:hover { background: #b9e4ec; }
    .cl__btn--primary { background: #32acc1; color: #fff; }
    .cl__btn--primary:hover:not(:disabled) { background: #2a93a6; }
    .cl__btn--primary:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class ChangeLanguageModalComponent {
  ref       = inject<ModalRef<string | undefined>>(MODAL_REF);
  data      = inject<ChangeLanguageModalData>(MODAL_DATA);
  private langSvc   = inject(LanguageService);

  picked = signal<string>(this.data.current);

  options = computed(() => {
    // Show every supported language. The user can also switch to a
    // language that doesn't have a translation yet — it just becomes
    // the new default and the existing text moves with them.
    const codes = (this.data.supported?.length ? this.data.supported : ['en']);
    return codes.map(code => ({
      code,
      label: this.labelFor(code),
      flag: this.flagFor(code),
    }));
  });

  currentLabel = computed(() => this.labelFor(this.data.current));

  private labelFor(code: string): string {
    return this.langSvc.available.find(a => a.code === code)?.nativeLabel ?? code.toUpperCase();
  }

  /** Crude code → flag emoji mapper using the language code's
   *  region heuristic. Falls back to a globe. */
  private flagFor(code: string): string {
    const map: Record<string, string> = {
      en: '🇺🇸', ar: '🇧🇭', he: '🇮🇱', fa: '🇮🇷', ur: '🇵🇰',
      es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪', it: '🇮🇹', pt: '🇵🇹',
      tr: '🇹🇷', ru: '🇷🇺', zh: '🇨🇳', ja: '🇯🇵', ko: '🇰🇷',
    };
    return map[code.toLowerCase()] ?? '🌐';
  }

  confirm(): void {
    const v = this.picked();
    if (!v || v === this.data.current) { this.ref.dismiss(); return; }
    this.ref.close(v);
  }
}
