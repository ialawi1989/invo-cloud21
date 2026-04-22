import {
  DatePeriodUnit,
  DateTimeSpan,
  TranslatedString,
} from "../promotions.model";
import {
  conditionMatch,
  CustomerTier,
  CustomerTierAction,
  CustomerTierActionName,
  CustomerTierSettings,
} from "./customer-tiers.modal";
import { PromotionsRepository } from "../promotions.data";
import { PoolClient } from "pg";
import { PageInfo } from "../common/pagination";
import { SortInfo } from "../common/sortInfo";

export class CustomerTiersRepository {
  private promotionsRepository: PromotionsRepository;
  private client: PoolClient;
  constructor(promotionsRepository: PromotionsRepository, client: PoolClient) {
    this.promotionsRepository = promotionsRepository;
    this.client = client;
  }

  static defaultCustomerTiers: CustomerTier[] = [
    {
      id: "bronze-id",
      name: {
        ar: "الفئة البرونزية",
        en: "Bronze Tier backend",
      },
      minNumberOfOrders: 0,
      minAmountSpend: 0,
      customerCount: 0,
      enabled: true,
    },
    {
      id: "silver-id",
      name: {
        ar: "الفئة الفضية",
        en: "Silver Tier",
      },
      minNumberOfOrders: 10,
      minAmountSpend: 2500,
      customerCount: 0,
      enabled: true,
    },
    {
      id: "gold-id",
      name: {
        ar: "الفئة الذهبية",
        en: "Gold Tier",
      },
      minNumberOfOrders: 20,
      minAmountSpend: 5000,
      customerCount: 0,
      enabled: true,
    },
    {
      id: "Platinum-id",
      name: {
        ar: "الفئة البلاتينية",
        en: "Platinum Tier",
      },
      minNumberOfOrders: 30,
      minAmountSpend: 6000,
      customerCount: 0,
      enabled: true,
    },
  ];

  static defaultCustomerTierSettings: CustomerTierSettings = {
    conditionMatch: conditionMatch.ALL_CONDITION,
    calculationPeriod: new DateTimeSpan(1, DatePeriodUnit.YEARS),
    evaluationLastDate: undefined,
    customerTiers: CustomerTiersRepository.defaultCustomerTiers,
    useMinOrder: true,
    useMinSpend: true,
    enabled: false,
    actionsList: [],
  };

  settingType = "CustomerTierSettings";
  async getCustomerTierSettings(
    companyId: string
  ): Promise<CustomerTierSettings> {
    let result: CustomerTierSettings =
      await this.promotionsRepository.getSettings(
        companyId,
        this.settingType,
        () => CustomerTiersRepository.defaultCustomerTierSettings
      );
    result = this.updateDefaultValues(result);
    return result;
  }
  async getCustomerTierAction(
    companyId: string,
    pageInfo?: PageInfo,
    sortInfo?:SortInfo
  ): Promise<CustomerTierAction[]> {
    let actionsList = await this.promotionsRepository.getActions(
      companyId,
      this.settingType,
      this.settingType,
      pageInfo,
      sortInfo
    );

    return actionsList;
  }
  private updateDefaultValues(settings: any) {
    if (settings == CustomerTiersRepository.defaultCustomerTierSettings)
      return settings;

    settings.calculationPeriod =
      settings.calculationPeriod ??
      CustomerTiersRepository.defaultCustomerTierSettings.calculationPeriod;
    settings.conditionMatch =
      settings.conditionMatch ??
      (settings.useMinOrder && settings.useMinSpend
        ? CustomerTiersRepository.defaultCustomerTierSettings.conditionMatch
        : "");
    settings.evaluationLastDate =
      settings.evaluationLastDate ??
      CustomerTiersRepository.defaultCustomerTierSettings.evaluationLastDate;
    settings.customerTiers =
      settings.customerTiers ??
      CustomerTiersRepository.defaultCustomerTierSettings.customerTiers;
    settings.useMinOrder =
      settings.useMinOrder ??
      CustomerTiersRepository.defaultCustomerTierSettings.useMinOrder;
    settings.useMinSpend =
      settings.useMinSpend ??
      CustomerTiersRepository.defaultCustomerTierSettings.useMinSpend;
    settings.enabled =
      settings.enabled ??
      CustomerTiersRepository.defaultCustomerTierSettings.enabled;
    settings.actionsList =
      settings.actionsList ??
      CustomerTiersRepository.defaultCustomerTierSettings.actionsList;

    return settings;
  }

  async setCustomerTierSettings(
    companyId: string,
    customerTierSettings: CustomerTierSettings,
    action: CustomerTierAction
  ) {
    await this.promotionsRepository.setSettings(
      companyId,
      this.settingType,
      customerTierSettings
    );

    let X = await this.promotionsRepository.AddAction(
      companyId,
      this.settingType,
      this.settingType,
      action
    );
  }
}
