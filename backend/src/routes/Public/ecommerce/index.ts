require('module-alias/register');
import { CompanyController } from '@src/controller/admin/company.controller';
import  express from 'express';
import { BranchController } from '@src/controller/admin/branch.controller';
import { ServiceController } from '@src/controller/admin/service.controller';
import { EmployeeScheduleController } from "@src/controller/admin/employeeSchedule.controller";
import { ShopController } from '@src/controller/ecommerce/shop.controller';
import { ShopperController } from '@src/controller/ecommerce/shopper.controller';
import passport from 'passport';
import session from 'express-session'
import { RedisClient } from '@src/redisClient';
import { Passport } from '@src/passport';
import { CartController } from '@src/controller/ecommerce/cart.controlle';
import { PaymentController } from '@src/controller/ecommerce/payment.controller';
import rateLimit from 'express-rate-limit'
import { AuthController } from '@src/controller/app/auth.controller';
import { Validator } from '@src/controller/Public/ecommerce/validator.controller';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';


const router = createAsyncRouter();
const limiter = rateLimit({
    windowMs: 1 * 1000, // 20 seconds
    max: 1, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers

})
router.use(limiter);
router.use(AuthController.publicApiAuthintcate)


//Company 
router.get('/getCompanyPrefrences', CompanyController.getCompanyEcommerceSetting);
router.get('/getCompanyDeliveryAddresses', BranchController.getCompanyDeliveryAddresses);
router.get('/getCompanyBranches', BranchController.getBranchesList);
// router.get('/load/:branchId/:tableId', Validator.loadQrData, BranchController.loadQrData); // need to be Reimplemented by user it self



//Branches
router.get("/getBranchList", BranchController.getBranchesWithStatus)

router.get("/getBranchCoveredAddresses/:branchId", Validator.branchId, BranchController.getBranchCoveredAddresses)
router.get("/getServices/:branchId", Validator.branchId, ServiceController.getBranchServices)




//Employees
router.post('/getEmployeesSchedule', Validator.validateEmployeeSchedule, EmployeeScheduleController.getEmployeesSchedule)
//{"branchId":"fa784ca9-c1f7-4d17-b341-4f17064af0a6","from":"2025-01-10","to":"2025-01-10",}
router.post('/getEmployeesScheduleForAppointment', Validator.EmployeesScheduleForAppointment, EmployeeScheduleController.getEmployeesScheduleForAppointment)
//{"branchId":"fa784ca9-c1f7-4d17-b341-4f17064af0a6","date":"2025-01-10"}






//Menu
router.post("/menu/getMenuSections", Validator.getMenuSections, ShopController.getMenuSections)
//{"branchId":"19a711e1-1328-4ecf-91a2-cb8b1bbf3dcf"}
router.post("/menu/getMenuProducts", Validator.getMenuProducts, ShopController.getMenuProducts)
//{"page":1,"branchId":"19a711e1-1328-4ecf-91a2-cb8b1bbf3dcf","limit":12,"sectionId":"","tags":null,"sort":{"sortValue":null,"sortDirection":null},"priceFilter":null}
router.post("/menu/getProductTags", Validator.getProductTags, ShopController.getMenuProductTags)
//{"branchId":"19a711e1-1328-4ecf-91a2-cb8b1bbf3dcf","priceFilter":""}
router.post("/getCatgorieProductsTags", Validator.getProductTags, ShopController.getCatgorieProductsTags)
//{"branchId":"19a711e1-1328-4ecf-91a2-cb8b1bbf3dcf","priceFilter":""}
router.post("/getCompanyCategories", Validator.branchIdPost, ShopController.getCompanyCategories)
//{"branchId":"19a711e1-1328-4ecf-91a2-cb8b1bbf3dcf"}
router.post("/getServiceProducts", Validator.getServiceProducts, ShopController.getServiceProducts)
// {
//     "page": 1,
//     "branchId": "a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6",
//     "limit": 20,
//     "tags": ["electronics", "gadgets"],
//     "sort": {
//       "sortValue": "price",
//       "sortDirection": "ASC"
//     },
//     "priceFilter": {
//       "min": 10,
//       "max": 1000
//     },
//     "searchTerm": "smartphone",
//     "departmentId": "a7b8c9d0-e1f2-3g4h-5i6j-k7l8m9n0o1p2",
//     "categoryId": "b8c9d0e1-f2g3-4h5i-6j7k-8l9m0n1o2p3",
//     "brandId": "c9d0e1f2-g3h4-5i6j-7k8l-9m0n1o2p3q4"
//   }
  
router.get("/getServiceProductCategories", ShopController.getServiceProductCategories)

router.post("/getCategoriesProducts", Validator.getServiceProducts, ShopController.getCategoriesProducts)
//{
//     "page": 1,
//     "branchId": "a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6",
//     "limit": 20,
//     "tags": ["electronics", "gadgets"],
//     "sort": {
//       "sortValue": "price",
//       "sortDirection": "ASC"
//     },
//     "priceFilter": {
//       "min": 10,
//       "max": 1000
//     },
//     "searchTerm": "smartphone",
//     "departmentId": "a7b8c9d0-e1f2-3g4h-5i6j-k7l8m9n0o1p2",
//     "categoryId": "b8c9d0e1-f2g3-4h5i-6j7k-8l9m0n1o2p3",
//     "brandId": "c9d0e1f2-g3h4-5i6j-7k8l-9m0n1o2p3q4"
//   }



