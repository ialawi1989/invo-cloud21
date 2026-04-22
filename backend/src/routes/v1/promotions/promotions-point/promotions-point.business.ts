import { TranslatedString } from "../promotions.model";
import {
  CustomerPoint,
  CustomerPointAction,
  CustomerPointsActionName,
  CustomerPointsSettingAction,
  CustomerPointsSettingActionName,
  CustomerPointsStatues,
  PointsSettings,
} from "./promotions-point.modal";
import { PromotionsPointsRepository } from "./promotions-point.data";
import { error } from "console";
import { PromotionsRepository } from "../promotions.data";
import {
  AccountingProvider,
  ParentType,
} from "../accounting/accounting.business";
import { PoolClient } from "node_modules/@types/pg";
import { AccountingRepository } from "../accounting/accounting.data";
import { DbClient } from "../common/sql";
import { NotFoundException, ParameterException } from "../common/exceptions";
import { PageInfo } from "../common/pagination";
import { EditSettings } from "../common/EditSettings.modal";
import { SortInfo } from "../common/sortInfo";

export class PromotionsPointsProvider {
  public static async Create(client?: PoolClient) {
    client = client || (await DbClient());
    const promotionsRepository = new PromotionsRepository(client);
    return new PromotionsPointsProvider(
      new PromotionsPointsRepository(promotionsRepository, client),
      promotionsRepository,
      await AccountingProvider.Create(client)
    );
  }

  promotionsRepository: PromotionsRepository;
  promotionsPointsRepository: PromotionsPointsRepository;
  accountingProvider!: AccountingProvider;
  constructor(
    promotionsPointsRepository: PromotionsPointsRepository,
    promotionsRepository: PromotionsRepository,
    accountingProvider: AccountingProvider
  ) {
    this.promotionsPointsRepository = promotionsPointsRepository;
    this.promotionsRepository = promotionsRepository;
    this.accountingProvider = accountingProvider;
  }

  async getPointsSettings(companyId: string): Promise<PointsSettings> {
    return await this.promotionsPointsRepository.getPointsSettings(companyId);
  }

  async getPointsActionsList(
    companyId: string,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo
  ): Promise<CustomerPointsSettingAction[]> {
    return await this.promotionsPointsRepository.getPointsActionsList(
      companyId,
      pageInfo,
      sortInfo
    );
  }
  async savePointsSettings(
    companyId: string,
    pointsSettings: EditSettings<PointsSettings>,
    employeeId: string
  ) {
    if (!pointsSettings || !pointsSettings.setting.pointsValue) {
      throw new ParameterException(
        "pointsSettings",
        "pointsSettings cannot be null or undefined"
      );
    }

    const currentSettings = await this.getPointsSettings(companyId);

    pointsSettings.setting.paymentMethodId = currentSettings.paymentMethodId;

    if (
      currentSettings.enabled == false &&
      pointsSettings.setting.enabled == true &&
      pointsSettings.setting.paymentMethodId == ""
    ) {
      pointsSettings.setting.paymentMethodId =
        await this.accountingProvider.createPromotionPaymentMethod(companyId);
    } else {
      await this.accountingProvider.enablePaymentMethods(
        companyId,
        currentSettings.paymentMethodId,
        pointsSettings.setting.enabled
      );
    }

    const result = await this.promotionsPointsRepository.savePointsSettings(
      companyId,
      pointsSettings.setting,
      {
        actionName:
          currentSettings.enabled !== pointsSettings.setting.enabled
            ? currentSettings.enabled == true
              ? CustomerPointsSettingActionName.DISABLE_POINTS
              : CustomerPointsSettingActionName.ENABLED_POINTS
            : CustomerPointsSettingActionName.EDIT,
        actionDate: new Date(),
        user: employeeId,
        reason: pointsSettings.reason,
        note: pointsSettings.note,
      }
    );

    const currentPointsRate =
      currentSettings.currencyValue / currentSettings.pointsValue;
    const newPointsRate =
      pointsSettings.setting.currencyValue / pointsSettings.setting.pointsValue;
    if (newPointsRate != currentPointsRate) {
      const customerPoints = await this.getCustomerPoints(
        companyId,
        "",
        false,
        CustomerPointsStatues.ACTIVE
      );
      let rate = currentPointsRate - newPointsRate;
      if (rate < 0) {
        rate = -rate;
        await this.accountingProvider.AddPromotionalJournals(
          companyId,
          customerPoints
            .map((points) => [
              {
                accountParentType: ParentType.OPERATING_EXPENSE,
                pointsId: points.id,
                code: "Rate Change",
                userName: "Phone: " + points.phoneNumber,
                total: points.activePoints * rate,
              },
              {
                accountParentType: ParentType.CURRENT_LIABILITIES,
                pointsId: points.id,
                code: "Rate Change",
                userName: "Phone: " + points.phoneNumber,
                total: -points.activePoints * rate,
              },
            ])
            .flat()
        );
      } else {
        await this.accountingProvider.AddPromotionalJournals(
          companyId,
          customerPoints
            .map((points) => [
              {
                accountParentType: ParentType.CURRENT_LIABILITIES,
                pointsId: points.id,
                code: "Rate Change",
                userName: "Phone: " + points.phoneNumber,
                total: points.activePoints * rate,
              },
              {
                accountParentType: ParentType.OPERATING_INCOME,
                pointsId: points.id,
                code: "Rate Change",
                userName: "Phone: " + points.phoneNumber,
                total: -points.activePoints * rate,
              },
            ])
            .flat()
        );
      }
    }
    return result;
  }

