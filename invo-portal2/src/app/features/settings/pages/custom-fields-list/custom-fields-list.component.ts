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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { SafeHtmlPipe } from '@core/pipes/safe-html.pipe';

import {
  CUSTOM_FIELD_ENTITY_TYPES,
  CustomFieldEntityType,
} from '../../models/custom-field.types';
import {
  CustomFieldEntityCount,
  CustomFieldsService,
} from '../../services/custom-fields.service';

interface EntityTypeRow extends CustomFieldEntityType {
  active:  number;
  deleted: number;
  label:   string;
}

/**
 * Settings → Custom Fields (list)
 *
 * Renders one card per entity type Invo supports custom fields on. Each
 * card carries the live counts of active / soft-deleted fields and
 * deep-links to the manager (`/settings/custom-fields/:type`). The
 * search box narrows the list by translated entity name.
 */
@Component({
  selector: 'app-custom-fields-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, BreadcrumbsComponent, SafeHtmlPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './custom-fields-list.component.html',
  styleUrl: './custom-fields-list.component.scss',
})
export class CustomFieldsListComponent implements OnInit {
  private service    = inject(CustomFieldsService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);

  loading = signal<boolean>(false);
  search  = signal<string>('');
  counts  = signal<Map<string, CustomFieldEntityCount>>(new Map());

  /** Re-translate labels after ngx-translate finishes loading. */
  private i18nTick = signal(0);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('SETTINGS.ITEMS.CUSTOM_FIELDS') },
    ];
  });

  /** Decorated rows — entity types + their counts + translated labels. */
  rows = computed<EntityTypeRow[]>(() => {
    this.i18nTick();
    const counts = this.counts();
    return CUSTOM_FIELD_ENTITY_TYPES.map((e) => ({
      ...e,
      label:   this.translate.instant(e.nameKey),
      active:  counts.get(e.type)?.active  ?? 0,
      deleted: counts.get(e.type)?.deleted ?? 0,
    }));
  });

  /** Filtered rows — narrowed by the search box. */
  filteredRows = computed<EntityTypeRow[]>(() => {
    const q = this.search().trim().toLowerCase();
    const all = this.rows();
    if (!q) return all;
    return all.filter((r) =>
      r.label.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q),
    );
  });

  /** Total active fields across all entity types — small KPI on the header. */
  totalActive = computed<number>(() => {
    let n = 0;
    this.counts().forEach((c) => (n += c.active));
    return n;
  });

  constructor() {
    withTranslations('settings');

    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const counts = await this.service.getCounts();
      this.counts.set(counts);
    } finally {
      this.loading.set(false);
    }
  }

  onSearchInput(value: string): void {
    this.search.set(value);
  }

  open(row: EntityTypeRow): void {
    this.router.navigate(['/settings/custom-fields', row.type]);
  }
}
