import { ResponseData } from "@src/models/ResponseData";
import { Request, Response, NextFunction } from 'express';

import { ImagesRepo } from "@src/utilts/images";

import crypto from 'crypto'
export class ImagesController {
    public static async icon72(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            let image = await ImagesRepo.icon72(company.id)


            let exstention = image?.extension == 'svg' ? 'svg+xml' : 'png'
            if (image && image.image) {
                const img = Buffer.from(image.image, 'base64');
                const etag = crypto.createHash('md5').update(img).digest('hex');
                res.setHeader('ETag', etag);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.writeHead(200, {
                    'Content-Type': `image/${exstention}`,
                    'Content-Length': img.length
                });
                return res.end(img);
            }
        } catch (error: any) {
              throw error
        }
    }


    public static async icon96(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            let image = await ImagesRepo.icon96(company.id)


            let exstention = image?.extension == 'svg' ? 'svg+xml' : 'png'
            if (image && image.image) {
                const img = Buffer.from(image.image, 'base64');
                const etag = crypto.createHash('md5').update(img).digest('hex');
                res.setHeader('ETag', etag);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.writeHead(200, {
                    'Content-Type': `image/${exstention}`,
                    'Content-Length': img.length
                });
                return res.end(img);
            }
        } catch (error: any) {
              throw error
        }
    }


    
    public static async icon128(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            let image = await ImagesRepo.icon128(company.id)


            let exstention = image?.extension == 'svg' ? 'svg+xml' : 'png'
            if (image && image.image) {
                const img = Buffer.from(image.image, 'base64');
                const etag = crypto.createHash('md5').update(img).digest('hex');
                res.setHeader('ETag', etag);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.writeHead(200, {
                    'Content-Type': `image/${exstention}`,
                    'Content-Length': img.length
                });
                return res.end(img);
            }
        } catch (error: any) {
              throw error
        }
    }


    public static async icon144(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            let image = await ImagesRepo.icon144(company.id)


            let exstention = image?.extension == 'svg' ? 'svg+xml' : 'png'
            if (image && image.image) {
                const img = Buffer.from(image.image, 'base64');
                const etag = crypto.createHash('md5').update(img).digest('hex');
                res.setHeader('ETag', etag);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.writeHead(200, {
                    'Content-Type': `image/${exstention}`,
                    'Content-Length': img.length
                });
                return res.end(img);
            }
        } catch (error: any) {
              throw error
        }
    }

    

    public static async icon152(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            let image = await ImagesRepo.icon152(company.id)


            let exstention = image?.extension == 'svg' ? 'svg+xml' : 'png'
            if (image && image.image) {
                const img = Buffer.from(image.image, 'base64');
                const etag = crypto.createHash('md5').update(img).digest('hex');
                res.setHeader('ETag', etag);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.writeHead(200, {
                    'Content-Type': `image/${exstention}`,
                    'Content-Length': img.length
                });
                return res.end(img);
            }
        } catch (error: any) {
              throw error
        }
    }


    
    public static async icon192(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            let image = await ImagesRepo.icon192(company.id)


            let exstention = image?.extension == 'svg' ? 'svg+xml' : 'png'
            if (image && image.image) {
                const img = Buffer.from(image.image, 'base64');
                const etag = crypto.createHash('md5').update(img).digest('hex');
                res.setHeader('ETag', etag);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.writeHead(200, {
                    'Content-Type': `image/${exstention}`,
                    'Content-Length': img.length
                });
                return res.end(img);
            }
        } catch (error: any) {
              throw error
        }
    }


        
    public static async icon384(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            let image = await ImagesRepo.icon384(company.id)


            let exstention = image?.extension == 'svg' ? 'svg+xml' : 'png'
            if (image && image.image) {
                const img = Buffer.from(image.image, 'base64');
                const etag = crypto.createHash('md5').update(img).digest('hex');
                res.setHeader('ETag', etag);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.writeHead(200, {
                    'Content-Type': `image/${exstention}`,
                    'Content-Length': img.length
                });
                return res.end(img);
            }
        } catch (error: any) {
              throw error
        }
    }

            
    public static async icon512(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            let image = await ImagesRepo.icon512(company.id)


            let exstention = image?.extension == 'svg' ? 'svg+xml' : 'png'
            if (image && image.image) {
                const img = Buffer.from(image.image, 'base64');
                const etag = crypto.createHash('md5').update(img).digest('hex');
                res.setHeader('ETag', etag);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.writeHead(200, {
                    'Content-Type': `image/${exstention}`,
                    'Content-Length': img.length
                });
                return res.end(img);
            }
        } catch (error: any) {
              throw error
        }
    }

    public static async AppleSplash(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const imageSize = req.params.imageSize;
            const size = imageSize.split('.')[0]
            let image = await ImagesRepo.appleSplash(size,company.id)


            let exstention = image?.extension == 'svg' ? 'svg+xml' : 'png'
            if (image && image.image) {
                const img = Buffer.from(image.image, 'base64');
                const etag = crypto.createHash('md5').update(img).digest('hex');
                res.setHeader('ETag', etag);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.writeHead(200, {
                    'Content-Type': `image/${exstention}`,
                    'Content-Length': img.length
                });
                return res.end(img);
            }
        } catch (error: any) {
              throw error
        }
    }

   
}