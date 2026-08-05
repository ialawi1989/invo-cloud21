import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { withTranslations } from '@core/i18n/with-translations';
import { CompanyService } from '@core/auth/company.service';
import { StorefrontUrlService } from '@core/auth/storefront-url.service';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';

import { SeoVarInputComponent } from '../seo-var-input/seo-var-input.component';
import { SeoSettingsService } from '../../services/seo.service';
import type { SeoPageRow, SeoStructuredDataItem } from '../../services/seo.types';
import {
  evaluateAssistant,
  SeoSeverity,
} from '../../services/seo-assistant';

export interface SeoPageEditorData {
  row:      SeoPageRow;
  typeSlug: string;
}

type Tab = 'assistant' | 'basics' | 'advanced' | 'social';

/** Sub-view inside the Advanced tab. The root list shows three
 *  cards (structured / robots / additional); each click swaps the
 *  panel to the matching detail view with a "Back" affordance. */
type AdvancedView = 'list' | 'structured' | 'robots' | 'additional';

/**
 * SEO Page Editor — side-panel modal opened from the Edit-by-page
 * row. Three tabs:
 *
 *   • Basics       — Title tag, Meta description, Page URL slug,
 *                    per-page index toggle. Includes a Google
 *                    search-result preview on top.
 *   • Advanced     — Per-page robots overrides + structured-data
 *                    JSON-LD blob.
 *   • Social share — og:title / og:description / og:image plus the
 *                    X (Twitter) overrides.
 *
 * The modal works on a local *draft* so partial edits don't bleed
 * into the parent list until the user hits Publish. Cancel closes
 * the panel with no return value — parent component leaves its row
 * unchanged.
 */
@Component({
  selector: 'app-seo-page-editor-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    ToggleComponent,
    SegmentedToggleComponent,
    TooltipDirective,
    SeoVarInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './seo-page-editor-modal.component.html',
  styleUrl: './seo-page-editor-modal.component.scss',
})
export class SeoPageEditorModalComponent {
  private ref        = inject<ModalRef<SeoPageRow>>(MODAL_REF);
  private data       = inject<SeoPageEditorData>(MODAL_DATA);
  private seo        = inject(SeoSettingsService);
  private companies  = inject(CompanyService);
  private storefront = inject(StorefrontUrlService);

  /** Site name shown in the Google preview header and in the
   *  `{{ siteName }}` substitution. Falls back to a neutral
   *  placeholder when the company hasn't named the store yet. */
  readonly siteName = computed(() => this.companies.currentCompanyName() || 'My Store');

  /** First letter of the site name, upper-cased — used as the
   *  favicon stand-in inside the Google preview card so it carries
   *  the tenant's brand instead of a hardcoded letter. */
  readonly siteInitial = computed(() => (this.siteName().trim()[0] ?? 'I').toUpperCase());

  /** Full live URL for the current row — `https://host/path`.
   *  Drives the Google preview URL line and the "view live" hint
   *  so the user sees exactly where the page will resolve. */
  readonly liveUrl = computed(() => this.storefront.pageUrl(this.data.row.pageUrl));

  /** Live URL of the *draft* path, so the preview's title link follows the
   *  slug the user is editing rather than the one they opened with. */
  readonly livePreviewUrl = computed(() => this.storefront.pageUrl(this.draft().pageUrl));

  /** Bare host (no protocol) of the live storefront — used by the
   *  social-share preview to mimic what the OG card will show. */
  readonly siteHost = computed(() => {
    try { return new URL(this.storefront.baseUrl()).host; }
    catch { return 'invopos.shop'; }
  });

  /** Same host upper-cased for the Facebook preview chrome which
   *  draws URLs in caps. */
  readonly siteHostUpper = computed(() => this.siteHost().toUpperCase());

  constructor() {
    // Modal can open from any context (settings/seo page-type, the
    // product form, future blog/bookings sections), so it has to
    // load its own translation namespace rather than rely on a
    // parent route having done it.
    withTranslations('settings/seo');
  }

  // Working draft — seeded from the row the parent passed in.
  draft = signal<SeoPageRow>({ ...this.data.row });

  // Tab state — Assistant opens first because it surfaces the
  // outstanding optimization checks at a glance; users can drill
  // into Basics / Advanced / Social to fix individual items.
  activeTab = signal<Tab>('assistant');
  readonly tabOptions: SegmentedToggleOption<Tab>[] = [
    { value: 'assistant', label: 'SEO.PAGE_EDITOR.ASSISTANT' },
    { value: 'basics',    label: 'SEO.PAGE_EDITOR.BASICS' },
    { value: 'advanced',  label: 'SEO.PAGE_EDITOR.ADVANCED' },
    { value: 'social',    label: 'SEO.PAGE_EDITOR.SOCIAL_SHARE' },
  ];

