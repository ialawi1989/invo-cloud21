import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ToastService } from '@shared/components/toast/toast.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { LanguageService } from '@core/i18n/language.service';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';

import { BranchTabsComponent }
  from '@features/products/pages/product-form/components/branch-product-section/branch-tabs/branch-tabs.component';
import {
  BranchTabRef,
  provideBranchTabs,
} from '@features/products/pages/product-form/components/branch-product-section/branch-tabs/branch-tabs.service';

import { PluginService } from '../../services/plugin.service';
import { BranchSettingsService } from '../../../services/branch-settings.service';
import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import { InvoiceStatusFilter } from './invoice-status-filter';

/** ZATCA EGS unit registration info (per branch). */
interface EgsInfo {
  uuid: string;
  VAT_name: string;
  branch_name: string;
  branch_industry: string;
  VAT_number: string;
  CRN_number: string;
  location: {
    city: string; city_subdivision: string; street: string;
    plot_identification: string; building: string; postal_zone: string;
  };
}

function emptyEgs(uuid = ''): EgsInfo {
  return {
    uuid, VAT_name: '', branch_name: '', branch_industry: '', VAT_number: '', CRN_number: '',
    location: { city: '', city_subdivision: '', street: '', plot_identification: '', building: '', postal_zone: '' },
  };
}

/**
 * ZATCA (Saudi Phase-2 e-invoicing).
 *
 * Per-branch EGS registration (organisation details + OTP → issue
 * compliance certificate) plus an invoice-tracking table showing each
 * invoice's clearance status with a re-sync action for failed ones.
 *
 * Doesn't extend PluginFormBase — there's no single plugin record to
 * save; registration is per-branch via `issueZatcaCertificate`.
 */
@Component({
  selector: 'app-plugin-zatca',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PluginFormShellComponent, MycurrencyPipe, BranchTabsComponent],
  providers: [provideBranchTabs('plugins.zatca.branches')],
  styleUrls: ['./plugin-fields.scss'],
  templateUrl: './zatca.component.html',
})
export class ZatcaComponent implements OnInit {
  private service   = inject(PluginService);
  private branchSvc = inject(BranchSettingsService);
  private toast     = inject(ToastService);
  private router    = inject(Router);
  private translate = inject(TranslateService);
  private lang      = inject(LanguageService);

  /** Branch directory shaped for the tab strip. */
  branchRefs = computed<BranchTabRef[]>(() =>
    this.branches().map(b => ({ id: b.id, name: b.name, isOnline: true })),
  );

  constructor() {
    // The reused branch-tabs UI addresses the PRODUCTS.* namespace.
    void this.lang.loadFeature('products');
  }

  onBranchChange(id: string): void {
    this.activeBranchId.set(id);
    if (!this.egs[id]) this.egs[id] = emptyEgs(id);
  }

  loading = signal(false);
  registering = signal(false);

  branches = signal<{ id: string; name: string }[]>([]);
  activeBranchId = signal('');
  egs: Record<string, EgsInfo> = {};
  otp = signal('');
  registered = signal<Record<string, boolean>>({});

  // Invoice tracking
  invoices = signal<any[]>([]);
  invLoading = signal(false);
  search = signal('');
  page = signal(1);
  pageCount = signal(1);
  readonly limit = 20;
  statuses = new InvoiceStatusFilter();

  breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
    { label: this.translate.instant('PLUGINS.LIST.TITLE'), routerLink: '/settings/plugins' },
    { label: this.translate.instant('PLUGINS.ZATCA.TITLE') },
  ]);

  get activeEgs(): EgsInfo | null {
    const id = this.activeBranchId();
    return id ? (this.egs[id] ??= emptyEgs(id)) : null;
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.branchSvc.getList({ limit: 200 });
      this.branches.set(res.list.map(b => ({ id: b.id, name: b.name })));
      if (this.branches().length) {
        const first = this.branches()[0];
        this.activeBranchId.set(first.id);
        this.egs[first.id] = emptyEgs(first.id);
      }
    } finally {
      this.loading.set(false);
    }
    void this.loadInvoices();
  }

  async register(): Promise<void> {
    const egs = this.activeEgs;
    if (!egs) return;
    this.registering.set(true);
    try {
      const res: any = await this.service.issueZatcaCertificate({ zatcaInfo: egs, OTP: this.otp() });
      if (res?.success) {
        this.registered.update(m => ({ ...m, [egs.uuid]: true }));
        this.toast.success('PLUGINS.ZATCA.REGISTERED');
      } else {
        this.toast.error(res?.msg || res?.message || 'PLUGINS.COMMON.SAVE_FAILED');
      }
    } finally {
      this.registering.set(false);
    }
  }

  isRegistered(): boolean { return !!this.registered()[this.activeBranchId()]; }

  // ── Invoice table ─────────────────────────────────────────────────
  async loadInvoices(): Promise<void> {
    this.invLoading.set(true);
    try {
      const res = await this.service.getZatcaInvoices({
        page: this.page(), limit: this.limit,
        searchTerm: this.search().trim(), sortBy: {},
        // Full filter shape the backend expects — partial objects are
        // ignored. Only the status pills are wired in this view.
        filter: {
          sources: [],
          status: [],
          branches: [],
          zatca_status: this.statuses.selected(),
          fromDate: null,
          toDate: null,
        },
      });
      this.invoices.set(res.list);
      this.pageCount.set(res.pageCount);
    } finally {
      this.invLoading.set(false);
    }
  }

  onSearch(v: string): void { this.search.set(v); this.page.set(1); void this.loadInvoices(); }
  toggleStatus(s: string): void { this.statuses.toggle(s); this.page.set(1); void this.loadInvoices(); }
  prevPage(): void { if (this.page() > 1) { this.page.update(p => p - 1); void this.loadInvoices(); } }
  nextPage(): void { if (this.page() < this.pageCount()) { this.page.update(p => p + 1); void this.loadInvoices(); } }

  statusClass = (s: string) => this.statuses.badgeClass(s);
  statusKey   = (s: string) => this.statuses.labelKey(s);

  viewInvoice(id: string): void { void this.router.navigate(['/account/invoices/view', id]); }

  async resync(inv: any): Promise<void> {
    if (inv.isResyncing) return;
    if (!confirm(this.translate.instant('PLUGINS.INVOICES.RESYNC') + '?')) return;
    inv.isResyncing = true;
    try {
      const res: any = await this.service.zatcaResyncInvoice(inv.id);
      if (res?.success) {
        inv.zatca_status = 'QUEUED';
        this.toast.success('PLUGINS.INVOICES.RESYNC_STARTED');
      } else {
        this.toast.error(res?.msg || res?.message || 'PLUGINS.COMMON.SAVE_FAILED');
      }
    } finally {
      inv.isResyncing = false;
    }
  }

  back(): void { void this.router.navigate(['/settings/plugins']); }
}
