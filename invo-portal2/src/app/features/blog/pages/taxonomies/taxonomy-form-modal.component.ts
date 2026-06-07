import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { BLOG_API } from '../../services/blog-api';
import {
  BlogTaxonomy,
  TaxonomyLocale,
  TaxonomyType,
} from '../../services/blog.types';
import { LanguageTabsComponent } from '../../components/language-tabs.component';
import { generateSlug } from '../../utils/blog-utils';

interface ModalInput {
  taxonomyType: TaxonomyType;
  existing:     BlogTaxonomy | null;
  /** Language to author a NEW taxonomy in (from the create-language modal). */
  initialLang?: string;
}

@Component({
  selector: 'app-taxonomy-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    LanguageTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="title()" [subtitle]="subtitle()"/>

    <div class="tf">
      <app-blog-language-tabs
        [activeLangs]="activeLangs()"
        [addableLangs]="addableLangs()"
        [active]="active()"
        [defaultLang]="defaultLang()"
        [completion]="completion()"
        [showDefaultPicker]="false"
        [showDefaultBadge]="true"
        [canRemove]="true"
        (activeChange)="active.set($event)"
        (addLang)="addLang($event)"
        (removeLang)="removeLang($event)"/>

      <div class="tf__grid" [dir]="isRtl(active()) ? 'rtl' : 'ltr'">
        <label class="tf__field">
          <span class="tf__label">{{ 'BLOG.TAXONOMIES.NAME' | translate }} <span class="req">*</span></span>
          <input class="tf__input"
                 [(ngModel)]="nameDraft"
                 (ngModelChange)="onNameChange($event)"
                 [placeholder]="'BLOG.TAXONOMIES.NAME' | translate"/>
        </label>

        <label class="tf__field">
          <span class="tf__label">{{ 'BLOG.TAXONOMIES.SLUG' | translate }}</span>
          <input class="tf__input tf__input--mono"
                 [(ngModel)]="slugDraft"
                 (ngModelChange)="onSlugChange($event)"/>
        </label>

        @if (taxonomyType !== 'tag') {
          <label class="tf__field tf__field--full">
            <span class="tf__label">{{ 'BLOG.TAXONOMIES.DESCRIPTION' | translate }}</span>
            <textarea class="tf__input tf__textarea"
                      rows="2"
                      [(ngModel)]="descriptionDraft"
                      (ngModelChange)="setLocaleField('description', $event)"></textarea>
          </label>

          <label class="tf__field">
            <span class="tf__label">{{ 'BLOG.TAXONOMIES.SEO_TITLE' | translate }}</span>
            <input class="tf__input"
                   [(ngModel)]="seoTitleDraft"
                   (ngModelChange)="setLocaleField('seoTitle', $event)"/>
          </label>

          <label class="tf__field">
            <span class="tf__label">{{ 'BLOG.TAXONOMIES.SEO_DESCRIPTION' | translate }}</span>
            <input class="tf__input"
                   [(ngModel)]="seoDescriptionDraft"
                   (ngModelChange)="setLocaleField('seoDescription', $event)"/>
          </label>
        }
      </div>

      @if (taxonomyType !== 'tag') {
        <div class="tf__shared">
          <label class="tf__field">
            <span class="tf__label">{{ 'BLOG.TAXONOMIES.IMAGE_URL' | translate }}</span>
            <div class="tf__imageRow">
              <input class="tf__input"
                     [(ngModel)]="imageUrl"
                     placeholder="https://…"/>
              <button type="button" class="tf-btn" (click)="filePicker.click()">
                {{ 'BLOG.TAXONOMIES.UPLOAD' | translate }}
              </button>
              <input #filePicker type="file" accept="image/*" hidden (change)="onUpload($any($event.target).files)"/>
            </div>
            @if (imageUrl()) { <img class="tf__imagePreview" [src]="imageUrl()" alt=""/> }
          </label>

          <label class="tf__field tf__field--narrow">
            <span class="tf__label">{{ 'BLOG.TAXONOMIES.ORDER' | translate }}</span>
            <input type="number" class="tf__input" [(ngModel)]="order"/>
          </label>
        </div>
      }
    </div>

    <app-modal-footer>
      <button type="button" class="tf-btn tf-btn--ghost" (click)="cancel()">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="tf-btn tf-btn--primary"
              [disabled]="!canSave() || saving()"
              (click)="save()">
        @if (saving()) { … }
        {{ 'COMMON.SAVE' | translate }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .tf { padding: 16px 24px; display: flex; flex-direction: column; gap: 16px; }
    .tf__grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .tf__field { display: flex; flex-direction: column; gap: 4px; }
    .tf__field--full   { grid-column: 1 / -1; }
    .tf__field--narrow { max-width: 120px; }
    .tf__label { font-size: 12px; font-weight: 500; color: #475569; }
    .req { color: #ef4444; }
    .tf__input {
      width: 100%;
      padding: 8px 12px;
      font-size: 13px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      color: #0f172a;
    }
    .tf__input:focus { outline: none; border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.12); }
    .tf__input--mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .tf__textarea { resize: vertical; min-height: 60px; }
    .tf__shared { display: flex; gap: 12px; padding-top: 12px; border-top: 1px dashed #e2e8f0; }
    .tf__imageRow { display: flex; gap: 6px; }
    .tf__imagePreview { width: 80px; height: 80px; border-radius: 8px; object-fit: cover; margin-top: 6px; }

    .tf-btn {
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid transparent;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .tf-btn--primary { background: #32acc1; color: #fff; }
    .tf-btn--primary:hover:not(:disabled) { background: #2a93a6; }
    .tf-btn--primary:disabled { opacity: .4; cursor: not-allowed; }
    .tf-btn--ghost { background: transparent; color: #475569; }
    .tf-btn--ghost:hover { background: #f1f5f9; color: #0f172a; }
  `],
})
export class TaxonomyFormModalComponent {
  private data       = inject<ModalInput>(MODAL_DATA);
  private modalRef   = inject(MODAL_REF);
  private api        = inject(BLOG_API);
  private translate  = inject(TranslateService);
  private toast      = inject(ToastService);
  private langSvc    = inject(LanguageService);

  taxonomyType: TaxonomyType = this.data.taxonomyType;
  private id: string | null = this.data.existing?.id ?? null;

  // ── Per-language form slices ────────────────────────────────────────
  private startLang = this.data.existing?.defaultLanguage ?? this.data.initialLang ?? 'en';
  defaultLang  = signal<string>(this.startLang);
  active       = signal<string>(this.startLang);
  private translations = signal<Record<string, TaxonomyLocale>>(
    this.data.existing?.translations ?? { [this.startLang]: { name: '', slug: '' } },
  );

  imageUrl = signal<string>(this.data.existing?.image ?? '');
  order    = signal<number>(this.data.existing?.order ?? 0);

  saving   = signal<boolean>(false);

  // Drafts mirror the active language slice so the inputs are ngModel-bound
  // without nested form complexity.
  nameDraft           = signal<string>('');
  slugDraft           = signal<string>('');
  descriptionDraft    = signal<string>('');
  seoTitleDraft       = signal<string>('');
  seoDescriptionDraft = signal<string>('');

  /** Once the user edits the slug manually, stop auto-deriving. */
  private slugEdited  = signal<boolean>(false);

  constructor() {
    // Sync drafts → translations when active language changes.
    this.syncDraftsFromActive();
  }

  // ── Derived ─────────────────────────────────────────────────────────
  activeLangs = computed(() => Object.keys(this.translations()));
  addableLangs = computed(() => {
    const have = new Set(this.activeLangs());
    return this.langSvc.available.map(l => l.code).filter(c => !have.has(c));
  });
  completion = computed(() => {
    const out: Record<string, 'complete' | 'partial' | 'empty'> = {};
    for (const [code, locale] of Object.entries(this.translations())) {
      const hasName = !!locale.name?.trim();
      const hasSlug = !!locale.slug?.trim();
      out[code] = (hasName && hasSlug) ? 'complete' : (hasName || hasSlug ? 'partial' : 'empty');
    }
    return out;
  });
  title = computed(() =>
    this.translate.instant(this.id
      ? `BLOG.TAXONOMIES.EDIT_${this.taxonomyType.toUpperCase()}`
      : `BLOG.TAXONOMIES.NEW_${this.taxonomyType.toUpperCase()}`),
  );
  subtitle = computed(() => this.translate.instant('BLOG.TAXONOMIES.MODAL_SUB'));
  canSave = computed(() => {
    const def = this.translations()[this.defaultLang()];
    return !!def?.name?.trim();
  });

  // ── Locale switching ────────────────────────────────────────────────
  isRtl(lang: string): boolean {
    return lang === 'ar';
  }

  private syncDraftsFromActive(): void {
    const slice = this.translations()[this.active()] ?? { name: '', slug: '' };
    this.nameDraft.set(slice.name ?? '');
    this.slugDraft.set(slice.slug ?? '');
    this.descriptionDraft.set(slice.description ?? '');
    this.seoTitleDraft.set(slice.seoTitle ?? '');
    this.seoDescriptionDraft.set(slice.seoDescription ?? '');
    this.slugEdited.set(!!slice.slug);
  }

  onNameChange(name: string): void {
    const next = { ...this.translations() };
    next[this.active()] = { ...next[this.active()], name };
    if (!this.slugEdited()) {
      const slug = generateSlug(name);
      this.slugDraft.set(slug);
      next[this.active()] = { ...next[this.active()], slug };
    }
    this.translations.set(next);
  }
  onSlugChange(slug: string): void {
    this.slugEdited.set(true);
    const next = { ...this.translations() };
    next[this.active()] = { ...next[this.active()], slug: generateSlug(slug) };
    this.translations.set(next);
    if (this.slugDraft() !== next[this.active()].slug) {
      this.slugDraft.set(next[this.active()].slug);
    }
  }
  setLocaleField(field: keyof TaxonomyLocale, value: string): void {
    const next = { ...this.translations() };
    next[this.active()] = { ...next[this.active()], [field]: value };
    this.translations.set(next);
  }

  // Re-sync drafts whenever the active tab changes.
  addLang(code: string): void {
    const next = { ...this.translations() };
    next[code] = { name: '', slug: '' };
    this.translations.set(next);
    this.active.set(code);
    this.syncDraftsFromActive();
  }
  removeLang(code: string): void {
    if (code === this.defaultLang()) return;
    const next = { ...this.translations() };
    delete next[code];
    this.translations.set(next);
    if (this.active() === code) {
      this.active.set(this.defaultLang());
      this.syncDraftsFromActive();
    }
  }

  // ── Image upload ────────────────────────────────────────────────────
  async onUpload(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file) return;
    const { url } = await this.api.upload(file);
    this.imageUrl.set(url);
  }

  // ── Save / Cancel ───────────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    // Force the active draft's name/slug to flush back into translations.
    const flush = { ...this.translations() };
    flush[this.active()] = {
      ...flush[this.active()],
      name: this.nameDraft(),
      slug: this.slugDraft() || generateSlug(this.nameDraft()),
    };
    try {
      const saved = await this.api.saveTaxonomy({
        id:               this.id ?? undefined,
        taxonomyType:     this.taxonomyType,
        defaultLanguage:  this.defaultLang(),
        slug:             flush[this.defaultLang()].slug || generateSlug(flush[this.defaultLang()].name),
        order:            Number(this.order()) || 0,
        image:            this.imageUrl() || null,
        translations:     flush,
      });
      this.modalRef.close(saved);
    } catch (e: any) {
      this.saving.set(false);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    }
  }

  cancel(): void { this.modalRef.dismiss(); }
}
