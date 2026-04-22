import { PoolClient } from "pg";
import { InvoiceRepo } from "@src/repo/app/accounts/invoice.repo";
import { CompanyRepo } from "@src/repo/admin/company.repo";

import { PageInfo, queryPage } from "../../../promotions/common/pagination";
import { SQL } from "../../../promotions/common/sql";
import { SubmitOrderData, validateInvoiceData as _validateInvoiceData } from "./ordering.model";
import { Company } from "@src/models/admin/company";
import { AccountsRepo } from "@src/repo/app/accounts/account.repo";

export class OrderingRepository {
  private client: PoolClient;

  constructor(client: PoolClient) {
    this.client = client;
  }

  async getInvoices(companyId: string, pageInfo?: PageInfo) {
    const query: SQL = {
      text: `--sql
        SELECT
          i."id",
          i."invoiceNumber",
          i."refrenceNumber",
          i."total",
          i."subTotal",
          i."discountTotal",
          i."chargeTotal",
          i."deliveryCharge",
          i."status",
          i."source",
          i."branchId",
          i."customerId",
          i."employeeId",
          i."serviceId",
          i."tableId",
          i."note",
          i."guests",
          i."invoiceDate",
          i."createdAt",
          i."updatedDate",
          i."isInclusiveTax",
          c."name" AS "customerName",
          c."phone" AS "customerPhone"
        FROM "Invoices" i
          LEFT JOIN "Customers" c ON c."id" = i."customerId"
        WHERE i."companyId" = $1
        ORDER BY i."createdAt" DESC
      `,
      values: [companyId],
    };

    return await queryPage(this.client, query, pageInfo);
  }

  async getInvoice(companyId: string, invoiceId: string) {
    const query: SQL = {
      text: `--sql
        SELECT
          i.*,
          c."name" AS "customerName",
          c."phone" AS "customerPhone",
          COALESCE(lines.data, '[]'::jsonb) AS "lines"
        FROM "Invoices" i
          LEFT JOIN "Customers" c ON c."id" = i."customerId"
          LEFT JOIN LATERAL (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', il."id",
                'productId', il."productId",
                'qty', il."qty",
                'price', il."price",
                'total', il."total",
                'note', il."note",
                'discountAmount', il."discountAmount",
                'discountTotal', il."discountTotal",
                'taxTotal', il."taxTotal"
              ) ORDER BY il."index"
            ) AS data
            FROM "InvoiceLines" il
            WHERE il."invoiceId" = i."id" AND il."parentId" IS NULL
          ) lines ON TRUE
        WHERE i."id" = $1 AND i."companyId" = $2
        LIMIT 1
      `,
      values: [invoiceId, companyId],
    };

    const result = (await this.client.query(query.text, query.values)).rows;
    if (result && result.length > 0) return result[0];
    return undefined;
  }

  async validateInvoiceData(data: SubmitOrderData) {
    if(data.lines != null && data.lines.length > 0)
    {
      for (let line of data.lines){
        if(line.productId != null) {
          line.accountId = line.accountId ?? (await AccountsRepo.getProductSalesId(
        this.client, data.branchId, data.productId)).id;
        }
      }
    }

    return await _validateInvoiceData(data);
  }
  async validateTransactionDate(invoiceDate: Date, branchId: string, companyId: string) {
    await CompanyRepo.validateTransactionDate(this.client, invoiceDate, branchId, companyId);
  }

  async addInvoice(company: Company,data: SubmitOrderData) {
    return await InvoiceRepo.addInvoice(this.client, data, company);
  }

  async editInvoice(company: Company, employeeId: string,data: SubmitOrderData) {
    return await InvoiceRepo.editInvoice(this.client, data, company, employeeId);
  }
}
