import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ToastService } from '@shared/components/toast/toast.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import { InvoiceStatusFilter } from './invoice-status-filter';
import { PluginFormBase } from './plugin-form.base';

/**
 * JordanFatoorah (JoFotara / ISTD) — fiscal reporting for Jordan.
 *
 * Configuration: tax name, client id, secret key (preserved secret),
 * tax number, activity number. Below the form, an invoice-tracking
 * table shows each invoice's JoFotara status with a re-sync action for
 * failed invoices.
 */
@Component({
  selector: 'app-plugin-jordanfatoorah',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PluginFormShellComponent, MycurrencyPipe],
  styleUrls: ['./plugin-fields.scss'],
  templateUrl: './jordanfatoorah.component.html',
})
export class JordanFatoorahComponent extends PluginFormBase implements OnInit {
  protected pluginName = 'JordanFatoorah';
  protected titleKey = 'PLUGINS.JOFOTARA.TITLE';

  private toastSvc = inject(ToastService);

  errors: { taxName?: boolean; clientId?: boolean; taxNumber?: boolean; activityNumber?: boolean } = {};

  // ── Invoice tracking ──────────────────────────────────────────────
  invoices = signal<any[]>([]);
  invLoading = signal(false);
  search = signal('');
  page = signal(1);
  pageCount = signal(1);
  readonly limit = 20;
  statuses = new InvoiceStatusFilter();

  async ngOnInit(): Promise<void> {
    await this.init(['secretKey']);
    void this.loadInvoices();
  }

  onChange(): void { this.markDirty(); if (this.submitted()) this.validate(); }

  private validate(): boolean {
    const s = this.plugin.settings;
    this.errors = {
      taxName: !(s.taxName ?? '').trim(),
      clientId: !(s.clientId ?? '').trim(),
      taxNumber: !(s.taxNumber ?? '').trim(),
      activityNumber: !(s.activityNumber ?? '').trim(),
    };
    return !Object.values(this.errors).some(Boolean);
  }

  save(): void {
    this.submitted.set(true);
    if (!this.validate()) return;
    const s = this.plugin.settings;
    const settings: Record<string, unknown> = {
      enable: !!s.enable,
      taxName: (s.taxName ?? '').trim(),
      clientId: (s.clientId ?? '').trim(),
      taxNumber: (s.taxNumber ?? '').trim(),
      activityNumber: (s.activityNumber ?? '').trim(),
    };
    if (this.shouldSendSecret('secretKey') && (s.secretKey ?? '').trim()) {
      settings['secretKey'] = (s.secretKey ?? '').trim();
    }
    void this.persist({ ...this.basePayload(), settings });
  }

  // ── Invoice table ─────────────────────────────────────────────────
  async loadInvoices(): Promise<void> {
    this.invLoading.set(true);
    try {
      const res = await this.service.getJordanFatoorahInvoices({
        page: this.page(),
        limit: this.limit,
        searchTerm: this.search().trim(),
        sortBy: {},
        // Full filter shape the backend expects — partial objects are
        // ignored. Only the status pills are wired in this view.
        filter: {
          sources: [],
          status: [],
          branches: [],
          jofotara_status: this.statuses.selected(),
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

  viewInvoice(id: string): void {
    void this.router.navigate(['/account/invoices/view', id]);
  }

  async resync(inv: any): Promise<void> {
    if (inv.isResyncing) return;
    if (!confirm(this.translate.instant('PLUGINS.INVOICES.RESYNC') + '?')) return;
    inv.isResyncing = true;
    try {
      const res: any = await this.service.resyncJordanInvoice(inv.id);
      if (res?.success) {
        inv.jofotara_status = 'QUEUED';
        this.toastSvc.success('PLUGINS.INVOICES.RESYNC_STARTED');
      } else {
        this.toastSvc.error(res?.msg || res?.message || 'PLUGINS.COMMON.SAVE_FAILED');
      }
    } finally {
      inv.isResyncing = false;
    }
  }
}
