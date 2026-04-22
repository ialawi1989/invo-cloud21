// authenticatedContextMiddleware.ts
import { Response, NextFunction } from 'express';
import { Logger } from '@src/utilts/invoLogger';

export function authenticatedContextMiddleware(routeName: string = 'Cloud') {
  return (req: any, res: Response, next: NextFunction): void => {
    if (!res.locals?.user) {
      return next();
    }

    Logger.setContext({
      user: {
        id: res.locals?.user,
        name: res.locals?.email,
      },
      company: {
        id: res.locals?.company?.id,
        name: res.locals?.company?.name,
      },
      tags: { Project: routeName }, // 👈 add route type here
    });

    Logger.addBreadcrumb('auth.user', 'Authenticated user context attached', {
      userId: req.user?.id,
      companyId: req.user?.companyId,
      branchId: req.user?.branchId,
      route: routeName, // 👈 also here
    });

    next();
  };
}