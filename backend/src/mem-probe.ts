// mem-probe.ts
import type { Application, Request, Response, NextFunction } from "express";
import type { Server as IOServer, Socket } from "socket.io";
import { Logger } from "./utilts/invoLogger";

type LogFn = (msg: string) => void;

interface ProbeOpts {
  log?: LogFn;              // default console.log
  thresholdMB?: number;     // only print if any metric grew by >= threshold
  includeRss?: boolean;     // include rss in diff check (default true)
}

const mb = (n: number) => Math.round((n / 1024 / 1024) * 100) / 100;

function snap() {
  const m = process.memoryUsage();
  return {
    rss: mb(m.rss),
    heapUsed: mb(m.heapUsed),
    heapTotal: mb(m.heapTotal),
    external: mb(m.external),
    arrayBuffers: mb((m as any).arrayBuffers ?? 0),
  };
}

function diff(a: ReturnType<typeof snap>, b: ReturnType<typeof snap>) {
  return {
    rss: +(b.rss - a.rss).toFixed(2),
    heapUsed: +(b.heapUsed - a.heapUsed).toFixed(2),
    heapTotal: +(b.heapTotal - a.heapTotal).toFixed(2),
    external: +(b.external - a.external).toFixed(2),
    arrayBuffers: +(b.arrayBuffers - a.arrayBuffers).toFixed(2),
  };
}

export function attachHttpMemProbe(app: Application, opts: ProbeOpts = {}) {
  const log = opts.log ?? console.log;
  const threshold = opts.thresholdMB ?? 0;
  const includeRss = opts.includeRss ?? true;

  app.use((req: Request, res: Response, next: NextFunction) => {
    const name = `HTTP ${req.method} ${req.route?.path || req.originalUrl || req.url}`;
    const startSnap = snap();
    log(`[START] ${name} mem=${JSON.stringify(startSnap)}`);

    res.on("finish", () => {
      const endSnap = snap();
      const d = diff(startSnap, endSnap);
      const grew = Math.max(
        includeRss ? d.rss : -Infinity,
        d.heapUsed,
        d.heapTotal,
        d.external,
        d.arrayBuffers
      );

      // Logger.error(`[PERF] ${name} `, { duration: d })
      
    // if (grew >= threshold) {
    log(
      `[END]   ${name} status=${res.statusCode} mem=${JSON.stringify(endSnap)} diff=${JSON.stringify(d)}`
    );
    // }
  });

  next();
});
}

export function attachSocketMemProbe(io: IOServer, opts: ProbeOpts = {}) {
  const log = opts.log ?? console.log;
  const threshold = opts.thresholdMB ?? 0;
  const includeRss = opts.includeRss ?? true;

  io.use((socket: Socket, next) => {
    log(`[SOCKET CONNECT] ${socket.id} mem=${JSON.stringify(snap())}`);

    const origOn = socket.on.bind(socket);
    socket.on = (event: string, handler: (...args: any[]) => any) => {
      const wrapped = async (...args: any[]) => {
        const startSnap = snap();
        log(`[START] SOCKET ${event}#${socket.id} mem=${JSON.stringify(startSnap)}`);
        try {
          const r = handler.apply(socket, args);
          if (r && typeof (r as any).then === "function") await r;
          return r;
        } finally {
          const endSnap = snap();
          const d = diff(startSnap, endSnap);
          const grew = Math.max(
            includeRss ? d.rss : -Infinity,
            d.heapUsed,
            d.heapTotal,
            d.external,
            d.arrayBuffers
          );
          if (grew >= threshold) {
            log(
              `[END]   SOCKET ${event}#${socket.id} mem=${JSON.stringify(endSnap)} diff=${JSON.stringify(d)}`
            );
          }
        }
      };
      return origOn(event, wrapped);
    };

    socket.on("disconnect", (reason) => {
      log(`[SOCKET DISCONNECT] ${socket.id} reason=${reason} mem=${JSON.stringify(snap())}`);
    });

    next();
  });
}
