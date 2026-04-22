import { PoolClient } from "node_modules/@types/pg";
import { PromotionsRepository } from "../promotions.data";
import { DateTimeSpan, fromDate, TranslatedString } from "../promotions.model";
import { CustomerTiersRepository } from "./customer-tiers.data";
import {
  CustomerTierAction,
  CustomerTierActionName,
  CustomerTierSettings,
  conditionMatch,
} from "./customer-tiers.modal";
import { DbClient } from "../common/sql";
import { ParameterException } from "../common/exceptions";
import { isNullOrWhiteSpace } from "../common/stringUtils";
import { EditSettings } from "../common/EditSettings.modal";
import { PageInfo } from "../common/pagination";
import { SortInfo } from "../common/sortInfo";

export class CustomerTiersProvider {
  public static async Create(client?: PoolClient) {
    client = client || (await DbClient());
    const promotionsRepository = new PromotionsRepository(client);
    return new CustomerTiersProvider(
      new CustomerTiersRepository(promotionsRepository, client),
      promotionsRepository
    );
  }

  private customerTiersRepository: CustomerTiersRepository;
  private promotionsRepository: PromotionsRepository;
  constructor(
    customerTiersRepository: CustomerTiersRepository,
    promotionsRepository: PromotionsRepository
  ) {
    this.customerTiersRepository = customerTiersRepository;
    this.promotionsRepository = promotionsRepository;
  }

  async getCustomerTierSettings(
    companyId: string
  ): Promise<CustomerTierSettings> {
    return await this.customerTiersRepository.getCustomerTierSettings(
      companyId
    );
  }

  async getCustomerTierAction(
    companyId: string,
    pageInfo?: PageInfo,
    sortInfo?:SortInfo
  ): Promise<CustomerTierAction[]> {
    return await this.customerTiersRepository.getCustomerTierAction(
      companyId,
      pageInfo,
      sortInfo
    );
  }
  async setCustomerTierSettings(
    companyId: string,
    customerTierSettings: EditSettings<CustomerTierSettings>,
    employeeId: string
  ) {
    if (
      !customerTierSettings ||
      !customerTierSettings.setting.conditionMatch ||
      !customerTierSettings.reason ||
      !employeeId
    ) {
      throw new ParameterException(
        "customerTierSettings",
        "customerTierSettings cannot be null or undefined"
      );
    }
    let current = await this.getCustomerTierSettings(companyId);

    if (current.enabled != customerTierSettings.setting.enabled)
        return await this.customerTiersRepository.setCustomerTierSettings(
          companyId,
          customerTierSettings.setting,

          {
            actionName: customerTierSettings.setting.enabled
              ? CustomerTierActionName.ENABLED_TIRES
              : CustomerTierActionName.DISABLE_TIRES,
            actionDate: new Date(),
            user: employeeId,
            reason: customerTierSettings.reason,
            note: customerTierSettings.note,
          }
        );
      else
        return await this.customerTiersRepository.setCustomerTierSettings(
          companyId,
          customerTierSettings.setting,

          {
            actionName: CustomerTierActionName.EDIT,
            actionDate: new Date(),
            user: employeeId,
            reason: customerTierSettings.reason,
            note: customerTierSettings.note,
          }
        );
  }

  async evaluateCustomerTiers(
    companyId: string,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string
  ) {
    if (isNullOrWhiteSpace(companyId)) {
      throw new ParameterException(
        "companyId",
        "null or whitespace not allowed",
        companyId
      );
    }

    const customerTierSettings =
      await this.customerTiersRepository.getCustomerTierSettings(companyId);
    const customerTiers = customerTierSettings.customerTiers;

    const today = new Date();
    const evaluationDate = fromDate(
      today,
      new DateTimeSpan(
        customerTierSettings.calculationPeriod.value * -1,
        customerTierSettings.calculationPeriod.periodUnit
      )
    );
    customerTierSettings.evaluationLastDate = today;
    const promotionCustomers =
      await this.promotionsRepository.getCustomersSpending(
        companyId,
        evaluationDate
      );

    for (let index = 0; index < promotionCustomers.length; index++) {
      const promotionCustomer = promotionCustomers[index];

      promotionCustomer.customerTierId = customerTiers[0].id;

      const customerSpendingInfo =
        await this.promotionsRepository.getPromotionsCustomerSpending(
          companyId,
          promotionCustomer.phoneNumber,
          evaluationDate
        );

      for (const tier of customerTiers) {
        let matchesOrders = false;
        if (
          customerTierSettings.useMinOrder &&
          customerSpendingInfo.numberOfOrders >= tier.minNumberOfOrders
        ) {
          matchesOrders = true;
        }

        let matchesSpend = false;
        if (
          customerTierSettings.useMinSpend &&
          customerSpendingInfo.amountSpend >= tier.minAmountSpend
        ) {
          matchesSpend = true;
        }

        if (matchesOrders == false && matchesSpend == false) {
          break;
        }

        if (
          customerTierSettings.conditionMatch === conditionMatch.ALL_CONDITION
        ) {
          if (matchesOrders && matchesSpend) {
            promotionCustomer.customerTierId = tier.id;
          }
        } else {
          if (matchesOrders || matchesSpend) {
            promotionCustomer.customerTierId = tier.id;
          }
        }
      }

      await this.promotionsRepository.setPromotionsCustomerCustomerTier(
        companyId,
        promotionCustomer.phoneNumber,
        promotionCustomer.customerTierId
      );
    }

    customerTiers.forEach(
      (tier) =>
        (tier.customerCount = promotionCustomers.filter(
          (wallet) => wallet.customerTierId == tier.id
        ).length)
    );

    customerTierSettings.customerTiers = customerTiers;
    await this.customerTiersRepository.setCustomerTierSettings(
      companyId,
      customerTierSettings,
      {
        actionName: CustomerTierActionName.EVALUATION,
        actionDate: new Date(),
        user: employeeId,
        reason: reason,
        note: notes,
      }
    );
    return customerTierSettings;
  }
}
