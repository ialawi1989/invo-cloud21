// utils/asyncRouter.ts
import { Router, RequestHandler } from "express";

export function createAsyncRouter() {
  const router = Router();

  const methods = ["get", "post", "put", "patch", "delete", "all"] as const;

  methods.forEach((method) => {
    const original = (router as any)[method] as Function;

    (router as any)[method] = function (
      path: string,
      ...handlers: RequestHandler[]
    ) {
      const wrappedHandlers = handlers.map((fn) => {
        if (fn.length <= 3) {
          return function (req: any, res: any, next: any) {
            Promise.resolve(fn(req, res, next)).catch(next);
          };
        }
        return fn;
      });

      return original.call(router, path, ...wrappedHandlers);
    };
  });

  return router;
}