  async ExpireCustomerPointsById(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string
  ) {
    const settings = await this.getPointsSettings(companyId);
    if (settings.enabled == false) throw new Error("Points Settings disabled");

    const customerPoints = await this.getCustomerPointsById(companyId, id);
    if (!customerPoints)
      throw new NotFoundException(
        "Customer Points with ID " + id + "not found for company " + companyId
      );

    return await this.ExpireCustomerPoints(
      companyId,
      customerPoints,
      reason,
      notes,
      employeeId
    );
  }

  async ExpireCustomerPoints(
    companyId: string,
    customerPoints: CustomerPoint | undefined,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string
  ) {
    if (!customerPoints)
      throw new NotFoundException(
        "Customer Points cannot be null or undefined"
      );

    let status = this.getStatus(customerPoints);
    const expiryDate = customerPoints.expiryDate;
    switch (status) {
      case CustomerPointsStatues.CANCELED:
      case CustomerPointsStatues.SPEND:
        throw new Error(
          `cannot expire points that are in ${customerPoints.status} status`
        );

      case CustomerPointsStatues.EXPIRED:
        if (customerPoints.status == CustomerPointsStatues.EXPIRED) {
          return; // already expired
        }
        break;
      default:
        customerPoints.expiryDate = new Date();
        break;
    }
    customerPoints.status = CustomerPointsStatues.EXPIRED;

    await this.promotionsPointsRepository.updateCustomerPoints(
      companyId,
      customerPoints,
      {
        actionName: CustomerPointsActionName.EXPIRE,
        actionDate: customerPoints.expiryDate,
        user: employeeId,
        note: notes,
        reason: reason,
        changes: {
          new: {
            status: status,
            expiryDate: customerPoints.expiryDate,
          },
          old: {
            status: customerPoints.status,
            expiryDate: expiryDate,
          },
        },
        extraDetails: {
          activePoints: 0,
          spentPoints: customerPoints.activePoints * -1,
          grandActivePoints: 0,
        },
      }
    );
  }
  //forTest

