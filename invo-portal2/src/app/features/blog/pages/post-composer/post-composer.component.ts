import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import { LanguageService } from '@core/i18n/language.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { RichEditorComponent } from '@shared/components/rich-editor/rich-editor.component';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';

import { BLOG_API } from '../../services/blog-api';
import {
  BlogPost,
  BlogTaxonomy,
  BlogWriter,
  PostLocale,
  PostStatus,
} from '../../services/blog.types';
import { SlugInputComponent } from '../../components/slug-input.component';
import { TaxonomySelectorComponent } from '../../components/taxonomy-selector.component';
import {
  estimateReadingTime,
  generateSlug,
  isRtl,
} from '../../utils/blog-utils';
import { defaultBlogSettings } from '../../services/blog-settings.types';

/** Vertical rail items — Wix layout. `null` means "no panel open". */
type RailKey = 'add' | 'ai' | 'settings' | 'seo' | 'monetize' | 'translate' | 'apps';
type SettingsTab = 'general' | 'categories' | 'tags';
type AddToolKey =
  | 'image' | 'aiImage' | 'gallery' | 'video' | 'gif' | 'file'
  | 'divider' | 'button' | 'table' | 'expandable' | 'poll' | 'layout'
  | 'html' | 'adsense' | 'soundcloud';

const AUTOSAVE_INTERVAL_MS = 30_000;
const EXCERPT_RECOMMENDED  = 500;
const MAX_CATEGORIES       = 10;

/** Inline SVG snippets used by the rail and Add panel. Kept in code
 *  (not template) so each item's row is a single object literal. */
const ICON = {
  plus:     '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  ai:       '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M5 19l1-2 2-1-2-1-1-2-1 2-2 1 2 1z"/></svg>',
  cog:      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  search:   '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  money:    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></svg>',
  globe:    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/></svg>',
  apps:     '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  // Add-panel tile icons
  image:    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  aiImage:  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/><path d="m18 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="currentColor"/></svg>',
  gallery:  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>',
  video:    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><polygon points="23 7 16 12 23 17 23 7"/></svg>',
  gif:      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><text x="6" y="16" font-size="7" font-weight="700" fill="currentColor" stroke="none">GIF</text></svg>',
  file:     '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>',
  divider:  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>',
  button:   '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="6" rx="3"/></svg>',
  table:    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="4" x2="9" y2="20"/></svg>',
  expandable: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><polyline points="3 6 5 8 7 6"/></svg>',
  poll:     '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="14"/></svg>',
  layout:   '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="18"/><rect x="11" y="3" width="6" height="18"/><rect x="19" y="3" width="2" height="18"/></svg>',
  html:     '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  adsense:  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 22 2 22 12 2"/></svg>',
  sound:    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17h2v-7H2zM6 17h2V8H6zM10 17h2V5h-2zM14 17h2v-4h-2zM18 17h2V9h-2z"/></svg>',
} as const;

@Component({
  selector: 'app-blog-post-composer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    SearchDropdownComponent,
    ToggleComponent,
    SlugInputComponent,
    TaxonomySelectorComponent,
    RichEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './post-composer.component.html',
  styleUrl: './post-composer.component.scss',
})
export class PostComposerComponent implements OnInit, OnDestroy, CanLeaveComponent {
  private api        = inject(BLOG_API);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private toast      = inject(ToastService);
  private langSvc    = inject(LanguageService);

  @ViewChild('editor') editor!: RichEditorComponent;

  // ─── Post model ────────────────────────────────────────────────────
  postId       = signal<string | null>(null);
  loading      = signal<boolean>(false);
  saving       = signal<boolean>(false);
  lastSavedAt  = signal<string | null>(null);
  isDirty      = signal<boolean>(false);

