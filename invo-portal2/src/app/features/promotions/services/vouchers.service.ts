import { Injectable, inject } from '@angular/core';

import { EditSettings, TranslatedString } from '../models/common.model';
import {
  Voucher,
  VoucherAction,
  VouchersActionName,
  VouchersSettings,
  VouchersSettingAction,
  VouchersStatues,
  VoucherUpdate,
  VoucherWithCount,
} from '../models/vouchers.model';
import { PageInfo, PromotionsApiService, SortInfo } from './promotions-api.service';

const BASE = 'promotions/promotions-vouchers';

/**
 * Vouchers part of the legacy `PromotionsService`, same endpoints, payloads and
 * argument order — only the transport differs (`PromotionsApiService`).
 */
@Injectable({ providedIn: 'root' })
export class VouchersService {
  private api = inject(PromotionsApiService);

  getVouchersSettings = (): Promise<VouchersSettings> =>
    this.api.get<VouchersSettings>(`${BASE}/settings`);

  async setVouchersSettings(vouchersSettings: EditSettings<VouchersSettings>): Promise<void> {
    await this.api.put(`${BASE}/settings`, vouchersSettings);
  }

  addCustomerVouchers(voucher: VoucherWithCount): Promise<string> {
    return this.api.post<string>(`${BASE}/customer-vouchers`, voucher);
  }

  getVouchersActionsList = (pageInfo?: PageInfo, sortInfo?: SortInfo): Promise<VouchersSettingAction[]> =>
    this.api.get<VouchersSettingAction[]>(`${BASE}/history`, { pageInfo, sortInfo });

  sendAddCustomerVouchers(customerVouchers: Voucher): Promise<string> {
    return this.api.post<string>(`${BASE}/send-Add-Customer-Vouchers`, customerVouchers);
  }

  async updateCustomerVouchers(id: string, voucherUpdate: VoucherUpdate, voucher?: Voucher): Promise<string> {
    const url = `${BASE}/customer-vouchers/${id}`;
    return voucher
      ? this.api.patch<string>(url, { voucherUpdate, voucher })
      : this.api.patch<string>(url, { voucherUpdate });
  }

  checkTheVoucher(voucherCode: string): Promise<any> {
    return this.api.get<any>(`${BASE}/check-voucher/${encodeURIComponent(voucherCode)}`);
  }

  async cancelCustomerVouchers(id: string, reason: TranslatedString, notes: string): Promise<void> {
    await this.updateCustomerVouchers(id, { actionName: VouchersActionName.CANCEL_VOUCHERS, reason, note: notes });
  }

  async restoreCustomerVouchers(id: string, reason: TranslatedString, notes: string): Promise<void> {
    await this.updateCustomerVouchers(id, { actionName: VouchersActionName.RESTORE_VOUCHERS, reason, note: notes });
  }

  async activateCustomerVouchers(id: string, reason: TranslatedString, notes: string): Promise<void> {
    await this.updateCustomerVouchers(id, { actionName: VouchersActionName.ACTIVATE, reason, note: notes });
  }

  async editCustomerVouchers(id: string, reason: TranslatedString, notes: string, customerVoucher: Voucher): Promise<void> {
    await this.updateCustomerVouchers(
      id,
      { actionName: VouchersActionName.EDIT, reason, note: notes },
      customerVoucher,
    );
  }

  async spendCustomerVouchers(
    id: string,
    reason: TranslatedString,
    notes: string,
    amount: number,
    spentOrderNumber: string,
    spentOrderId: string,
    paymentLineId?: string,
  ): Promise<void> {
    await this.updateCustomerVouchers(id, {
      actionName: VouchersActionName.SPEND_VOUCHERS,
      reason,
      note: notes,
      vouchersValue: amount,
      spentOrderNumber: spentOrderNumber ?? '',
      spentOrderId: spentOrderId ?? '',
      paymentLineId: paymentLineId ?? '',
    });
  }

  async refundCustomerVouchers(id: string, reason: TranslatedString, notes: string, amount: number): Promise<void> {
    await this.updateCustomerVouchers(id, {
      actionName: VouchersActionName.REFUND,
      reason,
      note: notes,
      vouchersValue: amount,
    });
  }

  async extendCustomerVouchers(id: string, reason: TranslatedString, notes: string, newDate: any): Promise<void> {
    await this.updateCustomerVouchers(id, {
      actionName: VouchersActionName.EXTEND,
      reason,
      note: notes,
      expiryDate: newDate,
    });
  }

  getCustomerVouchers = (
    searchCriteria: string = '',
    voucherStatue?: VouchersStatues,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
  ): Promise<Voucher[]> => {
    let url = `${BASE}/customer-vouchers`;
    const params: string[] = [];
    if (searchCriteria && searchCriteria.trim() != '') {
      params.push(`searchCriteria=${encodeURIComponent(searchCriteria)}`);
      params.push('forList=true');
    }
    if (voucherStatue) params.push(`voucherStatus=${voucherStatue}`);
    if (params.length > 0) url += '?' + params.join('&');
    return this.api.get<Voucher[]>(url, { pageInfo, sortInfo });
  };

  getCustomerVoucher = (id: string = ''): Promise<Voucher> =>
    this.api.get<Voucher>(`${BASE}/customer-vouchers/${id}`);

  getCustomerVoucherAction = (id: string = '', pageInfo?: PageInfo, sortInfo?: SortInfo): Promise<VoucherAction[]> =>
    this.api.get<VoucherAction[]>(`${BASE}/customer-vouchers-action/${id}`, { pageInfo, sortInfo });

  getAllVoucherActions(phoneNumber: string, pageInfo?: PageInfo, sortInfo?: SortInfo): Promise<VoucherAction[]> {
    return this.api.get<VoucherAction[]>(`${BASE}/statement/${encodeURIComponent(phoneNumber)}`, { pageInfo, sortInfo });
  }
}
