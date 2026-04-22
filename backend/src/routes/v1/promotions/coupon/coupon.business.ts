import { PoolClient } from "pg";
import { SortInfo } from "../common/sortInfo";
import { DbClient } from "../common/sql";
import { PromotionsPointsProvider } from "../promotions-point/promotions-point.business";
import { PromotionsRepository } from "../promotions.data";
import { PromotionsAction, TranslatedString } from "../promotions.model";
import {
  PromotionsCouponsSet,
  CouponSetsActionName,
  CouponSetsStatues,
  CouponSet,
  Coupon,
  CouponStatues,
  CouponActionName,
  CouponSetsSettings,
  CouponSetsSettingsActionName,
  CouponSetsSettingsAction,
} from "./coupon.modal";
import { couponRepository } from "./coupon.data";
import { PageInfo } from "../common/pagination";
import { EditSettings } from "../common/EditSettings.modal";
import { ParameterException } from "../common/exceptions";
import { AccountingProvider } from "../accounting/accounting.business";
import { Status } from "@aws-sdk/client-sesv2";
import { DB } from "@src/dbconnection/dbconnection";
import { CampaignProvider } from "../campaign/campaign.business";

export class CouponProvider {
  CouponRepository: couponRepository;

  constructor(CouponRepository: couponRepository) {
    this.CouponRepository = CouponRepository;
  }
  public static async Create(client?: PoolClient) {
    client = client || (await DbClient());
    return new CouponProvider(
      new couponRepository(new PromotionsRepository(client), client),
    );
  }
  async getCouponSetsActionsList(
    companyId: string,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
  ): Promise<CouponSetsSettingsAction[]> {
    return await this.CouponRepository.getCouponSetsActionsList(
      companyId,
      pageInfo,
      sortInfo,
    );
  }

  async getCouponSetsSettings(companyId: string): Promise<CouponSetsSettings> {
    return await this.CouponRepository.getCouponSetsSettings(companyId);
  }
  //isCouponSetNameExists
  async isCouponSetNameExists(
    companyId: string,
    name: string,
    lang: string,
    id?: string,
  ): Promise<boolean> {
    return await this.CouponRepository.isCouponSetNameExists(
      companyId,
      name,
      lang,
      id,
    );
  }
  async saveCouponSetsSettings(
    companyId: string,
    couponSetsSettings: EditSettings<CouponSetsSettings>,
    employeeId: string,
  ) {
    if (!couponSetsSettings) {
      throw new ParameterException(
        "pointsSettings",
        "pointsSettings cannot be null or undefined",
      );
    }

    const currentSettings = await this.getCouponSetsSettings(companyId);

    const result = await this.CouponRepository.saveCouponSetsSettings(
      companyId,
      couponSetsSettings.setting,
      {
        actionName:
          currentSettings.enabled !== couponSetsSettings.setting.enabled
            ? currentSettings.enabled == true
              ? CouponSetsSettingsActionName.DISABLED
              : CouponSetsSettingsActionName.ENABLED
            : CouponSetsSettingsActionName.EDIT,
        actionDate: new Date(),
        user: employeeId,
        reason: couponSetsSettings.reason,
        note: couponSetsSettings.note,
      },
    );

    return result;
  }

