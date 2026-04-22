import { Request, Response, NextFunction, Router } from "express";
import { CustomerTiersProvider } from "./customer-tiers.business";
import { ProcessRequest } from "../common/web";
import { CustomerTierUpdate } from "./customer-tiers.modal";

export class CustomerTiersController {
  public static registerRouts(router: Router) {
    
    router.get(
      "/customer-tiers",
      ProcessRequest(
        CustomerTiersProvider.Create,
        CustomerTiersController.getCustomerTiers
      )
    );

    router.get(
      "/customer-tiers-history",
      ProcessRequest(
        CustomerTiersProvider.Create,
        CustomerTiersController.getCustomerTierAction
      )
    );


    router.put(
      //UPDATE
      "/customer-tiers",
      ProcessRequest(
        CustomerTiersProvider.Create,
        CustomerTiersController.setCustomerTiers
      )
    );

    router.put(
      //UPDATE
      "/customer-tiers-evaluate",
      ProcessRequest(
        CustomerTiersProvider.Create,
        CustomerTiersController.evaluateCustomerTiers
      )
    );
  }

  public static async getCustomerTiers(
    req: Request,
    res: Response,
    next: NextFunction,
    customerTiersProvider: CustomerTiersProvider
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;

    const result = await customerTiersProvider.getCustomerTierSettings(
      company.id
    );
    return result;
  }
  public static async getCustomerTierAction(
    req: Request,
    res: Response,
    next: NextFunction,
    customerTiersProvider: CustomerTiersProvider
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const pageInfo = res.locals.pageInfo;
    const sortInfo = res.locals.sortInfo;

    const result = await customerTiersProvider.getCustomerTierAction(
      company.id,
      pageInfo,
      sortInfo
    );

    return result;
  }
  public static async setCustomerTiers(
    req: Request,
    res: Response,
    next: NextFunction,
    customerTiersProvider: CustomerTiersProvider
  ) {
    const result = req.body;

    const company = res.locals.company;
    const employeeId = res.locals.user;

    const customerTiersUpdate: CustomerTierUpdate = req.body.action;

    await customerTiersProvider.setCustomerTierSettings(
      company.id,
      result,
      employeeId
    );
    return true;
  }

  public static async evaluateCustomerTiers(
    req: Request,
    res: Response,
    next: NextFunction,
    customerTiersProvider: CustomerTiersProvider
  ) {
    const result = req.body;

    const company = res.locals.company;
    const employeeId = res.locals.user;

    await customerTiersProvider.evaluateCustomerTiers(
      company.id,
      result.reason,
      result.note,
      employeeId
    );
    return true;
  }
}
