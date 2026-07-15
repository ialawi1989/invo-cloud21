import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { RichEditorComponent } from '@shared/components/rich-editor/rich-editor.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import { FieldTranslateService } from '@shared/services/field-translate.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { MultilingualSettingsService } from '@features/settings/translations/services/multilingual-settings.service';
import { isRtlByDefault } from '@features/settings/translations/services/multilingual-settings.types';

/**
 * Per-language value map for a single field — keyed by language code:
 * `{ en: 'Name', ar: 'الاسم', fr: 'Nom' }`. `en`/`ar` stay explicit so
 * existing callers keep using `result.en` / `result.ar`, while the index
 * signature carries any additional site languages.
 */
export interface TranslationLang {
  en: string;
  ar: string;
  [lang: string]: string;
}

export interface TranslationModalData {
  /** Current value to seed the form with (per-language map). Extra languages
   *  not in the site's set are still shown so nothing is silently dropped. */
  initial?: Record<string, string>;
  /** Optional label shown under the modal title (e.g. "Branch name"). */
  label?: string;
  /** Explicit language codes to edit. Defaults to the site's supported set
   *  (from the multilingual settings), falling back to `['en', 'ar']`. */
  languages?: string[];
  /** Render each language with the shared RichEditor (WYSIWYG + toolbar +
   *  HTML toggle) instead of a plain textarea — e.g. a product description. */
  rich?: boolean;
  /** Multi-line textarea instead of a single-line input. Ignored when `rich`.
   *  Defaults to false — most translated fields (names/titles) are one line. */
  multiline?: boolean;
}

interface LangField {
  code: string;
  /** Native language name (e.g. "العربية", "Français"). */
  label: string;
  rtl: boolean;
}

/**
 * Translation modal
 * ─────────────────
 * Edits one field's copy across every language the site supports, one input
 * per language, and returns the resulting `{ <lang>: value }` map on Save
 * (or `null` on Cancel). The language set is the site's `supported` list, so
 * adding a language on the Multilingual page automatically surfaces it here.
 *
 * The caller writes the result back onto its domain object (typically
 * `entity.translation.<field>`) and keeps the primary value (e.g.
 * `entity.name`) in sync with `result.en`.
 */
@Component({
  selector: 'app-translation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, RichEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './translation-modal.component.html',
  styleUrl: './translation-modal.component.scss',
})
export class TranslationModalComponent {
  private modalRef    = inject<ModalRef<TranslationLang | null>>(MODAL_REF);
  private data        = inject<TranslationModalData>(MODAL_DATA);
  private settingsSvc = inject(MultilingualSettingsService);
  private translator  = inject(FieldTranslateService);
  private toast       = inject(ToastService);

  label = this.data?.label ?? '';
  rich = this.data?.rich ?? false;
  multiline = this.data?.multiline ?? false;

  loading = signal<boolean>(true);
  /** True while an auto-translate AI call is in flight (blocks Save + inputs). */
  translating = signal<boolean>(false);
  fields  = signal<LangField[]>([]);
  values  = signal<Record<string, string>>({ ...(this.data?.initial ?? {}) });

  /** With 2+ languages the fields are shown one at a time behind a segmented
   *  language tab bar (instead of a long vertical stack); `activeLang` is the
   *  selected tab. */
  activeLang = signal<string>('en');
  useTabs = computed<boolean>(() => this.fields().length > 1);
  activeField = computed<LangField | undefined>(() =>
    this.fields().find((f) => f.code === this.activeLang()) ?? this.fields()[0],
  );

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    let codes = this.data?.languages ?? [];
    let rtlList: string[] = [];

    if (codes.length === 0) {
      try {
        const s = await this.settingsSvc.get();
        codes = s.supported ?? [];
        rtlList = s.rtlLanguages ?? [];
      } catch {
        codes = [];
      }
    }
    if (codes.length === 0) codes = ['en', 'ar'];

    // English first (the source), then the rest; include any language the
    // seed value already carries so existing translations are never dropped.
    const seeded = Object.keys(this.data?.initial ?? {});
    const ordered = ['en', ...codes, ...seeded].filter((c) => c !== 'en');
    const seen = new Set<string>(['en']);
    const list: LangField[] = [{ code: 'en', label: this.nativeName('en'), rtl: false }];
    for (const code of ordered) {
      if (seen.has(code)) continue;
      seen.add(code);
      list.push({
        code,
        label: this.nativeName(code),
        rtl: rtlList.includes(code) || isRtlByDefault(code),
      });
    }

    // Seed a value slot for every field.
    const v = { ...this.values() };
    for (const f of list) if (v[f.code] == null) v[f.code] = '';
    this.values.set(v);
    this.fields.set(list);
    this.activeLang.set(list[0]?.code ?? 'en');
    this.loading.set(false);
  }

  setActive(code: string): void {
    this.activeLang.set(code);
  }

  /** Autonym for a language code (name written in that language). */
  private nativeName(code: string): string {
    try {
      const dn = new Intl.DisplayNames([code], { type: 'language' });
      const name = dn.of(code);
      if (name && name.toLowerCase() !== code.toLowerCase()) {
        return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
      }
    } catch { /* Intl.DisplayNames unsupported for this code */ }
    return code.toUpperCase();
  }

  setValue(code: string, val: string): void {
    this.values.update((v) => ({ ...v, [code]: val }));
  }

  /** The English source that auto-translate reads from. */
  private sourceValue(): string {
    return (this.values()['en'] ?? '').trim();
  }

  /** Auto-translate is offered when there's an English source and the active
   *  tab is a language OTHER than the English source (translating the source
   *  into itself is a no-op). */
  canAutoTranslate = computed<boolean>(() =>
    !!this.sourceValue() &&
    this.activeLang() !== 'en' &&
    this.fields().some((f) => f.code === this.activeLang()),
  );

  /**
   * Machine-translate the English source into ONLY the currently-active
   * language tab, in one AI call, and drop the result into that input.
   * Existing values are overwritten so the button always reflects the current
   * English text.
   */
  async autoTranslate(): Promise<void> {
    if (this.translating()) return;
    const source = this.sourceValue();
    const active = this.activeField();
    if (!source || !active || active.code === 'en') return;
    const targets = [{ code: active.code, label: active.label }];

    this.translating.set(true);
    try {
      const result = await this.translator.translate(source, targets, this.label);
      const out = result[active.code];
      if (!out) {
        this.toast.error('COMMON.AUTO_TRANSLATE_FAILED');
        return;
      }
      this.values.update((v) => ({ ...v, [active.code]: out }));
      this.toast.success('COMMON.AUTO_TRANSLATE_DONE');
    } catch {
      this.toast.error('COMMON.AUTO_TRANSLATE_FAILED');
    } finally {
      this.translating.set(false);
    }
  }

  save(): void {
    // Single-line fields must never persist line breaks — collapse any newlines
    // (e.g. pasted content) to spaces. Rich/multiline fields keep their breaks.
    const singleLine = !this.rich && !this.multiline;
    // `en`/`ar` slots always exist (seeded in init), so the cast is safe.
    const out: Record<string, string> = { en: '', ar: '' };
    for (const [code, val] of Object.entries(this.values())) {
      let v = (val ?? '').trim();
      if (singleLine) v = v.replace(/\s*[\r\n]+\s*/g, ' ');
      out[code] = v;
    }
    this.modalRef.close(out as TranslationLang);
  }

  cancel(): void {
    this.modalRef.close(null);
  }
}
