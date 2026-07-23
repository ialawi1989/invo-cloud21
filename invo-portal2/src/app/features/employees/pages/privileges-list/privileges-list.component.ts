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
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { EmployeePrivilege } from '@core/auth/privileges/models/privilege.model';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { ListShellComponent } from '@shared/components/list-shell/list-shell.component';
import {
  QueryParamsService,
  ParamDef,
  IntCodec,
  intCodec,
  StringCodec,
} from '@shared/services/query-params.service';

const QP = {
  page:     { key: 'page',  codec: IntCodec }     as ParamDef<number>,
  pageSize: { key: 'limit', codec: intCodec(20) } as ParamDef<number>,
  search:   { key: 'q',     codec: StringCodec }  as ParamDef<string>,
};

/**
 * Privileges list
 * ───────────────
 * Reusable permission-set records that can be assigned to employees.
 * Reuses the core {@link PrivilegeService} CRUD (shared with the auth layer).
 */
@Component({
  selector: 'app-privileges-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, ListShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './privileges-list.component.html',
  styleUrl: './privileges-list.component.scss',
})
export class PrivilegesListComponent implements OnInit {
  private service    = inject(PrivilegeService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);
  private qp         = inject(QueryParamsService);

  loading = signal<boolean>(false);
  rows    = signal<EmployeePrivilege[]>([]);
  total   = signal<number>(0);

  search   = signal<string>('');
  page     = signal<number>(1);
  pageSize = signal<number>(20);

  private i18nTick = signal(0);

  canAdd = this.service.check('privilegeSecurity.actions.add.access');

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('EMPLOYEES.TITLE'), routerLink: '/employees' },
      { label: this.translate.instant('EMPLOYEES.PRIVILEGES.TITLE') },
    ];
  });

  pageCount = computed<number>(() => {
    const total = this.total();
    const limit = this.pageSize();
    return total > 0 ? Math.ceil(total / limit) : 1;
  });

  rangeLabel = computed<string>(() => {
    this.i18nTick();
    const total = this.total();
    if (total === 0) return '';
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end   = Math.min(this.page() * this.pageSize(), total);
    return this.translate.instant('COMMON.PAGINATION_RANGE', { start, end, total });
  });

  constructor() {
    withTranslations('employees');

    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const p = this.qp.read(QP);
    this.page.set(p.page);
    this.pageSize.set(p.pageSize);
    this.search.set(p.search);
    await this.load();
  }

  private syncUrl(): void {
    this.qp.write(QP, {
      page:     this.page(),
      pageSize: this.pageSize(),
      search:   this.search(),
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.service.getPrivilegeList({
        page:       this.page(),
        limit:      this.pageSize(),
        searchTerm: this.search().trim(),
        sortBy:     {},
      });
      // With params, the service returns { list, count }.
      const list  = Array.isArray(res) ? res : res.list;
      const count = Array.isArray(res) ? res.length : res.count;
      this.rows.set(list);
      this.total.set(count);
    } finally {
      this.loading.set(false);
    }
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    this.syncUrl();
    void this.load();
  }

  clearSearch(): void {
    this.search.set('');
    this.page.set(1);
    this.syncUrl();
    void this.load();
  }

  goPrev(): void {
    if (this.page() <= 1) return;
    this.page.update(p => p - 1);
    this.syncUrl();
    this.load();
  }

  goNext(): void {
    if (this.page() >= this.pageCount()) return;
    this.page.update(p => p + 1);
    this.syncUrl();
    this.load();
  }

  add(): void {
    this.router.navigate(['/employees/privileges', 0]);
  }

  edit(p: EmployeePrivilege): void {
    this.router.navigate(['/employees/privileges', p.id]);
  }
}
