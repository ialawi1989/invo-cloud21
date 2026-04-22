import { PoolClient } from "pg";
import { PaymnetMethodRepo } from "@src/repo/app/accounts/paymentMethod.repo";
import { PaymnetMethod } from "@src/models/account/PaymnetMethod";
import { PageInfo, queryPage } from "../common/pagination";
import { multiValuesQuery, SQL } from "../common/sql";
import { DuplicatesException, NotFoundException } from "../common/exceptions";
import { Company } from "@src/models/admin/company";
import { Customer } from "@src/models/account/Customer";
import { ResponseData } from "@src/models/ResponseData";

import { DB } from "@src/dbconnection/dbconnection";


export class AccountingRepository {
  private client: PoolClient;

  constructor(client: PoolClient) {
    this.client = client;
  }

  private static accountType = "Promotions";
  async createPromotionsAccounts(companyId: string) {
    const accounts = [
      {
        name: "Promotions Income",
        code: "",
        type: AccountingRepository.accountType,
        parentType: ParentType.OPERATING_INCOME,
        description: "",
        default: true,
        translation: {
          name: { ar: "إيرادات العروض الترويجية", en: "Promotions Income" },
        },
      },
      {
        name: "Promotions Expense",
        code: "",
        type: AccountingRepository.accountType,
        parentType: ParentType.OPERATING_EXPENSE,
        description: "",
        default: true,
        translation: {
          name: { ar: "مصروفات العروض الترويجية", en: "Promotions Expense" },
        },
      },
      {
        name: "Promotions Liability",
        code: "",
        type: AccountingRepository.accountType,
        parentType: ParentType.CURRENT_LIABILITIES,
        description: "",
        default: true,
        translation: {
          name: {
            ar: "الالتزامات المتعلقة بالعروض الترويجية",
            en: "Promotions Liability",
          },
        },
      },
    ];

    await Promise.all(
      accounts.map(async (account) => {
        const result = await this.addAccount(this.client, account, companyId);
        return result;
      }),
    );
  }

  async addAccount(
    client: PoolClient,
    account: any,
    companyId: string,
    employeeId: string | null = null,
  ) {
    /**Insert Account Query */
    const query: SQL = {
      text: `INSERT INTO "Accounts" ("name",  "code", "type", "parentType", "description", "companyId", "default", "translation")
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8) 
                RETURNING id`,
      values: [
        account.name,
        account.code,
        account.type,
        account.parentType,
        account.description,
        companyId,
        account.default,
        account.translation,
      ],
    };
    const insert = await client.query(query.text, query.values);
    const accountId = (<any>insert.rows[0]).id;
    return accountId;
  }

  async getPromotionAccountByParentType(
    companyId: string,
    parentType: ParentType,
  ): Promise<AccountInfo> {
    const defaultAccount = true;

    const query = {
      text: `SELECT "id","name" from "Accounts" where "type" =$1 and "default"=$2 and "companyId"=$3 and "parentType"=$4`,
      values: [
        AccountingRepository.accountType,
        defaultAccount,
        companyId,
        parentType,
      ],
    };

    const result = await this.client.query(query.text, query.values);
    let accountInfo: AccountInfo;
    if (!result.rows || result.rows.length == 0) {
      await this.createPromotionsAccounts(companyId);
      accountInfo = await this.getPromotionAccountByParentType(
        companyId,
        parentType
      );
    } else {
      accountInfo = result.rows[0];
    }
    return accountInfo;
  }

  async createPromotionPaymentMethod(companyId: string) {
    const account = await this.getPromotionAccountByParentType(
      companyId,
      ParentType.CURRENT_LIABILITIES
    );

    const paymentMethod = new PaymnetMethod();

    paymentMethod.name = "Points";
    paymentMethod.type = "point";
    paymentMethod.rate = 1;
    paymentMethod.symbol = "";
    paymentMethod.afterDecimal = 0;
    paymentMethod.accountId = account.id;
    paymentMethod.companyId = companyId;
    paymentMethod.updatedDate = new Date();
    paymentMethod.defaultImage = "";
    paymentMethod.index = 0;
    paymentMethod.isEnabled = true;
    paymentMethod.settings = null;
    paymentMethod.bankCharge = 0;
    paymentMethod.pos = true;
    paymentMethod.options = {
      OpenDrawer: false,
      ReqCode: false,
    };
    paymentMethod.mediaId = null;
    paymentMethod.formType = "";
    paymentMethod.country = "";
    paymentMethod.translation = { ar: "نقاط", en: "Points" };
    paymentMethod.showInAccount = true;
    paymentMethod.currencyCode = "BHD";

    const reqData = await PaymnetMethodRepo.addPaymentMethod(
      this.client,
      paymentMethod,
      companyId
    );
    return reqData.data.id;
  }

