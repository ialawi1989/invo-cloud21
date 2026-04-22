import { ResponseData } from '@src/models/ResponseData';
import { MediaRepo } from '@src/repo/app/settings/media.repo';
import { S3Storage } from '@src/utilts/S3Storage';
import { FileStorage } from '@src/utilts/fileStorage';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto'
import path from 'path';
import { result } from 'lodash';


export class MediaController {
  // public static async importMedia(req: Request, res: Response, next: NextFunction) {
  //   try {
  //     const company = res.locals.company;
  //     const data = req.body;
  //     let resault;
  //     if (data.id == null || data.id == "") {
  //       resault = await MediaRepo.importMedia(req.body, company);
  //     }
  //     return res.send(resault);
  //   } catch (error: any) {
  //     console.log(error);
  //       throw error
  //   }
  // }
  public static async importMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const company = res.locals.company;
      let resault;
      const bodyData = req.body
      // const data: { type:string,name: string, fileType: string, extension: string, size: string, mediaType: any, media: string } = req.body;

      const fileData = req.files;


      if (fileData) {


        const files = Array.isArray(fileData.files) ? fileData.files[0] : fileData.file;
        if (!files) {
          return res.send(new ResponseData(false, "No file uploaded", []));
        }


        // for (let index = 0; index < files.length; index++) {
        const data: any = files
        data.media = data.data;
        let extension = data.name.split('.')[1];
        let fileType = data.mimetype.split('/')[0];
        // let extension = data.mimetype.split('/')[1];
        let contentTypes = bodyData[`contentTypes`]
        data.contentType = contentTypes;
        const mediaType = {
          "fileType": fileType,
          "extension": extension,
        }
        data.mediaType = mediaType;
        resault = await MediaRepo.importMedia(data, company);
        if (resault.success == false) {
          //  errors.push(index);

          await MediaRepo.deleteMedia({ mediaId: resault.data.currentMedia, mediaType: mediaType }, company)
          return res.send(resault)
        } else {
          return res.send(resault)
        }
        // }


      } else {
        return res.send(new ResponseData(false, "File Is Required", []))
      }
    } catch (error: any) {

        throw error
    }
  }
  public static async appendAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      const company = res.locals.company;
      const data = req.body;
      let resault;

      resault = await MediaRepo.setAttchments(data, company);

      res.send(resault);
    } catch (error: any) {


        throw error
    }
  }

  public static async getMediaList(req: Request, res: Response, next: NextFunction) {
    try {
      const company = res.locals.company;
      const data = req.body
      const resault = await MediaRepo.getMediaList(data, company)
      res.send(resault);
    } catch (error: any) {

        throw error
    }
  }
  public static async editMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const company = res.locals.company;
      const data = req.body
      const resault = await MediaRepo.editMedia(data, company)
      res.send(resault);
    } catch (error: any) {


        throw error
    }
  }
  public static async getMedia(req: Request, res: Response, next: NextFunction) {
    try {

      const companyId = req.params.companyId;
      const mediaId = req.params.mediaId;
      const extantion = mediaId.split('.')[1]

      const width = req.query.width ? Number(req.query.width) : null;
      const height = req.query.height ? Number(req.query.height) : null;

      if (extantion != 'pdf') {
        const image = await S3Storage.getImageUrl(mediaId, companyId, width, height)
        let exstention = extantion == 'svg' ? 'svg+xml' : 'png'
        if (image) {
          // const img = Buffer.from(image, 'base64');
          // /** image cache for 24h */
          //   const etag = crypto.createHash('md5').update(img).digest('hex');
          //   res.setHeader('ETag', etag);
          //   res.setHeader('Cache-Control', 'public, max-age=86400');
          //   res.writeHead(200, {
          //     'Content-Type': `image/${exstention}`,
          //     'Content-Length': img.length
          //   });
          //   return res.end(img);
          // }
          res.setHeader("Cache-Control", "no-store");      // don’t cache the redirect itself

          res.redirect(302, image);
        } else {
          let imageData: any = await S3Storage.getImageBase64(mediaId, companyId)
          return res.send(imageData)
        }
      }

      } catch (error: any) {
          throw error
      }
    }



  public static async getMediaFile(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.params.companyId;
      const mediaId = req.params.mediaId;

      // Get the extension
      const extension = mediaId.split('.').pop(); // safer than [1]

      const image: any = await S3Storage.getMediafile(mediaId, companyId);

      if (image) {
        // Clean base64 if it contains a data URI prefix
        const cleaned = image.replace(/^data:application\/[\w\.\-\+]+;base64,/, "");
        const download = Buffer.from(cleaned, "base64");

        // Set headers correctly
        res.setHeader("Content-Type", `application/${extension}`)
        res.setHeader("Content-Disposition", `inline; filename="file.${extension}"`);

        // Send the buffer directly
        return res.end(download);
      } else {
        return res.status(404).send(new ResponseData(false, "File not found", []));
      }
    } catch (error: any) {
         const err:any = new Error(error.message)
            err.statusCode = 500
            throw err 
      return res.status(500).send(new ResponseData(false, error.message, []));
    }
  }

  public static async getThumbnailMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.params.companyId;
      const mediaId = req.params.mediaId;
      const storage = new FileStorage();
      const image = await storage.getThumbnailMedia(companyId, mediaId)

      if (image) {
        const etag = crypto.createHash('md5').update(image).digest('hex');
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.sendFile(image)
      } else {
        return res.send(new ResponseData(true, "Image Not Found", []))
      }
    } catch (error: any) {

        throw error
    }
  }
  public static async getMediaLinkes(req: Request, res: Response, next: NextFunction) {
    try {

      const mediaId = req.params.mediaId;

      const resault = await MediaRepo.getMedialinkedToList(mediaId)
      res.send(resault);
    } catch (error: any) {
        throw error
    }
  }
  public static async unLinkMedia(req: Request, res: Response, next: NextFunction) {
    try {

      const media = req.body

      const resault = await MediaRepo.unlinkMedia(media)
      res.send(resault);
    } catch (error: any) {
        throw error
    }
  }
  public static async getMediabyId(req: Request, res: Response, next: NextFunction) {
    try {

      const mediaId = req.params.mediaId;

      const resault: any = await MediaRepo.getMediaById(mediaId)



      return res.send(resault);


    } catch (error: any) {
        throw error
    }
  }
  public static async getDefaultMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const mediaId = req.params.mediaId;
      const company = res.locals.company;
      const resault = await MediaRepo.getDeafultImge(mediaId, company)
      res.send(resault);
    } catch (error: any) {
        throw error
    }
  }
  public static async deleteMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const company = res.locals.company;
      const resault = await MediaRepo.deleteMedia(data, company)
      res.send(resault);
    } catch (error: any) {
        throw error
    }
  }


  public static async getLogo(req: Request, res: Response, next: NextFunction) {
    try {
      const logoName = req.params.logoName;
      const company = res.locals.company;
      let storage = new FileStorage();
      const resault = await storage.getLogo(logoName, company)
      const etag = crypto.createHash('md5').update(resault).digest('hex');
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.sendFile(resault);
    } catch (error: any) {
        throw error
    }
  }

  // public static async saveThumbnail(req: Request, res: Response, next: NextFunction) {
  //   try {
  //     const logoName = req.params.logoName;
  //     const company = res.locals.company;
  //     let resault = await S3Storage.saveThumbNails()
  //     res.send(resault);
  //   } catch (error: any) {
  //       throw error
  //   }
  // }


  public static async deleteAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      const company = res.locals.company;
      const data = req.body;
      let resault;

      resault = await MediaRepo.deleteAttchments(data, company);

      res.send(resault);
    } catch (error: any) {


        throw error
    }
  }

  public static async getMediaAttendance(req: Request, res: Response, next: NextFunction) {
    try {

      const companyId = req.params.companyId;
      const mediaId = req.params.mediaId;
      const extantion = mediaId.split('.')[1]

      const width = req.query.width ? Number(req.query.width) : null;
      const height = req.query.height ? Number(req.query.height) : null;

      if (extantion != 'pdf') {
        const image = await S3Storage.getMediaImageAttendance(mediaId, companyId, width, height)

        if (image) {
          const img = Buffer.from(image, 'base64');
          /** image cache for 24h */
          const etag = crypto.createHash('md5').update(img).digest('hex');
          res.setHeader('ETag', etag);
          res.setHeader('Cache-Control', 'public, max-age=86400');

          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': img.length
          });
          return res.end(img);
        }
      } else {
        let imageData: any = await S3Storage.getImageBase64(mediaId, companyId)
        return res.send(imageData)
      }


    } catch (error: any) {
        throw error
    }
  }

  public static async getSignatureMedia(req: Request, res: Response, next: NextFunction) {
    try {

      const companyId = req.params.companyId;
      const mediaId = req.params.mediaName;
      const filerName = req.params.fileName;
      const extantion = mediaId.split('.')[1]

      const width = req.query.width ? Number(req.query.width) : null;
      const height = req.query.height ? Number(req.query.height) : null;

      if (extantion != 'pdf') {
        const image = await S3Storage.getSignatureImage(mediaId, companyId, filerName)
        let exstention = extantion == 'svg' ? 'svg+xml' : 'png'
        if (image) {
          const img = Buffer.from(image, 'base64');
          /** image cache for 24h */
          const etag = crypto.createHash('md5').update(img).digest('hex');
          res.setHeader('ETag', etag);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.writeHead(200, {
            'Content-Type': `image/${exstention}`,
            'Content-Length': img.length
          });
          return res.end(img);
        }
      } else {
        let imageData: any = await S3Storage.getImageBase64(mediaId, companyId)
        return res.send(imageData)
      }


    } catch (error: any) {
        throw error
    }
  }
  public static async getAttchments(req: Request, res: Response, next: NextFunction) {
    try {
      const company = res.locals.company;
      const data = req.body;
      let resault;

      resault = await MediaRepo.getAttchments(data, company);

      res.send(resault);
    } catch (error: any) {


        throw error
    }
  }
}