router.post("/getProduct", Validator.branchIdAndProductId, ShopController.getProduct)
//{"productId":"0ba2cf3e-45f1-4b66-81bd-cf0d0812669c","branchId":"fa784ca9-c1f7-4d17-b341-4f17064af0a6"}
router.post("/getAlternativeProducts", Validator.branchIdAndProductId, ShopController.getaAlternativeProducts)
//{"productId":"0ba2cf3e-45f1-4b66-81bd-cf0d0812669c","branchId":"fa784ca9-c1f7-4d17-b341-4f17064af0a6"}
router.get("/getBrands", ShopController.getBrands)

router.post("/getServicesList", Validator.branchIdAndEmployeeId, ShopController.getServicesList)
//{"branchId":"fa784ca9-c1f7-4d17-b341-4f17064af0a6","employeeId":"9f522bec-3409-4551-8f5f-31f9effa95b7"}
router.use(session({
    secret: 'bz1P6EYH%q',
    store: RedisClient.getRedisClient().store,
    resave: false,
    saveUninitialized: true,
    cookie: { path: '/', secure: false, httpOnly: false, sameSite: "none", maxAge: 30 * 24 * 60 * 60 * 1000 } //30 days

}))
router.use(passport.initialize());
router.use(passport.session());
Passport.loadPassport(passport)


// router.post("/logIn", Validator.logIn, ShopperController.logIn)
//{"username": "exampleUser", "password": "examplePassword"}




//cart 

router.post("/createCart", Validator.createCart, CartController.createCart)
//{"branchId":"19a711e1-1328-4ecf-91a2-cb8b1bbf3dcf","serviceName":"PickUp","sessionId":"ba5ba9fa-304d-e5fe-b99c-80090507c032","userSessionId":null}
router.get("/getCart/:sessionId", CartController.getCart)

router.post("/addItem", Validator.addItem, CartController.addItemToCart)
//{"sessionId":"ba5ba9fa-304d-e5fe-b99c-80090507c032","userSessionId":null,"productId":"00e0491c-8a94-4989-9682-57b0a0238742","qty":1}
router.post("/removeItem", Validator.removeItem, CartController.removeItemFromCart)
//{"sessionId":"ba5ba9fa-304d-e5fe-b99c-80090507c032","userSessionId":null,"transactionId":"15c0ffa4-64e4-7993-211a-9fc185a5ff7b"}
router.post("/clearCart", Validator.clearCart, CartController.clearCartItems)
//{"sessionId":"89d20840-223d-4809-dcf6-4c38c87fa24c"}
router.post("/changeItemQty", Validator.changeItemQty, CartController.changeItemQty)
//{"sessionId":"ba5ba9fa-304d-e5fe-b99c-80090507c032","userSessionId":null,"transactionId":"a2e2a9aa-0f66-fcd7-5eb1-e744f8dbd8e3","qty":2}
router.post("/checkBranchAvailabilty", Validator.checkBranchAvailabilty, CartController.checkBranchAvailability)
//{"sessionId":"89d20840-223d-4809-dcf6-4c38c87fa24c","branchId":"19a711e1-1328-4ecf-91a2-cb8b1bbf3dcf"}
router.post("/checkOut",Validator.checkOut, CartController.checkOut)
//{"sessionId":"ba5ba9fa-304d-e5fe-b99c-80090507c032",
// "userSessionId":null,
// "branchId":"19a711e1-1328-4ecf-91a2-cb8b1bbf3dcf",
// "serviceId":"89ab9b19-0040-4cc2-b9a4-a8b5dfc0780b",
// "serviceName":"PickUp",
// "payment":{"name":"Cash"},
// "customer":{"name":"ee","phone":"33333332","address":{"country":null}},
// "note":"",
// "carNumber":"",
// "scheduleTime":null,
// "addressKey":""}
router.get("/getOrder/:sessionId",Validator.sessionId, CartController.getOrderBySessionId)
router.post("/ChangeService",Validator.ChangeService, CartController.ChangeService);
//{"sessionId":"89d20840-223d-4809-dcf6-4c38c87fa24c","userSessionId":null,"branchId":"19a711e1-1328-4ecf-91a2-cb8b1bbf3dcf","serviceName":"PickUp"}







//payments
router.get("/getCurrencyList", PaymentController.getCurrencyList)
router.get("/getPaymentMethods", PaymentController.PublicgetPaymentMethods)
router.post("/payInvoice",Validator.payInvoice, PaymentController.payInvoice)
//{"sessionId":"e4642b14-a6f6-8369-edfa-2b6d97601fe9","userSessionId":null,"payment":{"name":"TapPayment"}}
router.get("/tapPaymentResponse/:id", Validator.id, PaymentController.tapPaymentResponse)
router.get("/thawaniCallBack/:invoiceId", Validator.invoiceId, PaymentController.thawaniCallBack)
// router.get("/ThawaniCancelResponse/:invoiceId", Validator.invoiceId, PaymentController.ThawaniCancelResponse)
router.post("/BenefitCallBack/:id", Validator.id, PaymentController.BenefitCallBack)


//shipping
router.get('/getShippingSetting', CompanyController.getShippingSetting)


export default router;