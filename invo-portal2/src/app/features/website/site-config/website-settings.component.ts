import { FormActionsComponent, FormActionPrimaryDirective, FormActionSecondaryDirective } from '@shared/components/form-actions/form-actions.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ApiService } from '@core/http/api.service';
import { LanguageService } from '@core/i18n/language.service';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';

import { SettingsFieldsComponent } from '../page-types/settings-fields.component';
import { FieldOption } from '../page-types/page-type.types';
import { WebsitePagesService } from '../pages/services/website-pages.service';
import { SiteConfigSection, SiteConfigService } from './site-config.service';
import { FALLBACK_SITE_CONFIG_SCHEMA, SiteConfigSchema } from './site-config.schema';

import { FormSkeletonComponent } from '@shared/components/skeleton/form-skeleton.component';
/**
 * Website settings.
 *
 * The sidebar has linked `/website-settings` with nothing behind it. This is
 * that screen, and it is rendered from a SCHEMA rather than hand-built: the
 * same renderer draws page settings, so a new option is added in one place and
 * both screens agree with what the storefront reads.
 *
 * Sections map to the site-config document (branding / commerce / contact),
 * each persisting to the legacy row that already holds it — so editing here
 * writes exactly what the old dashboard wrote, key for key.
 *
 * Rich objects (colours, typography, logos, banners) are NOT here. They have a
 * purpose-built editor in the page builder with a live preview; this screen
 * links out to it instead of pretending a generic form can do the job.
 */