  async activateCouponSet(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string,
  ) {
    const client = await DB.excu.client();
    const campaignProvider = await CampaignProvider.Create(client);
    const couponSets = await this.getCouponSetById(companyId, id);
    if (!couponSets)
      throw new Error(
        `Coupon set with ID ${id} not found for company ${companyId}`,
      );

    if (!(couponSets.status === CouponSetsStatues.INACTIVE)) {
      return;
    }

    const oldIsActive = couponSets.isActive;
    couponSets.isActive = true;

    couponSets.status = CouponProvider.couponSetGetStatus(couponSets);
    await this.CouponRepository.UpdateCouponSet(
      companyId,
      couponSets.id,
      couponSets,
      {
        actionName: CouponSetsActionName.ACTIVATE,
        actionDate: new Date(),
        user: employeeId,
        note: notes,
        reason: reason,
        changes: {
          new: {
            isActive: couponSets.isActive,
          },
          old: {
            isActive: oldIsActive,
          },
        },
      },
    );
    await campaignProvider.updateCampaignsByCouponSetId(
      companyId,
      couponSets.id,
      CouponSetsActionName.ACTIVATE,
      couponSets.status,
    );
  }
  async deactivateCouponSet(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string,
  ) {
    const client = await DB.excu.client();
    const campaignProvider = await CampaignProvider.Create(client);
    const couponSets = await this.getCouponSetById(companyId, id);
    if (!couponSets)
      throw new Error(
        `Coupon with ID ${id} not found for company ${companyId}`,
      );

    if (!(couponSets.status === CouponSetsStatues.ACTIVE)) {
      return;
    }

    const oldIsActive = couponSets.isActive;
    couponSets.isActive = false;

    couponSets.status = CouponProvider.couponSetGetStatus(couponSets);
    await this.CouponRepository.UpdateCouponSet(
      companyId,
      couponSets.id,
      couponSets,
      {
        actionName: CouponSetsActionName.DEACTIVATE,
        actionDate: new Date(),
        user: employeeId,
        note: notes,
        reason: reason,
        changes: {
          new: {
            isActive: couponSets.isActive,
          },
          old: {
            isActive: oldIsActive,
          },
        },
      },
    );
    await campaignProvider.updateCampaignsByCouponSetId(
      companyId,
      couponSets.id,
      CouponSetsActionName.DEACTIVATE,
    );
  }
  async consumedCouponSet(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string,
  ) {
    const client = await DB.excu.client();
    const campaignProvider = await CampaignProvider.Create(client);
    const couponSets = await this.getCouponSetById(companyId, id);
    if (!couponSets)
      throw new Error(
        `Coupon with ID ${id} not found for company ${companyId}`,
      );

    // if (!(couponSets.status === CouponSetsStatues.ACTIVE)) {
    //   return;
    // }

    const oldStatue = couponSets.status;
    //couponSets.status = CouponSetsStatues.CONSUMED;

    couponSets.status = CouponProvider.couponSetGetStatus(couponSets);
    await this.CouponRepository.UpdateCouponSet(
      companyId,
      couponSets.id,
      couponSets,
      {
        actionName: CouponSetsActionName.CONSUMED,
        actionDate: new Date(),
        user: employeeId,
        note: notes,
        reason: reason,
        changes: {
          new: {
            status: couponSets.status,
          },
          old: {
            status: oldStatue,
          },
        },
      },
    );
    await campaignProvider.updateCampaignsByCouponSetId(
      companyId,
      couponSets.id,
      CouponSetsActionName.CONSUMED,
    );
  }
  async activateCoupon(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string,
  ) {
    const coupon = await this.getCouponById(companyId, id);
    if (!coupon)
      throw new Error(
        `coupon with ID ${id} not found for company ${companyId}`,
      );

    if (!(coupon.status === CouponStatues.INACTIVE)) {
      return;
    }

    const oldIsActiveDate = coupon.activeDate;
    coupon.activeDate = new Date();

    coupon.status = CouponProvider.couponGetStatus(coupon);
    await this.CouponRepository.UpdateCoupon(companyId, coupon.id, coupon, {
      actionName: CouponActionName.ACTIVATE,
      actionDate: new Date(),
      user: employeeId,
      note: notes,
      reason: reason,
      changes: {
        new: {
          activeDate: coupon.activeDate,
        },
        old: {
          isActive: oldIsActiveDate,
        },
      },
    });
  }

