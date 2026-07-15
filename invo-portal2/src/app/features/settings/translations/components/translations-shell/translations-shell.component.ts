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
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { withTranslations } from '@core/i18n/with-translations';
import { AiService } from '@core/ai/ai.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';
import { QueryParamsService } from '@shared/services/query-params.service';

import { translationGroups } from '../../translations.config';
import { TranslationsStore } from '../../services/translations.store';
import {
  TRANSLATION_QP,
  TranslationItemRef,
  TranslationStatusFilter,
} from '../../services/translation-api';

interface ItemOption {
  id: string;
  label: string;
}

/**
 * Persistent chrome for the Translation Manager — a single instance that
 * wraps the active group grid. Owns the sidebar (entity groups), the
 * header (target-language selector + word progress + actions menu) and
 * the toolbar (item / status filters + search). All toolbar state is
 * synced to the URL via {@link QueryParamsService}; the active grid reads
 * those params back and reloads.
 */
@Component({
  selector: 'app-translations-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    SearchDropdownComponent,
    DropdownMenuBtnComponent,
    SegmentedToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './translations-shell.component.html',
  styleUrl: './translations-shell.component.scss',
})
export class TranslationsShellComponent implements OnInit {
  protected store = inject(TranslationsStore);
  private translate = inject(TranslateService);
  private route = inject(ActivatedRoute);
  private qp = inject(QueryParamsService);
  private destroyRef = inject(DestroyRef);
  private ai = inject(AiService);

  /** True once the company Content AI plugin is enabled + keyed — gates the
   *  auto-translate actions. Mirrored onto the store so the grid's
   *  "Auto-translate selected" button can read it too. */
  protected aiAvailable = this.store.aiAvailable;

  readonly groups = translationGroups();

  // Toolbar state — seeded from the URL, written back on change.
  search = signal<string>('');
  /** Immediate echo of the search box; `search` is the debounced commit. */
  searchDraft = signal<string>('');
  status = signal<TranslationStatusFilter>('all');
  item = signal<string>('');

  private i18nTick = signal(0);
  private searchInput$ = new Subject<string>();

  // ─── Header: current language (from the :lang route) ────────────────
  currentLangLabel = computed<string>(() => this.store.langLabel(this.store.targetLang()));

  progressPct = computed<number>(() => {
    const { translated, total } = this.store.progress();
    return total > 0 ? Math.round((translated / total) * 100) : 0;
  });

  // ─── Header: actions menu ───────────────────────────────────────────
  actionItems = computed<DropdownMenuBtnItem[]>(() => {
    this.i18nTick();
    const busy = this.store.busy();
    const items: DropdownMenuBtnItem[] = [
      {
        label: 'TRANSLATIONS.ACTIONS.EXPORT',
        disabled: busy,
        iconPath: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2',
        click: () => this.store.emit('export'),
      },
      {
        label: 'TRANSLATIONS.ACTIONS.IMPORT',
        disabled: busy,
        iconPath: 'M12 21V9m0 0l-4 4m4-4l4 4M4 7V5a2 2 0 012-2h12a2 2 0 012 2v2',
        click: () => this.store.emit('import'),
      },
    ];
    // "Auto-translate everything" is offered only for the fixed-size UI
    // strings (bounded set); other entities can hold thousands of rows, so
    // there it's driven per-selection from the grid's bulk bar instead.
    if (this.aiAvailable() && this.store.canAutoTranslateAll()) {
      items.push({
        label: 'TRANSLATIONS.ACTIONS.AUTO_TRANSLATE',
        separator: true,
        disabled: busy,
        iconPath: 'M4 5h7M9 3v2c0 4-2 7-5 9m3-4c0 2 2 4 5 5M14 21l4-9 4 9m-7-3h6',
        click: () => this.store.emit('auto-translate'),
      });
    }
    items.push({
      label: 'TRANSLATIONS.ACTIONS.RESET_ALL',
      separator: true,
      danger: true,
      disabled: busy,
      iconPath: 'M3 12a9 9 0 1 0 9-9 9 9 0 0 0-7 3.3M3 4v4h4',
      click: () => this.store.emit('reset-all'),
    });
    return items;
  });

