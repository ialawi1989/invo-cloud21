import { RedisClientType } from "@redis/client";
import { createClient } from "redis";
import { promisify } from 'util';
import connectRedis, { RedisStore } from 'connect-redis';
import session from 'express-session'
let instance: RedisClient;
import IOredis from "ioredis"
import { Mutex } from 'redis-semaphore';

const Store = connectRedis(session);

export class RedisClient {
    client?: IOredis;
    store?: RedisStore;
    constructor() {
        try {
            let url: any = process.env.REDIS_CLIENT_URL;
            let clintUrl = new URL(url);
            // this.client = createClient({
            //     url: process.env.REDIS_CLIENT_URL,
            //     legacyMode: true
            // });

            // this.client.connect()

            this.client = new IOredis(url)

            this.store = new Store({ client: this.client })
        } catch (ex) {
            console.log(ex)
        }

    }
    public static getRedisClient() {
        if (!instance) {
            instance = new RedisClient();
        }
        return instance;
    }

    public async set(key: string, value: any, expireAt: number | null = null) {
        if (!this.client) return;

        if (expireAt) {
            await this.client.set(key, value, 'EX', expireAt);
        } else {
            await this.client.set(key, value);
        }
    }


    public async setExpiry(key: string, expireAt: number) {
        if (!this.client) return;
        await this.client.expire(key, expireAt);
    }

    public async get(key: string) {
        if (!this.client) return null;
        return await this.client.get(key);
    }



    public async deletKey(key: string) {
        if (this.client == null) return;
        await this.client.del(key)
    }


    public async deletPatternKey(pattern: string) {
        if (!this.client) return;

        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
            await this.client.del(...keys);
        }
    }


    /**
    * Acquires a distributed lock using redis-semaphore
    * @param lockKey Unique lock key
    * @param maxConcurrent Defaults to 1 (mutex)
    * @param lockTimeout Timeout in ms (default 5s)
    * @returns a lock instance with release() method
    */
    public async acquireLock(lockKey: string, lockTimeoutMs = 5000): Promise<Mutex> {
        if (!this.client) throw new Error('Redis client not initialized');

        const mutex = new Mutex(this.client, lockKey, {
            lockTimeout: lockTimeoutMs,
        });

        await mutex.acquire();
        return mutex;
    }

    public async withLock<T>(lockKey: string, fn: () => Promise<T>, lockTimeoutMs = 5000): Promise<T> {
        const lock = await this.acquireLock(lockKey, lockTimeoutMs);
        try {
            return await fn();
        } finally {
            await lock.release().catch(() => { });
        }
    }

}