  async uncancelCoupon(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string,
  ) {
    const coupon = await this.getCouponById(companyId, id);
    if (!coupon)
      throw new Error(
        `coupon with ID ${id} not found for company ${companyId}`,
      );

    if (!(coupon.status === CouponStatues.CANCELED)) {
      return;
    }

    const oldIsCancel = coupon.isCancel;
    coupon.isCancel = false;

    coupon.status = CouponProvider.couponGetStatus(coupon);
    await this.CouponRepository.UpdateCoupon(companyId, coupon.id, coupon, {
      actionName: CouponActionName.UNCANCEL,
      actionDate: new Date(),
      user: employeeId,
      note: notes,
      reason: reason,
      changes: {
        new: {
          isCancel: coupon.isCancel,
        },
        old: {
          isCancel: oldIsCancel,
        },
      },
    });
  }
  async ReActiveCoupon(
    companyId: string,
    reason: TranslatedString,
    notes: string | undefined,
    invoiceId: string,
    employeeId: string,
    client?: PoolClient,
  ) {
    const accountingProvider = await AccountingProvider.Create(client);
    const invoice = await accountingProvider.getInvoice(invoiceId);
    if (invoice.couponId === null) return;
    const coupon = await this.getCouponById(companyId, invoice.couponId);
    if (!coupon) return;
    // throw new Error(
    //   `coupon with ID ${invoice.couponId} not found for company ${companyId}`,
    // );

    if (!(coupon.status === CouponStatues.USED)) {
      return;
    }

    const oldIsUsed = coupon.isUsed;
    coupon.isUsed = false;
    const oldCountOfUsage = coupon.countOfUsage;
    coupon.countOfUsage -= 1;
    coupon.status = CouponProvider.couponGetStatus(coupon);
    await this.CouponRepository.UpdateCoupon(companyId, coupon.id, coupon, {
      actionName: CouponActionName.ACTIVATE,
      actionDate: new Date(),
      user: employeeId,
      note: notes,
      reason: reason,
      changes: {
        new: {
          isUsed: coupon.isUsed,
          countOfUsage: coupon.countOfUsage,
        },
        old: {
          isUsed: oldIsUsed,
          countOfUsage: oldCountOfUsage,
        },
      },
    });
  }
  async UseCoupon(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    invoiceId: string,
    employeeId: string,
  ) {
    const coupon = await this.getCouponById(companyId, id);
    if (!coupon)
      throw new Error(
        `coupon with ID ${id} not found for company ${companyId}`,
      );

    if (!(coupon.status === CouponStatues.ACTIVE)) {
      return;
    }
    const couponSets = await this.CouponRepository.getCouponSetById(
      companyId,
      coupon.couponSetId,
    );
    if (!couponSets)
      throw new Error(
        `CouponSet with ID ${id} not found for company ${companyId}`,
      );
    const today = new Date();
    const oldIsUsed = coupon.isUsed;
    coupon.isUsed = true;
    const oldCountOfUsage = coupon.countOfUsage;
    coupon.countOfUsage += 1;
    coupon.status = CouponProvider.couponGetStatus(coupon);
    coupon.uesDate = today;
    coupon.useInvoiceId = invoiceId;

    const oldUsed = couponSets.used;
    couponSets.used += 1;

    await this.CouponRepository.UpdateCouponSet(
      companyId,
      couponSets.id,
      couponSets,
      {
        actionName: CouponSetsActionName.COUPON_USED,
        actionDate: new Date(),
        user: employeeId,
        note: notes,
        reason: {
          en: "use coupon " + coupon.code,
          ar: "استخدام القسيمة " + coupon.code,
        },
        changes: {
          new: {
            used: couponSets.used,
          },
          old: {
            used: oldUsed,
          },
        },
      },
    );
    await this.CouponRepository.UpdateCoupon(companyId, coupon.id, coupon, {
      actionName: CouponActionName.USED,
      actionDate: new Date(),
      user: employeeId,
      note: notes,
      reason: reason,
      changes: {
        new: {
          isUsed: coupon.isUsed,
          countOfUsage: coupon.countOfUsage,
        },
        old: {
          isUsed: oldIsUsed,
          countOfUsage: oldCountOfUsage,
        },
      },
      extraDetails: {
        useInvoiceId: invoiceId,
      },
    });
  }
  async cancelCoupon(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string,
  ) {
    const coupon = await this.getCouponById(companyId, id);
    if (!coupon)
      throw new Error(
        `coupon with ID ${id} not found for company ${companyId}`,
      );

    if (!(coupon.status !== CouponStatues.CANCELED)) {
      return;
    }

    const oldIsCancel = coupon.isCancel;
    coupon.isCancel = true;

    coupon.status = CouponProvider.couponGetStatus(coupon);
    await this.CouponRepository.UpdateCoupon(companyId, coupon.id, coupon, {
      actionName: CouponActionName.CANCEL,
      actionDate: new Date(),
      user: employeeId,
      note: notes,
      reason: reason,
      changes: {
        new: {
          isCancel: coupon.isCancel,
        },
        old: {
          isCancel: oldIsCancel,
        },
      },
    });
  }

