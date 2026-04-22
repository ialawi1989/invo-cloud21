import { Request, Response, NextFunction, Router } from "express";
import { TranslatedString } from "../promotions.model";
import { ProcessRequest } from "../common/web";
import {
  Coupon,
  CouponActionName,
  CouponSetsActionName,
  CouponSetsStatues,
  CouponStatues,
} from "./coupon.modal";
import { CouponProvider } from "./coupon.business";
import { ParameterException } from "../common/exceptions";
import { ShopperRepo } from "@src/repo/ecommerce/shopper.repo";

//import { CouponRepository } from "./promotions-s.data";

export class CouponController {
  public static registerRouts(router: Router) {
    router.get(
      "/promotions-coupons/coupons",
      ProcessRequest(
        CouponProvider.Create,
        CouponController.getCouponsByNumber,
      ),
    );
    router.get(
      "/promotions-coupons/couponSets",
      ProcessRequest(CouponProvider.Create, CouponController.getCouponSets),
    );
    router.get(
      "/promotions-coupons/isCouponSetNameExists",
      ProcessRequest(
        CouponProvider.Create,
        CouponController.isCouponSetNameExists,
      ),
    );
    router.get(
      "/promotions-coupons/couponSet/:id",
      ProcessRequest(CouponProvider.Create, CouponController.getCouponSetById),
    );

    router.get(
      "/promotions-coupons/coupons/:id",
      ProcessRequest(CouponProvider.Create, CouponController.getCouponsById),
    );

    router.get(
      "/promotions-coupons/coupon/:id",
      ProcessRequest(CouponProvider.Create, CouponController.getCouponById),
    );

    router.get(
      "/promotions-coupons/couponSet-action/:id",
      ProcessRequest(
        CouponProvider.Create,
        CouponController.getCouponSetsActions,
      ),
    );
    router.get(
      "/promotions-coupons/coupon-action/:id",
      ProcessRequest(CouponProvider.Create, CouponController.getCouponActions),
    );

    router.get(
      "/promotions-coupons/generateUniquePrefix/:name?",
      ProcessRequest(
        CouponProvider.Create,
        CouponController.generateUniquePrefix,
      ),
    );
    router.get(
      "/promotions-coupons/settings",
      ProcessRequest(
        CouponProvider.Create,
        CouponController.getCouponSetsSettings,
      ),
    );

    router.put(
      //UPDATE
      "/promotions-coupons/settings",
      ProcessRequest(
        CouponProvider.Create,
        CouponController.saveCouponSetsSettings,
      ),
    );

    router.get(
      "/promotions-coupons/history",
      ProcessRequest(
        CouponProvider.Create,
        CouponController.getCouponSetsActionsList,
      ),
    );

    router.post(
      //ADD
      "/promotions-coupons/couponSet",
      ProcessRequest(CouponProvider.Create, CouponController.AddCouponSet),
    );

    router.post(
      //ADD
      "/promotions-coupons/coupon",
      ProcessRequest(CouponProvider.Create, CouponController.IssueCoupon),
    );
    router.put(
      "/accounting/redeemCoupon",
      ProcessRequest(CouponProvider.Create, CouponController.redeemCoupon),
    );
    router.put(
      //UPDATE
      "/promotions-coupons/couponSet/:id",
      ProcessRequest(CouponProvider.Create, CouponController.updateCouponSet),
    );

    router.patch(
      //UPDATE-Actions
      "/promotions-coupons/couponSet/:id",
      ProcessRequest(CouponProvider.Create, CouponController.patchCouponSet),
    );

    router.put(
      //UPDATE
      "/promotions-coupons/coupon/:id",
      ProcessRequest(CouponProvider.Create, CouponController.updateCoupon),
    );
    //useCoupon
    router.put(
      //UPDATE
      "/promotions-coupons/useCoupon/:id",
      ProcessRequest(CouponProvider.Create, CouponController.useCoupon),
    );
    router.patch(
      //UPDATE-Actions
      "/promotions-coupons/coupon/:id",
      ProcessRequest(CouponProvider.Create, CouponController.patchCoupon),
    );
  }

  public static async saveCouponSetsSettings(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const data = req.body;
    const company = res.locals.company;
    const employeeId = res.locals.user;

    const result = await CouponProvider.saveCouponSetsSettings(
      company.id,
      data,
      employeeId,
    );

    return result;
  }
  public static async getCouponSetsSettings(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;

    const result = await CouponProvider.getCouponSetsSettings(company.id);

    return result;
  }
  public static async getCouponSetsActionsList(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const pageInfo = res.locals.pageInfo;
    const sortInfo = res.locals.sortInfo;

    const result = await CouponProvider.getCouponSetsActionsList(
      company.id,
      pageInfo,
      sortInfo,
    );

    return result;
  }

