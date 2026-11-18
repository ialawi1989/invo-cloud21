import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '@core/auth/auth.service';
import { getDeviceInfo } from '@features/login/utils/device-info.util';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ListSkeletonComponent } from '@shared/components/skeleton/list-skeleton.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

/** One signed-in device, as `sessions/sessionList` returns it. */
interface DeviceSession {
  device_id: string;
  device_name: string;
  platform: string;
  app_version: string;
  user_agent: string;
  last_seen_at: string;
  session_created_at: string;
  isCurrent: boolean;
}

type DeviceKind = 'desktop' | 'laptop' | 'mobile' | 'tablet';

const PAGE_SIZE = 4;

/**
 * My Account > Device usage: the devices the employee is signed in on (this one first), with when each was last active and when its
 * session started. Any other device can be signed out (revoked). Same calls as the legacy page:
 * `sessions/sessionList` and `sessions/revokeSession/:deviceId`.
 */
@Component({
  selector: 'app-device-usage',
  standalone: true,
  imports: [DatePipe, TranslateModule, EmptyStateComponent, ListSkeletonComponent, TooltipDirective],
  templateUrl: './device-usage.component.html',
  styleUrl: './device-usage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceUsageComponent implements OnInit {
  private auth = inject(AuthService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  private all = signal<DeviceSession[]>([]);
  loading = signal(true);
  failed = signal(false);
  page = signal(1);

  pageCount = computed(() => Math.max(1, Math.ceil(this.all().length / PAGE_SIZE)));
  list = computed(() => this.all().slice((this.page() - 1) * PAGE_SIZE, this.page() * PAGE_SIZE));

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const currentId = getDeviceInfo().deviceId;
      const sessions: any[] = (await this.auth.getSessionList()) ?? [];
      const rows = sessions.map((s): DeviceSession => ({ ...s, isCurrent: s.device_id === currentId }));
      // This device first, then the most recently active.
      rows.sort((a, b) => (a.isCurrent === b.isCurrent
        ? new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime()
        : a.isCurrent ? -1 : 1));
      this.all.set(rows);
      this.page.set(1);
    } catch {
      this.all.set([]);
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  kind(d: DeviceSession): DeviceKind {
    const ua = (d.user_agent || '').toLowerCase();
    const platform = (d.platform || '').toLowerCase();
    if (ua.includes('iphone') || (ua.includes('android') && ua.includes('mobile'))) return 'mobile';
    if (ua.includes('ipad') || ua.includes('tablet')) return 'tablet';
    if (platform.includes('macos') || ua.includes('macintosh')) return 'laptop';
    return 'desktop';
  }

  prev(): void { if (this.page() > 1) this.page.update(p => p - 1); }
  next(): void { if (this.page() < this.pageCount()) this.page.update(p => p + 1); }

  async revoke(d: DeviceSession): Promise<void> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: {
        title: this.translate.instant('EMPLOYEES.MY_ACCOUNT.REVOKE_CONFIRM_TITLE'),
        message: `${d.device_name} - ${d.platform}`,
        confirm: this.translate.instant('EMPLOYEES.MY_ACCOUNT.REVOKE_YES'),
        cancel: this.translate.instant('EMPLOYEES.MY_ACCOUNT.REVOKE_NO'),
        danger: true,
      },
    });
    if (!(await ref.afterClosed())) return;
    try {
      await this.auth.revokeSession(d.device_id);
      this.all.update(rows => rows.filter(r => r.device_id !== d.device_id));
      if (this.page() > this.pageCount()) this.page.set(this.pageCount());
      this.toast.success('EMPLOYEES.MY_ACCOUNT.DEVICE_REVOKED');
    } catch (e: any) {
      this.toast.error('EMPLOYEES.MY_ACCOUNT.DEVICE_REVOKE_ERROR', e?.message);
    }
  }
}