  async expiredCoupon(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string,
  ) {
    const coupon = await this.getCouponById(companyId, id);
    if (!coupon)
      throw new Error(
        `coupon with ID ${id} not found for company ${companyId}`,
      );

    let status = CouponProvider.couponGetStatus(coupon);
    switch (status) {
      case CouponStatues.INACTIVE:
        throw new Error(
          `cannot expire points that are in ${coupon.status} status`,
        );

      default:
        break;
    }

    const oldStatus = coupon.status;
    coupon.status = CouponProvider.couponGetStatus(coupon);
    await this.CouponRepository.UpdateCoupon(companyId, coupon.id, coupon, {
      actionName: CouponActionName.EXPIRE,
      actionDate: new Date(),
      user: employeeId,
      note: notes,
      reason: reason,
      changes: {
        new: {
          status: coupon.status,
        },
        old: {
          status: oldStatus,
        },
      },
    });
  }

  async extendCoupon(
    companyId: string,
    id: string,
    expiryDate: Date,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string,
  ) {
    const coupon = await this.getCouponById(companyId, id);
    if (!coupon)
      throw new Error(
        `coupon with ID ${id} not found for company ${companyId}`,
      );

    if (!(coupon.status !== CouponStatues.CANCELED)) {
      return;
    }

    const oldExpiryDate = coupon.expiryDate;
    coupon.expiryDate = expiryDate;

    coupon.status = CouponProvider.couponGetStatus(coupon);
    await this.CouponRepository.UpdateCoupon(companyId, coupon.id, coupon, {
      actionName: CouponActionName.EXTEND,
      actionDate: new Date(),
      user: employeeId,
      note: notes,
      reason: reason,
      changes: {
        new: {
          expiryDate: coupon.expiryDate,
        },
        old: {
          expiryDate: oldExpiryDate,
        },
      },
    });
  }

  async getCouponSets(
    companyId: string,
    couponSetName?: string,
    couponsStatues?: CouponSetsStatues,
    includeActions: boolean = false,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
  ): Promise<PromotionsCouponsSet[]> {
    const result = await this.CouponRepository.getCouponSets(
      companyId,
      couponSetName,
      couponsStatues,
      pageInfo,
      sortInfo,
    );

    const updatedCoupons = await Promise.all(
      result.map(async (couponSet, index) => {
        const couponSetStatus = CouponProvider.couponSetGetStatus(couponSet);
        if (couponSet.status != couponSetStatus) {
          if (couponSetStatus === CouponSetsStatues.CONSUMED) {
            await this.consumedCouponSet(
              companyId,
              couponSet.id,
              {
                an: "Automatically marked as consumed due to system status recalculation",
                ar: "تم تحويل الحالة إلى مستهلك تلقائياً بسبب إعادة احتساب الحالة من النظام",
              },
              "",
              "SYSTEM",
            );
          } else {
            throw new ParameterException(
              "couponsSet",
              `couponsSet with ID ${couponSet.id} have a problem in its status`,
            );
          }
        }
        return couponSet;
      }),
    );

    return updatedCoupons.filter(
      (p) => !couponsStatues || p.status === couponsStatues,
    );
  }

