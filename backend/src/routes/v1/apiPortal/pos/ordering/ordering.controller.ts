import { Request, Response, NextFunction, Router } from "express";
import { OrderingProvider } from "./ordering.business";
import { ProcessEvent, ProcessRequest } from "../../../promotions/common/web";
import { onEvent } from "@src/utilts/system-events";
import { PoolClient } from "node_modules/@types/pg";

export class OrderingController {
  public static registerRouts(router: Router) {
    router.get( //get many
      "/orders",
      ProcessRequest(
        OrderingProvider.Create,
        OrderingController.getOrders
      )
    );

    router.get( //get one
      "/orders/:id",
      ProcessRequest(
        OrderingProvider.Create,
        OrderingController.getOrder
      )
    );

    router.post( //Add new
      "/orders",
      ProcessRequest(
        OrderingProvider.Create,
        OrderingController.submitOrder
      )
    );

    router.post( //Add new
      "/orders/:id",
      ProcessRequest(
        OrderingProvider.Create,
        OrderingController.submitOrder
      )
    );

    onEvent(
      "OrderOnlineStatusChanged",
      ProcessEvent(
        OrderingProvider.Create,
        OrderingController.onOrderOnlineStatusChanged
      )
    );

    onEvent(
      "onOrderChanged",
      ProcessEvent(
        OrderingProvider.Create,
        OrderingController.onOrderChanged
      )
    );
  }

  public static async onOrderOnlineStatusChanged(eventDetails: any, providers: OrderingProvider) {
    await providers.onOrderOnlineStatusChanged(eventDetails);
  }
  public static async onOrderChanged(eventDetails: any, providers: OrderingProvider) {
    await providers.onOrderChanged(eventDetails);
  }
  public static async getOrders(
    req: Request,
    res: Response,
    next: NextFunction,
    orderingProvider: OrderingProvider
  ) {
    const company = res.locals.company;
    const pageInfo = res.locals.pageInfo;
    const sortInfo = res.locals.sortInfo;

    const result = await orderingProvider.getOrders(
      company.id,
      pageInfo,
      sortInfo
    );

    return result;
  }

  public static async getOrder(
    req: Request,
    res: Response,
    next: NextFunction,
    orderingProvider: OrderingProvider
  ) {
    const company = res.locals.company;
    const id = req.params.id;

    const result = await orderingProvider.getOrder(company.id, id);

    return result;
  }

  public static async submitOrder(
    req: Request,
    res: Response,
    next: NextFunction,
    orderingProvider: OrderingProvider
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const data = req.body;

    const result = await orderingProvider.submitOrder(company, employeeId, data);

    return result;
  }
}
