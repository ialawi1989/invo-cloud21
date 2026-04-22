import { Request, Response, NextFunction, Router } from "express";
import {
  CustomerPointAction,
  CustomerPointsActionName,
  CustomerPointsUpdate,
} from "./promotions-point.modal";
import { PromotionsPointsProvider } from "./promotions-point.business";
import { TranslatedString } from "../promotions.model";
import { ProcessRequest } from "../common/web";
import { ParameterException } from "../common/exceptions";

export class PromotionsPointsController {
  public static registerRouts(router: Router) {
    router.get(
      "/promotions-points/customer-points/summary/:phone_number",
      ProcessRequest(
        PromotionsPointsProvider.Create,
        PromotionsPointsController.getCustomerPointsSummary
      )
    );

    router.get(
      "/promotions-points/customer-points/:id",
      ProcessRequest(
        PromotionsPointsProvider.Create,
        PromotionsPointsController.getCustomerPointsById
      )
    );

    router.get(
      "/promotions-points/statement/:phoneNumber",
      ProcessRequest(
        PromotionsPointsProvider.Create,
        PromotionsPointsController.getAllActionList
      )
    );

    router.get(
      "/promotions-points/customer-points",
      ProcessRequest(
        PromotionsPointsProvider.Create,
        PromotionsPointsController.getCustomerPoints
      )
    );

    router.post(
      //ADD
      "/promotions-points/customer-points",
      ProcessRequest(
        PromotionsPointsProvider.Create,
        PromotionsPointsController.AddCustomerPoints
      )
    );

    router.patch(
      //UPDATE-action
      "/promotions-points/customer-points",
      ProcessRequest(
        PromotionsPointsProvider.Create,
        PromotionsPointsController.updateCustomerPoints
      )
    );

    router.patch(
      //UPDATE-action
      "/promotions-points/customer-points/:id",
      ProcessRequest(
        PromotionsPointsProvider.Create,
        PromotionsPointsController.updateCustomerPointsById
      )
    );

    router.get(
      "/promotions-points/settings",
      ProcessRequest(
        PromotionsPointsProvider.Create,
        PromotionsPointsController.getPointsSettings
      )
    );

    router.get(
      "/promotions-points/history",
      ProcessRequest(
        PromotionsPointsProvider.Create,
        PromotionsPointsController.getPointsActionsList
      )
    );

    router.put(
      //UPDATE
      "/promotions-points/settings",
      ProcessRequest(
        PromotionsPointsProvider.Create,
        PromotionsPointsController.savePointsSettings
      )
    );

    router.get(
      "/promotions-points/customer-points-action/:id",
      ProcessRequest(
        PromotionsPointsProvider.Create,
        PromotionsPointsController.getCustomerPointsAction
      )
    );
  }

  public static async getCustomerPointsSummary(
    req: Request,
    res: Response,
    next: NextFunction,
    promotionsPointsProvider: PromotionsPointsProvider
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const phoneNumber = req.params.phone_number;

    if (phoneNumber == undefined) {
      throw new ParameterException(
        "phoneNumber",
        "phone Number is required for SPEND_POINTS"
      );
    }

    const result = await promotionsPointsProvider.getCustomerPointsSummary(
      company.id,
      phoneNumber
    );

    return result;
  }

  public static async getCustomerPoints(
    req: Request,
    res: Response,
    next: NextFunction,
    promotionsPointsProvider: PromotionsPointsProvider
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const pageInfo = res.locals.pageInfo;
    const sortInfo = res.locals.sortInfo;

    const searchCriteria = req.query["searchCriteria"]?.toString() || "";

    const result = await promotionsPointsProvider.getCustomerPoints(
      company.id,
      searchCriteria,
      true,
      undefined,
      pageInfo,
      sortInfo
    );

    return result;
  }

  public static async getCustomerPointsAction(
    req: Request,
    res: Response,
    next: NextFunction,
    promotionsPointsProvider: PromotionsPointsProvider
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const id = req.params.id;
    const pageInfo = res.locals.pageInfo;
    const sortInfo = res.locals.sortInfo;

    const result = await promotionsPointsProvider.getCustomerPointsAction(
      company.id,
      id,
      pageInfo,
      sortInfo
    );

    return result;
  }

  public static async getCustomerPointsById(
    req: Request,
    res: Response,
    next: NextFunction,
    promotionsPointsProvider: PromotionsPointsProvider
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const id = req.params.id;

    const result = await promotionsPointsProvider.getCustomerPointsById(
      company.id,
      id
    );

    return result;
  }

  public static async AddCustomerPoints(
    req: Request,
    res: Response,
    next: NextFunction,
    promotionsPointsProvider: PromotionsPointsProvider
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const customerPoints = req.body;

    const result = await promotionsPointsProvider.GiveCustomerPoints(
      company.id,
      customerPoints,
      employeeId
    );

    return result;
  }