  defaultLanguage  = signal<string>('en');
  translations     = signal<Record<string, PostLocale>>({ en: blankLocale() });
  status           = signal<PostStatus>('draft');
  scheduledDate    = signal<string>('');
  authorEmployeeId = signal<string>('');
  coverImage       = signal<string>('');
  ogImage          = signal<string>('');
  taxonomyIds      = signal<string[]>([]);
  mainTaxonomyId   = signal<string | null>(null);
  isFeatured       = signal<boolean>(false);
  featuredImageOn  = signal<boolean>(true);

  // ─── UI state ──────────────────────────────────────────────────────
  active       = signal<string>('en');
  rail         = signal<RailKey | null>(null);
  settingsTab  = signal<SettingsTab>('general');
  moreOpen     = signal<boolean>(false);

  // Lookups.
  writers        = signal<BlogWriter[]>([]);
  supportedLangs = signal<string[]>(['en']);
  rtlLangs       = signal<string[]>([]);
  taxonomies     = signal<BlogTaxonomy[]>([]);

  private i18nTick    = signal(0);
  private autosaveTimer: any = null;

  // ─── Derived ───────────────────────────────────────────────────────
  isNew       = computed(() => this.postId() === null);
  isRtlActive = computed(() => isRtl(this.active(), this.rtlLangs()));
  current     = computed(() => this.translations()[this.active()] ?? blankLocale());
  activeLangs  = computed(() => Object.keys(this.translations()));
  addableLangs = computed(() => {
    const have = new Set(this.activeLangs());
    return this.supportedLangs().filter(c => !have.has(c));
  });

  excerptCount = computed(() => (this.current().excerpt ?? '').length);
  excerptOver  = computed(() => this.excerptCount() > EXCERPT_RECOMMENDED);