  async getCustomerPoints(
    companyId: string,
    phoneNumber: string,
    includeActions: boolean = false,
    customerPointsStatues?: CustomerPointsStatues,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo
  ): Promise<CustomerPoint[]> {
    const pointsList = await this.promotionsPointsRepository.getCustomerPoints(
      companyId,
      phoneNumber,
      customerPointsStatues,
      pageInfo,
      sortInfo
    );

    const updatedPoints = await Promise.all(
      pointsList.map(async (points) => {
        const status = this.getStatus(points);

        if (points.status != status) {
          if (status === CustomerPointsStatues.EXPIRED) {
            await this.ExpireCustomerPoints(
              companyId,
              points,
              {
                an: "The activation period for these points has ended",
                ar: "انتهت فترة التفعيل لهذه النقاط",
              },
              "",
              "SYSTEM"
            );
          } else {
            throw new ParameterException(
              "points",
              `Customer Points with ID ${points.id} have a problem in its status`
            );
          }
        }

        return points;
      })
    );

    return updatedPoints.filter(
      (p) => !customerPointsStatues || p.status === customerPointsStatues
    );
  }
  async getCustomerPointsAction(
    companyId: string,
    customerPointsId: string,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo
  ): Promise<CustomerPointAction[]> {
    return await this.promotionsPointsRepository.getCustomerPointsAction(
      companyId,
      customerPointsId,
      pageInfo,
      sortInfo
    );
  }
  async getCustomerPointsById(
    companyId: string,
    id: string
  ): Promise<CustomerPoint | undefined> {
    const points = await this.promotionsPointsRepository.getCustomerPointsById(
      companyId,
      id
    );
    if (points) {
      const status = this.getStatus(points);
      if (points.status != status) {
        //solved TODO: update the status and add actions if needed
        throw new ParameterException(
          "points",
          "Customer Points with ID " +
            points.id +
            "have a problem in its statue"
        );
      }
      //  points.status = status;
    }
    return points;
  }

  async GiveCustomerPoints(
    companyId: string,
    customerPoints: CustomerPoint,
    employeeId: string
  ): Promise<string> {
    const settings = await this.getPointsSettings(companyId);
    if (settings.enabled == false) throw new Error("Points Settings disabled");

    customerPoints.activePoints = customerPoints.givenPoints;

    customerPoints.status = CustomerPointsStatues.INACTIVE;
    const result = await this.promotionsPointsRepository.AddCustomerPoints(
      companyId,
      customerPoints,
      {
        actionName: CustomerPointsActionName.ADD,
        actionDate: customerPoints.givenDate || new Date(),
        user: employeeId,
        note: customerPoints.note,
        reason: customerPoints.reason,
        changes: {
          new: customerPoints,
        },
        extraDetails: {
          activePoints: 0,
          spentPoints: 0,
          grandActivePoints: 0,
        },
      }
    );
    var status = this.getStatus(customerPoints);
    switch (status) {
      case CustomerPointsStatues.INACTIVE:
        return result;

      case CustomerPointsStatues.ACTIVE:
        await this.ActivateCustomerPoints(
          companyId,
          customerPoints,
          {
            en: "Automatic activation after points addition",
            ar: "تفعيل تلقائي بعد إضافة النقاط",
          },
          "",
          "SYSTEM",
          settings
        );

        return result;
      default:
        throw new ParameterException(
          "customerPoints",
          "Unknown initial state senario" + customerPoints.status
        );
    }
  }