  async enablePaymentMethods(
    companyId: string,
    paymentMethodId: string,
    enabled: boolean = true
  ) {
    const query: SQL = {
      text: `UPDATE "PaymentMethods"
              SET "isEnabled"=$1
              WHERE id =$2 `,
      values: [enabled, paymentMethodId],
    };

    return await this.client.query(query.text, query.values);
  }

  async insertJournals(companyId: string, journals: Journal[]) {
    const dbTable = "PromotionsCustomerPoints";
    const journalDate = new Date();
    journals = await Promise.all(
      journals.map(async (journal) => {
        if (!journal.accountId || journal.accountId == "") {
          const account = await this.getPromotionAccountByParentType(
            companyId,
            journal.accountParentType
          );
          journal.accountId = account.id;
          journal.accountName = account.name;
        }

        if (journal.id == undefined || (journal.id == "" && dbTable)) {
          journal.id = `${dbTable}_${journal.accountName}_${journal.pointsId}_${journalDate}`;
        }
        return journal;
      })
    );
    const query: SQL = {
      text: `INSERT INTO "JournalRecords" (
        --parents
        "companyId",
        "accountId",
        "name", --account name

        --related database record
        "dbTable",
        "referenceId",
        "code",

        "userName",

        --journal info
        "id",
        "amount",
        "createdAt"
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      values: journals.map((journal) => {
        return [
          // parents
          companyId,
          journal.accountId,
          journal.accountName,

          //related database record
          "PromotionsCustomerPoints",
          journal.pointsId,
          journal.code,

          journal.userName,

          //journal info
          journal.id,
          journal.total * 1.0,
          journalDate,
        ];
      }),
    };
    await multiValuesQuery(this.client, query.text, query.values);
  }

  public async getInvoices(
    companyId: string,
    invoiceNumber?: string,
    phoneNumber?: string,
    pageInfo?: PageInfo
  ) {
    // Build SQL with correct parameter indices and optional filter
    const values: any[] = [];
    let p = 1;
    //subTotal = 0;

    //TODO: consider using joins instead of inner select statements
    let text = `--sql
    SELECT
      i.id,
      i."createdAt",
      i."invoiceNumber",
      c."phone",
      i."total",
      i."status",
      (COUNT(DISTINCT pm.id) FILTER (
        WHERE ip."status" = 'SUCCESS' AND pm."name" ILIKE 'point%'
      )) > 0 AS "isPointPayment",
      (COUNT(DISTINCT cp.id)) > 0 AS "isGavePoints"
    FROM "Invoices" i
      JOIN "Customers" c ON c."id" = i."customerId"
      LEFT JOIN "InvoicePaymentLines" ipl ON ipl."invoiceId" = i."id"
      LEFT JOIN "InvoicePayments" ip ON ip."id" = ipl."invoicePaymentId"
      LEFT JOIN "PaymentMethods" pm ON pm."id" = ip."paymentMethodId"
      LEFT JOIN "PromotionsCustomerPoints" cp 
        ON (cp."points"->>'invoiceId')::uuid = i."id"
    WHERE i."companyId" = $${p} AND c."companyId" = $${p++}
  `;

    values.push(companyId);

    if (invoiceNumber && invoiceNumber.trim() !== "") {
      text += ` AND i."invoiceNumber" ILIKE $${p++}
       `;
      values.push(`%${invoiceNumber}%`);
    }

    if (phoneNumber && phoneNumber.trim() !== "") {
      text += ` AND (c.phone = $${p} OR c.mobile = $${p++})
      `;
      values.push(phoneNumber);
    }

    if (p == 2) {
      return [];
    }
    text += `
    GROUP BY
      i.id,
      i."createdAt",
      i."invoiceNumber",
      c."phone",
      i."total",
      i."status"
  `;
    const query = { text, values };

    // One-round-trip paginator (clamps to last page if pageNum is too large)
    const result = await queryPage<InvoiceInfo>(this.client, query, pageInfo);

    return result;
  }

  public async getInvoicesByIds(
    invoiceIds: string[],
    status?: string,
    includeLines: boolean = false
  ) {
    const query: SQL = {
      text: `--sql
          SELECT
            i."id",
            i."invoiceNumber",
            i."companyId",
            i."total",
            i."branchId",
            i."serviceId",
            i."invoi2te" AS "date",
            i."status",
            i."pointsDiscount",
            i."couponId",
            i."promoCoupon",
            c."phone" AS "customerPhone",
            pc."customerTierId",
            COALESCE(pay.payments, '[]'::jsonb) AS payments

          ${
            includeLines != true
              ? ``
              : `--sql
             , COALESCE(details.lines, '[]'::jsonb) AS lines
          `
          }

          FROM "Invoices" i
          LEFT JOIN "Customers" c
            ON c."id" = i."customerId"
            AND c."companyId" = i."companyId"
          LEFT JOIN "PromotionsCustomers" pc
            ON pc."phoneNumber" = c."phone"
            AND pc."companyId" = c."companyId"
          LEFT JOIN LATERAL (
            SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', p."id",
                      'methodId', p."paymentMethodId",
                      'methodType', pm."type",
                      'amount', p."paidAmount"
                    )
                  ) AS payments
            FROM "InvoicePaymentLines" pl
            JOIN "InvoicePayments" p
              ON p."id" = pl."invoicePaymentId"
              AND p."status" = 'SUCCESS'
            JOIN "PaymentMethods" pm
              ON pm."id" = p."paymentMethodId"
              AND i."companyId" = pm."companyId"
            WHERE pl."invoiceId" = i."id"
          ) AS pay ON TRUE

          
          ${
            includeLines != true
              ? ``
              : `--sql
          LEFT JOIN LATERAL (

            SELECT jsonb_agg(
        jsonb_build_object(
          'productId', il."productId",
          'qty', il."qty"
        )
      ) AS lines
      FROM "InvoiceLines" il
      WHERE il."invoiceId" = i."id"
           

          ) AS details ON TRUE

          `
          }

