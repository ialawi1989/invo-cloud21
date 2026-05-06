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
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { map, debounceTime } from 'rxjs/operators';
import { Subject } from 'rxjs';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ErrorService } from '@core/http/error.service';
import { ModalService } from '@shared/modal/modal.service';
import { AssignTaxModalComponent } from '@shared/components/assign-tax-modal/assign-tax-modal.component';

import { TaxSettingsService } from '../../services/tax-settings.service';

@Component({
  selector: 'app-tax-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tax-settings.component.html',
  styleUrl: './tax-settings.component.scss',
})
export class TaxSettingsComponent implements OnInit {
  private translate    = inject(TranslateService);
  private destroyRef   = inject(DestroyRef);
  private taxService   = inject(TaxSettingsService);
  private errorService = inject(ErrorService);
  private router       = inject(Router);
  private route        = inject(ActivatedRoute);
  private modal        = inject(ModalService);

  private i18nTick      = signal(0);
  private searchSubject = new Subject<string>();

  loading        = signal(false);
  taxes          = signal<any[]>([]);
  pageNum        = signal(1);
  pageLimit      = signal(10);
  searchTerm     = signal('');
  openDropdownId = signal<string | null>(null);

  constructor() {
    withTranslations('settings');

    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: ['/settings'] },
      { label: this.translate.instant('SETTINGS.ITEMS.TAX_SETTINGS') },
    ];
  });

  ngOnInit(): void {
    this.searchSubject
      .pipe(debounceTime(600), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => {
        this.searchTerm.set(term);
        this.pageNum.set(1);
        this.updateQueryParams();
      });

    this.route.queryParamMap
      .pipe(
        map(params => ({
          page:   parseInt(params.get('page')   ?? '1',  10),
          limit:  parseInt(params.get('limit')  ?? '10', 10),
          search: params.get('search') ?? '',
        })),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(params => {
        this.pageNum.set(params.page);
        this.pageLimit.set(params.limit);
        this.searchTerm.set(params.search);
        this.loadTaxes();
      });
  }

  private async loadTaxes(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.taxService.getTaxesList({
        page:       this.pageNum(),
        limit:      this.pageLimit(),
        searchTerm: this.searchTerm(),
      });
      this.taxes.set(res.list || res || []);
    } catch (error) {
      await this.errorService.handleError(error);
    } finally {
      this.loading.set(false);
    }
  }

  private updateQueryParams(): void {
    const params: any = {
      page:   this.pageNum()    > 1   ? this.pageNum()    : null,
      limit:  this.pageLimit() !== 10 ? this.pageLimit()  : null,
      search: this.searchTerm() || null,
    };
    this.router.navigate([], { relativeTo: this.route, queryParams: params });
  }

  async setAsDefault(taxId: string): Promise<void> {
    try {
      await this.taxService.setDefaultTax(taxId);
      await this.loadTaxes();
    } catch (error) {
      await this.errorService.handleError(error);
    }
  }

  onSearch(term: string): void { this.searchSubject.next(term); }

  clearSearch(): void {
    this.searchTerm.set('');
    this.pageNum.set(1);
    this.updateQueryParams();
  }

  nextPage(): void { this.pageNum.update(n => n + 1); this.updateQueryParams(); }
  prevPage(): void { this.pageNum.update(n => Math.max(1, n - 1)); this.updateQueryParams(); }

  addTax(): void {
    this.router.navigate(['/settings/tax/new']);
  }

  editTax(tax: any): void {
    if (tax.name === 'Exempt Tax' || tax.name === 'Zero Tax' || tax.default) return;
    this.router.navigate(['/settings/tax', tax.id]);
  }

  toggleDropdown(taxId: string, event: Event): void {
    event.stopPropagation();
    this.openDropdownId.set(this.openDropdownId() === taxId ? null : taxId);
  }

  async assignTo(taxId: string): Promise<void> {
    this.openDropdownId.set(null);
    const ref = this.modal.open(AssignTaxModalComponent, {
      size: 'md',
      closeable: true,
      closeOnBackdrop: true,
      data: { taxId },
    });
    const params = await ref.afterClosed();
    if (params) {
      try {
        await this.taxService.assignTax(params);
        await this.loadTaxes();
      } catch (error) {
        await this.errorService.handleError(error);
      }
    }
  }
}