  async CancelCustomerPoints(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string
  ) {
    const settings = await this.getPointsSettings(companyId);
    if (settings.enabled == false) throw new Error("Points Settings disabled");

    const customerPoints = await this.getCustomerPointsById(companyId, id);
    if (!customerPoints)
      throw new NotFoundException(
        "Customer Points with ID " + id + "not found for company " + companyId
      );

    if (
      !(
        customerPoints.status === CustomerPointsStatues.INACTIVE ||
        customerPoints.status === CustomerPointsStatues.ACTIVE
      )
    ) {
      throw new Error(
        `cannot cancel points that are in ${customerPoints.status} status`
      );
    }

    customerPoints.isCanceled = true;

    customerPoints.status = this.getStatus(customerPoints);

    let activePoints = customerPoints.activePoints;

    switch (customerPoints.status) {
      case CustomerPointsStatues.INACTIVE:
        activePoints = 0;
        break;
      case CustomerPointsStatues.CANCELED:
        //do nothing
        break;

      default:
        //solved TODO: add more actions ..
        throw new Error(
          `failed to Cancel points where the status became ${customerPoints.status}`
        );
    }

    await this.promotionsPointsRepository.updateCustomerPoints(
      companyId,
      customerPoints,
      {
        actionName: CustomerPointsActionName.CANCEL_POINTS,
        actionDate: new Date(),
        user: employeeId,
        note: notes,
        reason: reason,

        changes: {
          new: {
            isCanceled: true,
          },
          old: {
            isCanceled: false,
          },
        },
        extraDetails: {
          activePoints: 0,
          spentPoints: activePoints * -1,
          grandActivePoints: 0,
        },
      }
    );

    const pointsRate = settings.currencyValue / settings.pointsValue;

    //solved TODO: need to round it as a currency
    const pointsValue = Math.round(activePoints * pointsRate * 1000) / 1000;
    await this.accountingProvider.AddPromotionalJournals(companyId, [
      {
        accountParentType: ParentType.CURRENT_LIABILITIES,
        pointsId: customerPoints.id,
        code: CustomerPointsActionName.CANCEL_POINTS,
        userName: "Phone: " + customerPoints.phoneNumber,
        total: pointsValue,
      },
      {
        pointsId: customerPoints.id,
        accountParentType: ParentType.OPERATING_INCOME,
        code: CustomerPointsActionName.CANCEL_POINTS,
        userName: "Phone: " + customerPoints.phoneNumber,
        total: -pointsValue,
      },
    ]);
  }

  async RestoreCustomerPoints(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string
  ) {
    const settings = await this.getPointsSettings(companyId);
    if (settings.enabled == false) throw new Error("Points Settings disabled");

    const customerPoints = await this.getCustomerPointsById(companyId, id);
    if (!customerPoints)
      throw new NotFoundException(
        "Customer Points with ID " + id + "not found for company " + companyId
      );

    customerPoints.status = this.getStatus(customerPoints);

    if (customerPoints.status !== CustomerPointsStatues.CANCELED) {
      throw new Error(
        `cannot restore points that are in ${customerPoints.status} status`
      );
    }

    customerPoints.isCanceled = false;

    customerPoints.status = this.getStatus(customerPoints);

    let activePoints = customerPoints.activePoints;

    switch (customerPoints.status) {
      case CustomerPointsStatues.INACTIVE:
        activePoints = 0;
        break;
      case CustomerPointsStatues.ACTIVE:
        //do nothing
        break;

      default:
        //solved TODO: add more actions ..
        throw new Error(
          `failed to restore points where the status became ${customerPoints.status}`
        );
    }

    await this.promotionsPointsRepository.updateCustomerPoints(
      companyId,
      customerPoints,
      {
        actionName: CustomerPointsActionName.RESTORE_POINTS,
        actionDate: new Date(),
        user: employeeId,
        note: notes,
        reason: reason,

        changes: {
          new: {
            isCanceled: false,
          },
          old: {
            isCanceled: true,
          },
        },
        extraDetails: {
          activePoints: activePoints,
          spentPoints: activePoints,
          grandActivePoints: 0,
        },
      }
    );

    const pointsRate = settings.currencyValue / settings.pointsValue;

    //solved TODO: need to round it as a currency
    const pointsValue = Math.round(activePoints * pointsRate * 1000) / 1000;

    await this.accountingProvider.AddPromotionalJournals(companyId, [
      {
        accountParentType: ParentType.CURRENT_LIABILITIES,
        pointsId: customerPoints.id,
        code: CustomerPointsActionName.RESTORE_POINTS,
        userName: "Phone: " + customerPoints.phoneNumber,
        total: -pointsValue,
      },
      {
        pointsId: customerPoints.id,
        accountParentType: ParentType.OPERATING_INCOME,
        code: CustomerPointsActionName.RESTORE_POINTS,
        userName: "Phone: " + customerPoints.phoneNumber,
        total: pointsValue,
      },
    ]);
  }

