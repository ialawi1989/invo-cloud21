
import rateLimit from 'express-rate-limit'
import Redlock, { ExecutionError } from 'redlock';
import { RedisClient } from './redisClient'
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto'
const redlock = new Redlock([RedisClient.getRedisClient().client as any]);
export class ApiLimiterRepo {
  static apiLimiter = rateLimit({
    windowMs: 10 * 1000, // 10 seconds
    max: 1, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  })
  static redisClient: any = RedisClient.getRedisClient().client;
  static ecommerceLimiterOpject = new RateLimiterRedis({
    storeClient: ApiLimiterRepo.redisClient,
    keyPrefix: 'ecommerceLimiter',
    points: 100, // max 100 requests
    duration: 60, // per 1 minutes

  })

  static ecommerceLimiter = async (req: Request, res: Response, next: NextFunction) => {
    try {

      if (req.ip) {

        await ApiLimiterRepo.ecommerceLimiterOpject.consume(req.ip);
      }

      next();
    } catch (rejRes: any) {
      res.set('Retry-After', String(Math.ceil(rejRes.msBeforeNext / 1000)));
      res.status(429).json({
        message: 'Too Many Requests - try again later.',
        retryAfterSeconds: Math.ceil(rejRes.msBeforeNext / 1000)
      });
    }
  };


  //duration in second
  static getCustomLimiter(points: number, duration: number) {


    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const routeKey = req.originalUrl.split('?')[0];
        const limiter = new RateLimiterRedis({
          storeClient: ApiLimiterRepo.redisClient,
          keyPrefix: `${routeKey}:${points}:${duration}`,
          points,
          duration,
        });
        if (req.ip) {
          await limiter.consume(req.ip);
        }
        next();
      } catch (rejRes: any) {
        res.set('Retry-After', String(Math.ceil(rejRes.msBeforeNext / 1000)));
        res.status(429).json({
          message: 'Too Many Requests - try again later.',
          retryAfterSeconds: Math.ceil(rejRes.msBeforeNext / 1000)
        });
      }
    };
  }


  static lockTransaction(durationMs: number | null = null) {


    return async (req: Request, res: Response, next: NextFunction) => {

      durationMs = durationMs ?? 30000
      if ((req.method == 'POST' || req.method == 'DELETE' || req.method == 'PUT')) {
        const routeKey = req.originalUrl.split('?')[0];
        const token = req.headers['api-auth'] ?? req.ip
        const body = req.body.id ?? crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
        const lockKey = `lock:${routeKey}:${token}:${body}`;
        /**
         * I included the transaction ID to prevent the route from being locked for other transactions initiated by the same user.
         * For new posted data i use hash value of body if the id is not provided 
         * 
         */
        try {
          const lock = await redlock.acquire([lockKey], durationMs);
          (req as any).checkoutLock = lock;
          return next();
        } catch (err) {
          if (err instanceof ExecutionError) {
            return res.status(429).json({ message: 'Request already in progress' });
          }
          return res.status(500).json({ message: 'Locking error' });
        }

      }

      next();

    };
  }

  static getCustomLimiterByPath(points: number, duration: number) {
    const limiter = new RateLimiterRedis({
      storeClient: ApiLimiterRepo.redisClient,
      keyPrefix: `customLimiter:${points}:${duration}`,
      points,
      duration,
    });

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (req.ip) {
          await limiter.consume(req.ip + req.url);
        }
        next();
      } catch (rejRes: any) {
        res.set('Retry-After', String(Math.ceil(rejRes.msBeforeNext / 1000)));
        res.status(429).json({
          message: 'Too Many Requests - try again later.',
          retryAfterSeconds: Math.ceil(rejRes.msBeforeNext / 1000)
        });
      }
    };
  }


  // static lockTransaction(durationMs: number|null=null) {


  //   return async (req: Request, res: Response, next: NextFunction) => {

  //     durationMs = durationMs??30000
  //     if((req.method == 'POST' ||req.method == 'DELETE'|| req.method == 'PUT') )
  //     {
  //       const routeKey = req.originalUrl.split('?')[0];
  //       const token = req.headers['api-auth'] ?? req.ip
  //       const body = req.body.id ?? crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
  //       const lockKey = `lock:${routeKey}:${token}:${body}`;
  //       /**
  //        * I included the transaction ID to prevent the route from being locked for other transactions initiated by the same user.
  //        * For new posted data i use hash value of body if the id is not provided 
  //        * 
  //        */
  //       try {
  //         const lock = await redlock.acquire([lockKey], durationMs);
  //         (req as any).checkoutLock = lock;
  //        return   next();
  //       } catch (err) {
  //         if (err instanceof ExecutionError) {
  //           return res.status(429).json({ message: 'Request already in progress' });
  //         }
  //         return res.status(500).json({ message: 'Locking error' });
  //       }

  //     }

  //     next();

  //   };
  // }
}

export class ApiLimiter {
  static rateLimitedExpress = (
    limiter: RateLimiterRedis,
    handler: (req: Request, res: Response, next: NextFunction) => any
  ) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || (req.headers["x-forwarded-for"] as string) || "unknown";
      const companyId = res.locals?.company?.id || "no-company";
      const userId = res.locals?.user?.id || "anon";
      const routeKey = req.originalUrl.split("?")[0];
      const key = `${routeKey}:${ip}:${companyId}:${userId}`;

      try {
        await limiter.consume(key);

        try {
          await Promise.resolve(handler(req, res, next));
        } finally {
          // await limiter.delete(key); // release immediately after processing
          next();
        }
      } catch (rej: any) {
        const retryIn = Math.ceil((rej?.msBeforeNext ?? 1000) / 1000);
        next();
        res.status(429).json({
          ok: false,
          error: "rate_limited",
          message: `Rate limit exceeded. Try again in ${retryIn}s.`,
          retryInSeconds: retryIn,
        });
      }
    };
  };


  static insurance = new RateLimiterMemory({ points: 3, duration: 1 });

  static ApiLimiterRepo = {
    authLimiter: new RateLimiterRedis({
      storeClient: RedisClient.getRedisClient().client,
      keyPrefix: "socket:authLimiter",
      points: 5,        // 5 events
      duration: 60,     // per 60s
      insuranceLimiter: this.insurance,
    }),
    writeLimiter: new RateLimiterRedis({
      storeClient: RedisClient.getRedisClient().client,
      keyPrefix: "socket:writeLimiter",
      points:30,        // 5 events
      duration:5 * 60,     // per 60s
      insuranceLimiter: this.insurance,
    }),
    readLimiter: new RateLimiterRedis({
      storeClient: RedisClient.getRedisClient().client,
      keyPrefix: "socket:readLimiter",
      points: 120,        // 5 events
      duration: 5 * 60,     // per 60s
      insuranceLimiter: this.insurance,
    }),
    barcodeLimiter: new RateLimiterRedis({
      storeClient: RedisClient.getRedisClient().client,
      keyPrefix: "socket:barcodeLimiter",
      points: 60,        // 5 events
      duration: 60,     // per 60s
      insuranceLimiter: this.insurance,
    }),
    burstLimiter: new RateLimiterRedis({
      storeClient: RedisClient.getRedisClient().client,
      keyPrefix: "socket:burstLimiter",
      points: 10,        // 5 events
      duration: 10,     // per 60s
      insuranceLimiter: this.insurance,
    }),
  }
}