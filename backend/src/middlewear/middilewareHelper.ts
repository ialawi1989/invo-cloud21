
import { FileStorage } from '@src/utilts/fileStorage';
import { TimeHelper } from '@src/utilts/timeHelper';
import { Request, Response, NextFunction } from 'express';
export class MiddleWareHelper {
 
    public static setFilterDates() {
        return (req: Request, res: Response, next: NextFunction) => {
            try {
                let data = req.body;
                let filter = req.body.filter;
                let interval = req.body.interval;
                let fromDate;
                let toDate;

                if (filter) {
                    fromDate = filter.fromDate;
                    toDate = filter.toDate;
                    let isDate = TimeHelper.isValidDate(fromDate);
                    if(!isDate)
                    {
                        req.body.filter.fromDate = null 
                    }
                    isDate = TimeHelper.isValidDate(toDate);
                    if(!isDate)
                    {
                        req.body.filter.toDate = null 
                    }
                } else if (interval) {
                    fromDate = interval.from;
                    toDate = interval.to;
                    let isDate = TimeHelper.isValidDate(fromDate);
                    if(!isDate)
                    {
                        req.body.interval.from = null 
                    }
                    isDate = TimeHelper.isValidDate(toDate);
                    if(!isDate)
                    {
                        req.body.interval.to = null 
                    }
                }

                return next()
            } catch (error) {
                console.log(error)
            }


        }
    }

    public static  setTimeOffset() {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const country = res.locals.company.country
                let fileStorage = new FileStorage();
                const settings = (await  fileStorage.getCompanySettings(country))?.settings
                const timeOffset = settings.timeOffset
                res.locals.company.timeOffset = timeOffset
                return next()

            } catch (error) {
                console.log(error)
            }


        }
    }
}