          WHERE i."id" = ANY($1::uuid[])
         `,
      values: [invoiceIds],
    };

    if (status) {
      query.text += `--sql
          AND i."status" = $2
          `;
      query.values?.push(status);
    }
    query.text += `--sql
     ORDER BY i."companyId", i."invoiceNumber"
    `;
  console.log(query.text)
    const result = await this.client.query(query.text, query.values);

    return result.rows as Invoice[];
  }

  public async getInvoice(
    invoiceId: string,
    status?: string,
    includeLines: boolean = false
  ) {
    const result = await this.getInvoicesByIds(
      [invoiceId],
      status,
      includeLines
    );

    if (!result || result.length == 0) {
      throw new NotFoundException("Invoice Not Found:" + invoiceId);
    }
    if (result.length > 1) {
      throw new DuplicatesException(
        result.length + "duplicates Invoice Not Found:" + invoiceId
      );
    }
    return result[0];
  }
}

export enum ParentType {
  CURRENT_LIABILITIES = "Current Liabilities",
  OPERATING_EXPENSE = "Operating Expense",
  OPERATING_INCOME = "Operating Income",
}

export interface InvoiceInfo {
  id: string;
  createdAt: Date;
  invoiceNumber: string;
  total: number;
  isPointPayment: boolean;
  isGavePoints: boolean;
  status: string;
}

export interface Journal {
  accountId?: string;
  accountName?: string;
  accountParentType: ParentType;
  total: number;
  pointsId: string;
  id?: string;
  code: string;
  userName: string;
}

export interface AccountInfo {
  id: string;
  name: string;
}

export interface InvoicePayment {
  id: string;
  methodType: string;
  methodId: string;
  amount: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  customerPhone?: string;
  total: number;
  status: string;
  customerTierId: string;
  date: Date;
  payments: InvoicePayment[];
  lines: any[];
  pointsDiscount: number | null;
  promoDiscount: number | null;
  couponId:string | null;
  branchId?: string;
  serviceId?: string;
}
