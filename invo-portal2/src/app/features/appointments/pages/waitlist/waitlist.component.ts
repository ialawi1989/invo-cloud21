import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@shared/components/toast/toast.service';
import { WaitlistService } from '../../services/waitlist.service';
import { AppointmentPrefillService } from '../../services/appointment-prefill.service';
import { WaitlistEntry } from '../../models/appointment.types';

@Component({
  selector: 'app-waitlist',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './waitlist.component.html',
  styleUrl: './waitlist.component.scss',
})
export class WaitlistComponent implements OnInit {
  private waitlistSvc = inject(WaitlistService);
  private prefillSvc = inject(AppointmentPrefillService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  loading = signal(true);
  converting = signal<string | null>(null);
  entries = signal<WaitlistEntry[]>([]);

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      this.entries.set(await this.waitlistSvc.getWaitlist());
    } finally {
      this.loading.set(false);
    }
  }

  servicesLabel(entry: WaitlistEntry): string {
    if (entry.servicesSummary) return entry.servicesSummary;
    const names = (entry.services ?? []).map(s => s.serviceName ?? s.name).filter(Boolean);
    return names.join(', ');
  }

  requestedLabel(entry: WaitlistEntry): string {
    if (!entry.requestedDate) return this.translate.instant('APPOINTMENTS.WAITLIST.NO_PREFERRED_TIME');
    return new Date(entry.requestedDate).toLocaleString();
  }

  staffLabel(entry: WaitlistEntry): string {
    return entry.preferredStaffName ?? this.translate.instant('APPOINTMENTS.WAITLIST.ANY_STAFF');
  }

  async convert(entry: WaitlistEntry): Promise<void> {
    this.converting.set(entry.id);
    try {
      const prefill = await this.waitlistSvc.convert(entry.id);
      this.prefillSvc.set({ waitlistId: entry.id, prefill });
      this.router.navigate(['/appointments/form'], { queryParams: { mode: 'new', source: 'waitlist' } });
    } catch {
      this.toast.error(this.translate.instant('APPOINTMENTS.WAITLIST.CONVERT_FAILED'));
    } finally {
      this.converting.set(null);
    }
  }

  trackById = (_: number, e: WaitlistEntry) => e.id;
}
