import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { PendingOrder, PendingOrdersService } from '../../services/pending-orders.service';

/**
 * Topbar bell drawer — pending online orders (status 'Placed') with
 * Accept/Reject. Ported from the legacy portal's notifications dropdown;
 * the serial/batch picker sub-modal (for orders with tracked-inventory
 * lines) isn't ported — those orders route to the invoice detail page
 * instead so staff can accept them from the full order screen.
 */
@Component({
  selector: 'app-notifications-panel',
  standalone: true,
  imports: [TranslateModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notifications-panel.component.html',
  styleUrl: './notifications-panel.component.scss',
})
export class NotificationsPanelComponent implements OnInit {
  ref = inject<ModalRef<void>>(MODAL_REF);
  readonly pending = inject(PendingOrdersService);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);

  private busyIds = new Set<string>();

  ngOnInit(): void {
    void this.pending.load();
  }

  isBusy(order: PendingOrder): boolean {
    return this.busyIds.has(order.id);
  }

  needsReview(order: PendingOrder): boolean {
    return !!order.lines && order.lines.length > 0;
  }

  reviewOrder(order: PendingOrder): void {
    this.ref.dismiss();
    this.router.navigate(['/account/invoices/view', order.id]);
  }

  async accept(order: PendingOrder): Promise<void> {
    await this.act(order, 'Accepted', 'NOTIFICATIONS_PANEL.ACCEPT_FAILED');
  }

  async reject(order: PendingOrder): Promise<void> {
    await this.act(order, 'Rejected', 'NOTIFICATIONS_PANEL.REJECT_FAILED');
  }

  private async act(order: PendingOrder, status: 'Accepted' | 'Rejected', failKey: string): Promise<void> {
    if (this.busyIds.has(order.id)) return;
    this.busyIds.add(order.id);
    try {
      const ok = await this.pending.updateStatus(order, status);
      if (!ok) this.toast.error(this.translate.instant(failKey));
    } catch {
      this.toast.error(this.translate.instant(failKey));
    } finally {
      this.busyIds.delete(order.id);
    }
  }

  trackById(_index: number, order: PendingOrder): string {
    return order.id;
  }
}
