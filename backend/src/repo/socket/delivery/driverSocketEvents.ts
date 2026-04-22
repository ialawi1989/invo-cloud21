import { Socket } from 'socket.io'
import { DriverSocketRepo } from './driver.socket';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import { RedisClient } from '@src/redisClient';


export class SocketApiLimiter {
    static insurance = new RateLimiterMemory({ points: 3, duration: 1 });
    static limiters = {
        pendingOrders: new RateLimiterRedis({
            storeClient: RedisClient.getRedisClient().client,
            keyPrefix: "socket:pendingOrders",
            points: 5,        // 5 events
            duration: 60,     // per 60s
            insuranceLimiter: this.insurance,
        }),
        // add more per-event limiters if needed:
        clamiedOrders: new RateLimiterRedis({
            storeClient: RedisClient.getRedisClient().client,
            keyPrefix: "socket:clamiedOrders",
            points: 5,        // 5 events
            duration: 60,     // per 60s
            insuranceLimiter: this.insurance,
        }),


        pickedOrders: new RateLimiterRedis({
            storeClient: RedisClient.getRedisClient().client,
            keyPrefix: "socket:pickedOrders",
            points: 5,        // 5 events
            duration: 60,     // per 60s
            insuranceLimiter: this.insurance,
        }),

        deliveredOrders: new RateLimiterRedis({
            storeClient: RedisClient.getRedisClient().client,
            keyPrefix: "socket:deliveredOrders",
            points: 5,        // 5 events
            duration: 60,     // per 60s
            insuranceLimiter: this.insurance,
        }),
        getOrderById: new RateLimiterRedis({
            storeClient: RedisClient.getRedisClient().client,
            keyPrefix: "socket:getOrderById",
            points: 5,        // 5 events
            duration: 60,     // per 60s
            insuranceLimiter: this.insurance,
        }),
        getInvoicePaymentUrl: new RateLimiterRedis({
            storeClient: RedisClient.getRedisClient().client,
            keyPrefix: "socket:getInvoicePaymentUrl",
            points: 5,        // 5 events
            duration: 60,     // per 60s
            insuranceLimiter: this.insurance,
        }),
        setDriverLocation: new RateLimiterRedis({
            storeClient: RedisClient.getRedisClient().client,
            keyPrefix: "socket:setDriverLocation",
            points: 5,        // 5 events
            duration: 60,     // per 60s
            insuranceLimiter: this.insurance,
        }),
    };

    static rateLimitedOn<TData = any>(
        client: Socket,
        event: string,
        limiter: RateLimiterRedis | null,
        key: string, // e.g., `emp:${employeeId}` or `ip:${client.handshake.address}`
        handler: (data: TData, cb: (res: any) => void) => Promise<void>,
    ) {
        client.on(event, async (data: TData, callback?: (res: any) => void) => {
            const cb = typeof callback === "function" ? callback : () => { };
            try {
                if (limiter) {
                    try {
                        await limiter.consume(key); // 1 point
                    } catch (rej: any) {
                        const retryIn = Math.ceil((rej?.msBeforeNext ?? 1000) / 1000);
                        return cb({
                            ok: false,
                            error: "rate_limited",
                            message: `Rate limit exceeded. Try again in ${retryIn}s.`,
                            retryInSeconds: retryIn,
                        });
                    }
                }

                try {
                    await handler(data, cb); // run your actual event
                } catch (err: any) {
                    ;
                    cb({ ok: false, error: "server_error", message: err?.message ?? "Error" });
                } finally {
                    // delete the key after request finishes to allow next request
                    try {
                        // if (limiter) {
                        //     await limiter.delete(key);
                        // }

                    } catch (err) {
                        console.warn("Failed to release limiter key:", key, err);
                    }
                }
            } catch (err: any) {
                ;
                cb({ ok: false, error: "server_error", message: err?.message ?? "Error" });
            }
        });
    }


}
export class DriverSocketEvents {

    public static async events(client: Socket, employeeId: any) {
        try {
            let key = `emp:${employeeId}+ip:${client.handshake.address}`;

            SocketApiLimiter.rateLimitedOn(client, "pendingOrders", SocketApiLimiter.limiters.pendingOrders, key, async (data, callback) => {
                await DriverSocketRepo.pendingOrders(client, employeeId, callback)
            })
            SocketApiLimiter.rateLimitedOn(client, "clamiedOrders", SocketApiLimiter.limiters.clamiedOrders, key, async (data, callback) => {
                await DriverSocketRepo.clamiedOrders(client, employeeId, callback)
            })
            SocketApiLimiter.rateLimitedOn(client, "pickedOrders", SocketApiLimiter.limiters.pickedOrders, key, async (data, callback) => {
                await DriverSocketRepo.pickedOrders(client, employeeId, callback)
            })

            SocketApiLimiter.rateLimitedOn(client, "deliveredOrders", SocketApiLimiter.limiters.deliveredOrders, key, async (data, callback) => {
                await DriverSocketRepo.deliveredOrders(client, employeeId, callback)
            })
            SocketApiLimiter.rateLimitedOn(client, "getOrderById", SocketApiLimiter.limiters.getOrderById, key, async (data, callback) => {

                await DriverSocketRepo.getOrderById(client, employeeId, callback)
            })
            SocketApiLimiter.rateLimitedOn(client, "getInvoicePaymentUrl", SocketApiLimiter.limiters.getInvoicePaymentUrl, key, async (invoiceId, callback) => {
                await DriverSocketRepo.getInvoicePaymentUrl(client, employeeId, invoiceId, callback)
            })
            SocketApiLimiter.rateLimitedOn(client, "setDriverLocation", SocketApiLimiter.limiters.setDriverLocation, key, async (data, callback) => {
                console.log('setDriverLocation>>>>>', data)
                await DriverSocketRepo.setDriverLocation(client, data, employeeId, callback)
            })


        } catch (error) {

          
            

        }



    }

}

function next() {
    throw new Error('Function not implemented.');
}
