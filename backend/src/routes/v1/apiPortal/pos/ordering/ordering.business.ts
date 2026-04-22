import { PoolClient } from "pg";
import { DbClient } from "../../../promotions/common/sql";
import { PageInfo } from "../../../promotions/common/pagination";
import { SortInfo } from "../../../promotions/common/sortInfo";
import { OrderingRepository } from "./ordering.data";
import { OrderOnlineStatusChanged, SubmitOrderData, validateInvoiceData,OrderChanged } from "./ordering.model";
import { ViewQueue } from "@src/utilts/viewQueue";
import { TriggerQueue } from "@src/repo/triggers/triggerQueue";
import { InvoiceStatuesQueue } from "@src/repo/triggers/queue/workers/invoiceStatus.worker";
import { CustomerBalanceQueue } from "@src/repo/triggers/userBalancesQueue";
import { Company } from "@src/models/admin/company";

export class OrderingProvider {
  public static async Create(client?: PoolClient) {
    client = client || (await DbClient());
    return new OrderingProvider(
      new OrderingRepository(client)
    );
  }

  constructor(
    private orderingRepository: OrderingRepository
  ) {}

  async getOrders(
    companyId: string,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo
  ) {
    return await this.orderingRepository.getInvoices(companyId, pageInfo);
  }

  async getOrder(
    companyId: string,
    invoiceId: string
  ) {
    return await this.orderingRepository.getInvoice(companyId, invoiceId);
  }

  async submitOrder(
    company: Company,
    employeeId: string,
    data: SubmitOrderData
  ) {
    data.employeeId = data.id != "" && data.id != null ? data.employeeId : employeeId;

    
    const validate = await this.orderingRepository.validateInvoiceData(data);
    
    if (!validate.valid) {
      throw new Error(validate.error);
    }

    await this.orderingRepository.validateTransactionDate(data.invoiceDate, data.branchId, company.id);

    let result;
    if (data.id == null || data.id == "") {
      data.source = 'Online';
      data.aggregator = "apiPortal"; //'Talabat'//order.source.name;
      data.aggregatorId = data.invoiceNumber ;
      data.invoiceNumber = "";
      data.onlineStatus= data.onlineStatus ?? "Placed";
      data.onlineData= data.onlineData ?? {
        onlineStatus: "Placed"
      };
      result = await this.orderingRepository.addInvoice(company,data);
    } else {
      result = await this.orderingRepository.editInvoice(company, employeeId,data);
    }

    if (result.success && data.status != 'Draft') {
      this.dispatchQueues(result.data.invoice.id, data.customerId, company.id);
    }

    return result;
  }

  private dispatchQueues(invoiceId: string, customerId?: string, companyId?: string) {
    const viewQueue = ViewQueue.getQueue();
    viewQueue.pushJob();

    const triggerQueue = TriggerQueue.getInstance();

    InvoiceStatuesQueue.get().createJob({ id: invoiceId } as any);

    triggerQueue.createJob({ journalType: "Movment", type: "invoice", id: [invoiceId] });
    triggerQueue.createJob({ journalType: "Movment", type: "parentChildMovment", ids: [invoiceId] });
    triggerQueue.createJob({ type: "Invoices", id: [invoiceId], companyId });

    if (customerId) {
      const userBalancesQueue = CustomerBalanceQueue.getInstance();
      userBalancesQueue.createJob({ userId: customerId, dbTable: 'Invoices' });
    }
  }

  async onOrderOnlineStatusChanged(eventDetails: OrderOnlineStatusChanged) {

  }

  
  async onOrderChanged(eventDetails: OrderChanged) {

  }
}