  async getCoupons(
    companyId: string,
    couponSetId: string,
    couponsStatues?: CouponStatues,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
  ): Promise<Coupon[]> {
    const result = await this.CouponRepository.getCoupons(
      companyId,
      couponSetId,
      couponsStatues,
      pageInfo,
      sortInfo,
    );

    const updatedCoupons = await Promise.all(
      result.map(async (coupon, index) => {
        const couponStatus = CouponProvider.couponGetStatus(coupon);
        if (coupon.status != couponStatus) {
          if (couponStatus === CouponStatues.EXPIRED) {
            await this.expiredCoupon(
              companyId,
              coupon.id,
              {
                an: "The activation period for these coupon has ended",
                ar: "انتهت فترة التفعيل لهذه الكوبونات",
              },
              "",
              "SYSTEM",
            );
          } else {
            throw new ParameterException(
              "coupons",
              `Customer coupons with ID ${coupon.id} have a problem in its status`,
            );
          }
        }
        return coupon;
      }),
    );

    return updatedCoupons.filter(
      (p) => !couponsStatues || p.status === couponsStatues,
    );
  }

  async getCouponSetsActions(
    companyId: string,
    CouponSetsId: string,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
  ): Promise<PromotionsAction[]> {
    return await this.CouponRepository.getCouponSetsActions(
      companyId,
      CouponSetsId,
      pageInfo,
      sortInfo,
    );
  }
  async getCouponActions(
    companyId: string,
    couponsId: string,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
    client?: PoolClient,
  ): Promise<PromotionsAction[]> {
    const accountingProvider = await AccountingProvider.Create(client);
    const actions = await this.CouponRepository.getCouponActions(
      companyId,
      couponsId,
      pageInfo,
      sortInfo,
    );

    for (const action of actions) {
      if (
        action.actionName === CouponActionName.USED &&
        action.extraDetails?.useInvoiceId
      ) {
        const order = await accountingProvider.getInvoice(
          action.extraDetails.useInvoiceId,
        );
        if (order?.invoiceNumber) {
          action.extraDetails.orderNumber = order.invoiceNumber;
          action.note = `Used On Order #${order.invoiceNumber}`;
        } else {
          action.note = "pending accept";
        }
      }
    }

    return actions;
  }

  async generateUniquePrefix(companyId: string, name: string): Promise<string> {
    return await this.CouponRepository.generateUniquePrefix(companyId, name);
  }
  async getCouponSetById(
    companyId: string,
    id: string,
    branchId?: string,
    serviceId?: string,
  ): Promise<PromotionsCouponsSet | undefined> {
    const CouponSets = await this.CouponRepository.getCouponSetById(
      companyId,
      id,
    );
    if (CouponSets) {
      CouponSets.status = CouponProvider.couponSetGetStatus(CouponSets);
      if (branchId && CouponSets.branchesId) {
        if (!CouponSets.branchesId.includes(branchId)) {
          return undefined;
        }
      }
      if (serviceId && CouponSets.servicesId) {
        if (!CouponSets.servicesId.includes(serviceId)) {
          return undefined;
        }
      }
    }

    return CouponSets;
  }

  async getCouponById(
    companyId: string,
    id: string,
  ): Promise<Coupon | undefined> {
    const Coupon = await this.CouponRepository.getCouponById(companyId, id);
    if (Coupon) {
      Coupon.status = CouponProvider.couponGetStatus(Coupon);
    }
    return Coupon;
  }

