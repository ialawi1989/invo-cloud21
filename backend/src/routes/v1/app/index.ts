

require('module-alias/register');
import { AuthController } from '@src/controller/app/auth.controller';
import express from 'express';
import product from './product';
import tables from './tables'
import accounts from './accounts'
import terminals from './terminals'
import employee from './employee'
import branch from './branch'
import company from './company'
import media from './media'
import dashboard from './dashboard'
import session from './sessions'
import push from './push'
import eInvoice from './eInvoice'
import salesTarget from './salesTarget'
import { ProductController } from '@src/controller/app/products/product.controller';
import { EmployeeController } from '@src/controller/admin/employee.controller';
import { CompanyController } from '@src/controller/admin/company.controller';
import { DomainController } from '@src/controller/admin/domain.controller';
import { MediaController } from '@src/controller/app/products/media.controller';
import { TerminalController } from '@src/controller/app/Terminal/terminal.controller';
import whatsapp from './whatsapp';
import { pdfController } from '@src/controller/app/Accounts/pdf.controller';
import { JournalViewController } from '@src/controller/Journals/JournalViewController';
import { AccountController } from '@src/controller/app/Accounts/account.controller';
import { ApiLimiterRepo } from '@src/apiLimiter';
import { frontendRouter as promotions } from '../promotions';
import { frontendRouter as templates } from '../template';
import { frontendRouter as notification } from '../notification'
import { frontendRouter as apiPortal } from '../apiPortal';
import CompanyGroup from '../company_group';
import { WebPushController } from '@src/controller/app/webpush/webPush.controller';
import { authenticatedContextMiddleware } from '@src/middlewear/authenticatedContextMiddleware';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';
const router = createAsyncRouter();
router.use(authenticatedContextMiddleware("Cloud"))
router.use('/groups', CompanyGroup);
router.post("/insertAccountTranslation", AccountController.insertAccountTranslation)
router.post("/checkOTP", AuthController.checkOTP)
router.post("/resetPassword", AuthController.resetPassword)
router.post("/setNewPassword", AuthController.setNewPassword2)
router.post('/testTheFunction', CompanyController.testTheFunction);
router.post('/updateThumbnail', CompanyController.updateThumbnail);
router.post("/terminal/recoverTerminalDB", TerminalController.recoverTerminal)
router.use('/eInvoice', eInvoice)
router.post('/login', AuthController.login);
router.post('/brodcastMessage', WebPushController.brodcastNotification);
router.get('/validateEmail/:email/:token', AuthController.tempAuthintcate, AuthController.validateEmail);
router.post('/set2FA', AuthController.tempAuthintcate, AuthController.set2FA);
router.post('/validate2FaCode', AuthController.tempAuthintcate, AuthController.validate2FCode);
router.get("/reset2fa", AuthController.tempAuthintcate, AuthController.reset2fa)
router.post("/validateOTP", AuthController.tempAuthintcate, AuthController.validateOTP)

router.post('/getSlugByDomain',DomainController.getSlugByDomain);
router.post('/refreshToken', AuthController.refreshToken)
router.get('/tryHash', AuthController.testHash)
router.get('/InvoicePdf/:id', pdfController.InvoicePdf);
router.get('/POPdf/:id', pdfController.POPdf);
router.get('/billsPdf/:id', pdfController.billsPdf);
router.get('/billPaymentPdf/:id', pdfController.billPaymentPdf);
router.get('/invoicePaymentPdf/:id', pdfController.invoicePaymentPdf);
router.get('/estimatePdf/:id', pdfController.estimatePdf);
router.get('/creditNotePdf/:id', pdfController.creditNotePdf);
router.get('/supplierCreditNotePdf/:id', pdfController.supplierCreditNotePdf);
router.get('/expensePdf/:id', pdfController.expensePdf);
router.post('/deleteJournalsRecords/', JournalViewController.deleteJournals);
router.post('/deleteMovmentsRecords/', JournalViewController.deleteMovments);
router.post('/insertJournals/', JournalViewController.InsertJournalRecords);
router.post('/insertMovment/', JournalViewController.InsertMovment);
router.post('/deleteKeys/', JournalViewController.deleteKeys);
router.post('/getKeys/', JournalViewController.getKeys);
router.post('/retryFaildJobs/', JournalViewController.retryFaildJobs);
router.post('/getFailedJob/', JournalViewController.getFailedJob);
router.post('/getGrubFailedJob/', JournalViewController.getGrubFailedJob);
router.post('/addFaildPayments/', JournalViewController.addFaildPayments);
router.post('/addFaildCreditNotes/', JournalViewController.addFaildCreditNotes);
router.post('/addFaildCreditNoteRefunds/', JournalViewController.addFaildCreditNoteRefunds);
router.post('/tesssssstttttttt/', JournalViewController.tesssssstttttttt);
router.post('/checksaveAttendance/', AccountController.checksaveAttendance);


router.post('/InsertMissingJournals/', JournalViewController.InsertMissingJournals);


//image 

router.get("/product/getProductImage/:companyId/:productId", ProductController.getProductImage)
router.get('/employee/getEmployeeImage/:companyId/:employeeId', EmployeeController.getEmployeeImage)
router.get('/logo/:companyId', CompanyController.getCompanyLogo)
router.get('/Media/getMedia/:companyId/:mediaId', MediaController.getMedia)
router.get('/Media/getMedia/attendance/:companyId/:mediaId', MediaController.getMediaAttendance)
router.get('/Media/downloadMediaFile/:companyId/:mediaId', MediaController.getMediaFile)
router.get('/Media/getMedia/:companyId/thumbnail/:mediaId', MediaController.getThumbnailMedia)
router.get('/Media/getMedia/:companyId/File/:mediaId', MediaController.getMedia)
router.get('/Signatures/:fileName/:companyId/:mediaName', MediaController.getSignatureMedia)
router.get('/getLogo/:logoName', MediaController.getLogo)
// router.get('/saveThumbnail/', MediaController.saveThumbnail)


router.get('/connectTerminal/:code', TerminalController.connectTerminalRedirect)
router.put('/logout', AuthController.logOut)
router.post('/acceptTermAndConditions', AuthController.acceptTermAndConditions)
router.use(AuthController.authintcate)
router.use(AuthController.authinticateBranches)

router.get('/checkLoggedInToken', AuthController.checkLoggedInToken)
router.use((req, res, next) => {
    // addBreadcrumb({
    //     'message': res.locals.company.id,
    //     "level": "info"
    // });
    next();
});
router.use("/whatsapp", whatsapp)
router.use('/terminals', terminals)
router.use('/employee', employee)
router.use('/product', product);
router.use('/tables', tables);
router.use('/accounts', accounts)
router.use('/branch', branch)
router.use('/company', company)
router.use('/media', media)
router.use('/dashboard', dashboard)
router.use('/push', push)
router.use('/sessions', session)

router.use('/promotions', promotions);
router.use('/templates', templates);
router.use('/notification', notification);
router.use('/portal', apiPortal);

router.use('/salesTarget', salesTarget);

export default router;