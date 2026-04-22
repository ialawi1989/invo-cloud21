import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { RedisClient } from "@src/redisClient";

// 🔐 Generate stable hash from unordered JSON
function stableHash(obj: any): string {
    const json = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash("sha256").update(json).digest("hex");
}

// 🛑 Optional: enable/disable Redis protection
const USE_REDIS_LOCK = true;
const LOCK_TTL_SEC = 60; // auto-release after 60 seconds

export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.body || typeof req.body !== "object") {
            return res.status(400).json({ message: "Body required for idempotency" });
        }


        // 🎯 Create the hash key
        const hashKey = stableHash(req.body);
        const key = `idem:${hashKey}`; // unified idempotency key

        // 🔗 Make it available to handler
        req.idempotencyKey = hashKey;
        req.idempotencyRedisKey = key;

        // 🛡️ Optional Redis Lock Protection
        if (USE_REDIS_LOCK) {
            /**
             * NX = only set if not exists
             * EX = set expiration in seconds
             */
            let redisClient = RedisClient.getRedisClient();
            const lock = await redisClient.client!.set(key, "LOCK", "EX", LOCK_TTL_SEC, "NX");
            if (!lock) {
                return res.status(409).json({ message: "Duplicate request in progress" });
            }

            // Release the lock as soon as the response is sent
            const releaseLock = async () => {
                try {
                    await redisClient.client!.del(key);
                } catch (e) {
                    console.error("Failed to release idempotency lock:", e);
                }
            };
            res.on("finish", releaseLock);
            res.on("close", releaseLock);
        }

        next();
    } catch (err) {
        console.error("Idempotency Middleware Error:", err);
        return res.status(500).json({ message: "Idempotency middleware failed" });
    }
}

// 📌 Typescript extension
declare global {
    namespace Express {
        interface Request {
            idempotencyKey?: string;
            idempotencyRedisKey?: string;
        }
    }
}