  async ActivateCustomerPointsById(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string
  ) {
    const settings = await this.getPointsSettings(companyId);
    if (settings.enabled == false) throw new Error("Points Settings disabled");

    const customerPoints = await this.getCustomerPointsById(companyId, id);
    if (!customerPoints)
      throw new NotFoundException(
        "Customer Points with ID " + id + "not found for company " + companyId
      );

    return await this.ActivateCustomerPoints(
      companyId,
      customerPoints,
      reason,
      notes,
      employeeId,
      settings
    );
  }

  private async ActivateCustomerPoints(
    companyId: string,
    customerPoints: CustomerPoint | undefined,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string,
    settings: PointsSettings
  ) {
    if (!customerPoints)
      throw new ParameterException(
        "customerPoints",
        "customerPoints cannot be null"
      );

    if (customerPoints.status !== CustomerPointsStatues.INACTIVE) {
      throw new Error(
        `cannot activate points that are in ${customerPoints.status} status`
      );
    }

    const oldActiveDate = customerPoints.activeDate;
    customerPoints.activeDate = new Date();
    customerPoints.status = this.getStatus(customerPoints);

    let activePoints = customerPoints.activePoints;

    switch (customerPoints.status) {
      case CustomerPointsStatues.ACTIVE:
        //do nothing
        break;

      default:
        //solved TODO: add more actions ..
        throw new Error(
          `failed to active points where the status became ${customerPoints.status}`
        );
    }

    await this.promotionsPointsRepository.updateCustomerPoints(
      companyId,
      customerPoints,
      {
        actionName: CustomerPointsActionName.ACTIVATE,
        actionDate: new Date(),
        user: employeeId,
        note: notes,
        reason: reason,

        changes: {
          new: {
            activeDate: new Date(),
          },
          old: {
            activeDate: oldActiveDate,
          },
        },
        extraDetails: {
          activePoints: customerPoints.activePoints,
          spentPoints: customerPoints.givenPoints,
          grandActivePoints: 0,
        },
      }
    );

    const pointsRate = settings.currencyValue / settings.pointsValue;

    //solved TODO: need to round it as a currency
    const pointsValue = Math.round(activePoints * pointsRate * 1000) / 1000;
    await this.accountingProvider.AddPromotionalJournals(companyId, [
      {
        accountParentType: ParentType.CURRENT_LIABILITIES,
        pointsId: customerPoints.id,
        code: CustomerPointsActionName.ACTIVATE,
        userName: "Phone: " + customerPoints.phoneNumber,
        total: -pointsValue,
      },
      {
        pointsId: customerPoints.id,
        accountParentType: ParentType.OPERATING_EXPENSE,
        code: CustomerPointsActionName.ACTIVATE,
        userName: "Phone: " + customerPoints.phoneNumber,
        total: pointsValue,
      },
    ]);
  }