  // ─── Toolbar: filters ───────────────────────────────────────────────
  itemOptions = computed<ItemOption[]>(() => {
    this.i18nTick();
    const all: ItemOption = { id: '', label: this.translate.instant('TRANSLATIONS.TOOLBAR.ALL_ITEMS') };
    const items = this.store.items().map((i: TranslationItemRef) => ({ id: i.id, label: i.label }));
    return [all, ...items];
  });
  itemDisplay = (i: ItemOption) => i.label;
  itemCompare = (a: ItemOption, b: ItemOption) => a?.id === b?.id;
  selectedItem = computed<ItemOption | null>(
    () => this.itemOptions().find(o => o.id === this.item()) ?? null,
  );

  statusOptions = computed<SegmentedToggleOption<TranslationStatusFilter>[]>(() => {
    this.i18nTick();
    return [
      { value: 'all',            label: 'TRANSLATIONS.TOOLBAR.ALL_STATUSES' },
      { value: 'not-translated', label: 'TRANSLATIONS.STATUS.NOT_TRANSLATED' },
      { value: 'translated',     label: 'TRANSLATIONS.STATUS.TRANSLATED' },
      { value: 'needs-update',   label: 'TRANSLATIONS.STATUS.NEEDS_UPDATE' },
    ];
  });

  constructor() {
    withTranslations('settings/translations');

    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));

    // Debounced free-text search commits to the URL.
    this.searchInput$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        this.search.set(value);
        this.syncUrl(true);
      });

    // The editor is scoped to the `:lang` route param — drive the store's
    // target language from it so the grids load that language.
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(pm => {
        const code = pm.get('lang');
        if (code) this.store.setTargetLang(code);
      });

    // Re-seed the toolbar when the URL params change externally — e.g. a
    // sidebar group switch drops the query string, so the filters must
    // reset to match rather than showing stale values.
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const p = this.qp.read(TRANSLATION_QP);
        this.status.set(p.status);
        this.item.set(p.item);
        if (p.search !== this.search()) {
          this.search.set(p.search);
          this.searchDraft.set(p.search);
        }
      });
  }

  ngOnInit(): void {
    const p = this.qp.read(TRANSLATION_QP);
    this.search.set(p.search);
    this.searchDraft.set(p.search);
    this.status.set(p.status);
    this.item.set(p.item);

    // Resolve Content AI availability (enabled + key stored) to gate the
    // Auto-translate action. Fails soft to hidden on any error.
    void this.ai.getCompanySettings()
      .then(s => this.aiAvailable.set(s.enabled && s.apiKeySet))
      .catch(() => this.aiAvailable.set(false));
  }

  // ─── URL sync ───────────────────────────────────────────────────────
  private syncUrl(resetPage = false): void {
    const current = this.qp.read(TRANSLATION_QP);
    this.qp.write(TRANSLATION_QP, {
      page: resetPage ? 1 : current.page,
      limit: current.limit,
      search: this.search(),
      status: this.status(),
      item: this.item(),
    });
  }

  // ─── Toolbar handlers ───────────────────────────────────────────────
  onSearchInput(value: string): void {
    this.searchDraft.set(value);
    this.searchInput$.next(value);
  }

  clearSearch(): void {
    this.searchDraft.set('');
    this.search.set('');
    this.syncUrl(true);
  }

  onStatus(value: TranslationStatusFilter): void {
    this.status.set(value);
    this.syncUrl(true);
  }

  onItem(option: ItemOption | ItemOption[] | null): void {
    const picked = Array.isArray(option) ? option[0] : option;
    this.item.set(picked?.id ?? '');
    this.syncUrl(true);
  }
}
