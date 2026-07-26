import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '@core/auth/auth.service';
import { ApiService } from '@core/http/api.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';
import { ToastService } from '@shared/components/toast/toast.service';

/**
 * 403 — friendly "you don't have access" page.
 * ────────────────────────────────────────────
 * Reached via `privilegeGuard`, which passes `{ permissionPath, redirectTo,
 * attemptedUrl }` through router state. Shows the viewer their role, the
 * module/page they hit, and a **Request access** action that notifies an
 * administrator (a soft request — the admin decides). Replaces the bare
 * 403 code page.
 */
@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    <div class="forbidden">
      <div class="forbidden__card">
        <div class="forbidden__icon" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <h1 class="forbidden__title">{{ 'ERRORS.FORBIDDEN_TITLE' | translate }}</h1>
        <p class="forbidden__desc">{{ 'ERRORS.FORBIDDEN_DESC' | translate:{ page: pageLabel() } }}</p>

        <dl class="forbidden__facts">
          <div>
            <dt>{{ 'ERRORS.FORBIDDEN_YOUR_ROLE' | translate }}</dt>
            <dd><span class="forbidden__role">{{ roleLabel() }}</span></dd>
          </div>
          <div>
            <dt>{{ 'ERRORS.FORBIDDEN_MODULE' | translate }}</dt>
            <dd>{{ moduleLabel() }}</dd>
          </div>
          <div>
            <dt>{{ 'ERRORS.FORBIDDEN_PAGE' | translate }}</dt>
            <dd>{{ pageLabel() }}</dd>
          </div>
        </dl>

        <div class="forbidden__actions">
          <a class="btn btn--ghost" routerLink="/dashboard">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            {{ 'ERRORS.FORBIDDEN_BACK' | translate }}
          </a>
          <button type="button" class="btn btn--primary" (click)="requestAccess()" [disabled]="sending()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            {{ 'ERRORS.FORBIDDEN_REQUEST' | translate }}
          </button>
        </div>

        <p class="forbidden__hint">{{ 'ERRORS.FORBIDDEN_ONLY_HINT' | translate:{ module: moduleLabel() } }}</p>
      </div>
    </div>
  `,
  styles: [`
    .forbidden {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 24px; background: #f8fafc;
    }
    .forbidden__card {
      width: 100%; max-width: 440px; background: #fff;
      border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px 28px;
      text-align: center; box-shadow: 0 8px 30px rgba(15,23,42,.06);
    }
    .forbidden__icon {
      width: 60px; height: 60px; border-radius: 50%;
      background: #fff7ed; color: #f97316;
      display: inline-flex; align-items: center; justify-content: center;
      margin-bottom: 16px;
    }
    .forbidden__title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 6px; }
    .forbidden__desc  { font-size: 14px; color: #64748b; margin: 0 0 20px; line-height: 1.5; }

    .forbidden__facts {
      text-align: start; background: #f8fafc; border: 1px solid #eef2f6;
      border-radius: 10px; padding: 6px 14px; margin: 0 0 20px;
    }
    .forbidden__facts > div {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; padding: 9px 0; border-bottom: 1px solid #eef2f6;
    }
    .forbidden__facts > div:last-child { border-bottom: none; }
    .forbidden__facts dt { font-size: 13px; color: #64748b; margin: 0; }
    .forbidden__facts dd { font-size: 13px; font-weight: 600; color: #0f172a; margin: 0; text-align: end; }
    .forbidden__role {
      display: inline-block; padding: 2px 10px; border-radius: 999px;
      background: #fff7ed; color: #c2410c; font-size: 12px; font-weight: 600;
    }

    .forbidden__actions { display: flex; gap: 10px; }
    .btn {
      flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      padding: 11px 14px; border-radius: 10px; font-size: 14px; font-weight: 600;
      cursor: pointer; text-decoration: none; border: 1px solid transparent;
      transition: background 120ms ease, border-color 120ms ease;
    }
    .btn--ghost   { background: #fff; color: #475569; border-color: #e2e8f0; }
    .btn--ghost:hover { background: #f8fafc; color: #0f172a; }
    .btn--primary { background: #f97316; color: #fff; }
    .btn--primary:hover:not(:disabled) { background: #ea580c; }
    .btn:disabled { opacity: .6; cursor: not-allowed; }

    .forbidden__hint { font-size: 12px; color: #94a3b8; margin: 16px 0 0; }
  `],
})
export class ForbiddenComponent {
  private router    = inject(Router);
  private auth      = inject(AuthService);
  private api       = inject(ApiService);
  private modal     = inject(ModalService);
  private toast     = inject(ToastService);
  private translate = inject(TranslateService);

  sending = signal(false);

  /** Router state passed by the guard on deny. */
  private readonly st: { permissionPath?: string; attemptedUrl?: string } =
    (history.state ?? {}) as any;

  roleLabel = computed<string>(() => {
    const emp: any = this.auth.currentEmployee;
    return emp?.role || emp?.privilegeName || emp?.name || emp?.employeeName || '—';
  });

  moduleLabel = computed<string>(() => this.humanize((this.st.permissionPath ?? '').split('.')[0]));

  pageLabel = computed<string>(() => {
    const url = this.st.attemptedUrl ?? '';
    const seg = url.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? '';
    return seg ? this.humanize(seg) : this.moduleLabel();
  });

  /** "accountSecurity" → "Account"; "bankingOverview" → "Banking Overview". */
  private humanize(key: string): string {
    if (!key) return '—';
    const words = key
      .replace(/Security$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .trim();
    return words
      ? words.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : '—';
  }

  async requestAccess(): Promise<void> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title:   this.translate.instant('ERRORS.FORBIDDEN_REQUEST_TITLE'),
          message: this.translate.instant('ERRORS.FORBIDDEN_REQUEST_MSG', { page: this.pageLabel() }),
          confirm: this.translate.instant('ERRORS.FORBIDDEN_REQUEST_SEND'),
        },
        closeOnBackdrop: true,
      },
    );
    if (!(await ref.afterClosed())) return;

    this.sending.set(true);
    try {
      const emp: any = this.auth.currentEmployee;
      const res = await this.api.request<any>(
        this.api.post('employee/requestAccess', {
          permissionPath: this.st.permissionPath ?? '',
          module:         this.moduleLabel(),
          page:           this.pageLabel(),
          attemptedUrl:   this.st.attemptedUrl ?? '',
          employeeId:     emp?.id ?? null,
        }),
      );
      if (res?.success === false) {
        this.toast.error('ERRORS.FORBIDDEN_REQUEST_FAILED');
      } else {
        this.toast.success('ERRORS.FORBIDDEN_REQUEST_SENT');
      }
    } catch {
      this.toast.error('ERRORS.FORBIDDEN_REQUEST_FAILED');
    } finally {
      this.sending.set(false);
    }
  }
}
