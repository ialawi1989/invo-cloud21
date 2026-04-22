import { DB } from "@src/dbconnection/dbconnection";
import axios from "axios";
import os from 'os';
import { Request, Response, NextFunction } from "express";
import { RedisClient } from "@src/redisClient";
import { findMissingPollers } from "@src/AWS-SERVICES/sqsPublisher";
import { QueryResult } from "pg";
import v8 from 'v8';


interface healthResult{
  status: string;
  db: boolean;
  redis: boolean;
  externalAPI: boolean;
  memory: any;
  disk:any;
  timestamp: string;
  missingPollers: any;
  process: any;  
  v8: any,
}
export class Health {
  public static async serverHealth(req: Request, res: Response, next: NextFunction) {
    const token = req.query.token || req.headers['x-health-key'];
    if (token !== "2xmUaBByeS") {//TODO replace the key (move to .env)
      return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    const strict = req.query.strict === '1';

    const health:healthResult= {
      status: 'ok',
      db: false,
      redis: false,
      externalAPI: false,
      memory: {},
      disk: {},
      timestamp: new Date().toISOString(),
      v8: {},
      process: {},
      missingPollers: {}
    };

    //TODO: figure out the code below to not Takes long time
    // try {
    //   // ✅ PostgreSQL
    //   await DB.excu.query('SELECT 1');
    //   health.db = true;
    // } catch (e: any) {
    //   console.error('DB error:', e.message);
    // }

    //TODO: figure out the code below to not Takes long time
    // try {
    //   // ✅ Redis
    //   let redis = RedisClient.getRedisClient().client
    //   if (redis) {
    //     const pong = await redis.ping();
    //     health.redis = pong === 'PONG';
    //   }
    // } catch (e: any) {
    //   console.error('Redis error:', e.message);
    // }

    // شغّل الفحوصات بالتوازي مع timeouts صغيرة
    const checks = await Promise.allSettled([
      // DB
      pTimeout(DB.excu.query('SELECT 1'), 700, () => null).then(v => { health.db = !!v; }),
      // Redis
      pTimeout((async () => {
        const redis = RedisClient.getRedisClient().client;
        if (!redis) return false;
        const pong = await redis.ping();
        return pong === 'PONG';
      })(), 500, () => false).then(ok => { health.redis = ok; }),
      // External (HEAD + timeout قصير)
      pTimeout(axios.head('https://www.google.com/generate_204', {
        timeout: 800,
        validateStatus: () => true
      }), 900, () => ({ status: 0 })).then((r: any) => { health.externalAPI = r && r.status === 204; }),
    ]);

    // Memory / Disk — محلي وسريع
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    health.memory = {
      rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      external: `${(mem.external / 1024 / 1024).toFixed(2)} MB`,
      arrayBuffers: `${(mem.arrayBuffers / 1024 / 1024).toFixed(2)} MB`,
      osUsage: `${(((totalMem - freeMem) / totalMem) * 100).toFixed(2)} %`
    };
    health.disk = {
      freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
      totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
      uptimeSec: os.uptime(),
    };

    health.process = {
      uptimeSec: Math.round(process.uptime()),
      uptimeHuman: new Date(process.uptime() * 1000).toISOString().substr(11, 8),
    };

    if (strict) {
      const stats = v8.getHeapStatistics();
      health.v8 = {
        total_heap_size: Math.round(stats.total_heap_size / 1024 / 1024) + ' MB',
        total_heap_size_executable: Math.round(stats.total_heap_size_executable / 1024 / 1024) + ' MB',
        used_heap_size: Math.round(stats.used_heap_size / 1024 / 1024) + ' MB',
        heap_size_limit: Math.round(stats.heap_size_limit / 1024 / 1024) + ' MB'
      };
    }

    // قرّر الـ status code
    const isHealthy = health.db && health.redis && health.externalAPI;
    health.status = isHealthy ? 'ok' : 'degraded';

    // افتراضيًا 200 كي لا يضيع body خلف proxy/CDN
    const statusCode = strict ? (isHealthy ? 200 : 500) : 200;
    res.status(statusCode).json(health);
  }
}

const pTimeout = <T>(p: Promise<T>, ms: number, onTimeout: () => T) =>
  new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(onTimeout()), ms);
    p.then(v => { clearTimeout(t); resolve(v); })
      .catch(() => { clearTimeout(t); resolve(onTimeout()); });
  });