  async AddCouponSet(
    companyId: string,
    CouponSet: PromotionsCouponsSet,
    employeeId: string,
  ): Promise<string> {
    CouponSet.status = CouponProvider.couponSetGetStatus(CouponSet);
    return await this.CouponRepository.AddCouponSets(companyId, CouponSet, {
      actionName: CouponSetsActionName.ADD,
      actionDate: new Date(),
      user: employeeId,
      reason: { an: "" },
      note: "",
      changes: {
        new: CouponSet,
      },
    });
  }
  async IssueCoupon(
    companyId: string,
    coupon: Coupon,
    count: number,
    employeeId: string,
    reason: TranslatedString,
    notes: string | undefined,
  ): Promise<string> {
    const couponSets = await this.CouponRepository.getCouponSetById(
      companyId,
      coupon.couponSetId,
    );
    if (!couponSets)
      throw new Error(
        `Coupon set with ID ${coupon.couponSetId} not found for company ${companyId}`,
      );

    if (!(couponSets.status === CouponSetsStatues.ACTIVE)) {
      return "";
    }
    if (couponSets.max > 0 && couponSets.issued === couponSets.max) {
      return "cannot issued more coupons from this coupon set";
    }
    coupon.status = CouponProvider.couponGetStatus(coupon);
    if (couponSets) {
      couponSets.issued = count + couponSets.issued;
      await this.CouponRepository.UpdateCouponSet(
        companyId,
        couponSets.id,
        couponSets,
        {
          actionName: CouponSetsActionName.ISSUED,
          actionDate: new Date(),
          user: employeeId,
          note: notes,
          reason: reason,
          changes: {
            new: {
              issue: couponSets.issued,
            },
            old: {
              issue: count + couponSets.issued,
            },
          },
        },
      );
    }
    for (let i = 0; i < count; i++) {
      coupon.code = `${couponSets.codePrefix}${this.generateCouponCode()}`;

      await this.CouponRepository.IssueCoupon(companyId, coupon, {
        actionName: CouponActionName.ISSUED,
        actionDate: new Date(),
        user: employeeId,
        reason: { an: "" },
        note: "",
        changes: {
          new: coupon,
        },
      });
    }
    const couponSetStatus = CouponProvider.couponSetGetStatus(couponSets);
    if (couponSets.status != couponSetStatus) {
      if (couponSetStatus === CouponSetsStatues.CONSUMED) {
        await this.consumedCouponSet(
          companyId,
          couponSets.id,
          {
            an: "Automatically marked as consumed due to system status recalculation",
            ar: "تم تحويل الحالة إلى مستهلك تلقائياً بسبب إعادة احتساب الحالة من النظام",
          },
          "",
          "SYSTEM",
        );
      } else {
        throw new ParameterException(
          "couponsSet",
          `couponsSet with ID ${couponSets.id} have a problem in its status`,
        );
      }
    }

    return "";
  }
  private generateCouponCode(length: number = 8): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";

    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
  }

  async updateCouponSet(
    companyId: string,
    id: string,
    CouponSet: PromotionsCouponsSet,
    employeeId: string,
    reason: TranslatedString,
    note?: string,
  ) {
    const client = await DB.excu.client();
    const campaignProvider = await CampaignProvider.Create(client);
    //solved TODO: getCouponsById -> exist(companyId, id)
    let oldCouponSet = await this.getCouponSetById(companyId, id);
    if (!oldCouponSet)
      throw new Error(
        `Coupon with ID ${id} not found for company ${companyId}`,
      );

    CouponSet.status = CouponProvider.couponSetGetStatus(CouponSet);

    await this.CouponRepository.UpdateCouponSet(companyId, id, CouponSet, {
      actionName: CouponSetsActionName.EDITED,
      actionDate: new Date(),
      user: employeeId,
      reason: reason,
      note: note || "",
      changes: {
        old: oldCouponSet,
        new: CouponSet,
      },
    });

    if (CouponSet.status === CouponSetsStatues.ACTIVE) {
      await campaignProvider.updateCampaignsByCouponSetId(
        companyId,
        CouponSet.id,
        CouponSetsActionName.ACTIVATE,
        CouponSet.status,
      );
    }
  }
  async updateCoupon(
    companyId: string,
    id: string,
    coupon: Coupon,
    employeeId: string,
    reason: TranslatedString,
    note?: string,
  ) {
    //solved TODO: getCouponsById -> exist(companyId, id)
    let oldCoupon = await this.getCouponById(companyId, id);
    if (!oldCoupon)
      throw new Error(
        `Coupon with ID ${id} not found for company ${companyId}`,
      );

    coupon.status = CouponProvider.couponGetStatus(coupon);

    await this.CouponRepository.UpdateCoupon(companyId, id, coupon, {
      actionName: CouponActionName.EDITED,
      actionDate: new Date(),
      user: employeeId,
      reason: reason,
      note: note || "",
      changes: {
        old: oldCoupon,
        new: coupon,
      },
    });
  }

  static couponSetGetStatus(data: CouponSet): CouponSetsStatues {
    if (data.isActive == false) {
      return CouponSetsStatues.INACTIVE;
    }
    if (data.max > 0 && data.issued === data.max) {
      return CouponSetsStatues.CONSUMED;
    }
    {
      return CouponSetsStatues.ACTIVE;
    }
  }
  public async redeemCoupon(
    companyId: string,
    couponId: string,
    couponDiscount: number,
    invoiceId: string,
    client?: PoolClient,
  ) {
    if (couponDiscount) {
      //  const accountingProvider = await AccountingProvider.Create(client);
      // const invoice = await accountingProvider.getInvoice(invoiceId);
      const settings = await this.getCouponSetsSettings(companyId);
      if (settings.enabled) {
        await this.UseCoupon(
          companyId,
          couponId,
          { en: "Checkout use ", ar: "استخدام الكوبون عند الدفع" },
          "Using coupon for order",
          invoiceId,
          "SYSTEM",
        );
      }
    }
  }
  static couponGetStatus(data: Coupon): CouponStatues {
    const today = new Date();
    const activeDate = new Date(data.activeDate).setHours(0, 0, 0, 0);
    const expiryDate = new Date(data.expiryDate).setHours(0, 0, 0, 0);
    const currentDate = today.setHours(0, 0, 0, 0);
    if (data.isCancel) {
      return CouponStatues.CANCELED;
    }
    if (expiryDate < currentDate) {
      return CouponStatues.EXPIRED;
    }
    if (activeDate > currentDate) {
      return CouponStatues.INACTIVE;
    }
    if (data.isUsed) {
      return CouponStatues.USED;
    }

    return CouponStatues.ACTIVE;
  }

  async getCouponsByNumber(
    companyId: string,
    phoneNumber: string,
    customerCouponsOnly: boolean = false,
    couponsStatues?: CouponStatues,
    branchId?: string,
    serviceId?: string,
  ): Promise<Coupon[]> {
    const coupons = await this.CouponRepository.getCouponsByNumber(
      companyId,
      phoneNumber,
      customerCouponsOnly,
      couponsStatues,
    );

    const updatedCoupons = await Promise.all(
      coupons.map(async (coupon, index) => {
        coupon.couponSet = await this.getCouponSetById(
          companyId,
          coupon.couponSetId,
        );
        if (branchId && coupon.couponSet?.branchesId) {
          if (!coupon.couponSet.branchesId.includes(branchId)) {
            return null;
          }
        }
        if (serviceId && coupon.couponSet?.servicesId) {
          if (!coupon.couponSet.servicesId.includes(serviceId)) {
            return null;
          }
        }
        const couponStatus = CouponProvider.couponGetStatus(coupon);

        if (coupon.status != couponStatus) {
          if (couponStatus === CouponStatues.EXPIRED) {
            await this.expiredCoupon(
              companyId,
              coupon.id,
              {
                an: "The activation period for these coupon has ended",
                ar: "انتهت فترة التفعيل لهذه الكوبونات",
              },
              "",
              "SYSTEM",
            );
          } else {
            throw new ParameterException(
              "coupons",
              `Customer coupons with ID ${coupon.id} have a problem in its status`,
            );
          }
        }
        if (
          coupon.status === CouponStatues.ACTIVE &&
          coupon.couponSet?.status === CouponSetsStatues.INACTIVE
        )
          coupon.status = CouponStatues.INACTIVE;
        return coupon;
      }),
    );

    return updatedCoupons
      .filter((p): p is Coupon => p !== null)
      .filter((p) => !couponsStatues || p.status === couponsStatues)
      .sort((a, b) => a.status.localeCompare(b.status));
  }
}
