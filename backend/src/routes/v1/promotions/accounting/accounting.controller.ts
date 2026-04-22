import { Request, Response, NextFunction, Router } from "express";
import { AccountingProvider } from "./accounting.business";
import { ProcessRequest } from "../common/web";

export class AccountingController {
  public static registerRouts(router: Router) {
    router.get(
      "/accounting/invoice",
      ProcessRequest(
        AccountingProvider.Create,
        AccountingController.getInvoices
      )
    );
  }

  public static async getInvoices(
    req: Request,
    res: Response,
    next: NextFunction,
    accountingProvider: AccountingProvider
  ) {
    const company = res.locals.company;

    const invoiceNumber = req.query["invoiceNumber"]?.toString() || "";
    const phoneNumber = req.query["phoneNumber"]?.toString() || "";

    let pageInfo = res.locals.pageInfo;

    let result = await accountingProvider.getInvoices(
      company.id,
      invoiceNumber,
      phoneNumber,
      pageInfo
    );

    return result;
  }
}
