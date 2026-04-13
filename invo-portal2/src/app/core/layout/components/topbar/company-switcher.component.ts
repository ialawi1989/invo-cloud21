import {
  Component, OnInit, inject, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../../i18n/language.service';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../auth/auth.service';
import { CompanyService } from '../../../auth/company.service';
import { Company, resolveEmployeeName, resolveInitials } from '../../../auth/auth.models';
import { MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';

@Component({
  selector: 'app-company-switcher',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    <div class="sw">

      <!-- Employee identity -->
      <div class="identity">
        <div class="id-avatar">{{ initials() }}</div>
        <div class="id-text">
          <p class="id-name">{{ displayName() }}</p>
          <p class="id-company">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            </svg>
            {{ companyService.currentCompanyName() || '—' }}
          </p>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="actions">
        <a routerLink="/account" class="btn-act" (click)="ref.dismiss()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          {{ 'COMPANY_SWITCHER.MY_ACCOUNT' | translate }}
        </a>

        <a routerLink="/companies" class="btn-act" (click)="ref.dismiss()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          </svg>
          {{ 'COMPANY_SWITCHER.COMPANIES_OVERVIEW' | translate }}
        </a>

        <button class="btn-act btn-act--danger"
                (click)="onLogout()" [disabled]="loggingOut()">
          @if (loggingOut()) {
            <span class="spinner"></span> {{ 'COMPANY_SWITCHER.SIGNING_OUT' | translate }}
          } @else {
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {{ 'COMPANY_SWITCHER.LOGOUT' | translate }}
          }
        </button>
      </div>

      <!-- Company list -->
      <div class="list-label">{{ 'COMPANY_SWITCHER.SWITCH_COMPANY' | translate }}</div>

      @if (loading()) {
        <div class="loading-row">
          <span class="loading-spin"></span>
          {{ 'COMPANY_SWITCHER.LOADING' | translate }}
        </div>
      } @else if (companyService.companies().length === 0) {
        <p class="empty">{{ 'COMPANY_SWITCHER.NO_OTHER_COMPANIES' | translate }}</p>
      }

      <div class="company-list">
        @for (company of companyService.companies(); track company.id) {
          <button
            class="company-row"
            [class.rtl]="langService.isRtl()"
            [class.company-row--active]="company.id === companyService.currentCompany()?.id"
            (click)="onSwitch(company)"
            [disabled]="switching() !== null">

            <!-- Logo -->
            <div class="co-logo">
              @if (company.logo || company.logoUrl) {
                <img [src]="company.logo || company.logoUrl"
                     [alt]="company.name" class="co-img"/>
              } @else {
                <span class="co-placeholder">{{ company.name[0]?.toUpperCase() }}</span>
              }
            </div>

            <!-- Name -->
            <span class="co-name">{{ company.name }}</span>

            <!-- Right indicator -->
            <span class="co-right">
              @if (switching() === company.id) {
                <span class="row-spin"></span>
              } @else if (company.id === companyService.currentCompany()?.id) {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="#32acc1" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              }
            </span>
          </button>
        }
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .sw { min-width: 280px; }

    /* Identity */
    .identity {
      display: flex; align-items: center; gap: 12px;
      padding: 18px 18px 14px;
      border-bottom: 1px solid #f1f5f9;
    }
    .id-avatar {
      width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, #32acc1, #2b95a8);
      color: #fff; font-weight: 700; font-size: 15px;
      display: flex; align-items: center; justify-content: center;
    }
    .id-name    { font-size: 14px; font-weight: 600; color: #1e293b; margin: 0 0 3px; }
    .id-company {
      display: flex; align-items: center; gap: 4px;
      font-size: 12px; color: #64748b; margin: 0;
    }

    /* Actions */
    .actions {
      display: flex; flex-direction: column; gap: 1px;
      padding: 6px 8px; border-bottom: 1px solid #f1f5f9;
    }
    .btn-act {
      display: flex; align-items: center; gap: 9px;
      padding: 9px 10px; border-radius: 8px;
      font-size: 13px; font-weight: 500; color: #374151;
      background: none; border: none; cursor: pointer;
      text-decoration: none; font-family: inherit;
      transition: background .15s;
      &:hover { background: #f8fafc; color: #1e293b; }
    }
    .btn-act--danger {
      color: #ef4444;
      &:hover { background: #fef2f2; color: #dc2626; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }

    /* List */
    .list-label {
      padding: 12px 18px 6px;
      font-size: 11px; font-weight: 600; color: #94a3b8;
      text-transform: uppercase; letter-spacing: .6px;
    }
    .loading-row {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 18px; font-size: 13px; color: #94a3b8;
    }
    .empty {
      padding: 8px 18px 12px; font-size: 13px; color: #94a3b8; margin: 0;
    }

    .company-list {
      padding: 4px 8px 10px;
      max-height: 240px; overflow-y: auto;
      scrollbar-width: thin; scrollbar-color: #e2e8f0 transparent;
    }
    .company-row {
      display: flex; align-items: center; gap: 10px;
      width: 100%; padding: 9px 10px;
      background: none; border: none; border-radius: 10px;
      cursor: pointer; font-family: inherit;
      transition: background .15s;
      &:hover:not(:disabled) { background: #f8fafc; }
      &:disabled { cursor: default; opacity: .7; }
    }
    .company-row--active { background: #f0fdfd; }

    .co-logo {
      width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
      border: 1px solid #e2e8f0; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      background: #f8fafc;
    }
    .co-img { width: 100%; height: 100%; object-fit: cover; }
    .co-placeholder { font-size: 15px; font-weight: 700; color: #94a3b8; }

    .co-name {
      flex: 1; font-size: 13px; font-weight: 500; color: #1e293b;
      text-align: start; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .co-right { width: 18px; flex-shrink: 0; display: flex; justify-content: center; }

    /* LTR company row (explicit reset) */
    .company-row:not(.rtl) { flex-direction: row; }
    .company-row:not(.rtl) .co-right { order: unset; margin-right: unset; }
    .company-row:not(.rtl) .co-logo  { order: unset; }
    .company-row:not(.rtl) .co-name  { order: unset; flex: 1; margin-left: unset; }

    /* RTL company row: [✓ · · · ] [Sayed Hussain] [S] */
    .company-row.rtl { flex-direction: row-reverse; }
    .company-row.rtl .co-right { order: -1; margin-right: auto; }
    .company-row.rtl .co-logo  { order: 1; }
    .company-row.rtl .co-name  { order: 0; flex: none; margin-left: 8px; }

    /* Spinners */
    .spinner, .loading-spin, .row-spin {
      width: 13px; height: 13px; border-radius: 50%; flex-shrink: 0;
      animation: spin .6s linear infinite;
    }
    .spinner     { border: 2px solid rgba(239,68,68,.2); border-top-color: #ef4444; }
    .loading-spin { border: 2px solid #e2e8f0; border-top-color: #32acc1; }
    .row-spin    { border: 2px solid #e2e8f0; border-top-color: #32acc1; }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class CompanySwitcherComponent implements OnInit {
  private auth   = inject(AuthService);
  ref            = inject<ModalRef>(MODAL_REF);
  companyService = inject(CompanyService);

  loading    = signal(false);
  langService = inject(LanguageService);
  loggingOut = signal(false);
  switching  = signal<string | null>(null);

  employee    = signal(this.auth.currentEmployee);
  displayName = computed(() => resolveEmployeeName(this.employee()));
  initials    = computed(() => resolveInitials(this.employee()));

  async ngOnInit(): Promise<void> {
    if (this.companyService.companies().length === 0) {
      this.loading.set(true);
      await this.companyService.loadCompanies(
        this.companyService.currentCompany()?.id
      );
      this.loading.set(false);
    }
  }

  async onSwitch(company: Company): Promise<void> {
    if (company.id === this.companyService.currentCompany()?.id) return;

    this.switching.set(company.id);
    try {
      const res = await this.companyService.switchCompany(company.id);

      if (res?.data?.accessToken) {
        // Mirror v16: set the new access token
        this.auth.setAccessToken(res.data.accessToken);

        // Update stored employee if returned
        if (res.data.employee) {
          this.auth.storeSession({ success: true, data: res.data });
        }

        // Update current company
        const newCompany: Company = res.data.company ?? company;
        this.companyService.setCurrentCompany(newCompany);

        this.ref.close({ switched: true, company: newCompany });

        // Full reload to reinitialize all feature data for the new company
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Switch company failed:', err);
    } finally {
      this.switching.set(null);
    }
  }

  async onLogout(): Promise<void> {
    this.loggingOut.set(true);
    this.ref.dismiss();
    await this.auth.logout();
  }
}
