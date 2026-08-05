import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { LanguageService } from '@core/i18n/language.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';

import { PageSettingsFormComponent } from '../../page-types/page-settings-form.component';
import { PageTypeService } from '../../page-types/page-type.service';
import { ListingSourceKind } from '../../page-types/page-type.types';
import { WebsitePage, WebsitePagesService } from '../services/website-pages.service';

interface Option { id: string; name: string; }

/**
 * Page editor — name, URL, type, source, settings.
 *
 * Everything below the type selector is generated: the settings come from the
 * manifest, and the source selector only appears for types that declare
 * sources. Adding a page type or a setting server-side changes this screen with
 * no edit here.
 */
@Component({
  selector: 'app-website-page-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule,
    BreadcrumbsComponent, FormStickyFooterComponent, LoadingOverlayComponent,
    SearchDropdownComponent, ToggleComponent, PageSettingsFormComponent,
  ],
  template: `
    <div class="pf-page">
      <header class="page-header">
        <app-breadcrumbs [items]="breadcrumbs()" separator="chevron"/>
        <h1 class="page-title">{{ pageTitle() }}</h1>
      </header>

      @if (loading()) {
        <div class="pf-loading"><span class="spinner spinner--lg"></span></div>
      } @else {
        <section class="card">
          <header class="card__head"><h2 class="card__title">{{ 'WEBSITE.PAGES.BASICS' | translate }}</h2></header>
          <div class="card__body">
            <div class="grid grid--2">
              <div class="field">
                <label class="field-label" for="wp-name">
                  {{ 'WEBSITE.PAGES.NAME' | translate }}<span class="required">*</span>
                </label>
                <input id="wp-name" type="text" class="input"
                       [ngModel]="page().name" (ngModelChange)="patch({ name: $event })"/>
              </div>

              <div class="field">
                <label class="field-label" for="wp-slug">
                  {{ 'WEBSITE.PAGES.URL' | translate }}<span class="required">*</span>
                </label>
                <input id="wp-slug" type="text" class="input" placeholder="menu"
                       [ngModel]="page().slug" (ngModelChange)="patch({ slug: slugify($event) })"/>
                <p class="field-hint">/{{ page().slug || '…' }}</p>
              </div>

              <div class="field">
                <label class="field-label">{{ 'WEBSITE.PAGE_TYPES.TITLE' | translate }}</label>
                <app-search-dropdown
                  [items]="typeOptions()"
                  [displayWith]="optionName"
                  [toValue]="optionId"
                  [compareWith]="optionCompare"
                  [searchable]="false"
                  [clearable]="false"
                  [value]="page().pageType"
                  (valueChange)="changeType($any($event))"/>
                @if (typeDescription()) { <p class="field-hint">{{ typeDescription() }}</p> }
              </div>

              <!-- Only types that declare sources get this. It is the field
                   that makes /menu and /shop two rows of one type. -->
              @if (sourceOptions().length) {
                <div class="field">
                  <label class="field-label">{{ 'WEBSITE.PAGE_TYPES.SOURCE' | translate }}</label>
                  <app-search-dropdown
                    [items]="sourceOptions()"
                    [displayWith]="optionName"
                    [toValue]="optionId"
                    [compareWith]="optionCompare"
                    [searchable]="false"
                    [clearable]="false"
                    [value]="page().source?.kind ?? ''"
                    (valueChange)="changeSource($any($event))"/>
                </div>
              }
            </div>

            @if (page().pageType === 'content') {
              <div class="field field--inline">
                <span class="field-label">{{ 'WEBSITE.PAGES.IS_HOME' | translate }}</span>
                <app-toggle [checked]="page().isHomePage"
                            (checkedChange)="patch({ isHomePage: $event })"/>
              </div>
            }
          </div>
        </section>

        <section class="card">
          <header class="card__head"><h2 class="card__title">{{ 'WEBSITE.PAGES.SETTINGS' | translate }}</h2></header>
          <div class="card__body">
            <app-page-settings-form
              [pageType]="page().pageType"
              [settings]="page().settings"
              [source]="page().source"
              (settingsChange)="patch({ settings: $event })"/>
          </div>
        </section>
      }

      <app-loading-overlay [show]="saving()" [message]="'COMMON.SAVING' | translate"/>

      <app-form-sticky-footer>
        <button type="button" class="btn btn-ghost" (click)="cancel()" [disabled]="saving()">
          {{ 'COMMON.CANCEL' | translate }}
        </button>
        <button type="button" class="btn btn-primary" (click)="save()" [disabled]="saving() || !canSave()">
          {{ 'COMMON.SAVE' | translate }}
        </button>
      </app-form-sticky-footer>
    </div>
  `,
  styles: [`
    .pf-page { padding-bottom: 80px; }
    .pf-loading { display: flex; justify-content: center; padding: 60px 0; }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 1px 2px rgba(15,23,42,.04); margin-bottom: 16px; overflow: hidden; }
    .card__head { padding: 14px 18px; border-bottom: 1px solid #f1f5f9; }
    .card__title { margin: 0; font-size: 15px; font-weight: 600; color: #0f172a; }
    .card__body { padding: 16px 18px; }
    .grid--2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field--inline { flex-direction: row; align-items: center; justify-content: space-between; margin-top: 14px; }
    .field-label { font-size: 12px; color: #64748b; font-weight: 500; }
    .field-hint { margin: 0; font-size: 11px; color: #94a3b8; }
    .required { color: #dc2626; margin-inline-start: 2px; }
    .input { padding: 8px 10px; font-size: 13px; border: 1px solid #dbe2ea; border-radius: 8px; background: #fff; color: #1e293b; }
  `],
})
export class WebsitePageFormComponent implements OnInit, CanLeaveComponent {
  private service   = inject(WebsitePagesService);
  private registry  = inject(PageTypeService);
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private toast     = inject(ToastService);
  private translate = inject(TranslateService);
  private lang      = inject(LanguageService);

