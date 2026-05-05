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
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';

import {
  DEFAULT_PREFIX_MAP,
  PREFIX_MODULE_ORDER,
  PrefixEntry,
  PrefixMap,
  PrefixModule,
  PrefixSettingsService,
  buildPreview,
} from '../../services/prefix-settings.service';

interface PrefixRow {
  module:       PrefixModule;
  /** Translated display name (e.g. "Invoice"). */
  label:        string;
  /** Inline-editable prefix template — supports `{YYYY}`, `{YY}`, `{MM}`, `{DD}`. */
  prefix:       string;
  /** Zero-pad width for the trailing serial number. */
  width:        number;
  /** Live preview ("INV-2026001") — recomputed on every edit. */
  preview:      string;
  /** Validation flags */
  prefixError:  null | 'required' | 'duplicate';
  widthError:   null | 'range';
}

/**
 * Settings → Prefix Settings
 * ──────────────────────────
 * Edits the per-document-type prefix template + zero-pad width.
 * Replaces the legacy edit-row pattern with always-editable cards
 * that show a live preview as the user types — saves a click and
 * surfaces token expansion (`{YYYY}` → "2026") immediately.
 *
 * Implements `CanLeaveComponent` so the unsaved-changes guard prompts
 * before navigation when the form is dirty.
 */
@Component({
  selector: 'app-prefix-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prefix-settings.component.html',
  styleUrl: './prefix-settings.component.scss',
})
export class PrefixSettingsComponent implements OnInit, CanLeaveComponent {
  private service    = inject(PrefixSettingsService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** Current row state — mutated as the user types. */
  rows = signal<PrefixRow[]>([]);

  /** Snapshot of `rows` at load (and after each successful save) so we
   *  can detect dirtiness and revert. Held as a signal — the dirtiness
   *  computed reads it, so updating it on save invalidates the cache
   *  and the leave-confirm guard sees the fresh state. */
  private snapshot = signal<PrefixRow[]>([]);

  /** Re-translate row labels when ngx-translate finishes loading. */
  private i18nTick = signal(0);

  // ─── Derived ───────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('SETTINGS.ITEMS.PREFIX_SETTINGS') },
    ];
  });

  isDirty = computed<boolean>(() => {
    const cur  = this.rows();
    const snap = this.snapshot();
    if (cur.length !== snap.length) return true;
    return cur.some((r, i) => {
      const s = snap[i];
      return !s || s.prefix !== r.prefix || s.width !== r.width;
    });
  });

  /** Page-level validity: every row must be valid. */
  isValid = computed<boolean>(() =>
    this.rows().every((r) => !r.prefixError && !r.widthError),
  );

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  constructor() {
    withTranslations('settings');
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshLabels());
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshLabels());
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const stored = await this.service.getAll();
      const merged = this.mergeWithDefaults(stored);
      const rows   = this.buildRows(merged);
      this.rows.set(rows);
      this.snapshot.set(rows.map(clone));
      this.revalidateAll();
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Editing ───────────────────────────────────────────────────────────
  patchPrefix(module: PrefixModule, value: string): void {
    this.rows.update((list) =>
      list.map((r) => {
        if (r.module !== module) return r;
        const next: PrefixRow = { ...r, prefix: value };
        next.preview = buildPreview({ prefix: value, width: r.width });
        return next;
      }),
    );
    this.revalidateAll();
  }

  patchWidth(module: PrefixModule, raw: number | string): void {
    const n = Number(raw);
    const width = Number.isFinite(n) ? n : 0;
    this.rows.update((list) =>
      list.map((r) => {
        if (r.module !== module) return r;
        const next: PrefixRow = { ...r, width };
        next.preview = buildPreview({ prefix: r.prefix, width });
        return next;
      }),
    );
    this.revalidateAll();
  }

  /** Reset one row back to its on-load state. */
  revertRow(module: PrefixModule): void {
    const snap = this.snapshot().find((s) => s.module === module);
    if (!snap) return;
    this.rows.update((list) =>
      list.map((r) =>
        r.module === module
          ? { ...clone(snap), preview: buildPreview({ prefix: snap.prefix, width: snap.width }) }
          : r,
      ),
    );
    this.revalidateAll();
  }

  /** Reset every row back to factory defaults (not the load snapshot). */
  resetToDefaults(): void {
    this.rows.update((list) =>
      list.map((r) => {
        const def = DEFAULT_PREFIX_MAP[r.module];
        return {
          ...r,
          prefix:  def.prefix,
          width:   def.width,
          preview: buildPreview(def),
        };
      }),
    );
    this.revalidateAll();
  }

  // ─── Save / cancel ─────────────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.isValid()) return;
    this.saving.set(true);
    try {
      const map: PrefixMap = {};
      for (const r of this.rows()) {
        map[r.module] = { prefix: r.prefix.trim(), width: clamp(r.width, 1, 10) };
      }
      const ok = await this.service.save(map);
      if (ok) {
        this.snapshot.set(this.rows().map(clone));
        this.router.navigate(['/settings']);
      }
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/settings']);
  }

  // ─── CanDeactivate hook ────────────────────────────────────────────────
  hasUnsavedChanges(): boolean {
    return this.isDirty() && !this.saving();
  }

  // ─── Internal ──────────────────────────────────────────────────────────
  private mergeWithDefaults(stored: PrefixMap): Record<PrefixModule, PrefixEntry> {
    const out = { ...DEFAULT_PREFIX_MAP };
    for (const m of PREFIX_MODULE_ORDER) {
      const e = stored[m];
      if (e) out[m] = { prefix: e.prefix, width: e.width };
    }
    return out;
  }

  private buildRows(map: Record<PrefixModule, PrefixEntry>): PrefixRow[] {
    return PREFIX_MODULE_ORDER.map<PrefixRow>((m) => ({
      module:      m,
      label:       this.translate.instant('SETTINGS.PREFIX.MODULES.' + m.toUpperCase()),
      prefix:      map[m].prefix,
      width:       map[m].width,
      preview:     buildPreview(map[m]),
      prefixError: null,
      widthError:  null,
    }));
  }

  private refreshLabels(): void {
    this.i18nTick.update((n) => n + 1);
    this.rows.update((list) =>
      list.map((r) => ({
        ...r,
        label: this.translate.instant('SETTINGS.PREFIX.MODULES.' + r.module.toUpperCase()),
      })),
    );
  }

  /** Re-evaluate validation for the whole table (uniqueness is cross-row). */
  private revalidateAll(): void {
    this.rows.update((list) => {
      // Build a lookup of trimmed lowercase prefixes → modules to detect dupes.
      const seen = new Map<string, number>();
      for (const r of list) {
        const key = r.prefix.trim().toLowerCase();
        if (!key) continue;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      return list.map((r) => {
        const trimmed = r.prefix.trim();
        const prefixError: PrefixRow['prefixError'] =
          !trimmed
            ? 'required'
            : (seen.get(trimmed.toLowerCase()) ?? 0) > 1
              ? 'duplicate'
              : null;
        const widthError: PrefixRow['widthError'] =
          r.width >= 1 && r.width <= 10 ? null : 'range';
        return { ...r, prefixError, widthError };
      });
    });
  }
}

// ─── Free helpers ────────────────────────────────────────────────────────
function clone<T>(o: T): T { return JSON.parse(JSON.stringify(o)); }
function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }
