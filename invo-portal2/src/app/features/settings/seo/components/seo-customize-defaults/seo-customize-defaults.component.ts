import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';

import { SeoVarInputComponent } from '../seo-var-input/seo-var-input.component';
import { SeoSettingsService } from '../../services/seo.service';
import type { SeoCustomizeDefaults, SeoAdditionalTag } from '../../services/seo.types';

/** Concrete shape for the per-card open/dirty state signals. Avoids
 *  the `noPropertyAccessFromIndexSignature` errors a plain
 *  `Record<string, boolean>` produces when the template does
 *  `dirty().basics`. */
type CardKey = 'basics' | 'pageUrl' | 'structured' | 'robots' | 'additional';
type CardState = Record<CardKey, boolean>;

/**
 * Customize-defaults section for one page type — five expandable
 * sub-cards arranged vertically. Each card has its own Discard /
 * Save buttons so users can edit one bundle without committing
 * unrelated changes.
 *
 * State is held locally as a `draft` signal cloned from the
 * service's current `pageType(slug).defaults`; saving copies the
 * relevant slice back through `seo.patchPageTypeDefaults()` and
 * persists via `seo.save()`.
 */
@Component({
  selector: 'app-seo-customize-defaults',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ToggleComponent,
    SegmentedToggleComponent,
    SeoVarInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './seo-customize-defaults.component.html',
  styleUrl: './seo-customize-defaults.component.scss',
})
export class SeoCustomizeDefaultsComponent {
  private seo   = inject(SeoSettingsService);
  private toast = inject(ToastService);

  typeSlug = input.required<string>();

  /** Working copy of the bundle. Re-syncs whenever the slug changes
   *  via a computed key — components flushing draft on slug change
   *  is simpler than nesting effect()/onInit. */
  private draftKey = computed(() => this.typeSlug());
  private _draft   = signal<SeoCustomizeDefaults>(this.cloneCurrent());

  draft = computed(() => {
    // Re-clone whenever the active page-type slug changes.
    void this.draftKey();
    return this._draft();
  });

  /** Per-card collapse state. Each card starts collapsed; clicking
   *  the header expands the inline editor. Concrete keys (not an
   *  index signature) so template member access stays type-safe
   *  under `noPropertyAccessFromIndexSignature`. */
  open = signal<CardState>({
    basics: false, pageUrl: false, structured: false, robots: false, additional: false,
  });

  /** Per-card dirty flag — drives the visibility of the Discard /
   *  Save buttons. */
  dirty = signal<CardState>({
    basics: false, pageUrl: false, structured: false, robots: false, additional: false,
  });

  readonly xCardSizeOptions: SegmentedToggleOption<'large' | 'small'>[] = [
    { value: 'large', label: 'SEO.BASICS_FORM.CARD_LARGE' },
    { value: 'small', label: 'SEO.BASICS_FORM.CARD_SMALL' },
  ];

  readonly maxImagePreviewOptions: SegmentedToggleOption<'none' | 'standard' | 'large'>[] = [
    { value: 'none',     label: 'SEO.ROBOTS_FORM.NONE' },
    { value: 'standard', label: 'SEO.ROBOTS_FORM.STANDARD' },
    { value: 'large',    label: 'SEO.ROBOTS_FORM.LARGE' },
  ];

  private cloneCurrent(): SeoCustomizeDefaults {
    return JSON.parse(JSON.stringify(this.seo.pageType(this.typeSlug() ?? 'main').defaults));
  }

  toggle(card: CardKey): void {
    this.open.update(o => ({ ...o, [card]: !o[card] }));
  }

  /** Sparse patch into the draft. Updating one field flips the
   *  per-card dirty flag so the user sees the inline action bar. */
  patch(card: CardKey, patch: Partial<SeoCustomizeDefaults>): void {
    this._draft.update(d => ({ ...d, ...patch }));
    this.dirty.update(s => ({ ...s, [card]: true }));
  }

  patchBasics  (p: Partial<SeoCustomizeDefaults['basics']>):  void {
    this.patch('basics', { basics: { ...this._draft().basics, ...p } });
  }
  patchPageUrl (p: Partial<SeoCustomizeDefaults['pageUrl']>): void {
    this.patch('pageUrl', { pageUrl: { ...this._draft().pageUrl, ...p } });
  }
  patchRobots  (p: Partial<SeoCustomizeDefaults['robots']>):  void {
    this.patch('robots', { robots: { ...this._draft().robots, ...p } });
  }
  setStructured(v: string): void { this.patch('structured', { structuredData: v }); }

  // ─── Additional tags ────────────────────────────────────────────────────
  addTag(): void {
    const tags = [...this._draft().additionalTags, { name: '', value: '' }];
    this.patch('additional', { additionalTags: tags });
  }
  updateTag(i: number, patch: Partial<SeoAdditionalTag>): void {
    const tags = this._draft().additionalTags.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
    this.patch('additional', { additionalTags: tags });
  }
  removeTag(i: number): void {
    const tags = this._draft().additionalTags.filter((_, idx) => idx !== i);
    this.patch('additional', { additionalTags: tags });
  }

  // ─── Discard / save ─────────────────────────────────────────────────────
  discard(card: CardKey): void {
    this._draft.set(this.cloneCurrent());
    this.dirty.update(s => ({ ...s, [card]: false }));
  }

  async save(card: CardKey): Promise<void> {
    this.seo.patchPageTypeDefaults(this.typeSlug(), this._draft());
    this.dirty.update(s => ({ ...s, [card]: false }));
    try {
      await this.seo.save();
      this.toast.success('COMMON.SAVED_OK');
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
    }
  }
}
