import { ResponseData } from "@src/models/ResponseData";
import { SalesRepots } from "@src/repo/reports/Sales.reports";
import { ReportsPDFGenerator } from "@src/utilts/ReportPDFGenerator";
import { XLSXGenerator } from "@src/utilts/xlsxGenerator";
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';

export class DashboardController {

    static async companiesSales(req: Request, res: Response, next: NextFunction) {
        try {
            let data = req.body;
            if(data.filter){
                data = { ...data, ...data.filter };
            }
            
            const company = res.locals.company;
            data.branchIds = res.locals.branches;
            data.companyIds = res.locals.companyIds;

            const resault = await SalesRepots.getSalesByBranch(data, company, [])

            if (data.export) {
                resault.data.fileName = `companiesSales_${new Date().getTime()}`;
                if (data.fileType && data.fileType == 'xlsx') {
                    const resData = await XLSXGenerator.exportToExcel(resault.data, company);
                    res.setHeader('Content-Disposition', `attachment; filename= "${resData.fileName}"`);
                    res.setHeader('Content-Type', resData.type);
                    const fileStream = fs.createReadStream(resData.fileName);
                    fileStream.pipe(res);
                    res.on('finish', () => {
                        fs.unlinkSync(resData.fileName);
                    });
                    return new ResponseData(true, "", [])
                } else {
                    let orientation;
                    const resData = await ReportsPDFGenerator.exportPdf(resault.data, company, { orientation: orientation ?? null });
                    // Send the file as a response
                    if (resData) {
                        res.setHeader('Content-Disposition', `attachment; filename= "${resData.fileName}"`);
                        res.setHeader('Content-Type', 'application/pdf');
                        const fileStream = fs
                            .createReadStream(resData.fileName);
                        fileStream.pipe(res);
                        res.on('finish', () => {
                            fs.unlinkSync(resData.fileName);
                        });
                    }
                }
            } else {
                return res.send(resault)
            }
        } catch (error: any) {
              throw error
        } finally {

        }
    }

    static async companiesPaymentsOverview(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            console.log(data);
            const company = res.locals.company;
            data.branchIds = res.locals.branches;
            data.companyIds = res.locals.companyIds;
            const filter = data.filter || {};
            const reportData = await SalesRepots.companiesPaymentsOverview(data, company, [])

            if (filter.export) {
                reportData.data.fileName = `companiesPaymentsOverview_${new Date().getTime()}`;
                if (filter.fileType && filter.fileType == 'xlsx') {
                    const resData = await XLSXGenerator.exportToExcel(reportData.data, company);
                    res.setHeader('Content-Disposition', `attachment; filename= "${resData.fileName}"`);
                    res.setHeader('Content-Type', resData.type);
                    const fileStream = fs.createReadStream(resData.fileName);
                    fileStream.pipe(res);


                    res.on('finish', () => {
                        fs.unlinkSync(resData.fileName);
                    });

                    return new ResponseData(true, "", [])
                } else {
                    let orientation;
                    const resData = await ReportsPDFGenerator.exportPdf(reportData.data, company, { orientation: orientation ?? null });
                    // Send the file as a response
                    if (resData) {
                        res.setHeader('Content-Disposition', `attachment; filename= "${resData.fileName}"`);
                        res.setHeader('Content-Type', 'application/pdf');

                        const fileStream = fs.createReadStream(resData.fileName);
                        fileStream.pipe(res);


                        res.on('finish', () => {
                            fs.unlinkSync(resData.fileName);
                        });
                    }
                }
            } else {
                return res.send(reportData)
            }
        } catch (error: any) {
              throw error
        } finally {

        }
    }
}