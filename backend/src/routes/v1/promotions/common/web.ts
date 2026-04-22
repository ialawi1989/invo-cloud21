import { Request, Response, NextFunction } from "express";
import { PoolClient } from "node_modules/@types/pg";
import { UsingDbClient } from "./sql";
import { ToException } from "./exceptions";
import { IDisposable, Using } from "./disposable";
import { includePageInfo, includeSortInfo } from "./pagination";
import { Logger } from "@src/utilts/invoLogger";

export function ProcessRequest<T extends object>(
  providerFactory: (client?: PoolClient) => Promise<T>,
  processFn: (
    req: Request,
    res: Response,
    next: NextFunction,
    provider: T
  ) => Promise<any>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await UsingDbClient(async (client) => {
        const provider: T = await providerFactory(client);
        if ("dispose" in provider) {
          return Using(provider as IDisposable, (p) => {
            return includeSortInfo(req, res, next, async (req, res, next) => {
              return includePageInfo(req, res, next, async (req, res, next) => {
                return processFn(req, res, next, p as T);
              });
            });
          });
        } else {
          return includeSortInfo(req, res, next, async (req, res, next) => {
            return includePageInfo(req, res, next, async (req, res, next) => {
              return processFn(req, res, next, provider as T);
            });
          });
        }
      });

      if (typeof result === "number" || result instanceof Number) {
        return res.status(200).send(result.toString());
      }
      return res.status(200).send(result);
    } catch (error: any) {
      Logger.error(error.message, { stack: error.stack });
      const ex = ToException(error);
      return res.status(ex.statusCode).send(ex.message);
    }
  };
}

export function ProcessEvent<T extends object>(
  providerFactory: (client?: PoolClient) => Promise<T>,
  processFn: (payload: T, provider: T) => Promise<any>
) {
  return async (payload: T) => {
    const result = await UsingDbClient(async (client) => {
      const provider: T = await providerFactory(client);
      if ("dispose" in provider) {
        return Using(provider as IDisposable, (p) =>
          processFn(payload, p as T)
        );
      } else {
        return await processFn(payload, provider);
      }
    });
  };
}
