import {
  Component, OnInit, inject, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../../i18n/language.service';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../auth/auth.service';
import { CompanyService } from '../../../auth/company.service';
import { PrivilegeService } from '../../../auth/privileges/privilege.service';
import { Company, resolveAvatarUrl, resolveEmployeeName, resolveInitials } from '../../../auth/auth.models';
import { MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef, ModalService } from '../../../../shared/modal/modal.service';
import { EmployeeAvatarService } from '../../../auth/employee-avatar.service';
import { EmployeeAiOverrideComponent } from '../../../ai/employee-ai-override/employee-ai-override.component';

@Component({
  selector: 'app-company-switcher',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslateModule],
  template: `
    <div class="sw">

      <!-- Employee identity -->
      <div class="identity">
        <div class="id-avatar">
          @if (avatarUrl(); as url) { <img [src]="url" class="id-avatar__img" [alt]="displayName()" (error)="avatarBroken.set(true)"/> } @else { {{ initials() }} }
        </div>
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
        <a routerLink="/employees/my-account" class="btn-act" (click)="ref.dismiss()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          {{ 'COMPANY_SWITCHER.MY_ACCOUNT' | translate }}
        </a>

        @if (canSeeOverview) {
        <a routerLink="/companies-overview" class="btn-act" (click)="ref.dismiss()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          </svg>
          {{ 'COMPANY_SWITCHER.COMPANIES_OVERVIEW' | translate }}
        </a>
        }

        <button type="button" class="btn-act" (click)="openAiOverride()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/>
          </svg>
          {{ 'COMPANY_SWITCHER.AI_OVERRIDE' | translate }}
        </button>

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
      <div class="list-label">
        {{ 'COMPANY_SWITCHER.SWITCH_COMPANY' | translate }}
        @if (hasProtected()) {
          <button type="button" class="list-link" (click)="revealed.set(!revealed())">
            {{ (revealed() ? 'COMPANY_SWITCHER.HIDE' : 'COMPANY_SWITCHER.SHOW') | translate }}
          </button>
        }
      </div>

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
          <div class="company-item"
               [class.company-item--blur]="isProtected(company)">
          <button
            class="company-row"
            [class.rtl]="langService.isRtl()"
            [class.company-row--active]="company.id === companyService.currentCompany()?.id"
            [class.company-row--pending]="pending()?.id === company.id"
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
            <span class="co-name">
              <span class="co-title">{{ company.name }}</span>
              @if (company.slug) { <small class="co-slug" dir="ltr">{{ company.slug }}</small> }
            </span>

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

          @if (pending()?.id === company.id) {
            <!-- The password step: switching company needs the employee's password again. -->
            <form class="pw" (ngSubmit)="confirmSwitch()">
              <p class="pw-msg">{{ 'COMPANY_SWITCHER.PASSWORD_PROMPT' | translate }}</p>
              <input class="pw-input" type="password" name="password" autocomplete="current-password"
                     [(ngModel)]="password" [class.pw-input--err]="!!pwError()"
                     [placeholder]="'COMPANY_SWITCHER.PASSWORD_PLACEHOLDER' | translate"
                     [disabled]="switching() !== null" autofocus />
              @if (pwError()) { <p class="pw-err">{{ pwError() | translate }}</p> }
              <div class="pw-actions">
                <button type="button" class="pw-btn pw-btn--cancel" (click)="cancelSwitch()" [disabled]="switching() !== null">
                  {{ 'COMPANY_SWITCHER.CANCEL' | translate }}
                </button>
                <button type="submit" class="pw-btn pw-btn--confirm" [disabled]="switching() !== null">
                  @if (switching() === company.id) { <span class="pw-spin"></span> } @else { {{ 'COMPANY_SWITCHER.CONFIRM' | translate }} }
                </button>
              </div>
            </form>
          }
          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    /* Fills the drawer, so the company list runs down to its bottom edge. */
    :host { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }

    .sw { min-width: 280px; display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }

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
      display: flex; align-items: center; justify-content: center; overflow: hidden;
    }
    .id-avatar__img { width: 100%; height: 100%; object-fit: cover; }
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
    .list-link {
      float: inline-end; border: 0; background: none; padding: 0; cursor: pointer; font: inherit; font-size: 12px; font-weight: 600;
      text-transform: none; letter-spacing: 0; color: #2b95a8; &:hover { text-decoration: underline; }
    }
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
      flex: 1 1 auto; min-height: 0; overflow-y: auto;
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
    .company-row--pending { background: #f8fafc; }

    /* The other companies are blurred (their names are not for onlookers); the one being switched to and the current one stay clear. */
    .company-item { transition: filter .2s, opacity .2s; }
    .company-item--blur { filter: blur(4px); opacity: .65; user-select: none; }
    .company-item--blur:hover { filter: blur(3px); }

    /* Password step */
    .pw { padding: 4px 10px 12px; display: flex; flex-direction: column; gap: 8px; }
    .pw-msg { margin: 0; font-size: 12.5px; color: #475569; text-align: center; }
    .pw-input {
      height: 40px; padding: 0 12px; box-sizing: border-box; width: 100%;
      border: 1.5px solid #e5e7eb; border-radius: 8px; font: inherit; font-size: 14px; color: #111827; outline: none; text-align: center;
      &:focus { border-color: #32acc1; }
    }
    .pw-input--err { border-color: #ef4444; }
    .pw-err { margin: 0; font-size: 12px; color: #ef4444; text-align: center; }
    .pw-actions { display: flex; gap: 8px; }
    .pw-btn {
      flex: 1; height: 38px; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; border: none;
      display: flex; align-items: center; justify-content: center; transition: background .15s;
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
    .pw-btn--cancel { background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; &:hover:not(:disabled) { background: #fee2e2; } }
    .pw-btn--confirm { background: #32acc1; color: #fff; &:hover:not(:disabled) { background: #2b95a8; } }
    .pw-spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; animation: spin .6s linear infinite; }

    .co-logo {
      width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
      border: 1px solid #e2e8f0; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      background: #f8fafc;
    }
    .co-img { width: 100%; height: 100%; object-fit: cover; }
    .co-placeholder { font-size: 15px; font-weight: 700; color: #94a3b8; }

    .co-name {
      flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; text-align: start;
    }
    .co-title { font-size: 13px; font-weight: 500; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .co-slug { font-size: 11.5px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
  private modal  = inject(ModalService);
  ref            = inject<ModalRef>(MODAL_REF);
  companyService = inject(CompanyService);
  private privileges = inject(PrivilegeService);
  private avatars    = inject(EmployeeAvatarService);
  /** Group-wide figures: only for employees holding the Companies Overview privilege (super admins always). */
  get canSeeOverview(): boolean { return this.privileges.isSuperAdmin || this.privileges.check('companiesOverviewSecurity.access'); }

  loading    = signal(false);
  langService = inject(LanguageService);
  loggingOut = signal(false);
  switching  = signal<string | null>(null);
  /** The company the user clicked: its password step is open under it. */
  pending    = signal<Company | null>(null);
  /** The other companies are blurred until the user chooses to show them. */
  revealed   = signal(false);
  password   = '';
  pwError    = signal('');

  employee    = toSignal(this.auth.employee$, { initialValue: this.auth.currentEmployee });
  avatarBroken = signal(false);
  avatarUrl   = computed(() => (this.avatarBroken() ? null : resolveAvatarUrl(this.employee())));
  displayName = computed(() => resolveEmployeeName(this.employee()));
  initials    = computed(() => resolveInitials(this.employee()));

  /** Open the per-employee Content AI override (personal key that
   *  overrides the company-wide Content AI plugin). */
  openAiOverride(): void {
    this.ref.dismiss();
    this.modal.open(EmployeeAiOverrideComponent, { size: 'md', closeOnBackdrop: true });
  }

  async ngOnInit(): Promise<void> {
    void this.avatars.sync();
    if (this.companyService.companies().length === 0) {
      this.loading.set(true);
      await this.companyService.loadCompanies(
        this.companyService.currentCompany()?.id
      );
      this.loading.set(false);
    }
  }

  /**
   * Blurred = the user sees this company only because they are a super admin, not because someone gave them access to it
   * (`hasGrant`, sent by the backend), so a person at a shared screen cannot read its name. Granted companies, the current one,
   * the one being switched to, and everything after "Show" are clear. Without the flag (older backend) it stays blurred.
   */
  isProtected(company: Company): boolean {
    return !this.revealed()
      && company['hasGrant'] !== true
      && company.id !== this.companyService.currentCompany()?.id
      && this.pending()?.id !== company.id;
  }

  hasProtected = computed(() =>
    this.companyService.companies().some(c => c.id !== this.companyService.currentCompany()?.id && c['hasGrant'] !== true));

  /** Clicking another company opens its password step (clicking it again closes it). */
  onSwitch(company: Company): void {
    if (company.id === this.companyService.currentCompany()?.id || this.switching() !== null) return;
    if (this.pending()?.id === company.id) { this.cancelSwitch(); return; }
    this.password = '';
    this.pwError.set('');
    this.pending.set(company);
  }

  cancelSwitch(): void { this.pending.set(null); this.password = ''; this.pwError.set(''); }

  /** Checks the password, then switches. */
  async confirmSwitch(): Promise<void> {
    const company = this.pending();
    if (!company) return;
    if (!this.password.trim()) { this.pwError.set('COMPANY_SWITCHER.PASSWORD_REQUIRED'); return; }
    this.switching.set(company.id);
    this.pwError.set('');
    try {
      if (!(await this.companyService.validatePassword(this.password))) {
        this.pwError.set('COMPANY_SWITCHER.PASSWORD_WRONG');
        this.switching.set(null);
        return;
      }
    } catch {
      this.pwError.set('COMPANY_SWITCHER.PASSWORD_WRONG');
      this.switching.set(null);
      return;
    }
    await this.doSwitch(company);
  }

  private async doSwitch(company: Company): Promise<void> {
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