  public static async getCouponsByNumber(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const sessionId = res.locals.userSessionId;
    const loggedInUser = await ShopperRepo.getShopper(sessionId, company);
    const activeOnly: boolean =
      req.query.activeOnly !== undefined && req.query.activeOnly !== "false";
    const customerCouponsOnly: boolean =
      req.query.customerCouponsOnly !== undefined &&
      req.query.customerCouponsOnly !== "false";
    const branchId: string | undefined =
      typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const serviceId: string | undefined =
      typeof req.query.serviceId === "string" ? req.query.serviceId : undefined;
    const result = await CouponProvider.getCouponsByNumber(
      company.id,
      loggedInUser.phone,
      customerCouponsOnly,
      undefined,
      branchId,
      serviceId
    );
    if (activeOnly === true) {
      const filteredResult = await CouponProvider.getCouponsByNumber(
        company.id,
        loggedInUser.phone,
        customerCouponsOnly,
        CouponStatues.ACTIVE,
        branchId,
        serviceId
      );

      return filteredResult;
    }

    return result;
  }
  public static async getCouponSets(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const pageInfo = res.locals.pageInfo;
    const sortInfo = res.locals.sortInfo;
    const couponSetName = req.query["couponSetName"]?.toString() || "";
    const couponStatue = req.query["couponStatue"] as CouponSetsStatues;
    const minData: boolean =
      req.query.minData !== undefined && req.query.minData !== "false";

    const result = await CouponProvider.getCouponSets(
      company.id,
      couponSetName,
      couponStatue,
      false,
      pageInfo,
      sortInfo,
    );
    const filteredResult = result.filter(
      (item) =>
        item.status === CouponSetsStatues.ACTIVE ||
        item.status === CouponSetsStatues.INACTIVE,
    );

    if (minData === true) {
      return filteredResult.map((item) => ({
        id: item.id,
        expiryPeriod: item.expiryPeriod,
        activePeriod: item.activePeriod,
        name: item.name,
      }));
    }
    return result;
  }
  public static async getCouponsById(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const pageInfo = res.locals.pageInfo;
    const sortInfo = res.locals.sortInfo;
    const id = req.params.id;

    const result = await CouponProvider.getCoupons(
      company.id,
      id,
      undefined,
      pageInfo,
      sortInfo,
    );

    return result;
  }
  public static async getCouponSetById(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const id = req.params.id;

    const result = await CouponProvider.getCouponSetById(company.id, id);
    return result;
  }
  //isCouponSetNameExists
  // async isCouponSetNameExists(
  //   companyId: string,
  //   name: string,
  //   id?: string,
  // ): Promise<boolean> {
  //   return await this.CouponRepository.isCouponSetNameExists(
  //     companyId,
  //     name,
  //     id,
  //   );
  // }
  public static async getCouponById(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const id = req.params.id;

    const result = await CouponProvider.getCouponById(company.id, id);
    return result;
  }

  public static async getCouponSetsActions(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const id = req.params.id;
    const pageInfo = res.locals.pageInfo;
    const sortInfo = res.locals.sortInfo;

    const result = await CouponProvider.getCouponSetsActions(
      company.id,
      id,
      pageInfo,
      sortInfo,
    );
    return result;
  }

  public static async getCouponActions(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const id = req.params.id;
    const pageInfo = res.locals.pageInfo;
    const sortInfo = res.locals.sortInfo;

    const result = await CouponProvider.getCouponActions(
      company.id,
      id,
      pageInfo,
      sortInfo,
    );
    return result;
  }
  public static async AddCouponSet(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const CouponSet = req.body;

    const result = await CouponProvider.AddCouponSet(
      company.id,
      CouponSet,
      employeeId,
    );

    return result;
  }
  public static async generateUniquePrefix(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const name = req.params.name;
    // const name = req.body;

    const result = await CouponProvider.generateUniquePrefix(company.id, name);

    return res.json({ codePrefix: result });
  }
  //   //isCouponSetNameExists
  // async isCouponSetNameExists(
  //   companyId: string,
  //   name: string,
  //   id?: string,
  // ): Promise<boolean> {
  //   return await this.CouponRepository.isCouponSetNameExists(
  //     companyId,
  //     name,
  //     id,
  //   );
  // }