  async ExtendCustomerPoints(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    newDate: Date,
    employeeId: string
  ) {
    const settings = await this.getPointsSettings(companyId);
    if (settings.enabled == false) throw new Error("Points Settings disabled");

    const customerPoints = await this.getCustomerPointsById(companyId, id);
    if (!customerPoints)
      throw new NotFoundException(
        "Customer Points with ID " + id + "not found for company " + companyId
      );

    if (
      !(
        customerPoints.status === CustomerPointsStatues.INACTIVE ||
        customerPoints.status === CustomerPointsStatues.ACTIVE ||
        customerPoints.status === CustomerPointsStatues.EXPIRED
      )
    ) {
      throw new Error(
        `cannot extend points that are in ${customerPoints.status} status`
      );
    }
    const oldExpiryDate = customerPoints.expiryDate;
    customerPoints.expiryDate = newDate;
    customerPoints.status = this.getStatus(customerPoints);

    switch (customerPoints.status) {
      case CustomerPointsStatues.EXPIRED:
        throw new Error(
          `failed to active points where the status became ${customerPoints.status}`
        ); //do nothing

      default:
        //solved TODO: add more actions ..
        break;
    }
    await this.promotionsPointsRepository.updateCustomerPoints(
      companyId,
      customerPoints,
      {
        actionName: CustomerPointsActionName.EXTEND,
        actionDate: new Date(),
        user: employeeId,
        note: notes,
        reason: reason,

        changes: {
          new: {
            expiryDate: newDate,
          },
          old: {
            expiryDate: oldExpiryDate,
          },
        },
        extraDetails: {
          activePoints: customerPoints.activePoints,
          spentPoints: 0,
          grandActivePoints: 0,
        },
      }
    );
  }

  async refundCustomerPointsById(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    amount: number,
    employeeId: string
  ) {
    const settings = await this.getPointsSettings(companyId);
    if (settings.enabled == false) throw new Error("Points Settings disabled");

    const customerPoints = await this.getCustomerPointsById(companyId, id);
    if (!customerPoints)
      throw new NotFoundException(
        "Customer Points with ID " + id + "not found for company " + companyId
      );

    customerPoints.status = this.getStatus(customerPoints);

    if (
      !(
        customerPoints.status === CustomerPointsStatues.SPEND ||
        customerPoints.status === CustomerPointsStatues.ACTIVE
      )
    ) {
      throw new Error(
        `cannot refund points that are in ${customerPoints.status} status`
      );
    }
    const oldActivePoints = customerPoints.activePoints;
    customerPoints.activePoints = customerPoints.activePoints + amount;

    customerPoints.status = this.getStatus(customerPoints);

    switch (customerPoints.status) {
      case CustomerPointsStatues.ACTIVE:
        break;

      default:
        throw new Error(
          `failed to refund points where the status became ${customerPoints.status}`
        );
    }
    await this.promotionsPointsRepository.updateCustomerPoints(
      companyId,
      customerPoints,
      {
        actionName: CustomerPointsActionName.REFUND,
        actionDate: new Date(),
        user: employeeId,
        note: notes,
        reason: reason,
        changes: {
          new: {
            activePoints: customerPoints.activePoints,
          },
          old: {
            activePoints: oldActivePoints,
          },
        },
        extraDetails: {
          activePoints: customerPoints.activePoints,
          grandActivePoints: 0,
          spentPoints: amount,
          spentPointsValue:
            ((amount * settings.currencyValue) / settings.pointsValue) * -1,
        },
      }
    );
  }
  async SpendCustomerPointsById(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    amount: number,
    spentOrderNumber: string | undefined,
    spentOrderId: string | undefined,
    employeeId: string
  ) {
    var settings = await this.getPointsSettings(companyId);
    if (settings.enabled == false) throw new Error("Points Settings disabled");

    const customerPoints = await this.getCustomerPointsById(companyId, id);
    if (!customerPoints)
      throw new NotFoundException(
        "Customer Points with ID " + id + "not found for company " + companyId
      );
    customerPoints.status = this.getStatus(customerPoints);
    if (customerPoints.status !== CustomerPointsStatues.ACTIVE) {
      throw new Error(
        `cannot Spend points that are in ${customerPoints.status} status`
      );
    }
    const oldActivePoints = customerPoints.activePoints;
    customerPoints.activePoints = customerPoints.activePoints - amount;

    customerPoints.status = this.getStatus(customerPoints);

    switch (customerPoints.status) {
      case CustomerPointsStatues.SPEND:
        break;

      case CustomerPointsStatues.ACTIVE:
        break;

      default:
        //solved TODO: add more actions ..
        throw new Error(
          `failed to spend points where the status became ${customerPoints.status}`
        );
    }

    const pointsRate = settings.currencyValue / settings.pointsValue;
    const pointsValue = amount * pointsRate;

    await this.promotionsPointsRepository.updateCustomerPoints(
      companyId,
      customerPoints,
      {
        actionName: CustomerPointsActionName.SPEND_POINTS,
        actionDate: new Date(),
        user: employeeId,
        note: notes,
        reason: reason,
        changes: {
          new: {
            activePoints: customerPoints.activePoints,
          },
          old: {
            activePoints: oldActivePoints,
          },
        },
        extraDetails: {
          activePoints: customerPoints.activePoints,
          grandActivePoints: 0,
          spentPoints: amount * -1,
          spentPointsValue: pointsValue,
          spentOrderNumber: spentOrderNumber,
          spentOrderId: spentOrderId,
        },
      }
    );

    await this.accountingProvider.AddPromotionalJournal(companyId, {
      accountParentType: ParentType.CURRENT_LIABILITIES,
      pointsId: customerPoints.id,
      code: CustomerPointsActionName.SPEND_POINTS,
      userName: "Phone: " + customerPoints.phoneNumber,
      total: pointsValue,
    });
  }
  async getCustomerPointsSummary(companyId: string, phoneNumber: string) {
    return await this.promotionsRepository.getPromotionsCustomer(
      companyId,
      phoneNumber
    );
  }

