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
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { LanguageService } from '@core/i18n/language.service';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';

import { BLOG_API } from '../../services/blog-api';
import {
  BlogSettingsRow,
  BlogSettingsTemplate,
  FEED_LAYOUTS,
  FeedLayout,
  defaultBlogSettings,
} from '../../services/blog-settings.types';

/**
 * Settings → Blog
 *
 * Edits the BlogSettings JSONB on the `WebSiteBuilder` row keyed by
 * `type = 'BlogSettings'`. Section layout mirrors the spec from migration
 * 006: Languages / Layout / Display / Comments / RSS / SEO / Mobile.
 *
 * The form holds primitives only; chips (supported langs, RTL langs) live
 * in separate signals so the picker UIs can mutate them without nesting
 * FormArrays for a half-dozen booleans.
 */
@Component({
  selector: 'app-blog-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SearchDropdownComponent,
    FormStickyFooterComponent,
    ToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './blog-settings.component.html',
  styleUrl: './blog-settings.component.scss',
})
export class BlogSettingsComponent implements OnInit, CanLeaveComponent {
  private fb         = inject(FormBuilder);
  private api        = inject(BLOG_API);
  private translate  = inject(TranslateService);
  private lang       = inject(LanguageService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);
  private toast      = inject(ToastService);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** The row we loaded, kept so save can preserve id/companyId. */
  private row = signal<BlogSettingsRow | null>(null);

  /** Chips that live outside the form. Driving signals so checkbox-style
   *  toggles can flip them and the save handler can read them back. */
  supportedLangs = signal<string[]>(['en']);
  rtlLangs       = signal<string[]>([]);
  /** Site-wide multilingual fields (auto-switch / URL structure) captured from
   *  the loaded template and re-emitted on save, so editing Blog Settings never
   *  wipes them — they're managed in the Multilingual manager. */
  private langExtra: { autoSwitch?: boolean; urlStructure?: 'subdirectory' | 'subdomain' | 'parameter' } = {};

  /** Re-translates labels when ngx-translate finishes loading bundles. */
  private i18nTick = signal(0);

  // ─── Form ─────────────────────────────────────────────────────────────────
  form: FormGroup = this.fb.group({
    // Languages
    defaultLanguage:    ['en', [Validators.required]],
    // Layout
    feedLayout:         ['grid' as FeedLayout, [Validators.required]],
    categoryFeedLayout: ['list' as FeedLayout, [Validators.required]],
    postsPerPage:       [12, [Validators.required, Validators.min(1), Validators.max(100)]],
    // Display
    showAuthor:         [true],
    showDate:           [true],
    showReadingTime:    [true],
    showCategoryLabel:  [true],
    showTags:           [true],
    showHashtags:       [true],
    showSocialShare:    [true],
    showRelatedPosts:   [true],
    showCommentCount:   [true],
    // Comments
    commentsEnabled:        [true],
    requireApproval:        [false],
    allowReplies:           [true],
    maxDepth:               [3, [Validators.min(1), Validators.max(5)]],
    allowEmployeeReplies:   [true],
    requireShopperLogin:    [true],
    // RSS
    rssEnabled:             [true],
    rssItemsCount:          [20],
    // SEO
    seoTitleTemplate:       ['{postTitle} | {siteName}'],
    seoDefaultOgImage:      [''],
    // Mobile
    mobileOverrideDesktop:  [false],
    mobileFeedLayout:       ['list' as FeedLayout],
    mobileShowCategoryMenu: [true],
  });

  // ─── Derived ──────────────────────────────────────────────────────────────
  availableLanguages = computed(() => {
    this.i18nTick();
    return this.lang.available;
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('BLOG.SETTINGS.TITLE') },
    ];
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  /** Language items for the default-language dropdown — only the ones the
   *  admin has marked as supported can be the default. */
  defaultLangOptions = computed<{ id: string; label: string }[]>(() => {
    this.i18nTick();
    return this.availableLanguages()
      .filter(l => this.supportedLangs().includes(l.code))
      .map(l => ({ id: l.code, label: l.nativeLabel }));
  });

