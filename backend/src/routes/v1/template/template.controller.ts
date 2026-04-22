import { Request, Response, NextFunction, Router } from "express";
import { ProcessRequest } from "../promotions/common/web";
import { TemplateProvider } from "./template.business";


export class TemplateController {
    public static registerRouts(router: Router) {
        router.get(
            "/templates",
            ProcessRequest(TemplateProvider.Create, TemplateController.getTemplate)
        );
        router.get(
            "/templates/:id",
            ProcessRequest(TemplateProvider.Create, TemplateController.getTemplateById)
        );
         router.post(
            "/templates-render",
            ProcessRequest(TemplateProvider.Create, TemplateController.renderTemplate)
        );
        //create
        router.post(
            "/templates", 
            ProcessRequest(TemplateProvider.Create, TemplateController.createTemplate)
        );
        //update
        router.put(
            "/templates/:id", 
            ProcessRequest(TemplateProvider.Create, TemplateController.updateTemplate)
        );
        //delete
        router.delete(
            "/templates/:id",
            ProcessRequest(TemplateProvider.Create, TemplateController.deleteTemplate)
        )
    }


    public static async getTemplate(
        req: Request,
        res: Response,
        next: NextFunction,
        TemplateProvider:TemplateProvider
    ){
        const company = res.locals.company;
        const employeeId = res.locals.user;
        const pageInfo = res.locals.pageInfo;
        const sortInfo = res.locals.sortInfo;

        const result = await TemplateProvider.getTemplates(company.id, pageInfo,sortInfo );
        return result;
    }

    public static async getTemplateById(
        req: Request,
        res: Response,
        next: NextFunction,
        TemplateProvider:TemplateProvider
    ){
        const employeeId = res.locals.user;
        const id = req.params.id;

        const result = await TemplateProvider.getTemplateById(id);
        return result;

    }

    //render
    public static async renderTemplate(
        req: Request,
        res: Response,
        next: NextFunction,
        TemplateProvider:TemplateProvider
    ){
        const employeeId = res.locals.user;
        const template = req.body.template; //string
        const templateData = req.body.templateData; //any

        const result = await TemplateProvider.renderTemplate(template, templateData);
        return result;

    }


    public static async createTemplate(
        req: Request,
        res: Response,
        next: NextFunction,
        TemplateProvider:TemplateProvider
    ){
        const company = res.locals.company;
        const employeeId = res.locals.user;
        const template = req.body

        const result = await TemplateProvider.createTemplate(company.id, employeeId, template)

        return result
    }

    public static async updateTemplate(
        req: Request,
        res: Response,
        next: NextFunction,
        TemplateProvider:TemplateProvider
    ){
        const company = res.locals.company;
        const employeeId = res.locals.user;
        const id = req.params.id;
        const template = req.body

        const result = await TemplateProvider.updateTemplate(company.id, employeeId, id, template)

        return result
    }

    public static async deleteTemplate(
        req: Request,
        res: Response,
        next: NextFunction,
        TemplateProvider:TemplateProvider
    ){
        const employeeId = res.locals.user;
        const id = req.params.id;

        const result = await TemplateProvider.deleteTemplate(employeeId, id)

        return result
    }

}