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
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import { LanguageService } from '@core/i18n/language.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { RichEditorComponent } from '@shared/components/rich-editor/rich-editor.component';
import { RICH_EDITOR_AI_PROVIDER } from '@shared/components/rich-editor/rich-editor-ai';
import { BlogAiService } from '../../services/blog-ai.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import {
  MediaPickerModalComponent,
  MediaPickerConfig,
} from '../../../settings/media/components/media-picker';
import { Media } from '../../../settings/media/models/media.model';
import { VideoEmbedModalComponent, VideoEmbedResult } from './video-embed-modal.component';
import { AudioEmbedModalComponent, AudioEmbedResult } from './audio-embed-modal.component';
import { AddTableModalComponent, AddTableResult } from './add-table-modal.component';
import { LayoutSectionModalComponent } from './layout-section-modal.component';
import { PollTypeModalComponent, PollType } from './poll-type-modal.component';
import {
  PickProductModalComponent,
  PickProductModalData,
  PickProductResult,
} from '../../../products/pages/product-form/components/pick-product-modal/pick-product-modal.component';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ProductsService } from '../../../products/services/products.service';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { AuthService } from '@core/auth/auth.service';
import {
  ChangeLanguageModalComponent,
  ChangeLanguageModalData,
} from './change-language-modal.component';
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
type RailKey = 'add' | 'settings' | 'seo' | 'translate';
type SettingsTab = 'general' | 'categories' | 'tags';
type AddToolKey =
  | 'image' | 'gallery' | 'video' | 'file'
  | 'divider' | 'button' | 'table' | 'expandable' | 'poll' | 'layout' | 'banner'
  | 'html' | 'soundcloud' | 'product';

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
  divider:  '<svg viewBox="0 0 36 36" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M30 25.5V27H4.5v-1.5H30zm-12.75-9c1.243 0 2.25 1.007 2.25 2.25S18.493 21 17.25 21 15 19.993 15 18.75s1.007-2.25 2.25-2.25zM12 18v1.5H4.5V18H12zm18 0v1.5h-7.5V18H30zm-12.75 0c-.414 0-.75.336-.75.75s.336.75.75.75.75-.336.75-.75-.336-.75-.75-.75zM30 10.5V12H4.5v-1.5H30z"/></svg>',
  button:   '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="6" rx="3"/></svg>',
  table:    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="4" x2="9" y2="20"/></svg>',
  expandable: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><polyline points="3 6 5 8 7 6"/></svg>',
  poll:     '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="14"/></svg>',
  layout:   '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="18"/><rect x="11" y="3" width="6" height="18"/><rect x="19" y="3" width="2" height="18"/></svg>',
  banner:   '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="1"/><line x1="2" y1="11" x2="22" y2="11"/></svg>',
  html:     '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  sound:    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17h2v-7H2zM6 17h2V8H6zM10 17h2V5h-2zM14 17h2v-4h-2zM18 17h2V9h-2z"/></svg>',
  product:  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
} as const;

@Component({
  selector: 'app-blog-post-composer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ReactiveFormsModule,
    SearchDropdownComponent,
    ToggleComponent,
    SlugInputComponent,
    TaxonomySelectorComponent,
    RichEditorComponent,
    DatePickerComponent,
    TooltipDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './post-composer.component.html',
  styleUrl: './post-composer.component.scss',
  // Scope Content AI to the blog: supplying RICH_EDITOR_AI_PROVIDER here (and
  // only here) is what lights up the editor's ✨ button. Other editors that
  // reuse <app-rich-editor> don't provide it, so they stay AI-free.
  providers: [
    BlogAiService,
    { provide: RICH_EDITOR_AI_PROVIDER, useExisting: BlogAiService },
    MycurrencyPipe,
  ],
})
export class PostComposerComponent implements OnInit, OnDestroy, CanLeaveComponent {
  private api        = inject(BLOG_API);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private toast      = inject(ToastService);
  private langSvc    = inject(LanguageService);
  private mycurrency = inject(MycurrencyPipe);
  private products   = inject(ProductsService);
  private auth       = inject(AuthService);
  private sanitizer  = inject(DomSanitizer);
  private modal      = inject(ModalService);
  private fb         = inject(NonNullableFormBuilder);

  /** Per-language locale FormGroup factory — every key in
   *  `translations.controls` is one of these. Add a new group when
   *  the user activates a language, remove on delete. */
  private buildLocaleGroup(seed?: Partial<PostLocale>) {
    return this.fb.group({
      title:          seed?.title          ?? '',
      slug:           seed?.slug           ?? '',
      excerpt:        seed?.excerpt        ?? '',
      content:        seed?.content        ?? '',
      seoTitle:       seed?.seoTitle       ?? '',
      seoDescription: seed?.seoDescription ?? '',
    });
  }

  /** The full post FormGroup. Single source of truth for every
   *  editable post field — dirty / pristine / valueChanges all run
   *  off this. The legacy signal mirrors below are kept in sync via
   *  valueChanges so the existing template (which still reads the
   *  signals) keeps working without a wholesale rewrite. */
  postForm = this.fb.group({
    defaultLanguage:  'en',
    status:           'draft' as PostStatus,
    scheduledDate:    '',
    authorEmployeeId: '',
    coverImage:       '',
    ogImage:          '',
    isFeatured:       false,
    featuredImageOn:  true,
    allowComments:    true,
    relatedPostIds:   this.fb.control<string[]>([]),
    taxonomyIds:      this.fb.control<string[]>([]),
    mainTaxonomyId:   this.fb.control<string | null>(null),
    translations:     this.fb.group<Record<string, ReturnType<PostComposerComponent['buildLocaleGroup']>>>(
      { en: this.buildLocaleGroup() } as any,
    ),
  });

