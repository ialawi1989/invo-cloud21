import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ModalService } from '@shared/modal/modal.service';

import '../../domain-settings-i18n';
import { CERT_TERMINAL_FAIL, DomainSettings, RegisterDomainPayload, emptyDomainSettings } from '../../models/domain-settings.model';
import { DomainSettingsService } from '../../services/domain-settings.service';
import { DNS_PROVIDERS } from './dns-providers';

type Mode = 'subdomain' | 'custom';

const POLL_INTERVAL_MS = 30_000;
const POLL_MAX_MS = 30 * 60_000;

/**
 * Domain settings (`/domain-settings`) - legacy `DomainSettingsComponent`, a three-step wizard:
 *  1. Register: a subdomain of the customer's domain (approved at once) or the root domain (an ACM certificate is requested).
 *  2. Verify DNS (root domain only): add the validation CNAME(s); the page polls every 30s (up to 30 min) until the certificate is ISSUED.
 *  3. Connect: once approved, add the DNS record pointing the host at the CloudFront domain.
 */
@Component({
  selector: 'app-domain-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, BreadcrumbsComponent, EmptyStateComponent, LoadingOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './domain-settings.component.html',
  styleUrl: './domain-settings.component.scss',
})
export class DomainSettingsComponent implements OnInit {
  private service = inject(DomainSettingsService);
  private lang = inject(LanguageService);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);

  readonly providers = DNS_PROVIDERS;

  readonly breadcrumbs = signal<BreadcrumbItem[]>([]);
  readonly data = signal<DomainSettings>(emptyDomainSettings());
  readonly loading = signal(true);
  readonly busy = signal(false);

  readonly mode = signal<Mode>('subdomain');
  readonly subdomainInput = signal('');
  readonly rootDomainInput = signal('');
  readonly customDomainInput = signal('');

  readonly refreshing = signal(false);
  readonly polling = signal(false);
  readonly pollExpired = signal(false);
  readonly openProvider = signal<string | null>(null);
  readonly loadFailed = signal(false);

  private pollStartedAt = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  // ── state helpers ─────────────────────────────────────────────────
  readonly isInitial = computed(() => !this.data().status);
  readonly isPendingValidation = computed(() => this.data().status === 'pending_cert_validation');
  readonly isApproved = computed(() => this.data().status === 'Approved');
  readonly isCertIssued = computed(() => this.data().certStatus === 'ISSUED');
  readonly isCertFailed = computed(() => CERT_TERMINAL_FAIL.includes(this.data().certStatus));

  /** 1 / 2 / 3 for the step indicator. */
  readonly step = computed(() => (this.isApproved() ? 3 : this.isPendingValidation() ? 2 : 1));

  readonly finalHost = computed(() => {
    const d = this.data();
    return d.isSubdomain && d.subdomain ? `${d.subdomain}.${d.domain}` : d.domain;
  });
  readonly wwwHost = computed(() => (this.data().domain ? `www.${this.data().domain}` : ''));
  readonly showWwwRow = computed(() => !this.data().isSubdomain && !!this.data().domain);
  readonly finalUrl = computed(() => (this.finalHost() ? `https://${this.finalHost()}` : ''));

  readonly fullSubdomainPreview = computed(() => {
    const s = this.subdomainInput().toLowerCase().trim();
    const d = this.rootDomainInput().toLowerCase().trim();
    if (s && d) return `${s}.${d}`;
    if (d) return `subdomain.${d}`;
    return 'shop.example.com';
  });

  readonly subdomainValid = computed(() => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(this.subdomainInput().toLowerCase().trim()));
  readonly rootValid = computed(() => this.isDomainValid(this.rootDomainInput()));
  readonly customValid = computed(() => this.isDomainValid(this.customDomainInput()));
  readonly canSubmitRegister = computed(() =>
    !this.busy() && (this.mode() === 'subdomain' ? this.subdomainValid() && this.rootValid() : this.customValid()));

  isDomainValid(value: string): boolean {
    return /^((?!-))(xn--)?[a-z0-9][a-z0-9-_]{0,61}[a-z0-9]{0,1}\.(xn--)?([a-z0-9\-]{1,61}|[a-z0-9-]{1,30}\.[a-z]{2,})$/.test((value || '').toLowerCase().trim());
  }

  cnameHostPart(fullName: string): string {
    if (!fullName) return '';
    const stripped = fullName.replace(/\.$/, '');
    const apex = this.data().domain;
    if (apex && stripped.endsWith('.' + apex)) return stripped.slice(0, stripped.length - apex.length - 1);
    return stripped;
  }

  dnsRecordHost(fqdn: string): string {
    if (!fqdn) return '';
    const apex = this.data().domain;
    if (apex && fqdn === apex) return '@';
    if (apex && fqdn.endsWith('.' + apex)) return fqdn.slice(0, fqdn.length - apex.length - 1);
    return fqdn;
  }

  // ── data ──────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('domain-settings');
    this.breadcrumbs.set([
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: this.translate.instant('DOMAIN_SETTINGS.TITLE') },
    ]);
    await this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    await this.loadDomainSettingsData();
    this.loading.set(false);
    if (this.isPendingValidation() && !this.isCertIssued() && !this.isCertFailed()) this.startPolling();
  }

  /** Same as the legacy: a failed status (no domain yet, tenant gone...) leaves the current state untouched. */
  async loadDomainSettingsData(): Promise<boolean> {
    let next: DomainSettings | null;
    try {
      next = await this.service.status();
    } catch {
      this.loadFailed.set(true);
      return false;
    }
    this.loadFailed.set(false);
    if (!next) return false;
    if (!next.status || next.status === 'No Data') {
      this.data.set(emptyDomainSettings());
      this.mode.set('subdomain');
    } else {
      this.data.set(next);
      this.mode.set(next.isSubdomain ? 'subdomain' : 'custom');
    }
    return true;
  }

  // ── step 1: register ──────────────────────────────────────────────
  async register(): Promise<void> {
    if (!this.canSubmitRegister()) return;
    const payload: RegisterDomainPayload = this.mode() === 'subdomain'
      ? { domain: this.rootDomainInput().toLowerCase().trim(), subdomain: this.subdomainInput().toLowerCase().trim(), isSubdomain: true }
      : { domain: this.customDomainInput().toLowerCase().trim(), isSubdomain: false };

    this.busy.set(true);
    this.loading.set(true);
    let res;
    try {
      res = await this.service.register(payload);
    } catch (e: any) {
      res = { success: false, message: e?.error?.msg ?? e?.message ?? '' };
    }
    this.loading.set(false);
    this.busy.set(false);

    if (!res.success) { this.fail(res.message || this.translate.instant('DOMAIN_SETTINGS.REGISTER_FAILED')); return; }

    await this.loadDomainSettingsData();
    if (this.isApproved()) this.toast.success(this.translate.instant('DOMAIN_SETTINGS.LIVE_AT', { url: this.finalUrl() }));
    else if (this.isPendingValidation()) this.startPolling();
  }

  // ── step 2: polling ───────────────────────────────────────────────
  startPolling(): void {
    if (this.polling()) return;
    this.polling.set(true);
    this.pollExpired.set(false);
    this.pollStartedAt = Date.now();
    this.scheduleNextPoll();
  }

  stopPolling(): void {
    this.polling.set(false);
    if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
  }

  private scheduleNextPoll(): void {
    if (!this.polling()) return;
    this.pollTimer = setTimeout(async () => {
      await this.loadDomainSettingsData();
      if (!this.polling()) return;
      if (Date.now() - this.pollStartedAt >= POLL_MAX_MS) { this.pollExpired.set(true); this.stopPolling(); return; }
      if (this.isCertIssued() || this.isCertFailed() || this.isApproved()) { this.stopPolling(); return; }
      this.scheduleNextPoll();
    }, POLL_INTERVAL_MS);
  }

  async refreshStatus(): Promise<void> {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    try {
      await this.loadDomainSettingsData();
      this.pollExpired.set(false);
      if (this.isPendingValidation() && !this.isCertIssued() && !this.isCertFailed() && !this.polling()) this.startPolling();
    } finally {
      this.refreshing.set(false);
    }
  }

  // ── step 3: approve ───────────────────────────────────────────────
  async approve(): Promise<void> {
    if (!this.isCertIssued() || this.busy()) return;
    this.busy.set(true);
    this.loading.set(true);
    let res;
    try {
      res = await this.service.approve();
    } catch (e: any) {
      res = { success: false, message: e?.error?.msg ?? e?.message ?? '', data: undefined };
    }
    this.loading.set(false);
    this.busy.set(false);

    if (!res.success) {
      if (/Certificate not ready/i.test(res.message)) {
        this.fail(this.translate.instant('DOMAIN_SETTINGS.CERT_NOT_READY'));
        if (!this.polling()) this.startPolling();
      } else {
        this.fail(res.message || this.translate.instant('DOMAIN_SETTINGS.APPROVE_FAILED'));
      }
      return;
    }
    if (res.data) this.data.set(this.service.parse({ ...this.data(), ...res.data }));
    await this.loadDomainSettingsData();
    this.stopPolling();
  }

  // ── misc ──────────────────────────────────────────────────────────
  async copy(text: string): Promise<void> {
    if (!text) return;
    const ok = await this.writeClipboard(text);
    if (ok) this.toast.success(this.translate.instant('DOMAIN_SETTINGS.COPIED'), undefined, 1500);
    else this.toast.error(this.translate.instant('DOMAIN_SETTINGS.COPY_FAILED'), undefined, 1500);
  }

  private async writeClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch { /* fall through to the textarea fallback */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  toggleProvider(id: string): void { this.openProvider.update(cur => (cur === id ? null : id)); }

  private backToRegister(): void {
    this.stopPolling();
    this.data.set(emptyDomainSettings());
    this.subdomainInput.set('');
    this.rootDomainInput.set('');
    this.customDomainInput.set('');
    this.mode.set('subdomain');
  }

  async removeDomain(): Promise<void> {
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: {
        title: this.translate.instant('DOMAIN_SETTINGS.REMOVE_TITLE'),
        message: this.translate.instant('DOMAIN_SETTINGS.REMOVE_TEXT'),
        confirm: this.translate.instant('DOMAIN_SETTINGS.REMOVE'),
        danger: true,
      },
    }).afterClosed();
    if (!ok) return;

    this.stopPolling();
    this.busy.set(true);
    this.loading.set(true);
    let res;
    try {
      res = await this.service.remove();
    } catch (e: any) {
      res = { success: false, message: e?.error?.msg ?? e?.message ?? '' };
    }
    this.loading.set(false);
    this.busy.set(false);

    if (!res.success) { this.fail(res.message || this.translate.instant('DOMAIN_SETTINGS.REMOVE_FAILED')); return; }

    this.backToRegister();
    await this.loadDomainSettingsData();

    // A non-empty message on success means the AWS cleanup only partly worked.
    if (res.message) {
      this.toast.warning(this.translate.instant('DOMAIN_SETTINGS.REMOVED_WARN'), this.translate.instant('DOMAIN_SETTINGS.REMOVED_WARN_TEXT', { msg: res.message }));
    } else {
      this.toast.success(this.translate.instant('DOMAIN_SETTINGS.REMOVED'));
    }
  }

  private fail(message: string): void { this.toast.error('COMMON.OPS', message); }
}