  /** RSS items count dropdown — fixed steps per spec (10 / 20 / 50). */
  rssCountOptions = computed<{ id: number; label: string }[]>(() => {
    this.i18nTick();
    return [
      { id: 10, label: '10' },
      { id: 20, label: '20' },
      { id: 50, label: '50' },
    ];
  });

  layouts: readonly FeedLayout[] = FEED_LAYOUTS;

  constructor() {
    withTranslations('blog');

    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const row = await this.api.getSettings();
      this.row.set(row);
      this.patchFromTemplate(row.template);
    } catch (e: any) {
      console.error('[blog-settings] load failed', e);
      this.toast.error('COMMON.LOAD_FAILED', e?.message);
    } finally {
      this.loading.set(false);
    }
  }

  private patchFromTemplate(t: BlogSettingsTemplate): void {
    this.supportedLangs.set([...t.languages.supported]);
    this.rtlLangs.set([...t.languages.rtlLanguages]);
    // Preserve the site-wide multilingual fields (managed in the Multilingual
    // manager) so saving Blog Settings never wipes them — one source of truth.
    this.langExtra = {
      autoSwitch:   t.languages.autoSwitch,
      urlStructure: t.languages.urlStructure,
    };
    this.form.patchValue({
      defaultLanguage:        t.languages.default,
      feedLayout:             t.layouts.feed,
      categoryFeedLayout:     t.layouts.categoryFeed,
      postsPerPage:           t.display.postsPerPage,
      showAuthor:             t.display.showAuthor,
      showDate:               t.display.showDate,
      showReadingTime:        t.display.showReadingTime,
      showCategoryLabel:      t.display.showCategoryLabel,
      showTags:               t.display.showTags,
      showHashtags:           t.display.showHashtags,
      showSocialShare:        t.display.showSocialShare,
      showRelatedPosts:       t.display.showRelatedPosts,
      showCommentCount:       t.display.showCommentCount,
      commentsEnabled:        t.comments.enabled,
      requireApproval:        t.comments.requireApproval,
      allowReplies:           t.comments.allowReplies,
      maxDepth:               t.comments.maxDepth,
      allowEmployeeReplies:   t.comments.allowEmployeeReplies,
      requireShopperLogin:    t.comments.requireShopperLogin,
      rssEnabled:             t.rss.enabled,
      rssItemsCount:          t.rss.itemsCount,
      seoTitleTemplate:       t.seo.titleTemplate,
      seoDefaultOgImage:      t.seo.defaultOgImage,
      mobileOverrideDesktop:  t.mobile.overrideDesktop,
      mobileFeedLayout:       t.mobile.feedLayout,
      mobileShowCategoryMenu: t.mobile.showCategoryMenu,
    });
    this.form.markAsPristine();
  }

  // ─── Languages section helpers ────────────────────────────────────────────

  isSupported(code: string): boolean {
    return this.supportedLangs().includes(code);
  }

  toggleSupported(code: string): void {
    const next = new Set(this.supportedLangs());
    if (next.has(code)) {
      // Don't allow removing the default language — that would orphan it.
      if (code === this.form.controls['defaultLanguage'].value) return;
      // Always keep at least one supported language.
      if (next.size <= 1) return;
      next.delete(code);
      // If we just turned off an RTL language, drop it from rtlLangs too so
      // the saved row doesn't carry a phantom entry.
      if (this.rtlLangs().includes(code)) {
        this.rtlLangs.set(this.rtlLangs().filter(c => c !== code));
      }
    } else {
      next.add(code);
    }
    this.supportedLangs.set([...next]);
    this.form.markAsDirty();
  }

  isRtl(code: string): boolean {
    return this.rtlLangs().includes(code);
  }

  toggleRtl(code: string): void {
    if (!this.isSupported(code)) return;
    const next = new Set(this.rtlLangs());
    if (next.has(code)) next.delete(code); else next.add(code);
    this.rtlLangs.set([...next]);
    this.form.markAsDirty();
  }

  // ─── Adapters for app-search-dropdown ─────────────────────────────────────
  langDisplay = (v: any) => {
    if (v && typeof v === 'object') return v.label ?? '';
    return this.defaultLangOptions().find(o => o.id === v)?.label ?? '';
  };
  langCompare = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);
  langToValue = (item: { id: string; label: string }) => item.id;

  setDefaultLanguage(value: any): void {
    const id = (value && typeof value === 'object' ? value.id : value) ?? 'en';
    this.form.patchValue({ defaultLanguage: id });
    this.form.markAsDirty();
    // The new default must be in the supported list — silently add it.
    if (!this.isSupported(id)) {
      this.supportedLangs.set([...this.supportedLangs(), id]);
    }
  }

  rssCountDisplay = (v: any) => {
    if (v && typeof v === 'object') return v.label ?? '';
    return String(v ?? '');
  };
  rssCountCompare = (a: any, b: any) => Number(a?.id ?? a) === Number(b?.id ?? b);
  rssCountToValue = (item: { id: number; label: string }) => item.id;

  setRssCount(value: any): void {
    const id = (value && typeof value === 'object' ? Number(value.id) : Number(value)) || 20;
    this.form.patchValue({ rssItemsCount: id });
    this.form.markAsDirty();
  }

  // ─── Layout pickers ───────────────────────────────────────────────────────

  pickFeedLayout(layout: FeedLayout, control: 'feedLayout' | 'categoryFeedLayout' | 'mobileFeedLayout'): void {
    if (this.form.controls[control].value === layout) return;
    this.form.patchValue({ [control]: layout });
    this.form.markAsDirty();
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const row = this.row();
    if (!row) return;

    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      // Rebuild the template from form + chip state. Use a fresh default as
      // the floor so any newly added fields in the schema get sane values
      // even when the loaded row didn't have them.
      const base = defaultBlogSettings();
      const template: BlogSettingsTemplate = {
        languages: {
          default:      v.defaultLanguage,
          supported:    [...this.supportedLangs()],
          rtlLanguages: this.rtlLangs().filter(c => this.supportedLangs().includes(c)),
          // Carry through the site-wide multilingual fields untouched.
          ...this.langExtra,
        },
        layouts: {
          feed:             v.feedLayout,
          categoryFeed:     v.categoryFeedLayout,
          availableLayouts: base.layouts.availableLayouts,
        },
        display: {
          postsPerPage:      Number(v.postsPerPage) || base.display.postsPerPage,
          showAuthor:        !!v.showAuthor,
          showDate:          !!v.showDate,
          showReadingTime:   !!v.showReadingTime,
          showCategoryLabel: !!v.showCategoryLabel,
          showTags:          !!v.showTags,
          showHashtags:      !!v.showHashtags,
          showSocialShare:   !!v.showSocialShare,
          showRelatedPosts:  !!v.showRelatedPosts,
          showCommentCount:  !!v.showCommentCount,
        },
        comments: {
          enabled:              !!v.commentsEnabled,
          requireApproval:      !!v.requireApproval,
          allowReplies:         !!v.allowReplies,
          maxDepth:             Math.min(5, Math.max(1, Number(v.maxDepth) || 3)),
          allowEmployeeReplies: !!v.allowEmployeeReplies,
          requireShopperLogin:  !!v.requireShopperLogin,
        },
        rss: {
          enabled:    !!v.rssEnabled,
          itemsCount: Number(v.rssItemsCount) || 20,
        },
        seo: {
          titleTemplate:  v.seoTitleTemplate ?? '',
          defaultOgImage: v.seoDefaultOgImage ?? '',
        },
        mobile: {
          overrideDesktop:  !!v.mobileOverrideDesktop,
          feedLayout:       v.mobileFeedLayout,
          showCategoryMenu: !!v.mobileShowCategoryMenu,
        },
      };

      const saved = await this.api.saveSettings(template, row);
      if (saved) {
        this.row.set(saved);
      }
      this.form.markAsPristine();
      this.toast.success('COMMON.SAVED_OK');
      this.router.navigate(['/settings']);
    } catch (e: any) {
      console.error('[blog-settings] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }
}
