import { ResponseData } from "@src/models/ResponseData";
import { Request, Response, NextFunction } from 'express';

import { WebManifestRepo } from "@src/repo/ecommerce/webManifest.Repo";

export class WebManifestController{
        public static async getWebManifest(req: Request, res: Response, next: NextFunction){
            try {
        
                const company = res.locals.company;

               let webManifest = await WebManifestRepo.getWebManifest(company)
            
               res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
               res.setHeader("Pragma", "no-cache");
              return  res.send(webManifest) 
            } catch (error:any) {
                  throw error
            }
        } 
    
}