  loading = signal<boolean>(true);
  saving  = signal<boolean>(false);
  private dirty = signal<boolean>(false);

  page = signal<WebsitePage>({
    id: null, name: '', slug: '', pageType: 'content', source: null,
    settings: {}, sections: [], isHomePage: false, rowType: 'Page',
  });

  typeOptions = computed<Option[]>(() =>
    this.registry.types().map(t => ({ id: t.id, name: t.title })),
  );

  typeDescription = computed<string>(() =>
    this.registry.typeDef(this.page().pageType)?.description ?? '',
  );

  sourceOptions = computed<Option[]>(() => {
    const kinds = this.registry.typeDef(this.page().pageType)?.sources ?? [];
    return kinds.map(kind => ({
      id: kind,
      name: this.sourceLabel(kind),
    }));
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: this.translate.instant('WEBSITE.PAGES.TITLE'), routerLink: '/page-builder' },
    { label: this.page().id ? (this.page().name || this.page().slug) : this.translate.instant('WEBSITE.PAGES.NEW') },
  ]);

  pageTitle = computed<string>(() =>
    this.page().id ? (this.page().name || this.page().slug) : this.translate.instant('WEBSITE.PAGES.NEW'),
  );

  canSave = computed<boolean>(() => !!this.page().name.trim() && !!this.page().slug.trim());

  async ngOnInit(): Promise<void> {
    // Both before first paint: labels come from this feature's translations,
    // type names and defaults from the registry.
    await Promise.all([
      this.lang.loadFeature('website/page-types'),
      this.registry.load(),
    ]);
    const id = this.route.snapshot.paramMap.get('id');

    try {
      if (!id || id === 'new') {
        const type = this.route.snapshot.queryParamMap.get('type') || 'content';
        this.page.set(this.service.blank(type));
      } else {
        const loaded = await this.service.getOne(id);
        if (loaded) this.page.set(loaded);
      }
    } finally {
      this.loading.set(false);
    }
  }

  patch(part: Partial<WebsitePage>): void {
    this.page.update(p => ({ ...p, ...part }));
    this.dirty.set(true);
  }

  /** Switching type re-seeds settings with that type's defaults — the old
   *  type's keys would be meaningless and would linger in storage. */
  changeType(pageType: string): void {
    if (!pageType || pageType === this.page().pageType) return;
    const def = this.registry.typeDef(pageType);
    const source = def?.sources?.length ? { kind: def.sources[0] } : null;
    this.patch({
      pageType,
      source,
      settings: this.registry.withDefaults(pageType, {}),
    });
  }

  changeSource(kind: ListingSourceKind): void {
    if (!kind) return;
    this.patch({ source: { ...(this.page().source ?? {}), kind } });
  }

  slugify(value: string): string {
    return String(value ?? '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const res = await this.service.save(this.page());
      if (res.success) {
        this.dirty.set(false);
        this.toast.success('WEBSITE.PAGES.SAVED');
        void this.router.navigate(['/page-builder']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED', res.msg);
      }
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { void this.router.navigate(['/page-builder']); }

  hasUnsavedChanges(): boolean { return this.dirty() && !this.saving(); }

  private sourceLabel(kind: string): string {
    const key = `WEBSITE.PAGE_TYPES.SOURCE_${kind.toUpperCase()}`;
    const out = this.translate.instant(key);
    return out === key ? kind : out;
  }

  optionName    = (o: Option | string): string => (typeof o === 'object' ? o.name : String(o ?? ''));
  optionId      = (o: Option | string): string => (typeof o === 'object' ? o.id : String(o ?? ''));
  optionCompare = (a: any, b: any): boolean => (a?.id ?? a) === (b?.id ?? b);
}