  // ─── SEO Assistant ──────────────────────────────────────────────────────
  /** Live task evaluation driven by the draft. Re-runs on every
   *  field edit (signals recompute) so the user sees the count and
   *  green ticks flip immediately as they fix things. */
  assistant = computed(() => {
    const row = this.draft();
    const site = this.seo.document()?.sitePreferences;
    return evaluateAssistant({
      row,
      siteIndexable:  site?.allowIndexing ?? true,
      defaultOgImage: site?.generalOgImage ?? '',
    });
  });

  /** Severity columns rendered as the four header cards. Each entry
   *  carries the failure count for that severity so the template
   *  can switch between the ✓ badge and the bare number. */
  readonly severityRows: { key: SeoSeverity; labelKey: string }[] = [
    { key: 'critical', labelKey: 'SEO.ASSISTANT.SEVERITY.CRITICAL' },
    { key: 'high',     labelKey: 'SEO.ASSISTANT.SEVERITY.HIGH'     },
    { key: 'medium',   labelKey: 'SEO.ASSISTANT.SEVERITY.MEDIUM'   },
    { key: 'low',      labelKey: 'SEO.ASSISTANT.SEVERITY.LOW'      },
  ];

  severityBadgeKey(sev: SeoSeverity): string {
    return `SEO.ASSISTANT.SEVERITY.${sev.toUpperCase()}`;
  }

  /** Convert a task's `labelKey` (`SEO.ASSISTANT.TASK.KEYWORD_IN_H1`)
   *  into the matching long-form body key under `SEO.ASSISTANT.BODY.*`
   *  so the expanded row can render the "why this matters" copy
   *  without each call site repeating the string surgery. */
  bodyKeyFor(labelKey: string): string {
    return labelKey.replace('.TASK.', '.BODY.');
  }

  /** Per-task fix UI dispatch. Multiple tasks share the same editor
   *  (e.g. all three title-related tasks open the title-tag input)
   *  so we map a task id to one of a small set of "fix types" and
   *  the template uses `@switch` once.
   *
   *  Tasks that can only be fixed by editing the page content itself
   *  (H1, body, subheadings, images, hreflang, visual content) fall
   *  through to `'instructional'` — the modal renders the task body
   *  copy and the user resolves it in the source page. Structured
   *  data has a dedicated `'structured'` shortcut that jumps to the
   *  Advanced tab's Markup card. */
  fixUiFor(
    taskId: string,
  ): 'index' | 'title' | 'meta' | 'url' | 'og-title'
    | 'structured' | 'instructional' | null {
    switch (taskId) {
      case 'indexable':            return 'index';
      case 'has-title-tag':
      case 'keyword-in-title':
      case 'title-length':         return 'title';
      case 'has-meta-desc':
      case 'keyword-in-meta-desc':
      case 'meta-length':          return 'meta';
      case 'keyword-in-url':
      case 'meaningful-slug':      return 'url';
      case 'og-title-set':         return 'og-title';
      case 'has-structured-data':  return 'structured';
      case 'has-focus-keyword':
      case 'has-og-image':
      case 'keyword-in-h1':
      case 'keyword-in-body':
      case 'keyword-in-subheading':
      case 'images-have-alt-text':
      case 'has-visual-content':
      case 'has-hreflang':         return 'instructional';
    }
    return null;
  }

  /** Jump the user to the Advanced › Structured data sub-screen from
   *  inside the assistant tab. Used by the `'structured'` fix UI. */
  jumpToStructured(): void {
    this.setTab('advanced');
    this.advancedView.set('structured');
  }

  /** External Semrush keyword-research deep link — opens in a new
   *  tab. Invo uses Semrush; we keep the same URL so the i18n copy
   *  stays accurate ("Get ideas from Semrush"). */
  readonly keywordIdeasUrl = 'https://www.semrush.com/analytics/keywordoverview/';

  /** Currently expanded task id — only one row open at a time. */
  expandedTaskId = signal<string | null>(null);

  /** Snapshot of the draft taken when the user expands a task, so
   *  the Cancel button can restore everything the task's fix UI
   *  might have touched. Stored outside `signal()` because we don't
   *  need reactivity on it — only Cancel reads it. */
  private taskSnapshot: SeoPageRow | null = null;

  /** Best practices accordion inside the focus-keyword card. */
  bestPracticesOpen = signal(false);
  toggleBestPractices(): void { this.bestPracticesOpen.update(v => !v); }