  public static async updateCustomerPoints(
    req: Request,
    res: Response,
    next: NextFunction,
    promotionsPointsProvider: PromotionsPointsProvider
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const phoneNumber = req.query["phoneNumber"]?.toString() || "";

    const customerPointsUpdate: CustomerPointUpdate = req.body;

    if (phoneNumber == undefined) {
      throw new ParameterException(
        "phoneNumber",
        "Phone Number is required for " + customerPointsUpdate.actionName
      );
    }

    let result: any = null;
    switch (customerPointsUpdate.actionName) {
      case CustomerPointsActionName.SPEND_POINTS:
        if (customerPointsUpdate.pointsValue == undefined) {
          throw new ParameterException(
            "pointsValue",
            "pointsValue is required for " + customerPointsUpdate.actionName
          );
        }

        return await promotionsPointsProvider.SpendCustomerPointsByPhoneNumber(
          company.id,
          phoneNumber,
          customerPointsUpdate.reason,
          customerPointsUpdate.note,
          customerPointsUpdate.pointsValue,
          customerPointsUpdate.spentOrderNumber,
          customerPointsUpdate.spentOrderId,
          employeeId
        );

      default:
        throw new ParameterException(
          "actionName",
          "invalid action name " + customerPointsUpdate.actionName
        );
    }
  }

  public static async updateCustomerPointsById(
    req: Request,
    res: Response,
    next: NextFunction,
    promotionsPointsProvider: PromotionsPointsProvider
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const id = req.params.id;

    const customerPointsUpdate: CustomerPointUpdate = req.body;

    switch (customerPointsUpdate.actionName) {
      case CustomerPointsActionName.CANCEL_POINTS:
        return await promotionsPointsProvider.CancelCustomerPoints(
          company.id,
          id,
          customerPointsUpdate.reason,
          customerPointsUpdate.note,
          employeeId
        );

      case CustomerPointsActionName.RESTORE_POINTS:
        return await promotionsPointsProvider.RestoreCustomerPoints(
          company.id,
          id,
          customerPointsUpdate.reason,
          customerPointsUpdate.note,
          employeeId
        );

      case CustomerPointsActionName.SPEND_POINTS:
        if (customerPointsUpdate.pointsValue == undefined) {
          throw new ParameterException(
            "actionName",
            "pointsValue is required for " + customerPointsUpdate.actionName
          );
        }

        return await promotionsPointsProvider.SpendCustomerPointsById(
          company.id,
          id,
          customerPointsUpdate.reason,
          customerPointsUpdate.note,
          customerPointsUpdate.pointsValue,
          customerPointsUpdate.spentOrderNumber,
          customerPointsUpdate.spentOrderId,
          employeeId
        );
      case CustomerPointsActionName.REFUND:
        if (customerPointsUpdate.pointsValue == undefined) {
          throw new ParameterException(
            "actionName",
            "pointsValue is required for " + customerPointsUpdate.actionName
          );
        }

        return await promotionsPointsProvider.refundCustomerPointsById(
          company.id,
          id,
          customerPointsUpdate.reason,
          customerPointsUpdate.note,
          customerPointsUpdate.pointsValue,
          employeeId
        );
      case CustomerPointsActionName.ACTIVATE:
        return await promotionsPointsProvider.ActivateCustomerPointsById(
          company.id,
          id,
          customerPointsUpdate.reason,
          customerPointsUpdate.note,
          employeeId
        );

      case CustomerPointsActionName.EXTEND:
        if (customerPointsUpdate.expiryDate == undefined) {
          throw new ParameterException(
            "expiryDate",
            "expiryDate is required for " + customerPointsUpdate.actionName
          );
        }

        return await promotionsPointsProvider.ExtendCustomerPoints(
          company.id,
          id,
          customerPointsUpdate.reason,
          customerPointsUpdate.note,
          customerPointsUpdate.expiryDate,
          employeeId
        );

      default:
        throw new ParameterException(
          "actionName",
          "invalid action name " + customerPointsUpdate.actionName
        );
    }
  }

  public static async getPointsActionsList(
    req: Request,
    res: Response,
    next: NextFunction,
    promotionsPointsProvider: PromotionsPointsProvider
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const pageInfo = res.locals.pageInfo;
    const sortInfo = res.locals.sortInfo;

    const result = await promotionsPointsProvider.getPointsActionsList(
      company.id,
      pageInfo,
      sortInfo
    );

    return result;
  }

  public static async getPointsSettings(
    req: Request,
    res: Response,
    next: NextFunction,
    promotionsPointsProvider: PromotionsPointsProvider
  ) {
    const company = res.locals.company;


    const result = await promotionsPointsProvider.getPointsSettings(company.id);

    return result;
  }

  public static async savePointsSettings(
    req: Request,
    res: Response,
    next: NextFunction,
    promotionsPointsProvider: PromotionsPointsProvider
  ) {
    const data = req.body;
    const company = res.locals.company;
    const employeeId = res.locals.user;

    const result = await promotionsPointsProvider.savePointsSettings(
      company.id,
      data,
      employeeId
    );

    return result;
  }

  public static async getAllActionList(
    req: Request,
    res: Response,
    next: NextFunction,
    promotionsPointsProvider: PromotionsPointsProvider
  ) {
    const company = res.locals.company;
    const sessionId = res.locals.userSessionId;
    const phoneNumber = req.params.phoneNumber;
    const pageInfo = res.locals.pageInfo;
    const sortInfo = res.locals.sortInfo;

    const actions = await promotionsPointsProvider.getAllActionList(
      company.id,
      phoneNumber,
      pageInfo,
      sortInfo
    );

    const result: CustomerPointAction[] = actions;

    return result;
  }
}

interface CustomerPointUpdate {
  actionName: CustomerPointsActionName;
  reason: TranslatedString;
  note?: string;
  pointsValue?: number;
  activeDate?: Date;
  expiryDate?: Date;
  spentOrderNumber?: string;
  spentOrderId?: string;
}