  async SpendCustomerPointsByPhoneNumber(
    companyId: string,
    phoneNumber: string,
    reason: TranslatedString,
    notes: string | undefined,
    amount: number,
    spentOrderNumber: string | undefined,
    spentOrderId: string | undefined,
    employeeId: string
  ) {
    const settings = await this.getPointsSettings(companyId);
    if (settings.enabled == false) throw new Error("Points Settings disabled");

    if (amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }

    let remainingAmount = amount;

    const customerPoints = (
      await this.getCustomerPoints(
        companyId,
        phoneNumber,
        false,
        CustomerPointsStatues.ACTIVE
      )
    ).sort((a, b) => {
      return (
        new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
      );
    });

    if (
      (await this.getCustomerPointsSummary(companyId, phoneNumber))
        .activePoints == 0
    ) {
      throw new Error("no point to spend");
    }

    for (const point of customerPoints) {
      if (remainingAmount <= 0) break;

      const deductAmount = Math.min(point.activePoints, remainingAmount);

      await this.SpendCustomerPointsById(
        companyId,
        point.id!,
        reason,
        notes,
        deductAmount,
        spentOrderNumber,
        spentOrderId,
        employeeId
      );

      remainingAmount -= deductAmount;
    }

    return remainingAmount;
  }
  //refundCustomerPoints

  async refundCustomerPointsByPhoneNumber(
    companyId: string,
    phoneNumber: string,
    reason: TranslatedString,
    notes: string | undefined,
    amount: number,
    employeeId: string
  ) {
    const settings = await this.getPointsSettings(companyId);
    if (settings.enabled == false) throw new Error("Points Settings disabled");

    let refundPointsAmount = amount;

    const customerPoints = await this.getCustomerPoints(companyId, phoneNumber);
    //where action extran datila spentordernumber = spentOrderNumber
    //do function for them (take the amunt and send it agin as refund )
    let customerPoint = await this.getCustomerPointsById(
      companyId,
      customerPoints[0].id
    );
    let validRefundPoints: number = 0;
    if (customerPoint)
      validRefundPoints =
        customerPoint.activePoints - customerPoint.givenPoints;
    const activePoints = customerPoints
      .filter(
        (p) => p.status === CustomerPointsStatues.ACTIVE && p.activePoints > 0
      )
      .sort(
        (a, b) =>
          new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
      );

    if (
      (await this.getCustomerPointsSummary(companyId, phoneNumber))
        .activePoints == 0
    ) {
      throw new Error("no point to refund");
    }
    if (amount > validRefundPoints) {
      throw new Error("amount is more than valid Refund Points");
    }

    for (const point of activePoints) {
      if (refundPointsAmount <= 0) break;

      const deductAmount = Math.min(point.activePoints, refundPointsAmount);

      await this.refundCustomerPointsById(
        companyId,
        point.id!,
        reason,
        notes,
        deductAmount,
        employeeId
      );

      refundPointsAmount += deductAmount;
    }

    return refundPointsAmount;
  }