  /** Trust the inline SVG strings used for the rail + Add panel
   *  icons so Angular's default DomSanitizer doesn't strip them when
   *  bound via `[innerHTML]`. Cached so we don't re-trust on every
   *  change-detection pass. */
  private iconCache = new Map<string, SafeHtml>();
  icon(html: string): SafeHtml {
    let trusted = this.iconCache.get(html);
    if (!trusted) {
      trusted = this.sanitizer.bypassSecurityTrustHtml(html);
      this.iconCache.set(html, trusted);
    }
    return trusted;
  }

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
  allowComments    = signal<boolean>(true);
  relatedPostIds   = signal<string[]>([]);
  /** Post options for the "Related posts" picker (loaded once). */
  relatedPostOptions = signal<{ id: string; label: string }[]>([]);

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
  /** Writer dropdown displays the writer's name. The bound value is the
   *  raw id (UUID), so resolve it back to a name via the writers list —
   *  otherwise the trigger shows the UUID. */
  writerDisplay = (v: any) => {
    const id = v?.id ?? v;
    return this.writers().find(w => w.id === id)?.name ?? v?.label ?? '';
  };
  /** Related-posts dropdown — resolve a post id back to its title. */
  relatedDisplay = (v: any) => {
    const id = v?.id ?? v;
    return this.relatedPostOptions().find(p => p.id === id)?.label ?? v?.label ?? '';
  };

  /** Publish date as a Date for the shared date picker (form stores an
   *  ISO/local string; null when unset). */
  scheduledDateObj = computed<Date | null>(() => {
    const s = this.scheduledDate();
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  });

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

  /** Rail config — Add / Settings / SEO / Translate. */
  readonly railItems: { key: RailKey; label: string; icon: string }[] = [
    { key: 'add',       label: 'BLOG.COMPOSER.SIDE_ADD',       icon: ICON.plus   },
    { key: 'settings',  label: 'BLOG.COMPOSER.SIDE_SETTINGS',  icon: ICON.cog    },
    { key: 'seo',       label: 'BLOG.COMPOSER.SIDE_SEO',       icon: ICON.search },
    { key: 'translate', label: 'BLOG.COMPOSER.SIDE_TRANSLATE', icon: ICON.globe  },
  ];

  readonly settingsTabs: { key: SettingsTab; label: string }[] = [
    { key: 'general',    label: 'BLOG.COMPOSER.TAB_GENERAL'    },
    { key: 'categories', label: 'BLOG.COMPOSER.TAB_CATEGORIES' },
    { key: 'tags',       label: 'BLOG.COMPOSER.TAB_TAGS'       },
  ];

  readonly addGroups: { label: string; tools: { key: AddToolKey; label: string; icon: string }[] }[] = [
    { label: 'BLOG.COMPOSER.ADD_MEDIA', tools: [
      { key: 'image',   label: 'BLOG.COMPOSER.ADD_IMAGE',   icon: ICON.image   },
      { key: 'gallery', label: 'BLOG.COMPOSER.ADD_GALLERY', icon: ICON.gallery },
      { key: 'video',   label: 'BLOG.COMPOSER.ADD_VIDEO',   icon: ICON.video   },
      // TODO(upload): re-add the File tool once file upload is implemented.
      // { key: 'file',    label: 'BLOG.COMPOSER.ADD_FILE',    icon: ICON.file    },
    ]},
    { label: 'BLOG.COMPOSER.ADD_ELEMENTS', tools: [
      { key: 'divider',    label: 'BLOG.COMPOSER.ADD_DIVIDER',    icon: ICON.divider    },
      { key: 'button',     label: 'BLOG.COMPOSER.ADD_BUTTON',     icon: ICON.button     },
      { key: 'table',      label: 'BLOG.COMPOSER.ADD_TABLE',      icon: ICON.table      },
      { key: 'expandable', label: 'BLOG.COMPOSER.ADD_EXPANDABLE', icon: ICON.expandable },
      { key: 'poll',       label: 'BLOG.COMPOSER.ADD_POLL',       icon: ICON.poll       },
      { key: 'layout',     label: 'BLOG.COMPOSER.ADD_LAYOUT',     icon: ICON.layout     },
      { key: 'banner',     label: 'BLOG.COMPOSER.ADD_BANNER',     icon: ICON.banner     },
    ]},
    { label: 'BLOG.COMPOSER.ADD_FROM_SITE', tools: [
      { key: 'product',    label: 'BLOG.COMPOSER.ADD_PRODUCT',    icon: ICON.product },
    ]},
    { label: 'BLOG.COMPOSER.ADD_FROM_WEB', tools: [
      { key: 'html',       label: 'BLOG.COMPOSER.ADD_HTML',       icon: ICON.html    },
      { key: 'soundcloud', label: 'BLOG.COMPOSER.ADD_SOUNDCLOUD', icon: ICON.sound   },
    ]},
  ];

  /** Flat list of insert commands for the editor's "/" slash menu —
   *  reuses the Add-panel groups so the two stay in sync. */
  get slashCommands(): { key: string; label: string; icon: string }[] {
    return this.addGroups.flatMap(g => g.tools);
  }

