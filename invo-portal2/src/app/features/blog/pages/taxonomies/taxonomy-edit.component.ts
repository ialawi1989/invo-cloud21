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
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { StorefrontUrlService } from '@core/auth/storefront-url.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { MediaPickerModalComponent, MediaPickerConfig } from '../../../settings/media/components/media-picker';
import { Media } from '../../../settings/media/models/media.model';

import { BLOG_API } from '../../services/blog-api';
import { BlogTaxonomy, TaxonomyLocale, TaxonomyType } from '../../services/blog.types';
import { generateSlug } from '../../utils/blog-utils';

/**
 * Full-page category / tag editor with the Wix-style SEO panel (URL slug
 * + Google preview). Routed at `/blog/categories/new` and
 * `/blog/categories/:id/edit`. Edits one language at a time (from the
 * route's `lang`, or the loaded taxonomy's default language).
 */
@Component({
  selector: 'app-blog-taxonomy-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './taxonomy-edit.component.html',
  styleUrl: './taxonomy-edit.component.scss',
})
export class TaxonomyEditComponent implements OnInit {
  private api        = inject(BLOG_API);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private translate  = inject(TranslateService);
  private toast      = inject(ToastService);
  private modal      = inject(ModalService);
  private destroyRef = inject(DestroyRef);
  private storefront = inject(StorefrontUrlService);

  type = signal<TaxonomyType>('category');
  lang = signal<string>('en');
  private id: string | null = null;
  private existing: BlogTaxonomy | null = null;

  name           = signal<string>('');
  slug           = signal<string>('');
  private slugEdited = signal<boolean>(false);
  description     = signal<string>('');
  seoTitle        = signal<string>('');
  seoDescription  = signal<string>('');
  image           = signal<string>('');
  saving          = signal<boolean>(false);
  loading         = signal<boolean>(false);

  private i18nTick = signal(0);

  isCategory = computed(() => this.type() === 'category');
  pageTitle  = computed(() => this.name().trim() || this.translate.instant('BLOG.TAXONOMIES.UNTITLED'));

  /** Google-preview URL — absolute live-storefront URL (dev/test/prod
   *  or custom domain via StorefrontUrlService). Path mirrors the
   *  website routes: `/:lang/blog/category|tag/:slug`. */
  previewUrl = computed(() =>
    this.storefront.pageUrl(
      `/${this.lang()}/blog/${this.isCategory() ? 'category' : 'tag'}/${this.slug() || 'untitled'}`,
    ),
  );

  constructor() {
    withTranslations('blog');
    this.translate.onLangChange.pipe().subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const pm = this.route.snapshot.paramMap;
    const qp = this.route.snapshot.queryParamMap;
    this.id = pm.get('id');
    this.type.set((qp.get('type') as TaxonomyType) ?? 'category');
    this.lang.set(qp.get('lang') ?? 'en');

    if (this.id) {
      this.loading.set(true);
      try {
        const t = await this.api.getTaxonomy(this.id);
        if (t) {
          this.existing = t;
          this.type.set(t.taxonomyType);
          this.lang.set(t.defaultLanguage || 'en');
          const slice = t.translations?.[this.lang()] ?? Object.values(t.translations ?? {})[0] ?? { name: '', slug: '' };
          this.name.set(slice.name ?? '');
          this.slug.set(slice.slug ?? '');
          this.slugEdited.set(!!slice.slug);
          this.description.set(slice.description ?? '');
          this.seoTitle.set(slice.seoTitle ?? '');
          this.seoDescription.set(slice.seoDescription ?? '');
          this.image.set(t.image ?? '');
        }
      } finally {
        this.loading.set(false);
      }
    }
  }

  onName(v: string): void {
    this.name.set(v);
    if (!this.slugEdited()) this.slug.set(generateSlug(v));
  }
  onSlug(v: string): void { this.slug.set(generateSlug(v)); this.slugEdited.set(true); }

  /** Pick the category image from the shared media library. */
  async pickImage(): Promise<void> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      { data: { contentTypes: ['image'], multiple: false, title: this.translate.instant('BLOG.TAXONOMIES.FIELD_IMAGE') }, size: 'xl' },
    );
    const picked = await ref.afterClosed();
    const m = Array.isArray(picked) ? picked[0] : picked;
    const url = m?.url?.defaultUrl || m?.url?.original || m?.url?.thumbnail || '';
    if (url) this.image.set(url);
  }
  removeImage(): void { this.image.set(''); }

  canSave = computed(() => this.name().trim().length > 0 && !this.saving());

  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    const lang = this.lang();
    const slug = this.slug() || generateSlug(this.name());
    const slice: TaxonomyLocale = {
      name: this.name().trim(),
      slug,
      description: this.description() || undefined,
      seoTitle: this.seoTitle() || undefined,
      seoDescription: this.seoDescription() || undefined,
    };
    // Preserve any other languages already on the taxonomy.
    const translations = { ...(this.existing?.translations ?? {}), [lang]: slice };
    try {
      await this.api.saveTaxonomy({
        id:              this.id ?? undefined,
        taxonomyType:    this.type(),
        defaultLanguage: this.existing?.defaultLanguage ?? lang,
        slug,
        order:           this.existing?.order ?? 0,
        image:           this.image() || null,
        translations,
      });
      this.toast.success('COMMON.SAVED_OK');
      this.cancel();
    } catch (e: any) {
      this.saving.set(false);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    }
  }

  cancel(): void {
    // Return to the taxonomies page on the matching tab.
    void this.router.navigate(['/blog/categories'], this.isCategory() ? {} : { queryParams: { tab: 'tag' } });
  }
}