  async refundCustomerPointsByInvoiceId(
    client: PoolClient,
    companyId: string,
    invoiceId: string
  ) {
    const settings = await this.getPointsSettings(companyId);

    //TODO: make sure we need this
    // if (settings.enabled == false) throw new Error("Points Settings disabled");

    const accountingProvider = await AccountingProvider.Create(client);
    const invoice = await accountingProvider.getInvoice(invoiceId);
    if (invoice.pointsDiscount === null) return;
    let refundCustomerPoint = 0;

    if (!invoice.customerPhone) return refundCustomerPoint;

    const customerPoints = await this.getCustomerPoints(
      companyId,
      invoice.customerPhone,
      true
    );
    for (const customerPoint of customerPoints)
      customerPoint.actionsList = await this.getCustomerPointsAction(
        companyId,
        customerPoint.id
      );
    const customerPointsFiltered = customerPoints.filter(
      (refundCustomerPoints) =>
        refundCustomerPoints.actionsList &&
        refundCustomerPoints.actionsList.length > 0 &&
        refundCustomerPoints.actionsList.filter(
          (actionsList) =>
            actionsList.actionName === "SPEND_POINTS" &&
            actionsList.extraDetails?.spentOrderId
        ).length > 0
    );

    for (const refundCustomerPoints of customerPointsFiltered) {
      if (!refundCustomerPoints.actionsList) continue;
      const actionsLists = refundCustomerPoints.actionsList.filter(
        (actionsList) =>
          actionsList &&
          actionsList.actionName === "SPEND_POINTS" &&
          actionsList.extraDetails?.spentOrderId
      );

      for (const actionsList of actionsLists) {
        if (actionsList.extraDetails.spentOrderId !== invoiceId) continue;
        console.log(" Matched5555:", actionsList.extraDetails.spentOrderId);

        const spentPoints = actionsList.extraDetails.spentPoints || 0;
        const deductAmount = Math.min(
          refundCustomerPoints.activePoints,
          Math.abs(spentPoints)
        );

        await this.refundCustomerPointsById(
          companyId,
          refundCustomerPoints.id!,
          { en: "refund", ar: "استرجاع" },
          "",
          spentPoints * -1,
          "SYSTEM"
        );

        refundCustomerPoint += deductAmount;
      }
    }

    return refundCustomerPoint;
  }

  private getStatus(data: CustomerPoint): CustomerPointsStatues {
    const today = new Date();
    const activeDate = new Date(data.activeDate).setHours(0, 0, 0, 0);
    const expiryDate = new Date(data.expiryDate).setHours(0, 0, 0, 0);
    const currentDate = today.setHours(0, 0, 0, 0);

    if (data.isCanceled) {
      return CustomerPointsStatues.CANCELED;
    }
    if (expiryDate < currentDate) {
      return CustomerPointsStatues.EXPIRED;
    }
    if (activeDate > currentDate) {
      return CustomerPointsStatues.INACTIVE;
    }
    if (data.activePoints === 0) {
      return CustomerPointsStatues.SPEND;
    }

    return CustomerPointsStatues.ACTIVE;
  }

  async getAllActionList(
    companyId: string,
    customerPhoneNumber: string,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo
  ): Promise<CustomerPointAction[]> {
    return await this.promotionsPointsRepository.getAllActionList(
      companyId,
      customerPhoneNumber,
      pageInfo,
      sortInfo
    );
  }
}