@Component({
  selector: 'app-website-settings',
  standalone: true,
  imports: [FormActionsComponent, FormActionPrimaryDirective, FormActionSecondaryDirective, PageHeaderComponent, FormSkeletonComponent, 
    CommonModule, TranslateModule,
    LoadingOverlayComponent,
    SettingsFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ws-page">
      <app-page-header [title]="'WEBSITE.SETTINGS.TITLE' | translate" [trail]="breadcrumbs()">
<app-form-actions pageActions>
        <button formActionSecondary type="button" (click)="reload()" [disabled]="saving() || !dirty()">
          {{ 'COMMON.CANCEL' | translate }}
        </button>
        <button formActionPrimary type="button" (click)="save()" [disabled]="saving() || !dirty()">
          {{ 'COMMON.SAVE' | translate }}
        </button>
</app-form-actions>
</app-page-header>

      @if (loading()) {
        <app-form-skeleton />
      } @else {
        @for (section of schema().sections; track section.key) {
          <section class="card">
            <header class="card__head">
              <h2 class="card__title">{{ section.title }}</h2>
              <p class="card__sub">{{ section.description }}</p>
            </header>
            <div class="card__body">
              <app-settings-fields
                [groups]="section.groups"
                [values]="valuesFor(section.key)"
                [optionSources]="optionSources()"
                (valuesChange)="onChange(section.key, $event)"/>
            </div>
          </section>
        }

        <!-- Settings that live elsewhere. Linking out beats an empty panel or,
             worse, a second half-working editor. -->
        @if (schema().external.length) {
          <section class="card">
            <header class="card__head">
              <h2 class="card__title">{{ 'WEBSITE.SETTINGS.ELSEWHERE' | translate }}</h2>
            </header>
            <div class="card__body ws-links">
              @for (item of schema().external; track item.key) {
                <button type="button" class="ws-link" (click)="open(item.editor)">
                  <span class="ws-link__title">{{ item.title }}</span>
                  <span class="ws-link__reason">{{ item.reason }}</span>
                </button>
              }
            </div>
          </section>
        }
      }

      <app-loading-overlay [show]="saving()" [message]="'COMMON.SAVING' | translate"/>

      
    </div>
  `,
  styles: [`
    .ws-loading { display: flex; justify-content: center; padding: 60px 0; }
    .card { background: var(--ui-surface); border-radius: 12px; box-shadow: 0 1px 2px rgba(15,23,42,.04); margin-bottom: 16px; overflow: hidden; }
    .card__head { padding: 14px 18px; border-bottom: 1px solid var(--ui-surface-2); }
    .card__title { margin: 0; font-size: 15px; font-weight: 600; color: var(--ui-text); }
    .card__sub { margin: 3px 0 0; font-size: 12px; color: var(--ui-faint); }
    .card__body { padding: 16px 18px; }
    .ws-links { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .ws-link {
      display: flex; flex-direction: column; gap: 3px; text-align: start;
      padding: 12px 14px; border: 1px solid var(--ui-line); border-radius: 10px;
      background: var(--ui-surface); cursor: pointer;
    }
    .ws-link:hover { border-color: #32acc1; }
    .ws-link__title { font-size: 13px; font-weight: 600; color: var(--ui-text); }
    .ws-link__reason { font-size: 11.5px; color: var(--ui-faint); line-height: 1.5; }
  `],
})
export class WebsiteSettingsComponent implements OnInit, CanLeaveComponent {
  private api       = inject(ApiService);
  private config    = inject(SiteConfigService);
  private pages     = inject(WebsitePagesService);
  private lang      = inject(LanguageService);
  private translate = inject(TranslateService);
  private toast     = inject(ToastService);
  private router    = inject(Router);

  loading = signal<boolean>(true);
  saving  = signal<boolean>(false);
  schema  = signal<SiteConfigSchema>(FALLBACK_SITE_CONFIG_SCHEMA);

  /** Edited values per section, and which sections actually changed — only
   *  those are written, so a save never rewrites a section nobody touched. */
  private edits = signal<Record<string, Record<string, any>>>({});
  private touched = signal<Set<SiteConfigSection>>(new Set());

  /** Runtime option lists the schema names but can't know. */
  optionSources = signal<Record<string, FieldOption[]>>({});

  dirty = computed<boolean>(() => this.touched().size > 0);

  breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: this.translate.instant('MENU.WEBSITE_CONTENT') },
    { label: this.translate.instant('WEBSITE.SETTINGS.TITLE') },
  ]);

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('website/page-types');
    await Promise.all([this.loadSchema(), this.config.load(true), this.loadOptions()]);
    this.loading.set(false);
  }

  private async loadSchema(): Promise<void> {
    try {
      const res = await this.api.request<any>(this.api.get('website/siteConfigSchema'));
      if (res?.data?.sections?.length) this.schema.set(res.data as SiteConfigSchema);
    } catch {
      // Endpoint not mounted — the bundled schema carries the screen.
    }
  }

  /** The tenant's listing pages, for "Primary product page". */
  private async loadOptions(): Promise<void> {
    try {
      const all = await this.pages.list();
      this.optionSources.set({
        listingPages: all
          .filter(p => p.pageType === 'product-list' && p.slug)
          .map(p => ({ title: `${p.name || p.slug} (/${p.slug})`, value: p.slug })),
      });
    } catch {
      this.optionSources.set({ listingPages: [] });
    }
  }

  valuesFor(section: SiteConfigSection): Record<string, any> {
    return this.edits()[section] ?? (this.config.config() as any)[section] ?? {};
  }

  onChange(section: SiteConfigSection, values: Record<string, any>): void {
    this.edits.update(e => ({ ...e, [section]: values }));
    this.touched.update(t => new Set(t).add(section));
  }

  async save(): Promise<void> {
    if (!this.dirty()) return;
    this.saving.set(true);
    try {
      // Section at a time: each persists to its own legacy row, and a failure
      // half-way leaves the untouched sections exactly as they were.
      for (const section of this.touched()) {
        await this.config.save(section, this.edits()[section] ?? {});
      }
      this.edits.set({});
      this.touched.set(new Set());
      this.toast.success('WEBSITE.SETTINGS.SAVED');
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  async reload(): Promise<void> {
    this.edits.set({});
    this.touched.set(new Set());
    await this.config.load(true);
  }

  open(editor: string): void {
    void this.router.navigate(['/' + editor]);
  }

  hasUnsavedChanges(): boolean {
    return this.dirty() && !this.saving();
  }
}
