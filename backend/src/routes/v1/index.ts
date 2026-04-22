
import express from 'express';

import app from './app';
import callCenter from './callCenter';
import inventoryApp from './inventoryApp';
import deliveryApp from './deliveryApp';
import ecommerce from './ecommerce'
import { CompanyController } from '@src/controller/admin/company.controller';
import { DomainController } from '@src/controller/admin/domain.controller';
import session from 'express-session'
import { RedisClient } from '@src/redisClient';
import { Passport } from '@src/passport';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import watch from '../v1/invoWatch';
import { ApiLimiterRepo } from '@src/apiLimiter';
import CompanyGroup from './company_group';
import { CompanyRepo } from '@src/repo/admin/company.repo';
import { errorHandler } from '@src/middlewear/errorHandler';
import { authenticatedContextMiddleware } from '@src/middlewear/authenticatedContextMiddleware';
// import  statusMonitor from 'express-status-monitor';

const router = express.Router();

// router.use(  statusMonitor({
//   title: 'Express Status',  // Default title
// theme: 'default.css',     // Default styles
// path: '/status',
// spans: [{
// interval: 1,            // Every second
// retention: 60           // Keep 60 datapoints in memory
// }, {
// interval: 5,            // Every 5 seconds
// retention: 60
// }, {
// interval: 15,           // Every 15 seconds
// retention: 60
// }],
// chartVisibility: {
// cpu: true,
// mem: true,
// load: true,

// heap: true,
// responseTime: true,
// rps: true,
// statusCodes: true
// },
// healthChecks: [{
// protocol: 'http',
// host: 'localhost',
// path: '/',
// port: '3001'
// }],
// }))

router.use('/app', app);

router.use('/callcenter', callCenter);
router.use('/inventoryApp', inventoryApp);
router.use('/delivery', deliveryApp);
router.use('/watch', watch);
// router.use((req,res,next)=>{
//   res.setHeader('Set-Cookie', 'cookieName=cookieValue; Path=/; Secure; HttpOnly');
//   res.header('Access-Control-Allow-Credentials', 'true');
//   next()
// })



router.get('/ecommerce/domainSimilarity/:slug', DomainController.domainSimilarity);

if (process.env.NODE_ENV === 'production') {
    router.use('/ecommerce/:subDomain', ApiLimiterRepo.ecommerceLimiter);
}
router.use('/ecommerce/:subDomain', CompanyController.setSubDomain);
router.use('/ecommerce/:subDomain', ecommerce);


export default router;