  public static async isCouponSetNameExists(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const name = req.query.name as string;
    const lang = req.query.lang as string;
    const id = req.query.id as string | undefined;

    const result = await CouponProvider.isCouponSetNameExists(
      company.id,
      name,
      lang,
      id,
    );

    return result;
  }
  public static async IssueCoupon(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const Coupon = req.body;

    const result = await CouponProvider.IssueCoupon(
      company.id,
      Coupon.coupon,
      Coupon.count,
      employeeId,
      Coupon.reason,
      Coupon.note,
    );

    return result;
  }

  public static async updateCouponSet(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const { reason, note, ...CouponSetData } = req.body;
    const id = req.params.id;

    const result = await CouponProvider.updateCouponSet(
      company.id,
      id,
      CouponSetData,
      employeeId,
      reason,
      note,
    );

    return result;
  }
  public static async updateCoupon(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const { reason, note, ...CouponData } = req.body;
    const id = req.params.id;

    const result = await CouponProvider.updateCoupon(
      company.id,
      id,
      CouponData,
      employeeId,
      reason,
      note,
    );

    return result;
  }

  public static async patchCouponSet(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const id = req.params.id;
    const CouponSetUpdate: CouponSetUpdate = req.body;

    let result: any = null;
    switch (CouponSetUpdate.actionName) {
      case CouponSetsActionName.ACTIVATE:
        result = await CouponProvider.activateCouponSet(
          company.id,
          id,
          CouponSetUpdate.reason,
          CouponSetUpdate.note,
          employeeId,
        );
        break;
      case CouponSetsActionName.DEACTIVATE:
        result = await CouponProvider.deactivateCouponSet(
          company.id,
          id,
          CouponSetUpdate.reason,
          CouponSetUpdate.note,
          employeeId,
        );
        break;

      default:
        throw new Error(`Coupon Action Name not found `);
    }

    return result;
  }

  public static async patchCoupon(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const id = req.params.id;
    const CouponUpdate: CouponUpdate = req.body;

    let result: any = null;
    switch (CouponUpdate.actionName) {
      case CouponActionName.ACTIVATE:
        result = await CouponProvider.activateCoupon(
          company.id,
          id,
          CouponUpdate.reason,
          CouponUpdate.note,
          employeeId,
        );
        break;
      case CouponActionName.CANCEL:
        result = await CouponProvider.cancelCoupon(
          company.id,
          id,
          CouponUpdate.reason,
          CouponUpdate.note,
          employeeId,
        );
        break;
      case CouponActionName.UNCANCEL:
        result = await CouponProvider.uncancelCoupon(
          company.id,
          id,
          CouponUpdate.reason,
          CouponUpdate.note,
          employeeId,
        );
        break;
      case CouponActionName.USED:
        result = await CouponProvider.UseCoupon(
          company.id,
          id,
          CouponUpdate.reason,
          CouponUpdate.note,
          CouponUpdate.useInvoiceId ?? "",
          employeeId,
        );
        break;
      case CouponActionName.EXTEND:
        if (CouponUpdate.expiryDate == undefined) {
          throw new ParameterException(
            "actionName",
            "pointsValue is required for " + CouponUpdate.actionName,
          );
        }
        result = await CouponProvider.extendCoupon(
          company.id,
          id,
          CouponUpdate.expiryDate,
          CouponUpdate.reason,
          CouponUpdate.note,
          employeeId,
        );
        break;

      default:
        throw new Error(`Coupon Action Name not found `);
    }

    return result;
  }
  public static async useCoupon(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const id = req.params.id;
    const CouponUpdate: CouponUpdate = req.body;
    const result = await CouponProvider.UseCoupon(
      company.id,
      id,
      CouponUpdate.reason,
      CouponUpdate.note,
      CouponUpdate.useInvoiceId ?? "",
      employeeId,
    );

    return result;
  }
  public static async redeemCoupon(
    req: Request,
    res: Response,
    next: NextFunction,
    CouponProvider: CouponProvider,
  ) {
    const company = res.locals.company;

    const { couponId, couponDiscount, invoiceId } = req.body;

    if (!couponId || couponDiscount === undefined) {
      return res
        .status(400)
        .json({ message: "Missing invoice, couponId or couponDiscount" });
    }

    const discountNumber = Number(couponDiscount);

    if (isNaN(discountNumber)) {
      return res
        .status(400)
        .json({ message: "couponDiscount must be a number" });
    }

    const result = await CouponProvider.redeemCoupon(
      company.id,
      couponId,
      discountNumber,
      invoiceId,
    );

    return result;
  }
}

export interface CouponSetUpdate {
  actionName: CouponSetsActionName;
  reason: TranslatedString;
  note?: string;
}
export interface CouponUpdate {
  actionName: CouponActionName;
  reason: TranslatedString;
  note?: string;
  expiryDate?: Date;
  useInvoiceId?: string;
}
