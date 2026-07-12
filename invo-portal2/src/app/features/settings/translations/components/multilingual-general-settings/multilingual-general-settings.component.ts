import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ToastService } from '@shared/components/toast/toast.service';

import { ORIGINAL_LANG, TranslationsStore } from '../../services/translations.store';
import { MultilingualSettingsService } from '../../services/multilingual-settings.service';
import { MultilingualSettings, UrlStructure } from '../../services/multilingual-settings.types';

interface UrlOption { value: UrlStructure; example: string; }

/**
 * Multilingual → General Settings (Wix parity). Three cards:
 *   1. Language auto-switch (toggle, auto-saved; SEO warning when on)
 *   2. Default visitor language (radio list, Edit/Cancel/Save)
 *   3. URL structure (radio list, Edit/Cancel/Save)
 *
 * Renders inside the Translation Manager full-page shell, so it inherits the
 * Exit-to-Settings top bar.
 */
@Component({
  selector: 'app-multilingual-general-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mgs">
      <header class="mgs-head">
        <a class="mgs-back" routerLink="/settings/translations"
           [attr.aria-label]="'TRANSLATIONS.BACK' | translate">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="rtl:rotate-180">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </a>
        <div class="mgs-head__titles">
          <h1 class="mgs-title">{{ 'TRANSLATIONS.GENERAL.TITLE' | translate }}</h1>
          <p class="mgs-sub">{{ 'TRANSLATIONS.GENERAL.SUBTITLE' | translate }}</p>
        </div>
      </header>

      @if (loading()) {
        <div class="mgs-loading"><span class="mgs-spinner"></span></div>
      } @else {
        <!-- ── 1. Language auto-switch ─────────────────────────────── -->
        <section class="mgs-card">
          <div class="mgs-row">
            <div class="mgs-row__text">
              <h2 class="mgs-card__title">{{ 'TRANSLATIONS.GENERAL.AUTO_SWITCH' | translate }}</h2>
              <p class="mgs-card__desc">{{ 'TRANSLATIONS.GENERAL.AUTO_SWITCH_DESC' | translate }}</p>
            </div>
            <button type="button" class="mgs-switch" role="switch"
                    [class.on]="autoSwitch()" [attr.aria-checked]="autoSwitch()"
                    [disabled]="saving()" (click)="toggleAutoSwitch()">
              <span class="mgs-switch__knob"></span>
            </button>
          </div>
          @if (autoSwitch()) {
            <div class="mgs-warn">{{ 'TRANSLATIONS.GENERAL.AUTO_SWITCH_WARN' | translate }}</div>
          }
        </section>

        <!-- ── 2. Default visitor language ─────────────────────────── -->
        <section class="mgs-card">
          <div class="mgs-row">
            <div class="mgs-row__text">
              <h2 class="mgs-card__title">
                {{ 'TRANSLATIONS.GENERAL.DEFAULT_LANG' | translate }}
                <span class="mgs-chip">{{ label(defaultLanguage()) }}</span>
              </h2>
              <p class="mgs-card__desc">{{ 'TRANSLATIONS.GENERAL.DEFAULT_LANG_DESC' | translate }}</p>
            </div>
            <button type="button" class="mgs-btn mgs-btn--ghost" (click)="toggleEdit('lang')">
              {{ (editing() === 'lang' ? 'COMMON.CLOSE' : 'COMMON.EDIT') | translate }}
            </button>
          </div>

          @if (editing() === 'lang') {
            <div class="mgs-edit">
              @for (l of siteLanguages(); track l.code) {
                <label class="mgs-opt">
                  <input type="radio" name="deflang" [value]="l.code"
                         [checked]="draftLang() === l.code" (change)="draftLang.set(l.code)"/>
                  <span class="mgs-opt__label">{{ l.label }}</span>
                  @if (l.original) { <span class="mgs-tag">{{ 'TRANSLATIONS.GENERAL.ORIGINAL' | translate }}</span> }
                </label>
              }
              <div class="mgs-actions">
                <button type="button" class="mgs-btn mgs-btn--ghost" (click)="cancelEdit()">{{ 'COMMON.CANCEL' | translate }}</button>
                <button type="button" class="mgs-btn mgs-btn--primary"
                        [disabled]="saving() || draftLang() === defaultLanguage()" (click)="saveLang()">
                  {{ 'COMMON.SAVE' | translate }}
                </button>
              </div>
            </div>
          }
        </section>

        <!-- ── 3. URL structure ────────────────────────────────────── -->
        <section class="mgs-card">
          <div class="mgs-row">
            <div class="mgs-row__text">
              <h2 class="mgs-card__title">
                {{ 'TRANSLATIONS.GENERAL.URL_STRUCTURE' | translate }}
                <span class="mgs-chip">{{ urlExample(urlStructure()) }}</span>
              </h2>
              <p class="mgs-card__desc">{{ 'TRANSLATIONS.GENERAL.URL_STRUCTURE_DESC' | translate }}</p>
            </div>
            <button type="button" class="mgs-btn mgs-btn--ghost" (click)="toggleEdit('url')">
              {{ (editing() === 'url' ? 'COMMON.CLOSE' : 'COMMON.EDIT') | translate }}
            </button>
          </div>

          @if (editing() === 'url') {
            <div class="mgs-edit">
              @for (o of urlOptions; track o.value) {
                <label class="mgs-opt mgs-opt--stack">
                  <span class="mgs-opt__row">
                    <input type="radio" name="urlstruct" [value]="o.value"
                           [checked]="draftUrl() === o.value" (change)="draftUrl.set(o.value)"/>
                    <span class="mgs-opt__label">
                      {{ ('TRANSLATIONS.GENERAL.URL_' + o.value) | translate }}
                      @if (o.value === 'subdirectory') {
                        <span class="mgs-tag">{{ 'TRANSLATIONS.GENERAL.RECOMMENDED' | translate }}</span>
                      }
                    </span>
                  </span>
                  <span class="mgs-opt__ex">{{ 'TRANSLATIONS.GENERAL.EG' | translate }} {{ o.example }}</span>
                </label>
              }
              <div class="mgs-note">{{ 'TRANSLATIONS.GENERAL.URL_NOTE' | translate }}</div>
              <div class="mgs-actions">
                <button type="button" class="mgs-btn mgs-btn--ghost" (click)="cancelEdit()">{{ 'COMMON.CANCEL' | translate }}</button>
                <button type="button" class="mgs-btn mgs-btn--primary"
                        [disabled]="saving() || draftUrl() === urlStructure()" (click)="saveUrl()">
                  {{ 'COMMON.SAVE' | translate }}
                </button>
              </div>
            </div>
          }
        </section>

        <!-- ── 4. Text direction per language ──────────────────────── -->
        <section class="mgs-card">
          <div class="mgs-row__text mgs-dir-head">
            <h2 class="mgs-card__title">{{ 'TRANSLATIONS.GENERAL.DIRECTION' | translate }}</h2>
            <p class="mgs-card__desc">{{ 'TRANSLATIONS.GENERAL.DIRECTION_DESC' | translate }}</p>
          </div>
          <div class="mgs-dirs">
            @for (l of siteLanguages(); track l.code) {
              <div class="mgs-dir">
                <span class="mgs-dir__lang">
                  {{ l.label }}
                  <span class="mgs-code">{{ l.code }}</span>
                  @if (l.original) { <span class="mgs-tag">{{ 'TRANSLATIONS.GENERAL.ORIGINAL' | translate }}</span> }
                </span>
                <div class="mgs-seg">
                  <button type="button" [class.on]="!isRtl(l.code)" [disabled]="saving()" (click)="setDir(l.code, 'ltr')">{{ 'TRANSLATIONS.GENERAL.LTR' | translate }}</button>
                  <button type="button" [class.on]="isRtl(l.code)" [disabled]="saving()" (click)="setDir(l.code, 'rtl')">{{ 'TRANSLATIONS.GENERAL.RTL' | translate }}</button>
                </div>
              </div>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow-y: auto; }
    .mgs { max-width: 900px; margin: 0 auto; padding: 20px 24px 48px; display: flex; flex-direction: column; gap: 16px; }

    .mgs-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 4px; }
    .mgs-back {
      display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto;
      width: 34px; height: 34px; margin-top: 2px; border-radius: 8px; border: 1px solid #e2e8f0;
      background: #fff; color: #475569; text-decoration: none; transition: background .12s, color .12s;
    }
    .mgs-back:hover { background: #f8fafc; color: #0f172a; }
    .mgs-title { margin: 0 0 4px; font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.01em; }
    .mgs-sub { margin: 0; font-size: 14px; color: #64748b; }

    .mgs-loading { display: flex; align-items: center; justify-content: center; padding: 60px 0; }
    .mgs-spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid #e2e8f0; border-top-color: var(--color-brand-600, #0891b2); animation: mgs-spin .8s linear infinite; }
    @keyframes mgs-spin { to { transform: rotate(360deg); } }

    .mgs-card { border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; padding: 18px 20px; }
    .mgs-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .mgs-row__text { min-width: 0; }
    .mgs-card__title { margin: 0 0 4px; font-size: 16px; font-weight: 700; color: #0f172a; display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .mgs-card__desc { margin: 0; font-size: 13px; color: #64748b; }
    .mgs-chip { font-size: 12px; font-weight: 600; color: #475569; background: #f1f5f9; border-radius: 999px; padding: 2px 10px; }

    /* Toggle */
    .mgs-switch { flex: 0 0 auto; width: 44px; height: 26px; border-radius: 999px; border: none; background: #cbd5e1; cursor: pointer; position: relative; transition: background .15s ease; padding: 0; }
    .mgs-switch.on { background: var(--color-brand-600, #0891b2); }
    .mgs-switch:disabled { opacity: .6; cursor: not-allowed; }
    .mgs-switch__knob { position: absolute; top: 3px; inset-inline-start: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: inset-inline-start .15s ease; box-shadow: 0 1px 2px rgba(15,23,42,.2); }
    .mgs-switch.on .mgs-switch__knob { inset-inline-start: 21px; }

    /* Amber SEO warning */
    .mgs-warn { margin-top: 14px; padding: 12px 14px; border: 1px solid #fde68a; background: #fffbeb; border-radius: 10px; font-size: 13px; color: #92400e; }

    /* Edit section */
    .mgs-edit { margin-top: 14px; padding-top: 14px; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 6px; }
    .mgs-opt { display: flex; align-items: center; gap: 10px; padding: 10px 8px; border-radius: 8px; cursor: pointer; }
    .mgs-opt:hover { background: #f8fafc; }
    .mgs-opt--stack { flex-direction: column; align-items: stretch; gap: 2px; }
    .mgs-opt__row { display: flex; align-items: center; gap: 10px; }
    .mgs-opt input[type="radio"] { accent-color: var(--color-brand-600, #0891b2); width: 16px; height: 16px; }
    .mgs-opt__label { font-size: 14px; font-weight: 500; color: #0f172a; display: inline-flex; align-items: center; gap: 8px; }
    .mgs-opt__ex { font-size: 12px; color: #94a3b8; margin-inline-start: 26px; }
    .mgs-tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #64748b; background: #f1f5f9; border-radius: 4px; padding: 2px 6px; }
    .mgs-note { margin-top: 6px; padding: 10px 12px; border: 1px solid #dbeafe; background: #eff6ff; border-radius: 10px; font-size: 12.5px; color: #1e40af; }

    .mgs-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
    .mgs-btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid transparent; }
    .mgs-btn--ghost { background: #fff; border-color: #e2e8f0; color: #334155; }
    .mgs-btn--ghost:hover { background: #f8fafc; }
    .mgs-btn--primary { background: var(--color-brand-600, #0891b2); color: #fff; }
    .mgs-btn--primary:hover { background: var(--color-brand-700, #0e7490); }
    .mgs-btn:disabled { opacity: .5; cursor: not-allowed; }

    /* Text direction card */
    .mgs-dir-head { margin-bottom: 14px; }
    .mgs-dirs { display: flex; flex-direction: column; gap: 4px; }
    .mgs-dir { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 8px 4px; border-top: 1px solid #f1f5f9; }
    .mgs-dir:first-child { border-top: 0; }
    .mgs-dir__lang { font-size: 14px; font-weight: 500; color: #0f172a; display: inline-flex; align-items: center; gap: 8px; }
    .mgs-code { font-size: 11px; font-weight: 600; color: #94a3b8; background: #f1f5f9; border-radius: 4px; padding: 1px 6px; text-transform: uppercase; }
    .mgs-seg { display: inline-flex; background: #f1f5f9; border-radius: 8px; padding: 2px; }
    .mgs-seg button { border: none; background: transparent; color: #64748b; font-size: 12.5px; font-weight: 600; padding: 5px 12px; border-radius: 6px; cursor: pointer; transition: background .12s, color .12s; }
    .mgs-seg button.on { background: #fff; color: var(--color-brand-700, #0e7490); box-shadow: 0 1px 2px rgba(15,23,42,.1); }
    .mgs-seg button:disabled { cursor: not-allowed; }
  `],
})
export class MultilingualGeneralSettingsComponent implements OnInit {
  protected store = inject(TranslationsStore);
  private settingsSvc = inject(MultilingualSettingsService);
  private toast = inject(ToastService);

  loading = signal(true);
  saving = signal(false);

  autoSwitch = signal(false);
  defaultLanguage = signal(ORIGINAL_LANG);
  urlStructure = signal<UrlStructure>('subdirectory');
  /** Codes rendered right-to-left (drives per-language direction). */
  rtlLanguages = signal<string[]>([]);
  /** The site's supported languages (single source of truth). */
  supported = signal<string[]>([]);

  editing = signal<null | 'lang' | 'url'>(null);
  draftLang = signal(ORIGINAL_LANG);
  draftUrl = signal<UrlStructure>('subdirectory');

  /** The site's languages (original first, then the rest) — from the single
   *  `supported` source of truth. */
  siteLanguages = computed(() => {
    const rest = this.supported().filter(c => c !== ORIGINAL_LANG);
    return [ORIGINAL_LANG, ...rest].map(c => ({ code: c, label: this.label(c), original: c === ORIGINAL_LANG }));
  });

  // Subdomain (en.mysite.com) is infra-level (host parsing collides with the
  // tenant slug) — hidden until the server side supports it.
  readonly urlOptions: UrlOption[] = [
    { value: 'subdirectory', example: 'mysite.com/en' },
    { value: 'parameter',    example: 'mysite.com/?lang=en' },
  ];

  constructor() { withTranslations('settings/translations'); }

  async ngOnInit(): Promise<void> {
    try {
      const s = await this.settingsSvc.get();
      this.autoSwitch.set(s.autoSwitch);
      this.defaultLanguage.set(s.defaultLanguage);
      this.urlStructure.set(s.urlStructure);
      this.rtlLanguages.set([...s.rtlLanguages]);
      this.supported.set([...s.supported]);
    } finally {
      this.loading.set(false);
    }
  }

  isRtl(code: string): boolean {
    return this.rtlLanguages().includes(code);
  }

  async setDir(code: string, dir: 'ltr' | 'rtl'): Promise<void> {
    const set = new Set(this.rtlLanguages());
    if (dir === 'rtl') set.add(code); else set.delete(code);
    this.rtlLanguages.set([...set]);
    await this.persist();
  }

  urlExample(value: UrlStructure): string {
    return this.urlOptions.find(o => o.value === value)?.example ?? '';
  }

  /** Display label for a language code (the source language isn't in the
   *  catalogue, so special-case it). */
  label(code: string): string {
    return code === ORIGINAL_LANG ? 'English' : this.store.langLabel(code);
  }

  toggleEdit(which: 'lang' | 'url'): void {
    if (this.editing() === which) { this.editing.set(null); return; }
    if (which === 'lang') this.draftLang.set(this.defaultLanguage());
    else this.draftUrl.set(this.urlStructure());
    this.editing.set(which);
  }
  cancelEdit(): void { this.editing.set(null); }

  async toggleAutoSwitch(): Promise<void> {
    this.autoSwitch.set(!this.autoSwitch());
    await this.persist();
  }

  async saveLang(): Promise<void> {
    this.defaultLanguage.set(this.draftLang());
    this.editing.set(null);
    await this.persist();
  }

  async saveUrl(): Promise<void> {
    this.urlStructure.set(this.draftUrl());
    this.editing.set(null);
    await this.persist();
  }

  private async persist(): Promise<void> {
    this.saving.set(true);
    const payload: MultilingualSettings = {
      autoSwitch: this.autoSwitch(),
      defaultLanguage: this.defaultLanguage(),
      urlStructure: this.urlStructure(),
      rtlLanguages: this.rtlLanguages(),
      supported: this.supported(),
    };
    try {
      await this.settingsSvc.save(payload);
      this.toast.success('TRANSLATIONS.GENERAL.SAVED');
    } catch (e: any) {
      this.toast.error('TRANSLATIONS.GENERAL.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }
}