  writerOptions = computed(() => this.writers().map(w => ({ id: w.id, label: w.name })));
  idDisplay = (v: any) => v?.label ?? v ?? '';
  idCompare = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);
  idToValue = (i: { id: string; label: string }) => i.id;

  /** Active rail item's label, used in the panel header. */
  panelTitle = computed(() => {
    const r = this.rail();
    if (!r) return '';
    return this.railItems.find(i => i.key === r)?.label ?? '';
  });

  /** Number of selected category taxonomies (vs tags). */
  categoryCount = computed(() => {
    const cats = new Set(this.taxonomies().filter(t => t.taxonomyType === 'category').map(t => t.id));
    return this.taxonomyIds().filter(id => cats.has(id)).length;
  });
  tagCount = computed(() => {
    const tags = new Set(this.taxonomies().filter(t => t.taxonomyType === 'tag').map(t => t.id));
    return this.taxonomyIds().filter(id => tags.has(id)).length;
  });

  primaryActionLabel = computed(() => {
    this.i18nTick();
    const s = this.status();
    if (s === 'scheduled') return this.translate.instant('BLOG.COMPOSER.SCHEDULE');
    if (s === 'published') return this.translate.instant(this.isNew() ? 'BLOG.COMPOSER.PUBLISH' : 'BLOG.COMPOSER.UPDATE');
    return this.translate.instant('BLOG.COMPOSER.PUBLISH');
  });

  // Undo/redo are delegated to the contenteditable host (browser undo
  // stack), so for now these are stubbed always-enabled and call
  // execCommand. Wiring a proper history stack belongs in a follow-up.
  canUndo = computed(() => !this.loading());
  canRedo = computed(() => !this.loading());

  /** Rail config — order matches the Wix sidebar in the screenshots. */
  readonly railItems: { key: RailKey; label: string; icon: string }[] = [
    { key: 'add',       label: 'BLOG.COMPOSER.SIDE_ADD',       icon: ICON.plus   },
    { key: 'ai',        label: 'BLOG.COMPOSER.SIDE_AI',        icon: ICON.ai     },
    { key: 'settings',  label: 'BLOG.COMPOSER.SIDE_SETTINGS',  icon: ICON.cog    },
    { key: 'seo',       label: 'BLOG.COMPOSER.SIDE_SEO',       icon: ICON.search },
    { key: 'monetize',  label: 'BLOG.COMPOSER.SIDE_MONETIZE',  icon: ICON.money  },
    { key: 'translate', label: 'BLOG.COMPOSER.SIDE_TRANSLATE', icon: ICON.globe  },
    { key: 'apps',      label: 'BLOG.COMPOSER.SIDE_APPS',      icon: ICON.apps   },
  ];

  readonly settingsTabs: { key: SettingsTab; label: string }[] = [
    { key: 'general',    label: 'BLOG.COMPOSER.TAB_GENERAL'    },
    { key: 'categories', label: 'BLOG.COMPOSER.TAB_CATEGORIES' },
    { key: 'tags',       label: 'BLOG.COMPOSER.TAB_TAGS'       },
  ];

  readonly addGroups: { label: string; tools: { key: AddToolKey; label: string; icon: string }[] }[] = [
    { label: 'BLOG.COMPOSER.ADD_MEDIA', tools: [
      { key: 'image',   label: 'BLOG.COMPOSER.ADD_IMAGE',   icon: ICON.image    },
      { key: 'aiImage', label: 'BLOG.COMPOSER.ADD_AIIMAGE', icon: ICON.aiImage  },
      { key: 'gallery', label: 'BLOG.COMPOSER.ADD_GALLERY', icon: ICON.gallery  },
      { key: 'video',   label: 'BLOG.COMPOSER.ADD_VIDEO',   icon: ICON.video    },
      { key: 'gif',     label: 'BLOG.COMPOSER.ADD_GIF',     icon: ICON.gif      },
      { key: 'file',    label: 'BLOG.COMPOSER.ADD_FILE',    icon: ICON.file     },
    ]},
    { label: 'BLOG.COMPOSER.ADD_ELEMENTS', tools: [
      { key: 'divider',    label: 'BLOG.COMPOSER.ADD_DIVIDER',    icon: ICON.divider    },
      { key: 'button',     label: 'BLOG.COMPOSER.ADD_BUTTON',     icon: ICON.button     },
      { key: 'table',      label: 'BLOG.COMPOSER.ADD_TABLE',      icon: ICON.table      },
      { key: 'expandable', label: 'BLOG.COMPOSER.ADD_EXPANDABLE', icon: ICON.expandable },
      { key: 'poll',       label: 'BLOG.COMPOSER.ADD_POLL',       icon: ICON.poll       },
      { key: 'layout',     label: 'BLOG.COMPOSER.ADD_LAYOUT',     icon: ICON.layout     },
    ]},
    { label: 'BLOG.COMPOSER.ADD_FROM_WEB', tools: [
      { key: 'html',       label: 'BLOG.COMPOSER.ADD_HTML',       icon: ICON.html    },
      { key: 'adsense',    label: 'BLOG.COMPOSER.ADD_ADSENSE',    icon: ICON.adsense },
      { key: 'soundcloud', label: 'BLOG.COMPOSER.ADD_SOUNDCLOUD', icon: ICON.sound   },
    ]},
  ];

  constructor() {
    withTranslations('blog');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    // Load lookups in parallel.
    void this.api.listWriters().then(rows => {
      this.writers.set(rows);
      if (!this.authorEmployeeId() && rows[0]) this.authorEmployeeId.set(rows[0].id);
    });
    void this.api.getSettings().then(s => {
      this.supportedLangs.set(s.template.languages.supported);
      this.rtlLangs.set(s.template.languages.rtlLanguages);
    }).catch(() => {
      const d = defaultBlogSettings();
      this.supportedLangs.set(d.languages.supported);
      this.rtlLangs.set(d.languages.rtlLanguages);
    });

    // For the settings panel taxonomy badges.
    void Promise.all([
      this.api.listTaxonomies({ taxonomyType: 'category' }),
      this.api.listTaxonomies({ taxonomyType: 'tag' }),
    ]).then(([cats, tags]) => this.taxonomies.set([...cats, ...tags])).catch(() => { /* non-fatal */ });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.postId.set(id);
      await this.load(id);
    }

    this.autosaveTimer = setInterval(() => this.maybeAutosave(), AUTOSAVE_INTERVAL_MS);
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  ngOnDestroy(): void {
    if (this.autosaveTimer) clearInterval(this.autosaveTimer);
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
  }

  private beforeUnloadHandler = (e: BeforeUnloadEvent): void => {
    if (this.isDirty()) { e.preventDefault(); e.returnValue = ''; }
  };

  hasUnsavedChanges(): boolean { return this.isDirty() && !this.saving(); }

  // ─── Rail / panel ──────────────────────────────────────────────────
  toggleRail(key: RailKey): void {
    this.rail.set(this.rail() === key ? null : key);
  }

  labelForLang(code: string): string {
    return this.langSvc.available.find(a => a.code === code)?.nativeLabel ?? code.toUpperCase();
  }
  activeLangLabel(): string { return this.labelForLang(this.active()); }

  // ─── Loading ───────────────────────────────────────────────────────
  private async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const post = await this.api.getPost(id);
      if (!post) { this.toast.error('COMMON.LOAD_FAILED'); return; }
      this.applyPost(post);
    } catch (e: any) {
      this.toast.error('COMMON.LOAD_FAILED', e?.message);
    } finally {
      this.loading.set(false);
    }
  }

  private applyPost(post: BlogPost): void {
    this.defaultLanguage.set(post.defaultLanguage);
    this.translations.set({ ...post.translations });
    this.status.set(post.status);
    this.scheduledDate.set(post.scheduledDate ? toLocalInput(post.scheduledDate) : '');
    this.authorEmployeeId.set(post.authorEmployeeId);
    this.coverImage.set(post.coverImage ?? '');
    this.featuredImageOn.set(!!post.coverImage);
    this.ogImage.set(post.ogImage ?? '');
    this.taxonomyIds.set([...post.taxonomyIds]);
    this.mainTaxonomyId.set(post.mainTaxonomyId);
    this.isFeatured.set(post.isFeatured);
    this.active.set(post.defaultLanguage);
    this.isDirty.set(false);
    this.lastSavedAt.set(post.updatedAt);
  }

  // ─── Edit handlers ─────────────────────────────────────────────────
  private setLocaleField(field: keyof PostLocale, value: string): void {
    const next = { ...this.translations() };
    next[this.active()] = { ...next[this.active()], [field]: value };
    this.translations.set(next);
    this.markDirty();
  }

  setTitle(v: string): void   { this.setLocaleField('title', v); }
  setSlug(v: string): void    { this.setLocaleField('slug', v); }
  setExcerpt(v: string): void { this.setLocaleField('excerpt', v); }
  setContent(v: string): void { this.setLocaleField('content', v); }
  setSeoTitle(v: string): void { this.setLocaleField('seoTitle', v); }
  setSeoDescription(v: string): void { this.setLocaleField('seoDescription', v); }

  setStatus(v: PostStatus): void { this.status.set(v); this.markDirty(); }
  setAuthor(v: any): void {
    const id = (v && typeof v === 'object' ? v.id : v) ?? '';
    this.authorEmployeeId.set(id);
    this.markDirty();
  }
  setScheduled(v: string): void { this.scheduledDate.set(v); this.markDirty(); }
  setFeatured(v: boolean): void { this.isFeatured.set(v); this.markDirty(); }
  setCover(url: string): void { this.coverImage.set(url); this.markDirty(); }
  setOg(url: string): void { this.ogImage.set(url); this.markDirty(); }

  setFeaturedImageOn(v: boolean): void {
    this.featuredImageOn.set(v);
    if (!v && this.coverImage()) {
      this.coverImage.set('');
      this.markDirty();
    }
  }

  addLang(code: string): void {
    const next = { ...this.translations() };
    next[code] = blankLocale();
    this.translations.set(next);
    this.active.set(code);
    this.markDirty();
  }
  removeLang(code: string): void {
    if (code === this.defaultLanguage()) return;
    const next = { ...this.translations() };
    delete next[code];
    this.translations.set(next);
    if (this.active() === code) this.active.set(this.defaultLanguage());
    this.markDirty();
  }
  setDefaultLang(code: string): void {
    if (!this.translations()[code]) this.addLang(code);
    this.defaultLanguage.set(code);
    this.markDirty();
  }

  // ─── Taxonomies ────────────────────────────────────────────────────
  addTaxonomy(t: BlogTaxonomy): void {
    if (this.taxonomyIds().includes(t.id)) return;
    if (t.taxonomyType === 'category' && this.categoryCount() >= MAX_CATEGORIES) return;
    this.taxonomyIds.set([...this.taxonomyIds(), t.id]);
    if (t.taxonomyType === 'category' && !this.mainTaxonomyId()) {
      this.mainTaxonomyId.set(t.id);
    }
    // Cache for badge counters.
    if (!this.taxonomies().some(x => x.id === t.id)) {
      this.taxonomies.set([...this.taxonomies(), t]);
    }
    this.markDirty();
  }
  removeTaxonomy(id: string): void {
    this.taxonomyIds.set(this.taxonomyIds().filter(x => x !== id));
    if (this.mainTaxonomyId() === id) this.mainTaxonomyId.set(null);
    this.markDirty();
  }
  setMainTaxonomy(id: string): void { this.mainTaxonomyId.set(id); this.markDirty(); }
  async createTagInline(name: string): Promise<void> {
    const slug = generateSlug(name);
    const created = await this.api.saveTaxonomy({
      taxonomyType: 'tag',
      defaultLanguage: 'en',
      slug,
      order: 0,
      image: null,
      translations: { en: { name, slug } },
    });
    this.addTaxonomy(created);
  }

  // ─── Cover / OG upload ─────────────────────────────────────────────
  async onCoverFile(files: FileList | null): Promise<void> {
    const f = files?.[0]; if (!f) return;
    const { url } = await this.api.upload(f);
    this.setCover(url);
  }
  async onOgFile(files: FileList | null): Promise<void> {
    const f = files?.[0]; if (!f) return;
    const { url } = await this.api.upload(f);
    this.setOg(url);
  }
  removeCover(): void { this.setCover(''); }
  removeOg(): void { this.setOg(''); }

  // ─── Add panel — insert blocks into the editor ─────────────────────
  async onAddTool(key: AddToolKey): Promise<void> {
    switch (key) {
      case 'image':
      case 'aiImage':       // AI image not wired yet — fall back to upload.
      case 'gif':
        await this.insertImageFromPicker();
        break;
      case 'gallery':
        await this.insertGallery();
        break;
      case 'video':
        this.insertVideoEmbed();
        break;
      case 'file':
        await this.insertFile();
        break;
      case 'divider':
        this.editor?.insertHtml('<hr/>');
        break;
      case 'button':
        this.insertButton();
        break;
      case 'table':
        this.editor?.insertHtml(`
          <table>
            <thead><tr><th>Col 1</th><th>Col 2</th></tr></thead>
            <tbody><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></tbody>
          </table>`);
        break;
      case 'expandable':
        this.editor?.insertHtml(`<details><summary>${this.translate.instant('BLOG.COMPOSER.EXPANDABLE_TITLE')}</summary><p>${this.translate.instant('BLOG.COMPOSER.EXPANDABLE_BODY')}</p></details>`);
        break;
      case 'poll':
      case 'adsense':
      case 'soundcloud':
      case 'layout':
        this.toast.info('BLOG.COMPOSER.COMING_SOON');
        break;
      case 'html':
        this.insertRawHtml();
        break;
    }
  }

  private async insertImageFromPicker(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const { url } = await this.api.upload(f);
        this.editor?.insertHtml(`<p><img src="${escapeAttr(url)}" alt=""/></p>`);
      } catch (e: any) {
        this.toast.error('COMMON.UPLOAD_FAILED', e?.message);
      }
    };
    input.click();
  }

  private async insertGallery(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return;
      try {
        const uploads = await Promise.all(files.map(f => this.api.upload(f)));
        const grid = uploads.map(u => `<img src="${escapeAttr(u.url)}" alt=""/>`).join('');
        this.editor?.insertHtml(`<div class="re-gallery" style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin:8px 0;">${grid}</div>`);
      } catch (e: any) {
        this.toast.error('COMMON.UPLOAD_FAILED', e?.message);
      }
    };
    input.click();
  }

  private async insertFile(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const { url } = await this.api.upload(f);
        this.editor?.insertHtml(`<p><a href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeText(f.name)}</a></p>`);
      } catch (e: any) {
        this.toast.error('COMMON.UPLOAD_FAILED', e?.message);
      }
    };
    input.click();
  }

  private insertVideoEmbed(): void {
    const url = window.prompt(this.translate.instant('BLOG.COMPOSER.VIDEO_PROMPT'), 'https://');
    if (!url) return;
    // Reuse the editor's paste pipeline — set focus and call insertHtml
    // via the same path used for paste embeds. We synthesise a YouTube
    // iframe inline here so we don't need to re-export the helper.
    const yt = extractYouTubeId(url);
    const vm = extractVimeoId(url);
    let html: string | null = null;
    if (yt) html = responsiveIframe(`https://www.youtube.com/embed/${yt}`, 'YouTube video');
    else if (vm) html = responsiveIframe(`https://player.vimeo.com/video/${vm}`, 'Vimeo video');
    if (!html) {
      this.toast.error('BLOG.COMPOSER.VIDEO_INVALID');
      return;
    }
    this.editor?.insertHtml(html);
  }

  private insertButton(): void {
    const label = window.prompt(this.translate.instant('BLOG.COMPOSER.BUTTON_TEXT_PROMPT'), 'Click me') ?? '';
    if (!label.trim()) return;
    const url = window.prompt(this.translate.instant('BLOG.COMPOSER.BUTTON_URL_PROMPT'), 'https://') ?? '';
    if (!url.trim()) return;
    this.editor?.insertHtml(`<p><a class="re-btn-block" href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeText(label)}</a></p>`);
  }

  private insertRawHtml(): void {
    const html = window.prompt(this.translate.instant('BLOG.COMPOSER.HTML_PROMPT'), '<!-- paste HTML here -->');
    if (!html) return;
    this.editor?.insertHtml(`<div class="re-html-raw">${html}</div>`);
  }

  // ─── Undo / Redo (browser-native) ──────────────────────────────────
  onUndo(): void { document.execCommand('undo'); }
  onRedo(): void { document.execCommand('redo'); }

  // ─── Save / Publish ────────────────────────────────────────────────
  private markDirty(): void {
    if (!this.isDirty()) this.isDirty.set(true);
  }

  private buildPayload(): any {
    const defContent = this.translations()[this.defaultLanguage()]?.content ?? '';
    return {
      id: this.postId() ?? undefined,
      defaultLanguage:  this.defaultLanguage(),
      status:           this.status(),
      authorEmployeeId: this.authorEmployeeId(),
      coverImage:       this.coverImage() || null,
      ogImage:          this.ogImage() || null,
      mainTaxonomyId:   this.mainTaxonomyId(),
      isFeatured:       this.isFeatured(),
      publishDate:      this.status() === 'published' ? new Date().toISOString() : null,
      scheduledDate:    this.status() === 'scheduled' && this.scheduledDate()
                          ? new Date(this.scheduledDate()).toISOString()
                          : null,
      translations:     this.translations(),
      taxonomyIds:      this.taxonomyIds(),
      readingTime:      estimateReadingTime(defContent),
    };
  }

  private validateDefault(): { ok: boolean; field?: string } {
    const slice = this.translations()[this.defaultLanguage()];
    if (!slice?.title?.trim()) return { ok: false, field: 'title' };
    if (!slice?.slug?.trim())  return { ok: false, field: 'slug' };
    if (!stripHtml(slice?.content ?? '').trim()) return { ok: false, field: 'content' };
    return { ok: true };
  }

  /** Top-bar "Save" — saves at the current status. Draft stays draft. */
  async save(): Promise<void> {
    return this.saveAt(this.status());
  }

  /** Top-bar "Publish" — flips status to published (or scheduled if a
   *  future scheduledDate is set) and saves. */
  async publishNow(): Promise<void> {
    const target: PostStatus = this.scheduledDate() && new Date(this.scheduledDate()) > new Date()
      ? 'scheduled' : 'published';
    this.status.set(target);
    return this.saveAt(target);
  }

  private async saveAt(targetStatus: PostStatus): Promise<void> {
    if (targetStatus !== 'draft') {
      const v = this.validateDefault();
      if (!v.ok) {
        this.toast.error('BLOG.COMPOSER.MISSING_REQUIRED');
        return;
      }
      if (targetStatus === 'scheduled' && !this.scheduledDate()) {
        this.toast.error('BLOG.COMPOSER.NO_SCHEDULED_DATE');
        return;
      }
    }

    this.saving.set(true);
    try {
      const saved = await this.api.savePost(this.buildPayload());
      this.postId.set(saved.id);
      this.isDirty.set(false);
      this.lastSavedAt.set(saved.updatedAt);
      this.toast.success('BLOG.COMPOSER.SAVED_OK');
      if (this.isNew() || this.router.url.endsWith('/new')) {
        this.router.navigate(['/blog/posts', saved.id, 'edit'], { replaceUrl: true });
      }
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  async maybeAutosave(): Promise<void> {
    if (!this.isDirty() || this.saving() || this.loading()) return;
    if (!this.postId()) return;
    if (this.status() !== 'draft') return;
    try {
      const saved = await this.api.savePost(this.buildPayload());
      this.postId.set(saved.id);
      this.isDirty.set(false);
      this.lastSavedAt.set(saved.updatedAt);
    } catch { /* silent */ }
  }

  async preview(): Promise<void> {
    if (this.isDirty()) await this.save();
    const slug = this.translations()[this.defaultLanguage()]?.slug;
    if (!slug) { this.toast.error('BLOG.COMPOSER.PREVIEW_NEEDS_SLUG'); return; }
    window.open(`/${this.defaultLanguage()}/blog/${slug}?preview=1`, '_blank');
  }

  cancel(): void {
    if (this.isDirty() && !window.confirm(this.translate.instant('COMMON.UNSAVED_HINT'))) return;
    this.router.navigate(['/blog/posts']);
  }

  @HostListener('document:click')
  closeMoreMenu(): void {
    // Top-bar "more" menu closes on any outside click. The button
    // itself stops propagation so toggling still works.
    if (this.moreOpen()) this.moreOpen.set(false);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function blankLocale(): PostLocale {
  return { title: '', slug: '', excerpt: '', content: '' };
}
function stripHtml(s: string): string { return s.replace(/<[^>]*>/g, ' '); }

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function responsiveIframe(src: string, title: string): string {
  return `<div class="re-embed-video" contenteditable="false"><iframe src="${escapeAttr(src)}" title="${escapeAttr(title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        return id && /^[\w-]{6,}$/.test(id) ? id : null;
      }
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]{6,})/);
      if (m) return m[2];
    }
    return null;
  } catch { return null; }
}
function extractVimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('vimeo.com')) return null;
    const m = u.pathname.match(/^\/(\d{6,})/);
    return m ? m[1] : null;
  } catch { return null; }
}
