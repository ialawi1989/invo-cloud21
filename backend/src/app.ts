process.on('SIGTERM', () => {
  console.error('[process] SIGTERM');
  loggerTest.error('[process] SIGTERM');
});

process.on('SIGINT', () => {
  console.error('[process] SIGINT');
  loggerTest.error('[process] SIGINT');
});

process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException', err);
  loggerTest.error('[process] uncaughtException', { message: err.message, stack: err.stack });
  
});

process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection', reason);
  // loggerTest.error('[process] unhandledRejection', { reason });
});

process.on('exit', (code) => {
  console.error('[process] exit', { code });
  loggerTest.error('[process] exit', { code });
});
/* eslint-disable @typescript-eslint/no-var-requires */
import dotenv from 'dotenv';
import { attachHttpMemProbe, attachSocketMemProbe } from "./mem-probe";
function loadEnvConfig(path: string | null = null) {
  let result = path ? dotenv.config({ path: path }) : dotenv.config();
  path = path ? path : "Global environment";
  if (result.error) {
    console.warn("Error Loading " + path + ":" + result.error.name + " " + result.error.message);
  } else if (result.parsed) {
    console.log("Loaded " + path);
  } else {
    console.warn("Did not load " + path);
  }
}

loadEnvConfig(".env.local");
loadEnvConfig(".env");
loadEnvConfig();


import express from 'express';
import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { Routes } from './routes';
import cors from "cors"
import { createServer } from "http";
import { SocketController } from './socket';

import { RedisClient } from './redisClient';
import morgan from 'morgan'
import e, { Request, Response, NextFunction } from 'express';
import { CronJob } from 'cron';
import { ViewJob } from './controller/app/jobs/viewJobs';
import { MOICJob } from './controller/app/jobs/MOIC';
import { ZatcaJob } from './controller/app/jobs/ZatcaJob';
import { SubscriptionsJob } from './controller/app/jobs/subscriptions';
import { footfallCamJob } from './controller/app/jobs/FootfallCam';
import compression = require("compression");
import Queue from 'queue';
import { TriggerQueue } from './repo/triggers/triggerQueue';
import './repo/triggers/userBalancesQueue';
import { bezat } from '@src/Integrations/bezat/bezat';
import { GruptechOrderQueue } from './controller/admin/GruptechOrderQueue';
import { InvoiceStatusUpdate } from './controller/admin/InvoiceStatusUpdatedQueue';
import { ImBalanceJournalJob } from './controller/app/jobs/imBalanceJournalJobs';
import { InvoiceStatuesWorker } from './repo/triggers/queue/workers/invoiceStatus.worker';
import { purchaseOrderStatuesWorker } from './repo/triggers/queue/workers/purchaseOrder.worker';
import { requestContextMiddleware } from './middlewear/requestContextMiddleware';import loggerTest from './utilts/logFile';

// eslint-disable-next-line @typescript-eslint/no-var-requires
// import 'module-alias/register';
// import { addAliases } from 'module-alias';
// addAliases({
//   '@src': `${__dirname}/src`,
// });


const https = require('https');

export class App {
  public app = express();

  public routePrv: Routes = new Routes();
  public server: any;
  public socket: SocketController;
  public redisClient: RedisClient;
  port = process.env.PORT || 3001;
  private viewJob = new ViewJob();
  private imBalanceJournalJob = new ImBalanceJournalJob();
  private moic = new MOICJob();
  private ZatcaJob = new ZatcaJob();
  private SubscriptionsJob = new SubscriptionsJob();
  private bezat = new bezat();
  private footfallCam = new footfallCamJob();


  constructor() {
    this.app = express();
    attachHttpMemProbe(this.app, { thresholdMB: 1 });
    // this.app.set('trust proxy', true);
    this.app.set('trust proxy', 1); // Trust the first proxy (Nginx, etc.)

    this.redisClient = new RedisClient();
    this.config();
    this.routePrv.routes(this.app);
    this.server = createServer(this.app)

    this.socket = SocketController.createInstance(this.server);



    console.log(process.env.REDIS_CLIENT_URL);
    console.log('PORT:', process.env.PORT);
    attachSocketMemProbe((this.socket as any).io, { thresholdMB: 1 });
    this.server.listen(this.port, () => {
      console.log(`server running on localhost:` + this.port);
    })
    // this.viewJob.job.start()
    this.viewJob.paymentJob.start()
    this.viewJob.autoTransaction.start()
    this.viewJob.scheduledReport.start()
    if (process.env.NODE_ENV === "production") {
      this.imBalanceJournalJob.job.start()
    }
    this.moic.job.start();
    this.ZatcaJob.job.start();
    // this.SubscriptionsJob.job.start();
    this.bezat.setupNotificationListener();

    this.footfallCam.job.start();
    new TriggerQueue();
    new GruptechOrderQueue();
    new InvoiceStatusUpdate();
    if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing" || process.env.NODE_ENV === "development") {
      console.log = () => {};
      console.warn = () => {};
      console.error = () => {};

    }
  }


  //TODO: Load these from process.env
  allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://10.2.2.19:3000",
    "http://10.2.2.45:3000",
    "http://10.2.2.42:4200",
    "http://10.2.2.90:4200",
    "http://10.2.2.85:3000/"
  ];

  corsOptions = {
    origin: true, 
    credentials: true,
    exposedHeaders: ['Content-Disposition']
  }
  private config(): void {
    // this.app.set('trust proxy', true);
    this.app.set('trust proxy', 1); // Trust the first proxy (Nginx, etc.)
    this.app.use(compression());
    this.app.use(morgan('dev', {
      skip: function (req: any, res: any) {
        if (!req._startAt || !res._startAt) {
          // missing request and/or response start time
          return true
        }
        var ms: any = (res._startAt[0] - req._startAt[0]) * 1e3 +
          (res._startAt[1] - req._startAt[1]) * 1e-6
        return res.statusCode < 400 && ms.toFixed(3) < 1000
      }
    }))
    this.app.use(cors(this.corsOptions));
    this.app.use(cookieParser())

    this.app.use(express.json({ limit: "200mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "200mb", parameterLimit: 50000 }))
    this.redisClient.deletPatternKey("BulkImport*")
    this.redisClient.deletPatternKey("OptionBulkImport*")
    this.redisClient.deletPatternKey("CustomerBulkImport*")
    this.redisClient.deletPatternKey("SupplierBulkImport*")
    this.redisClient.deletPatternKey("PriceLabelBulkImport*")

    this.redisClient.deletPatternKey("sess:*")
    this.redisClient.deletKey('lockRefresh_' + process.env.NODE_ENV)
    this.app.use(requestContextMiddleware)
  }
}
const accountWorkers = [
  InvoiceStatuesWorker(),
  purchaseOrderStatuesWorker()
]
// export default new App().app;

import { runMigrations } from './utilts/runMigrations';

runMigrations()
  .then(() => {
    new App();
  })
  .catch((err) => {
    console.error('[startup] Migration failed — aborting boot', err);
    process.exit(1);
  });
