
import { CompanyController } from "@src/controller/admin/company.controller";
import { DomainController } from "@src/controller/admin/domain.controller";
import { RecieptTemplateController } from "@src/controller/app/Settings/recieptTemplate.controller";
import { LabelTemplateController } from "@src/controller/app/Settings/LabelTemplate.controller";
import { PermissionMiddleware } from "@src/middlewear/privilegeMiddleWear";
import express from "express";
import { WebsiteBuilderController } from "@src/controller/app/Settings/WebSiteBuilder.Controller";
import { ProductCollectionController } from "@src/controller/app/Settings/procuctCollection.controller";
import { CustomerSegmentsController } from "@src/controller/app/Settings/customerSegmentations.controller";
import { PluginController } from "@src/controller/app/Settings/plugin.Controller";
import { CustomizationController } from "@src/controller/app/Settings/customizations.controller";
import { ProductController } from "@src/controller/app/products/product.controller";
import { ThemeController } from "@src/controller/ecommerce/theme.controller";
import { ApiLimiterRepo } from "@src/apiLimiter";
import { FeedbackController } from "@src/controller/app/Settings/feedbacks.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";

const router = createAsyncRouter();

router.get('/getCompanySetting',CompanyController.getCompanySetting)
router.get('/switchCompnay/:companyId',CompanyController.switchCompany)
router.get('/getCompaniesList',CompanyController.getAllCompanies)

router.post('/saveCompany',CompanyController.saveCompany)
router.post('/validateName',CompanyController.validateName)
router.post('/validatePassword',CompanyController.validatePassword)
router.post('/transactionsDate',CompanyController.checkTransactionsDates)
// router.post('/importFromCsvFile',CompanyController.importFromCsvFile)
router.post('/importCompanyData',CompanyController.importCompanyData)
router.post('/setProductOptions',CompanyController.setProductOptions)
router.get('/getProductOptions',CompanyController.getProductOptions)


router.post('/setBranchOptions',CompanyController.setBranchOptions)
router.get('/getBranchOptions',CompanyController.getBranchOptions)
router.get('/getCoveredAddresses',CompanyController.getCoveredAddresses)
router.post('/setCoveredAddresses',CompanyController.setCoveredAddresses)
router.post('/getSlugByDomain',DomainController.getSlugByDomain);

router.get('/getInvoiceTemplate',CompanyController.getInvoiceTemplate)
router.post('/setInvoiceTemplate',CompanyController.setInvoiceTemplate)

//Shipping Setting

router.get('/getShippingSetting',CompanyController.getShippingSetting)
router.post('/setShippingSetting',CompanyController.setShippingSetting)

//Reciept Template
router.post(`/saveRecieptTemplate`,RecieptTemplateController.saveRecieptTemplate)
router.post(`/getRecieptTemplates`,RecieptTemplateController.getRecieptTemplates)
router.get(`/getRecieptTemplate/:recieptTemplateId`,RecieptTemplateController.getRecieptTemplateById)
router.get(`/deleteRecieptTemplate/:recieptTemplateId`,RecieptTemplateController.deleteRecieptTemplateById)

//ZPL Template 
router.post(`/saveLabelTemplate`,LabelTemplateController.saveZPLTemplate)
router.post(`/getLabelTemplates`,LabelTemplateController.getZPLTemplates)
router.get(`/getLabelTemplate/:labelTemplateId`,LabelTemplateController.getZPLTemplateById)
router.get(`/deleteLabelTemplate/:labelTemplateId`,LabelTemplateController.deleteZPLTemplateById)

router.get(`/getDeliveryAddresses`,CompanyController.getCompanyAddresses)


router.post('/saveWebsiteTheme',WebsiteBuilderController.saveWebsiteTheme)
router.get('/getWebSiteThemeSettings',WebsiteBuilderController.getWebSiteThemeSettings)
router.get('/getWebSitePageSettings/:slug',WebsiteBuilderController.getWebSitePageSettings)
router.post('/getWebsiteBuilderPageList/',WebsiteBuilderController.getWebsiteBuilderPageList)
router.post('/getWebsiteBuilderPageList/',WebsiteBuilderController.getWebsiteBuilderPageList)
router.get('/getMenusSettings/',WebsiteBuilderController.getMenuSettings)
router.post('/getThemeByType/',WebsiteBuilderController.getThemeByType)
router.get('/getThemeById/:id',WebsiteBuilderController.getThemeById)
router.delete('/deletTheme/:id',WebsiteBuilderController.deleteThemeById)
router.put('/setHomePage/:id',WebsiteBuilderController.setHomePage)
router.post("/getCollectionProducts",ProductController.getMenuProducts);
router.get("/getMenus",WebsiteBuilderController.getMenus);
router.post("/getSectionData/",ThemeController.getSectionData)
router.post("/deleteContentLibrary/",WebsiteBuilderController.deleteContentLibrary)

router.post('/saveCollection',ProductCollectionController.saveProductCollection)
router.get('/getCollectionById/:collectionId',ProductCollectionController.getById)
router.post('/getCollectionList',ProductCollectionController.getList)

router.post('/saveCustomerSegment',CustomerSegmentsController.saveCustomerSegment)
router.get('/getCustomerSegmentById/:segmentId',CustomerSegmentsController.getCustomerSegmentById)
router.post('/getCustomerSegmentList',CustomerSegmentsController.getCustomerSegmentList)




router.post('/getPlugins',PluginController.getPlugins)
router.get('/getPlugin/:pluginId',PluginController.getPluginById)
router.post('/savePlugin',PluginController.savePlugin)
router.post('/footFallLogin',PluginController.footFallLogin)
router.post('/saveFootCam',PluginController.saveFootCamPlugin)
router.get('/getFootFallPlugin',PluginController.getFootFallCamPlugin);
  router.get('/CsrGenerate',PluginController.GenerateCsr)

router.post('/syncTransactions',PluginController.syncTransactions)
router.post('/MOICManualUpload',PluginController.MOICManualUpload)




//Domains
router.get('/domainStatus',DomainController.DomainStatus)
router.post('/registerDomain',DomainController.registerDomain)
router.post('/approveDomain',DomainController.approveDomain)
router.delete('/deleteDomain',DomainController.deleteDomain)


//customizations 
router.post('/saveCustomizations',CustomizationController.saveCustomization)
router.post('/getCustomizations',CustomizationController.getCustomizations)
router.post('/getCustomizationById/',CustomizationController.getCustomizationById)
router.get('/getCustomizationByKey/:type/:key',CustomizationController.getCustomizationByKey)
router.get('/getCustomizationByType/:type',CustomizationController.getCustomizationByType)



//OpenApi
router.get('/getApiToken',CompanyController.getCompanyApiToken);
router.get('/GenerateApiToken',CompanyController.GenerateApiToken);


router.post('/setpickUpMaxDistance',CompanyController.setpickUpMaxDistance);
router.get('/getpickUpMaxDistance',CompanyController.getpickUpMaxDistance);


router.post('/setPrefixSettings',CompanyController.setPrefixSettings);
router.get('/getPrefixSettings',CompanyController.getPrefixSettings);


router.post('/setFeedbackSettings',FeedbackController.saveFeedBackSettings);
router.get('/getFeedbackSettings',FeedbackController.getFeedBackSettings);
router.post('/getFeedbackList',FeedbackController.getFeedBackList);


//jofotara
router.post('/setJofotaraConfig',CompanyController.setJofotaraConfig);

export default router;