  constructor() {
    withTranslations('blog');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));

    // Mirror the form into the legacy signals so the existing
    // template (which still reads signals everywhere) stays in sync
    // with the new FormGroup. Also bridges `isDirty` to the form's
    // own dirty flag so manual `markDirty()` calls aren't needed.
    this.postForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(v => {
        this.defaultLanguage.set(v.defaultLanguage  ?? 'en');
        this.status.set(v.status                    ?? 'draft');
        this.scheduledDate.set(v.scheduledDate      ?? '');
        this.authorEmployeeId.set(v.authorEmployeeId ?? '');
        this.coverImage.set(v.coverImage            ?? '');
        this.ogImage.set(v.ogImage                  ?? '');
        this.isFeatured.set(v.isFeatured            ?? false);
        this.featuredImageOn.set(v.featuredImageOn  ?? true);
        this.allowComments.set(v.allowComments      ?? true);
        this.relatedPostIds.set([...(v.relatedPostIds ?? [])]);
        this.taxonomyIds.set([...(v.taxonomyIds ?? [])]);
        this.mainTaxonomyId.set(v.mainTaxonomyId    ?? null);
        // Translations: rebuild the plain-object signal from the
        // nested FormGroup's value.
        const t: Record<string, PostLocale> = {};
        for (const [code, slice] of Object.entries(v.translations ?? {})) {
          t[code] = {
            title:          (slice as any)?.title          ?? '',
            slug:           (slice as any)?.slug           ?? '',
            excerpt:        (slice as any)?.excerpt        ?? '',
            content:        (slice as any)?.content        ?? '',
            seoTitle:       (slice as any)?.seoTitle       ?? '',
            seoDescription: (slice as any)?.seoDescription ?? '',
          };
        }
        this.translations.set(t);
        this.isDirty.set(this.postForm.dirty);
      });
  }

  /** Shorthand for the translations sub-FormGroup. Cast to the
   *  untyped `FormGroup` because we add/remove controls dynamically
   *  by language code — the strongly-typed wrapper would reject the
   *  dynamic key names. */
  private get translationsGroup(): FormGroup {
    return this.postForm.controls.translations as unknown as FormGroup;
  }

  /** Push a value into a nested locale field + flag dirty. Used by
   *  the template's existing `setTitle / setSlug / ...` setters so
   *  edits flow through the form. */
  private patchLocale(field: keyof PostLocale, value: string): void {
    const code = this.active();
    let group = this.translationsGroup.get(code);
    if (!group) {
      this.translationsGroup.addControl(code, this.buildLocaleGroup() as any);
      group = this.translationsGroup.get(code)!;
    }
    group.get(field as string)?.setValue(value);
    this.postForm.markAsDirty();
  }

  async ngOnInit(): Promise<void> {
    // Load lookups in parallel.
    void this.api.listWriters().then(rows => {
      this.writers.set(rows);
      // New post → default the writer to the current user (fall back to the
      // first writer if the logged-in user isn't in the writers list).
      if (this.isNew() && !this.postForm.controls.authorEmployeeId.value) {
        const me = this.auth.currentEmployee?.id;
        const def = (me && rows.some(r => r.id === me)) ? me : rows[0]?.id;
        if (def) this.postForm.controls.authorEmployeeId.setValue(def);
      }
    });
    void this.loadRelatedPostOptions();
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
    // No `beforeunload` guard — browser refresh / tab close lets the
    // navigation through silently. In-app navigation (top-bar Back,
    // sidebar, etc.) still goes through `unsavedChangesGuard` which
    // shows the project's ConfirmModalComponent, so deliberate route
    // changes still prompt with a styled dialog.
  }

  ngOnDestroy(): void {
    if (this.autosaveTimer) clearInterval(this.autosaveTimer);
  }

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
    // Rebuild the translations FormGroup so its keys exactly match
    // the loaded post — addControl / removeControl in a loop is the
    // canonical way to swap a dynamic FormGroup's contents.
    const tg = this.translationsGroup;
    Object.keys(tg.controls).forEach(k => tg.removeControl(k));
    // Reconstruct the translations map. The backend may send a `translations`
    // object keyed by language, OR flatten the default-language fields onto
    // the post row — handle both so the editor always has at least one locale.
    const rawT = (post.translations && typeof post.translations === 'object') ? post.translations : null;
    const entries = rawT && Object.keys(rawT).length
      ? Object.entries(rawT)
      : [[post.defaultLanguage || 'en', {
          title:          (post as any).title ?? '',
          slug:           (post as any).slug ?? '',
          content:        (post as any).content ?? '',
          excerpt:        (post as any).excerpt ?? '',
          seoTitle:       (post as any).seoTitle ?? '',
          seoDescription: (post as any).seoDescription ?? '',
        }]] as [string, any][];
    for (const [code, slice] of entries) {
      tg.addControl(code, this.buildLocaleGroup(slice) as any);
    }
    this.postForm.patchValue({
      defaultLanguage:  post.defaultLanguage,
      status:           post.status,
      scheduledDate:    post.scheduledDate ? toLocalInput(post.scheduledDate) : '',
      authorEmployeeId: post.authorEmployeeId,
      coverImage:       post.coverImage ?? '',
      featuredImageOn:  !!post.coverImage,
      ogImage:          post.ogImage ?? '',
      taxonomyIds:      Array.isArray(post.taxonomyIds) ? [...post.taxonomyIds] : [],
      mainTaxonomyId:   post.mainTaxonomyId,
      isFeatured:       post.isFeatured,
      allowComments:    post.allowComments ?? true,
      relatedPostIds:   Array.isArray(post.relatedPostIds) ? [...post.relatedPostIds] : [],
    }, { emitEvent: true });
    // Pristine after loading — load events shouldn't count as dirt.
    this.postForm.markAsPristine();
    this.isDirty.set(false);
    this.active.set(post.defaultLanguage);
    this.lastSavedAt.set(post.updatedAt);
  }

  // ─── Edit handlers — all route through the postForm so dirty /
  //     valueChanges tracking stays accurate. The signal mirrors
  //     update via the form's valueChanges subscription. ─────────────
  setTitle(v: string): void   { this.patchLocale('title', v); }
  setSlug(v: string): void    { this.patchLocale('slug', v); }
  setExcerpt(v: string): void { this.patchLocale('excerpt', v); }
  setContent(v: string): void { this.patchLocale('content', v); }
  setSeoTitle(v: string): void { this.patchLocale('seoTitle', v); }
  setSeoDescription(v: string): void { this.patchLocale('seoDescription', v); }

  setStatus(v: PostStatus): void { this.postForm.controls.status.setValue(v); this.postForm.markAsDirty(); }
  setAuthor(v: any): void {
    const id = (v && typeof v === 'object' ? v.id : v) ?? '';
    this.postForm.controls.authorEmployeeId.setValue(id);
    this.postForm.markAsDirty();
  }
  setScheduled(v: string): void { this.postForm.controls.scheduledDate.setValue(v); this.postForm.markAsDirty(); }
  /** Date picker emits a Date — persist it as an ISO string. */
  setScheduledDate(d: Date | null): void { this.setScheduled(d ? d.toISOString() : ''); }
  setFeatured(v: boolean): void { this.postForm.controls.isFeatured.setValue(v); this.postForm.markAsDirty(); }
  setAllowComments(v: boolean): void { this.postForm.controls.allowComments.setValue(v); this.postForm.markAsDirty(); }
  setRelatedPosts(ids: any): void {
    const list = (Array.isArray(ids) ? ids : []).map((x: any) => x?.id ?? x).slice(0, 3);
    this.postForm.controls.relatedPostIds.setValue(list);
    this.postForm.markAsDirty();
  }
  setCover(url: string): void { this.postForm.controls.coverImage.setValue(url); this.postForm.markAsDirty(); }
  setOg(url: string): void { this.postForm.controls.ogImage.setValue(url); this.postForm.markAsDirty(); }

  setFeaturedImageOn(v: boolean): void {
    this.postForm.controls.featuredImageOn.setValue(v);
    if (!v && this.coverImage()) this.postForm.controls.coverImage.setValue('');
    this.postForm.markAsDirty();
  }

  addLang(code: string): void {
    if (!this.translationsGroup.get(code)) {
      this.translationsGroup.addControl(code, this.buildLocaleGroup() as any);
    }
    this.active.set(code);
    this.postForm.markAsDirty();
  }
  removeLang(code: string): void {
    if (code === this.postForm.controls.defaultLanguage.value) return;
    this.translationsGroup.removeControl(code);
    if (this.active() === code) this.active.set(this.postForm.controls.defaultLanguage.value);
    this.postForm.markAsDirty();
  }
  setDefaultLang(code: string): void {
    if (!this.translationsGroup.get(code)) this.addLang(code);
    this.postForm.controls.defaultLanguage.setValue(code);
    this.postForm.markAsDirty();
  }

  // ─── Taxonomies ────────────────────────────────────────────────────
  addTaxonomy(t: BlogTaxonomy): void {
    const ids = this.postForm.controls.taxonomyIds.value;
    if (ids.includes(t.id)) return;
    if (t.taxonomyType === 'category' && this.categoryCount() >= MAX_CATEGORIES) return;
    this.postForm.controls.taxonomyIds.setValue([...ids, t.id]);
    if (t.taxonomyType === 'category' && !this.postForm.controls.mainTaxonomyId.value) {
      this.postForm.controls.mainTaxonomyId.setValue(t.id);
    }
    // Cache for badge counters.
    if (!this.taxonomies().some(x => x.id === t.id)) {
      this.taxonomies.set([...this.taxonomies(), t]);
    }
    this.postForm.markAsDirty();
  }
  removeTaxonomy(id: string): void {
    const ids = this.postForm.controls.taxonomyIds.value;
    this.postForm.controls.taxonomyIds.setValue(ids.filter(x => x !== id));
    if (this.postForm.controls.mainTaxonomyId.value === id) {
      this.postForm.controls.mainTaxonomyId.setValue(null);
    }
    this.postForm.markAsDirty();
  }
  setMainTaxonomy(id: string): void { this.postForm.controls.mainTaxonomyId.setValue(id); this.postForm.markAsDirty(); }
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
  /** Create + assign a new category (used by the AI suggestions picker). */
  async createCategoryInline(name: string): Promise<void> {
    const slug = generateSlug(name);
    const created = await this.api.saveTaxonomy({
      taxonomyType: 'category',
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

  /** Featured image — pick from the shared media library (replaces the
   *  old hidden file input so it matches every other image picker). */
  async onPickFeaturedImage(): Promise<void> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      { data: { contentTypes: ['image'], multiple: false, title: this.translate.instant('BLOG.COMPOSER.FEATURED_IMAGE') }, size: 'xl' },
    );
    const picked = await ref.afterClosed();
    const url = mediaUrl(Array.isArray(picked) ? picked[0] : picked);
    if (!url) return;
    this.setCover(url);
  }

  /** Load post titles once for the Related-posts picker. */
  private async loadRelatedPostOptions(): Promise<void> {
    try {
      const res = await this.api.listPosts({ limit: 100, sortBy: 'publishDate', sortDir: 'desc' });
      const def = this.defaultLanguage();
      const opts = (res.list ?? [])
        .filter(p => p.id !== this.postId())
        .map(p => ({
          id: p.id,
          label: p.translations?.[def]?.title || Object.values(p.translations ?? {})[0]?.title || p.id,
        }));
      this.relatedPostOptions.set(opts);
    } catch { /* picker stays empty on failure */ }
  }

  // ─── Add panel — insert blocks into the editor ─────────────────────
  async onAddTool(key: AddToolKey): Promise<void> {
    switch (key) {
      case 'image':
        await this.insertImageFromPicker();
        break;
      case 'gallery':
        await this.insertGallery();
        break;
      case 'video':
        await this.insertVideoEmbed();
        break;
      case 'file':
        await this.insertFile();
        break;
      case 'divider':
        this.editor?.insertHtml('<hr data-divider-style="line" data-divider-size="extended" data-divider-align="center"/>');
        break;
      case 'button':
        this.insertButton();
        break;
      case 'table':
        await this.insertTable();
        break;
      case 'expandable':
        this.editor?.insertExpandable();
        break;
      case 'banner':
        // First-class banner section: editor builds the <section
        // class="re-banner"> shape and selects it for immediate styling.
        this.editor?.insertBanner();
        break;
      case 'layout':
        await this.insertLayoutSection();
        break;
      case 'poll':
        await this.insertPoll();
        break;
      case 'soundcloud':
        await this.insertAudioEmbed();
        break;
      case 'product':
        // Emits productPickClick → onPickProduct opens the picker.
        this.editor?.insertProduct();
        break;
      case 'html':
        this.editor?.insertHtmlEmbed();
        break;
    }
  }

  /** Open the shared Media Library picker for a single image and
   *  insert an <img> at the caret on confirm. Reuses the same modal
   *  the product/gallery features use — no duplicate UI. */
  private async insertImageFromPicker(): Promise<void> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      {
        data: { contentTypes: ['image'], multiple: false, title: this.translate.instant('BLOG.COMPOSER.ADD_IMAGE') },
        size: 'xl',
      },
    );
    const result = await ref.afterClosed();
    const picked = Array.isArray(result) ? result[0] : result;
    if (!picked) return;
    const url = mediaUrl(picked);
    if (!url) { this.toast.error('COMMON.UPLOAD_FAILED'); return; }
    // Wrap in the shared embed-figure shape so the selection toolbar
    // (size / align / replace / delete) applies to images too.
    this.editor?.insertHtml(
      `<figure class="re-embed-figure re-embed-figure--image re-align-center" contenteditable="false">
        <img src="${escapeAttr(url)}" alt="" style="display:block;width:100%;height:auto;border-radius:8px;"/>
        <figcaption class="re-embed-caption" contenteditable="true" data-placeholder="Write a caption"></figcaption>
      </figure>`,
    );
  }

  /** Open the shared Media Library picker in multi-select mode and
   *  insert a responsive grid gallery of the chosen images. */
  private async insertGallery(): Promise<void> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      {
        data: { contentTypes: ['image'], multiple: true, title: this.translate.instant('BLOG.COMPOSER.ADD_GALLERY') },
        size: 'xl',
      },
    );
    const result = await ref.afterClosed();
    const picked = Array.isArray(result) ? result : (result ? [result] : []);
    if (!picked.length) return;
    const items = picked
      .map(m => ({ url: mediaUrl(m), id: m.id }))
      .filter((x): x is { url: string; id: string | null } => !!x.url);
    if (!items.length) return;
    const tiles = items
      .map((x, i) => {
        const mid = x.id ? ` data-media-id="${escapeAttr(x.id)}"` : '';
        return `<div class="re-gallery-item"><img src="${escapeAttr(x.url!)}" alt="" data-gid="g${i}"${mid}/></div>`;
      })
      .join('');
    // Default config: grid, 1:1, crop, up-to-3 columns. The gallery
    // panel (Manage) edits these via data-* + the .re-gallery class.
    const cols = Math.min(3, Math.max(2, items.length));
    this.editor?.insertHtml(
      `<figure class="re-embed-figure re-embed-figure--gallery re-align-center" contenteditable="false"
               data-layout="grid" data-crop="crop" data-ratio="1:1" data-cols="${cols}"
               data-click-expand="true" data-allow-download="false">
        <div class="re-gallery re-gallery--grid" data-crop="crop" data-ratio="1:1" style="--re-gal-cols:${cols};--re-gal-ratio:1 / 1;">${tiles}</div>
        <figcaption class="re-embed-caption" contenteditable="true" data-placeholder="Write a caption"></figcaption>
      </figure>`,
    );
  }

  /** Gallery "Manage media" — open the media library with the
   *  gallery's current images PRE-SELECTED, so the picker reflects
   *  what's already in the gallery. The returned selection replaces
   *  the gallery (add by selecting more, remove by deselecting). */
  async onGalleryAddImages(_fig: HTMLElement): Promise<void> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      {
        data: {
          contentTypes: ['image'],
          multiple: true,
          title: this.translate.instant('BLOG.COMPOSER.ADD_GALLERY'),
          preSelectedIds: this.editor?.currentGalleryMediaIds() ?? [],
        },
        size: 'xl',
      },
    );
    const result = await ref.afterClosed();
    const picked = Array.isArray(result) ? result : (result ? [result] : []);
    // Undefined result = cancelled → leave the gallery untouched.
    if (result === undefined) return;
    const items = picked
      .map(m => ({ url: mediaUrl(m), mediaId: m.id ?? undefined }))
      .filter((x): x is { url: string; mediaId: string | undefined } => !!x.url);
    this.editor?.setGalleryImages(items);
  }

  /** Open the shared Media Library picker filtered to non-image
   *  files (docs, audio, archives, etc.) and insert a Wix-style file
   *  card — icon + filename + "Download EXT · SIZE" + download
   *  arrow. The whole card is a single anchor so a click anywhere
   *  starts the download. */
  private async insertFile(): Promise<void> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      {
        data: {
          contentTypes: ['docs', 'audio'],
          multiple:     false,
          title:        this.translate.instant('BLOG.COMPOSER.ADD_FILE'),
        },
        size: 'xl',
      },
    );
    const result = await ref.afterClosed();
    const m = Array.isArray(result) ? result[0] : result;
    if (!m) return;

    const url  = mediaUrl(m);
    if (!url) { this.toast.error('COMMON.UPLOAD_FAILED'); return; }

    const name = m.name || 'file';
    const ext  = (m.mediaType?.extension || name.split('.').pop() || '').toUpperCase();
    const size = m.getFormattedSize;
    const safeUrl  = escapeAttr(url);
    const safeName = escapeText(name);
    const safeExt  = escapeText(ext);
    const safeSize = escapeText(size);

    // Self-contained HTML so the card renders identically inside the
    // editor and on the public blog page — no global styles needed.
    this.editor?.insertHtml(
      `<a class="re-file-card" href="${safeUrl}" target="_blank" rel="noopener" download
          style="display:flex;align-items:center;gap:14px;margin:10px 0;padding:14px 16px;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:inherit;background:#fff;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:48px;background:#1e293b;color:#fff;font-size:11px;font-weight:700;border-radius:4px;letter-spacing:.05em;">${safeExt}</span>
        <span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;">
          <span style="font-size:14px;font-weight:500;color:#0e7490;text-decoration:underline;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">${safeName}</span>
          <span style="font-size:12px;color:#64748b;">Download ${safeExt}${size ? ' · ' + safeSize : ''}</span>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#475569;flex-shrink:0;">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </a>`,
    );
  }

  /** Open the media library to pick a banner background image, then
   *  hand the URL back to the editor's public API so it can apply
   *  the chosen image as the section background. */
  async onPickBannerBgImage(): Promise<void> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      { data: { contentTypes: ['image'], multiple: false, title: this.translate.instant('BLOG.COMPOSER.ADD_IMAGE') }, size: 'xl' },
    );
    const picked = await ref.afterClosed();
    const url = mediaUrl(Array.isArray(picked) ? picked[0] : picked);
    if (!url) return;
    this.editor?.setBannerBgImage(url);
  }

  /** Same media-library flow as the section-background picker, but
   *  the chosen URL is routed to the column-background slot instead. */
  async onPickColBgImage(): Promise<void> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      { data: { contentTypes: ['image'], multiple: false, title: this.translate.instant('BLOG.COMPOSER.ADD_IMAGE') }, size: 'xl' },
    );
    const picked = await ref.afterClosed();
    const url = mediaUrl(Array.isArray(picked) ? picked[0] : picked);
    if (!url) return;
    this.editor?.setColBgImage(url);
  }

  /** Poll background image — open the media library and pipe the chosen
   *  URL back to the editor. */
  async onPickPollBgImage(): Promise<void> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      { data: { contentTypes: ['image'], multiple: false, title: this.translate.instant('BLOG.COMPOSER.ADD_IMAGE') }, size: 'xl' },
    );
    const picked = await ref.afterClosed();
    const url = mediaUrl(Array.isArray(picked) ? picked[0] : picked);
    if (!url) return;
    this.editor?.setPollBgImageUrl(url);
  }

  /** Product card — open the shared product picker (single-select) and
   *  pipe the chosen product back to the editor. Fired both for the
   *  initial insert and the toolbar "Change product" action; the editor
   *  decides whether to insert a new card or swap the selected one. */
  async onPickProduct(): Promise<void> {
    const ref = this.modal.open<PickProductModalComponent, PickProductModalData, PickProductResult | undefined>(
      PickProductModalComponent,
      { data: { multiple: false, title: this.translate.instant('BLOG.COMPOSER.ADD_PRODUCT') }, size: 'md' },
    );
    const result = await ref.afterClosed();
    const p = result?.added?.[0];
    if (!p) return;
    // The list thumbnail is a small/cropped variant; fetch the full product
    // to use its original image (mediaUrl.defaultUrl). Fall back to the
    // picker thumbnail if the detail call fails or has no media.
    let image = p.thumbnailUrl ?? '';
    try {
      const full = await this.products.getProduct(p.id);
      image = full?.mediaUrl?.defaultUrl || full?.mediaUrl?.thumbnailUrl || image;
    } catch { /* keep the thumbnail fallback */ }
    this.editor?.setProductCard({
      id:    p.id,
      name:  p.name,
      price: this.mycurrency.transform(p.price ?? 0),
      image,
    });
  }

  /** Cell-level image picker — fires when the user clicks an "Add
   *  image" placeholder inside a banner cell. Opens the media library
   *  modal; on selection, swaps the placeholder for an <img> via the
   *  editor's public helper. */
  async onPickCellImage(placeholderEl: HTMLElement): Promise<void> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      { data: { contentTypes: ['image'], multiple: false, title: this.translate.instant('BLOG.COMPOSER.ADD_IMAGE') }, size: 'xl' },
    );
    const picked = await ref.afterClosed();
    const url = mediaUrl(Array.isArray(picked) ? picked[0] : picked);
    if (!url) return;
    this.editor?.replaceCellImagePlaceholder(placeholderEl, url);
  }

  /** Handler for the rich-editor's `(blockReplace)` event — dispatches
   *  to the right picker based on the figure's type marker class.
   *  All replacement HTML preserves the figure's existing size /
   *  alignment / wrap classes plus any caption text the user has
   *  written, so editorial choices survive a replace. */
  async onBlockReplace(figure: HTMLElement): Promise<void> {
    const keepClasses = Array.from(figure.classList).filter(c =>
      c === 're-embed-figure' || c === 're-embed-figure--image' || c === 're-embed-figure--gallery'
      || c.startsWith('re-size-') || c.startsWith('re-align-') || c === 're-wrap-text'
    );
    const caption = figure.querySelector('.re-embed-caption')?.innerHTML ?? '';
    const wrapWith = (inner: string, contentEditable = false) =>
      `<figure class="${keepClasses.join(' ')}"${contentEditable ? ' contenteditable="false"' : ''}>
        ${inner}
        <figcaption class="re-embed-caption" contenteditable="true" data-placeholder="Write a caption">${caption}</figcaption>
      </figure>`;

    if (figure.classList.contains('re-embed-figure--image')) {
      const replacement = await this.pickReplaceImage(wrapWith);
      if (replacement) this.editor?.replaceSelectedFigure(replacement);
      return;
    }
    if (figure.classList.contains('re-embed-figure--gallery')) {
      const replacement = await this.pickReplaceGallery(wrapWith);
      if (replacement) this.editor?.replaceSelectedFigure(replacement);
      return;
    }
    // Default: video figure.
    const replacement = await this.pickReplaceVideo(wrapWith);
    if (replacement) this.editor?.replaceSelectedFigure(replacement);
  }

  private async pickReplaceImage(wrap: (inner: string, ce?: boolean) => string): Promise<string | null> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      { data: { contentTypes: ['image'], multiple: false, title: this.translate.instant('BLOG.COMPOSER.ADD_IMAGE') }, size: 'xl' },
    );
    const picked = await ref.afterClosed();
    const url = mediaUrl(Array.isArray(picked) ? picked[0] : picked);
    if (!url) return null;
    return wrap(`<img src="${escapeAttr(url)}" alt="" style="display:block;width:100%;height:auto;border-radius:8px;"/>`, true);
  }

  private async pickReplaceGallery(wrap: (inner: string, ce?: boolean) => string): Promise<string | null> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      { data: { contentTypes: ['image'], multiple: true, title: this.translate.instant('BLOG.COMPOSER.ADD_GALLERY') }, size: 'xl' },
    );
    const result = await ref.afterClosed();
    const picked = Array.isArray(result) ? result : (result ? [result] : []);
    const urls = picked.map(m => mediaUrl(m)).filter((u): u is string => !!u);
    if (!urls.length) return null;
    const tiles = urls.map((u, i) => `<div class="re-gallery-item"><img src="${escapeAttr(u)}" alt="" data-gid="g${i}"/></div>`).join('');
    const cols = Math.min(3, Math.max(2, urls.length));
    return wrap(`<div class="re-gallery re-gallery--grid" data-crop="crop" data-ratio="1:1" style="--re-gal-cols:${cols};--re-gal-ratio:1 / 1;">${tiles}</div>`, true);
  }

  private async pickReplaceVideo(wrap: (inner: string, ce?: boolean) => string): Promise<string | null> {
    const ref = this.modal.open<VideoEmbedModalComponent, void, VideoEmbedResult | undefined>(
      VideoEmbedModalComponent, { size: 'sm' },
    );
    const result = await ref.afterClosed();
    if (!result) return null;
    let innerHtml: string;
    if (result.kind === 'upload') {
      const pickerRef = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
        MediaPickerModalComponent,
        { data: { contentTypes: ['video'], multiple: false, title: this.translate.instant('BLOG.COMPOSER.ADD_VIDEO') }, size: 'xl' },
      );
      const picked = await pickerRef.afterClosed();
      const url = mediaUrl(Array.isArray(picked) ? picked[0] : picked);
      if (!url) return null;
      innerHtml = `<video src="${escapeAttr(url)}" controls playsinline style="width:100%;height:100%;border:0;"></video>`;
    } else {
      const raw = result.url.trim();
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const yt  = extractYouTubeId(url);
      const vm  = extractVimeoId(url);
      let src: string; let title: string;
      if (yt)      { src = `https://www.youtube.com/embed/${yt}`; title = 'YouTube video'; }
      else if (vm) { src = `https://player.vimeo.com/video/${vm}`; title = 'Vimeo video'; }
      else         { src = url; title = 'Embedded video'; }
      innerHtml = `<iframe src="${escapeAttr(src)}" title="${escapeAttr(title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }
    return wrap(`<div class="re-embed-video" contenteditable="false">${innerHtml}</div>`);
  }

  /** Open the Wix-style "Add a video" modal. Returns an embed URL
   *  (then converted to iframe) OR signals that the user wants to
   *  upload — in which case we hand off to the media picker. */
  private async insertVideoEmbed(): Promise<void> {
    const ref = this.modal.open<VideoEmbedModalComponent, void, VideoEmbedResult | undefined>(
      VideoEmbedModalComponent,
      { size: 'sm' },
    );
    const result = await ref.afterClosed();
    if (!result) return;

    if (result.kind === 'upload') {
      // Open the shared media library scoped to video files.
      const pickerRef = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
        MediaPickerModalComponent,
        { data: { contentTypes: ['video'], multiple: false, title: this.translate.instant('BLOG.COMPOSER.ADD_VIDEO') }, size: 'xl' },
      );
      const picked = await pickerRef.afterClosed();
      const m = Array.isArray(picked) ? picked[0] : picked;
      const url = mediaUrl(m ?? null);
      if (!url) return;
      this.editor?.insertHtml(
        `<figure class="re-embed-figure re-align-center">
          <div class="re-embed-video" contenteditable="false">
            <video src="${escapeAttr(url)}" controls playsinline style="width:100%;height:100%;border:0;"></video>
          </div>
          <figcaption class="re-embed-caption" data-placeholder="Write a caption"></figcaption>
        </figure>`,
      );
      return;
    }

    // Embed branch — try YouTube, then Vimeo. Anything else falls
    // through to a generic responsive iframe so Facebook URLs still
    // render something useful.
    const raw = result.url.trim();
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const yt  = extractYouTubeId(url);
    const vm  = extractVimeoId(url);
    let html: string;
    if (yt)      html = responsiveIframe(`https://www.youtube.com/embed/${yt}`, 'YouTube video');
    else if (vm) html = responsiveIframe(`https://player.vimeo.com/video/${vm}`, 'Vimeo video');
    else         html = responsiveIframe(url, 'Embedded video');
    this.editor?.insertHtml(html);
  }

  /** Open the Wix-style "Add audio file" modal. The audio twin of
   *  {@link insertVideoEmbed}: converts a SoundCloud / Spotify URL into
   *  the right player iframe, or hands off to the media picker for an
   *  uploaded audio file. */
  private async insertAudioEmbed(): Promise<void> {
    const ref = this.modal.open<AudioEmbedModalComponent, void, AudioEmbedResult | undefined>(
      AudioEmbedModalComponent,
      { size: 'sm' },
    );
    const result = await ref.afterClosed();
    if (!result) return;

    if (result.kind === 'upload') {
      // Open the shared media library scoped to audio files.
      const pickerRef = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
        MediaPickerModalComponent,
        { data: { contentTypes: ['audio'], multiple: false, title: this.translate.instant('BLOG.COMPOSER.AUDIO_MODAL_TITLE') }, size: 'xl' },
      );
      const picked = await pickerRef.afterClosed();
      const m = Array.isArray(picked) ? picked[0] : picked;
      const url = mediaUrl(m ?? null);
      if (!url) return;
      this.editor?.insertHtml(
        `<figure class="re-embed-figure re-align-center">
          <div class="re-embed-audio" contenteditable="false">
            <audio src="${escapeAttr(url)}" controls style="width:100%;"></audio>
          </div>
          <figcaption class="re-embed-caption" data-placeholder="Write a caption"></figcaption>
        </figure>`,
      );
      return;
    }

    // Embed branch — SoundCloud or Spotify. Anything else falls through
    // to the SoundCloud widget URL so a bare track link still renders.
    const raw = result.url.trim();
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const sp = spotifyEmbedUrl(url);
    const html = sp
      ? responsiveAudioIframe(sp, 'Spotify player', 152)
      : responsiveAudioIframe(soundcloudEmbedUrl(url), 'SoundCloud player', 166);
    this.editor?.insertHtml(html);
  }

  private insertButton(): void {
    // Insert a button-styled anchor with inline styles that the
    // editor's contextual button-settings panel can read back via
    // syncButtonState() (which reads computed styles). The href
    // defaults to '#' so the Link panel can be used to set it.
    const style = [
      'display:inline-block',
      'padding:8px 20px',
      'background-color:#0f172a',
      'color:#ffffff',
      'border-radius:4px',
      'text-decoration:none',
      'font-size:14px',
    ].join(';');
    this.editor?.insertHtml(`<p><a class="re-btn-block" href="#" style="${style}">Click me</a></p>`);
  }

  /** Open the "Add a table" dialog, then insert an editable table of the
   *  chosen size. */
  private async insertTable(): Promise<void> {
    const ref = this.modal.open<AddTableModalComponent, void, AddTableResult | undefined>(
      AddTableModalComponent, { size: 'sm' },
    );
    const res = await ref.afterClosed();
    if (!res) return;
    const cols = Math.max(1, res.cols);
    const rows = Math.max(1, res.rows);
    const cells = `<td>&nbsp;</td>`.repeat(cols);
    const body  = `<tr>${cells}</tr>`.repeat(rows);
    this.editor?.insertHtml(`<table class="re-table re-table--${res.preset}"><tbody>${body}</tbody></table>`);
  }

  /** Open the "Layout section" picker, then insert a multi-column banner
   *  from the chosen preset (reuses the banner engine). */
  private async insertLayoutSection(): Promise<void> {
    const ref = this.modal.open<LayoutSectionModalComponent, void, string | undefined>(
      LayoutSectionModalComponent, { size: 'md' },
    );
    const id = await ref.afterClosed();
    if (id) this.editor?.applyBannerPreset(id);
  }

  /** Open the "Choose a Poll Type" dialog, then insert the chosen poll. */
  private async insertPoll(): Promise<void> {
    const ref = this.modal.open<PollTypeModalComponent, void, PollType | undefined>(
      PollTypeModalComponent, { size: 'md' },
    );
    const type = await ref.afterClosed();
    if (type) this.editor?.insertPoll(type);
  }


  // ─── Undo / Redo (browser-native) ──────────────────────────────────
  onUndo(): void { document.execCommand('undo'); }
  onRedo(): void { document.execCommand('redo'); }

  // ─── Save / Publish ────────────────────────────────────────────────
  /** Legacy helper kept for callers that haven't been ported — just
   *  marks the postForm dirty (which then drives the isDirty signal
   *  via the valueChanges subscription). */
  private markDirty(): void {
    this.postForm.markAsDirty();
    this.isDirty.set(true);
  }

  private buildPayload(): any {
    // Read straight from the form — single source of truth.
    const v = this.postForm.getRawValue();
    const defContent = (v.translations as any)?.[v.defaultLanguage]?.content ?? '';
    return {
      id: this.postId() ?? undefined,
      defaultLanguage:  v.defaultLanguage,
      status:           v.status,
      authorEmployeeId: v.authorEmployeeId,
      coverImage:       v.coverImage || null,
      ogImage:          v.ogImage || null,
      mainTaxonomyId:   v.mainTaxonomyId,
      isFeatured:       v.isFeatured,
      publishDate:      v.status === 'published' ? new Date().toISOString() : null,
      scheduledDate:    v.status === 'scheduled' && v.scheduledDate
                          ? new Date(v.scheduledDate).toISOString()
                          : null,
      translations:     v.translations,
      taxonomyIds:      v.taxonomyIds,
      relatedPostIds:   v.relatedPostIds ?? [],
      allowComments:    v.allowComments ?? true,
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
      this.postForm.markAsPristine();
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
      this.postForm.markAsPristine();
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

  /** Open the "Change the draft language" modal for the Translate
   *  panel's "Change" link. Returns the new default code, or no-op
   *  on cancel. Goes through the unsaved-changes check first so we
   *  don't lose work by switching defaults mid-edit. */
  async onChangeDefaultLanguage(): Promise<void> {
    const proceed = await this.ensureSavedBefore('To change the draft language, you need to save your changes first.');
    if (!proceed) return;
    const ref = this.modal.open<ChangeLanguageModalComponent, ChangeLanguageModalData, string | undefined>(
      ChangeLanguageModalComponent,
      {
        size: 'sm',
        data: {
          current:   this.defaultLanguage(),
          active:    this.activeLangs(),
          supported: this.supportedLangs(),
        },
      },
    );
    const picked = await ref.afterClosed();
    if (picked && picked !== this.defaultLanguage()) this.setDefaultLang(picked);
  }

  /** Wrapper used by every Translate-panel action that needs the
   *  draft committed first. Returns true if the caller may proceed
   *  (post is already saved, or user just saved it from the modal),
   *  false if the user cancelled. */
  private async ensureSavedBefore(message: string): Promise<boolean> {
    if (!this.isDirty()) return true;
    const ok = await this.confirm({
      title:   'Save your changes?',
      message,
      confirm: 'Save & Continue',
    });
    if (!ok) return false;
    await this.save();
    // Save can fail (validation, network) — if it's still dirty
    // afterwards, we treat that as cancel rather than silently
    // proceeding.
    return !this.isDirty();
  }

  /** Wrapper for "Add translation" — saves first if dirty, then
   *  activates the language. Mirrors Wix's behaviour. */
  async onAddTranslation(code: string): Promise<void> {
    const proceed = await this.ensureSavedBefore('To add a translation, you need to save your changes first.');
    if (!proceed) return;
    this.addLang(code);
  }

  async cancel(): Promise<void> {
    if (this.isDirty()) {
      const confirmed = await this.confirm({
        title:   this.translate.instant('COMMON.UNSAVED_TITLE'),
        message: this.translate.instant('COMMON.UNSAVED_HINT'),
        confirm: this.translate.instant('COMMON.LEAVE'),
        danger:  true,
      });
      if (!confirmed) return;
    }
    this.router.navigate(['/blog/posts']);
  }

  /** Small wrapper around the shared ConfirmModalComponent so the
   *  composer's prompts share one button style + dismiss UX. */
  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      { size: 'sm', data },
    );
    return (await ref.afterClosed()) === true;
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

/** Pull a usable URL off a Media item. Prefer the defaultUrl, fall
 *  back to original then thumbnail — matching the MediaPicker's own
 *  precedence. Returns null when the item has no URL at all. */
function mediaUrl(m: Media | null | undefined): string | null {
  if (!m) return null;
  return m.url?.defaultUrl || m.url?.original || m.url?.thumbnail || null;
}
function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function responsiveIframe(src: string, title: string): string {
  // The iframe block is `contenteditable=false` so users can't type
  // inside it; the surrounding <figcaption> stays editable, matching
  // the Wix Ricos "Write a caption" affordance.
  return `<figure class="re-embed-figure re-align-center">
    <div class="re-embed-video" contenteditable="false">
      <iframe src="${escapeAttr(src)}" title="${escapeAttr(title)}" frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen></iframe>
    </div>
    <figcaption class="re-embed-caption" data-placeholder="Write a caption"></figcaption>
  </figure>`;
}

/** Fixed-height embed for audio players (SoundCloud / Spotify). Unlike
 *  {@link responsiveIframe} (16:9 video), audio players are short bars,
 *  so the wrapper uses an explicit height instead of an aspect ratio. */
function responsiveAudioIframe(src: string, title: string, height: number): string {
  return `<figure class="re-embed-figure re-align-center">
    <div class="re-embed-audio" contenteditable="false" style="height:${height}px;">
      <iframe src="${escapeAttr(src)}" title="${escapeAttr(title)}" frameborder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              allowfullscreen></iframe>
    </div>
    <figcaption class="re-embed-caption" data-placeholder="Write a caption"></figcaption>
  </figure>`;
}

/** Build the SoundCloud widget player URL from any soundcloud.com link. */
function soundcloudEmbedUrl(url: string): string {
  const params = new URLSearchParams({
    url,
    color: '#ff5500',
    auto_play: 'false',
    hide_related: 'false',
    show_comments: 'true',
    show_user: 'true',
    show_reposts: 'false',
    show_teaser: 'true',
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

/** Convert an open.spotify.com share link into its /embed/ player URL.
 *  Returns null for non-Spotify URLs so the caller falls back to
 *  SoundCloud. Handles track / album / playlist / episode / show. */
function spotifyEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)spotify\.com$/.test(u.hostname.replace(/^www\./, ''))) return null;
    if (u.pathname.startsWith('/embed/')) return `https://open.spotify.com${u.pathname}`;
    const m = u.pathname.match(/^\/(track|album|playlist|episode|show|artist)\/([\w-]+)/);
    return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
  } catch { return null; }
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
