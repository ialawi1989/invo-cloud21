import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

export interface TaxonomyLanguageModalData {
  /** 'category' | 'tag' — drives the title/labels. */
  kind: 'category' | 'tag';
  /** Languages to choose from. */
  languages: { code: string; label: string; flag: string }[];
}

/**
 * "Create category / Create tag" language picker — the small dialog Wix
 * shows before the editor: choose which language the new taxonomy is
 * authored in. Returns the chosen language code (or undefined on cancel).
 */
@Component({
  selector: 'app-taxonomy-language-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header
      [title]="(data.kind === 'category' ? 'BLOG.TAXONOMIES.NEW_CATEGORY' : 'BLOG.TAXONOMIES.NEW_TAG') | translate" />

    <div class="tlm__body">
      <p class="tlm__hint">
        {{ (data.kind === 'category' ? 'BLOG.TAXONOMIES.PICK_LANG_CATEGORY' : 'BLOG.TAXONOMIES.PICK_LANG_TAG') | translate }}
      </p>
      @for (l of data.languages; track l.code) {
        <label class="tlm__opt" [class.is-on]="lang() === l.code">
          <input type="radio" name="tlmLang" [value]="l.code" [ngModel]="lang()" (ngModelChange)="lang.set(l.code)"/>
          <span class="tlm__flag">{{ l.flag }}</span>
          <span class="tlm__name">{{ l.label }}</span>
        </label>
      }
    </div>

    <app-modal-footer>
      <button type="button" class="tlm__add" (click)="addLanguage()">{{ 'BLOG.TAXONOMIES.ADD_LANGUAGE' | translate }}</button>
      <span class="tlm__spacer"></span>
      <button type="button" class="tlm__btn tlm__btn--ghost" (click)="ref.dismiss()">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="tlm__btn tlm__btn--primary" [disabled]="!lang()" (click)="ref.close(lang())">
        {{ (data.kind === 'category' ? 'BLOG.TAXONOMIES.NEW_CATEGORY' : 'BLOG.TAXONOMIES.NEW_TAG') | translate }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .tlm__body { padding: 8px 20px 12px; }
    .tlm__hint { margin: 0 0 12px; font-size: 13px; color: #64748b; }
    .tlm__opt {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px;
      margin-bottom: 8px; cursor: pointer; font-size: 14px; color: #0f172a;
      transition: border-color .1s, background .1s;
    }
    .tlm__opt:hover { border-color: #cbd5e1; }
    .tlm__opt.is-on { border-color: var(--color-brand-600, #2691a4); background: #f4fafb; }
    .tlm__opt input { accent-color: var(--color-brand-600, #2691a4); }
    .tlm__flag { font-size: 18px; line-height: 1; }
    .tlm__name { font-weight: 500; }
    .tlm__add { background: transparent; border: 0; color: var(--color-brand-700, #2691a4); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .tlm__add:hover { text-decoration: underline; }
    .tlm__spacer { flex: 1; }
    .tlm__btn { padding: 8px 18px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
    .tlm__btn--ghost { background: #d4eef3; color: #0e7490; }
    .tlm__btn--ghost:hover { background: #b9e4ec; }
    .tlm__btn--primary { background: var(--color-brand-600, #2691a4); color: #fff; }
    .tlm__btn--primary:hover:not(:disabled) { background: var(--color-brand-700, #2691a4); }
    .tlm__btn--primary:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class TaxonomyLanguageModalComponent {
  data = inject<TaxonomyLanguageModalData>(MODAL_DATA);
  ref  = inject<ModalRef<string | undefined>>(MODAL_REF);
  private router = inject(Router);

  lang = signal<string>(this.data.languages.find(l => l.code === 'en')?.code ?? this.data.languages[0]?.code ?? 'en');

  addLanguage(): void {
    this.ref.dismiss();
    void this.router.navigate(['/blog/settings']);
  }
}
