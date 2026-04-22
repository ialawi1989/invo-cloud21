
import { Request, Response, NextFunction } from 'express';


export class SentryMiddlware {
  // Start a span that tracks the duration of middleware
  public static middleware(_req: Request, res: Response, next: NextFunction) {
    //   return startSpanManual({ name: "middleware" }, (span, finish) => {
    //     res.once("finish", () => {

    //       span?.setHttpStatus(res.statusCode);
    //       finish();
    //     });
    //      next();
    //   });

    //   next();
    // }
    next();
  }
}