  /** Expand / collapse a task row. Re-clicking the open row
   *  collapses it; clicking another row swaps the snapshot to that
   *  row's starting state. */
  toggleTask(id: string): void {
    if (this.expandedTaskId() === id) {
      this.collapseTask();
      return;
    }
    this.taskSnapshot = { ...this.draft() };
    this.expandedTaskId.set(id);
  }

  /** Commit the in-progress edits — nothing to do beyond closing
   *  the row, since edits already flowed into `draft()` via the
   *  inline inputs. Drops the snapshot so subsequent expand/collapse
   *  cycles don't restore stale data. */
  applyTask(): void {
    this.taskSnapshot = null;
    this.expandedTaskId.set(null);
  }

  /** Revert every field the task might have touched back to its
   *  pre-expand state and close the row. */
  cancelTask(): void {
    if (this.taskSnapshot) {
      this.draft.set(this.taskSnapshot);
      this.taskSnapshot = null;
    }
    this.expandedTaskId.set(null);
  }

  private collapseTask(): void {
    this.taskSnapshot = null;
    this.expandedTaskId.set(null);
  }

  /** Remove the focus keyword from the draft entirely. */
  removeFocusKeyword(): void { this.patch({ focusKeyword: '' }); }

  // ─── Derived for previews ───────────────────────────────────────────────
  /** Resolved title rendered in the Google preview — falls back to
   *  the per-type default template when the row's titleTag is blank. */
  previewTitle = computed(() => {
    const d = this.draft();
    if (d.titleTag) return d.titleTag;
    const tpl = this.seo.pageType(this.data.typeSlug).defaults.basics.titleTagTemplate;
    return tpl.replace('{{ pageName }}', d.pageName).replace('{{ siteName }}', this.siteName());
  });

  /** Site-wide indexing flag — when off, the per-page toggle shows
   *  a yellow "site indexing is off" notice. */
  siteIndexingAllowed = computed(
    () => this.seo.document()?.sitePreferences.allowIndexing ?? true,
  );

  // ─── Advanced sub-views ────────────────────────────────────────────────
  /** Which Advanced sub-screen is rendered. Starts on the list of
   *  three cards and drills down on click. */
  advancedView = signal<AdvancedView>('list');
  setAdvancedView(v: AdvancedView): void { this.advancedView.set(v); }

  /** Inline "Add new markup" form state. When `addingMarkup()` is
   *  true the structured-data view shows the form below the list,
   *  matching the Invo nested-modal UX without spawning a real
   *  second-level modal. */
  addingMarkup    = signal(false);
  newMarkupName   = signal('');
  newMarkupCode   = signal('');
  startAddMarkup(): void {
    this.newMarkupName.set('');
    this.newMarkupCode.set('');
    this.addingMarkup.set(true);
  }
  cancelAddMarkup(): void { this.addingMarkup.set(false); }
  applyMarkup(): void {
    const name = this.newMarkupName().trim();
    const code = this.newMarkupCode().trim();
    if (!name || !code) return;
    const next = [...(this.draft().structuredData ?? []), { name, code }];
    this.patch({ structuredData: next });
    this.addingMarkup.set(false);
  }
  removeMarkup(i: number): void {
    const next = (this.draft().structuredData ?? []).filter((_, idx) => idx !== i);
    this.patch({ structuredData: next.length ? next : undefined });
  }

  /** "X Settings" collapsible — defaults open if the user already
   *  has overrides on any X field. */
  xExpanded = signal(false);
  toggleX(): void { this.xExpanded.update(v => !v); }

  // ─── Mutations on the draft ─────────────────────────────────────────────
  patch(p: Partial<SeoPageRow>): void {
    this.draft.update(d => ({ ...d, ...p }));
  }

  /** Sparse patch for the per-page robots overrides. Undefined keys
   *  on the patch drop back to the per-type default, so callers
   *  pass only what they want to change. */
  patchRobots(p: Partial<NonNullable<SeoPageRow['robots']>>): void {
    this.patch({ robots: { ...(this.draft().robots ?? {}), ...p } });
  }

  // Identity helper for *ngFor / @for tracking on structured-data items.
  trackMarkup = (i: number, m: SeoStructuredDataItem) => `${i}:${m.name}`;

  // ─── Actions ────────────────────────────────────────────────────────────
  cancel():  void { this.ref.dismiss(); }
  publish(): void { this.ref.close(this.draft()); }
  setTab(t: Tab): void {
    this.activeTab.set(t);
    this.advancedView.set('list');
    this.addingMarkup.set(false);
  }
}
