import { PoolClient } from "node_modules/@types/pg";
import { AccountingRepository, Journal } from "./accounting.data";
import { DbClient } from "../common/sql";
import { PageInfo } from "../common/pagination";

export class AccountingProvider {
  public static async Create(client?: PoolClient) {
    client = client || (await DbClient());
    return new AccountingProvider(new AccountingRepository(client));
  }

  accountingRepository: AccountingRepository;
  constructor(campaignRepository: AccountingRepository) {
    this.accountingRepository = campaignRepository;
  }

  public async getInvoicesByIds(invoiceIds: string[], status?: string,includeLines:boolean= false) {
    return await this.accountingRepository.getInvoicesByIds(invoiceIds, status,includeLines);
  }

  public async getInvoice(invoiceId: string, status?: string,includeLines:boolean= false) {
    return await this.accountingRepository.getInvoice(invoiceId, status,includeLines);
  }

  public async getInvoices(
    companyId: string,
    invoiceNumber?: string,
    phoneNumber?: string,
    pageInfo?: PageInfo
  ) {
    return await this.accountingRepository.getInvoices(
      companyId,
      invoiceNumber,
      phoneNumber,
      pageInfo
    );
  }

  public async createPromotionPaymentMethod(companyId: string) {
    return await this.accountingRepository.createPromotionPaymentMethod(
      companyId
    );
  }

  public async AddPromotionalJournal(companyId: string, journal: Journal) {
    return await this.accountingRepository.insertJournals(companyId, [journal]);
  }

  public async AddPromotionalJournals(companyId: string, journals: Journal[]) {
    return await this.accountingRepository.insertJournals(companyId, journals);
  }

  public async enablePaymentMethods(
    companyId: string,
    paymentMethodId: string,
    enabled: boolean
  ) {
    return await this.accountingRepository.enablePaymentMethods(
      companyId,
      paymentMethodId,
      enabled
    );
  }
}

export enum ParentType {
  CURRENT_LIABILITIES = "Current Liabilities",
  OPERATING_EXPENSE = "Operating Expense",
  OPERATING_INCOME = "Operating Income",
}
