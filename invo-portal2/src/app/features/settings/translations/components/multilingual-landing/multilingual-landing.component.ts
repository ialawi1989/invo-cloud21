import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { ORIGINAL_LANG, TranslationsStore } from '../../services/translations.store';
import { ApiTranslationService } from '../../services/api-translation.service';
import { MultilingualSettingsService } from '../../services/multilingual-settings.service';
import { TranslationLangSummary, TranslationSummary } from '../../services/translation-api';

interface LangRow {
  code: string;
  label: string;
  nativeLabel: string;
  translated: number;
  total: number;
  pct: number;
  complete: boolean;
}

/**
 * Multilingual landing — the overview page (Wix-style). Shows the original
 * language + total word count, lists the site's additional languages with
 * per-language progress, and offers "Add Language". Editing a language's
 * translations happens on a separate page (`/settings/translations/:lang`).
 */
@Component({
  selector: 'app-multilingual-landing',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, DropdownMenuBtnComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './multilingual-landing.component.html',
  styleUrl: './multilingual-landing.component.scss',
})
export class MultilingualLandingComponent implements OnInit {
  protected store = inject(TranslationsStore);
  private api = inject(ApiTranslationService);
  private settingsSvc = inject(MultilingualSettingsService);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  readonly originalLang = ORIGINAL_LANG;

  loading = signal<boolean>(false);
  summary = signal<TranslationSummary | null>(null);
  private i18nTick = signal(0);

  originalWords = computed<number>(() => this.summary()?.original.words ?? 0);

  langRows = computed<LangRow[]>(() => {
    this.i18nTick();
    const byLang = new Map((this.summary()?.languages ?? []).map((l: TranslationLangSummary) => [l.lang, l]));
    return this.store.additionalLanguages().map(code => {
      const s = byLang.get(code);
      const total = s?.total ?? 0;
      const translated = s?.translated ?? 0;
      const pct = total > 0 ? Math.round((translated / total) * 100) : 0;
      const lang = this.store.lang(code);
      return {
        code,
        label: lang?.label ?? code,
        nativeLabel: lang?.nativeLabel ?? code,
        translated,
        total,
        pct,
        complete: total > 0 && translated >= total,
      };
    });
  });

  addLangItems = computed<DropdownMenuBtnItem[]>(() => {
    this.i18nTick();
    return this.store.languagesToAdd().map(l => ({
      label: l.nativeLabel,
      click: () => this.addLanguage(l.code),
    }));
  });

  constructor() {
    withTranslations('settings/translations');
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  ngOnInit(): void {
    void this.init();
  }

  private async init(): Promise<void> {
    // Seed the additional-language list from the persisted `supported` set so
    // languages added in a previous session (and the modals' language list)
    // stay in sync — the store's default is only a first-run fallback.
    try {
      const settings = await this.settingsSvc.get();
      this.store.setAdditionalLanguages(settings.supported);
    } catch { /* keep the store default on failure */ }
    await this.loadSummary();
  }

  private async loadSummary(): Promise<void> {
    this.loading.set(true);
    try {
      this.summary.set(await this.api.getSummary(this.store.additionalLanguages()));
    } finally {
      this.loading.set(false);
    }
  }

  openEditor(code: string): void {
    void this.router.navigate(['/settings/translations', code]);
  }

  private addLanguage(code: string): void {
    this.store.addLanguage(code);
    void this.persistLanguages();
    void this.loadSummary();
  }

  private removeLanguage(code: string): void {
    this.store.removeLanguage(code);
    void this.persistLanguages();
    void this.loadSummary();
  }

  /** Persist the current language set to the site's `supported` list. */
  private async persistLanguages(): Promise<void> {
    try {
      await this.settingsSvc.saveSupported(this.store.additionalLanguages());
    } catch { /* surfaced by the toast layer elsewhere; keep UI responsive */ }
  }

  rowMenuItems(row: LangRow): DropdownMenuBtnItem[] {
    return [
      { label: 'TRANSLATIONS.LANDING.EDIT', click: () => this.openEditor(row.code) },
      { label: 'TRANSLATIONS.LANDING.REMOVE', danger: true, separator: true,
        click: () => this.removeLanguage(row.code) },
    ];
  }
}
