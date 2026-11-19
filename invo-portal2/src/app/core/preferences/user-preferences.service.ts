import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { EmployeeOptionsService, EmployeePreferences } from '../layout/services/employee-options.service';
import { LanguageService } from '../i18n/language.service';
import { installDatePipePreferences } from './date-pipe-preferences';

/** Date patterns offered in My Account (Angular `DatePipe` syntax). */
export const DATE_FORMATS = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'dd MMM yyyy', 'MMM d, yyyy'] as const;

/**
 * The employee's display preferences, loaded once after sign-in from the employee's options (`employee/getEmployeeOptions`)
 * and saved back with `employee/setEmployeeOptions` through {@link EmployeeOptionsService}.
 *
 * What follows them app-wide: the timezone of every `date` pipe (through `DATE_PIPE_DEFAULT_OPTIONS`, see app.config) and its
 * date format and clock (date-pipe-preferences.ts rewrites the well-known patterns, so existing templates need no change), the UI language, and the first day of the week of the shared date picker.
 * `timePattern` is there for screens that show a bare time.
 */
@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private options = inject(EmployeeOptionsService);
  private lang = inject(LanguageService);

  readonly prefs = signal<EmployeePreferences>({});
  private loaded = false;

  readonly timezone = computed(() => this.prefs().timezone || undefined);
  readonly dateFormat = computed(() => this.prefs().dateFormat || undefined);
  readonly firstDayOfWeek = computed(() => this.prefs().firstDayOfWeek ?? 0);
  /** Unsaved choice from My Account, shown immediately so the user can see it before saving. */
  private readonly themePreview = signal<EmployeePreferences['theme'] | null>(null);
  readonly theme = computed(() => this.themePreview() ?? this.prefs().theme ?? 'light');
  /** Unsaved choice from My Account, shown immediately; cleared on save / cancel. */
  private readonly densityPreview = signal<EmployeePreferences['density'] | null>(null);
  readonly density = computed(() => this.densityPreview() ?? this.prefs().density ?? 'comfortable');
  readonly timePattern = computed(() => (this.prefs().timeFormat === '12h' ? 'hh:mm a' : 'HH:mm'));

  constructor() {
    // Every `date` pipe follows the chosen date format and clock, whatever pattern its template names.
    installDatePipePreferences(() => ({ date: this.dateFormat(), time: this.prefs().timeFormat }));
    // Dark mode: a class on <html> (see styles/_dark.scss). 'system' follows the OS live.
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    const systemDark = signal(!!mq?.matches);
    mq?.addEventListener?.('change', e => systemDark.set(e.matches));
    effect(() => {
      const t = this.theme();
      const dark = t === 'dark' || (t === 'system' && systemDark());
      document.documentElement.classList.toggle('app-dark', dark);
      try { localStorage.setItem('invo.theme', t); } catch { /* storage unavailable */ }
    });
    // Table density: components size themselves from CSS tokens switched by this root attribute.
    effect(() => {
      const d = this.density();
      document.documentElement.setAttribute('data-density', d);
      try { localStorage.setItem('invo.density', d); } catch { /* storage unavailable */ }
    });
    // Switching language from the top bar also becomes the employee's choice, so the next sign-in does not undo it.
    effect(() => {
      const code = this.lang.current();
      untracked(() => {
        if (this.loaded && this.prefs().language && this.prefs().language !== code) void this.save({ ...this.prefs(), language: code });
      });
    });
  }

  /** Shows `theme` right away without saving; pass null to go back to the saved one. */
  previewTheme(theme: EmployeePreferences['theme'] | null): void { this.themePreview.set(theme); }

  /** Shows `density` right away without saving; pass null to go back to the saved one. */
  previewDensity(density: EmployeePreferences['density'] | null): void { this.densityPreview.set(density); }

  /** Reads the saved preferences and applies the language. Safe to call repeatedly. */
  async load(): Promise<void> {
    if (this.loaded) return;
    const opts = await this.options.get();
    this.prefs.set({ ...(opts?.preferences ?? {}) });
    this.loaded = true;
    const language = this.prefs().language;
    if (language && language !== this.lang.current()) await this.lang.use(language);
  }

  /** Saves `next` as the employee's preferences (the other options are left as they are) and applies them. */
  async save(next: EmployeePreferences): Promise<void> {
    const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined && v !== '' && v !== null)) as EmployeePreferences;
    const current = (await this.options.get()) ?? {};
    await this.options.setStrict({ ...current, preferences: clean });
    this.prefs.set(clean);
    this.themePreview.set(null);
    this.densityPreview.set(null);
    if (clean.language && clean.language !== this.lang.current()) await this.lang.use(clean.language);
  }
}
