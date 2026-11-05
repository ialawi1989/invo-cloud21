import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';

import { PaymentsService } from '../../services/payments.service';

export interface GatewayCheckData {
  /** The failed payment's reference number — what the gateway is asked about. */
  referenceNumber: string;
}

/**
 * "Payment gateway response" (legacy `gatewayCheckModal`): asks the payment gateway, through the backend, what it says about a
 * failed online payment and shows the gateway's status / message next to the online data saved with the payment, with a shortcut
 * to the invoice it was meant for.
 */
@Component({
  selector: 'app-gateway-check-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, ModalHeaderComponent],
  template: `
    <app-modal-header [title]="'PAYMENTS.GATEWAY.TITLE' | translate"/>
    <div class="gc">
      @if (loading()) {
        <p class="gc__muted">{{ 'PAYMENTS.GATEWAY.CHECKING' | translate }}</p>
      } @else if (error()) {
        <div class="gc__error">{{ error() }}</div>
      } @else if (result(); as r) {
        <dl class="gc__facts">
          <div><dt>{{ 'PAYMENTS.GATEWAY.STATUS' | translate }}</dt><dd>{{ r.gatewayStatus }}</dd></div>
          @if (r.message) { <div><dt>{{ 'PAYMENTS.GATEWAY.MESSAGE' | translate }}</dt><dd>{{ r.message }}</dd></div> }
          <div><dt>{{ 'PAYMENTS.LIST.PAYMENT_METHOD' | translate }}</dt><dd>{{ r.paymentName }}</dd></div>
        </dl>
        <h4 class="gc__h">{{ 'PAYMENTS.GATEWAY.GATEWAY_DATA' | translate }}</h4>
        <pre class="gc__pre">{{ r.gatewayData | json }}</pre>
        <h4 class="gc__h">{{ 'PAYMENTS.GATEWAY.SAVED_DATA' | translate }}</h4>
        <pre class="gc__pre">{{ r.savedOnlineData | json }}</pre>
      }
      <div class="gc__end">
        <button type="button" class="gc__btn gc__btn--primary" [disabled]="!result()?.invoiceId"
          [title]="result()?.invoiceId ? '' : ('PAYMENTS.GATEWAY.NO_INVOICE' | translate)" (click)="openInvoice()">
          {{ 'PAYMENTS.GATEWAY.VIEW_INVOICE' | translate }}
        </button>
        <button type="button" class="gc__btn" (click)="ref.dismiss()">{{ 'COMMON.CLOSE' | translate }}</button>
      </div>
    </div>
  `,
  styles: [`
    .gc { padding: 16px 20px; min-width: min(640px, 92vw); max-height: 70vh; overflow: auto; display: flex; flex-direction: column; gap: 10px; font-size: 13.5px; color: #0f172a; }
    .gc__muted { color: #64748b; margin: 0; }
    .gc__error { padding: 10px 12px; border: 1px solid #fecaca; background: #fef2f2; color: #b91c1c; border-radius: 8px; }
    .gc__facts { margin: 0; display: grid; gap: 6px; }
    .gc__facts div { display: flex; gap: 8px; }
    .gc__facts dt { font-weight: 600; min-width: 130px; }
    .gc__facts dd { margin: 0; word-break: break-word; }
    .gc__h { margin: 8px 0 0; font-size: 13px; font-weight: 700; }
    .gc__pre { margin: 0; padding: 10px 12px; background: #f1f5f9; border-radius: 8px; font-size: 12px; max-height: 220px; overflow: auto; white-space: pre-wrap; word-break: break-word; direction: ltr; text-align: left; }
    .gc__end { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
    .gc__btn { border: 1px solid #d0d5dd; background: #fff; color: #344054; border-radius: 8px; padding: 8px 16px; font: inherit; font-weight: 500; cursor: pointer;
      &:disabled { opacity: .5; cursor: not-allowed; } }
    .gc__btn--primary { background: #2691a4; border-color: #2691a4; color: #fff; }
  `],
})
export class GatewayCheckModalComponent implements OnInit {
  readonly data = inject<GatewayCheckData>(MODAL_DATA);
  readonly ref = inject<ModalRef<void>>(MODAL_REF);
  private readonly payments = inject(PaymentsService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly result = signal<any>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.result.set(await this.payments.checkFailedPaymentWithGateway(this.data.referenceNumber));
    } catch (e: any) {
      this.error.set(e?.message || 'Could not check the payment');
    } finally {
      this.loading.set(false);
    }
  }

  openInvoice(): void {
    const id = this.result()?.invoiceId;
    if (!id) return;
    this.ref.dismiss();
    void this.router.navigate(['/account/invoices/view', id]);
  }
}
