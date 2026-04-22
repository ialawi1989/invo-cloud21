import { DB } from "@src/dbconnection/dbconnection";
import { S3Storage } from "./S3Storage";
import fs from 'fs'
import path from 'path'
import favicons from "favicons";
export class ImagesRepo {

  public static async getCompanyMedia(companyId: string) {
    try {
      const query = {
        text: `SELECT  "Media"."url"->>'defaultUrl' as "mediaUrl" ,
                         case when "WebSiteBuilder" ."type" = 'OldThemeSettings' and "WebSiteBuilder" ."template" is not null then   (("template"->>'style')::jsonb)->>'primaryColor' 
                                when "WebSiteBuilder" ."type" = 'ThemeSettings' and "WebSiteBuilder" ."template" is not null then (("template"->>'colors')::jsonb)->>'primaryColor'  end as "theme_color"

                       FROM "Companies"
                       inner join "Media" on "Media".id = "Companies"."mediaId"
                      left join "WebSiteBuilder" on "WebSiteBuilder"."companyId" = "Companies".id and "WebSiteBuilder"."type" in ('ThemeSettings','OldThemeSettings')

                       where "Companies".id = $1
                 `,
        values: [companyId]
      }

      let data = await DB.excu.query(query.text, query.values);
      return data.rows && data.rows.length > 0 ? data.rows[0] : null
    } catch (error: any) {
      throw new Error(error)
    }
  }
  public static async icon72(companyId: string) {
    try {
      let data: any = await ImagesRepo.getCompanyMedia(companyId)
      if (data) {
        if (data.mediaUrl) {
          const filename = data.mediaUrl.split('/').pop();
          const extension = filename.split('.')[1]
          if (filename) {
            let image = await S3Storage.getMediaImage(filename, companyId, 72, 72)
            return { image: image, extension: extension }
          }
        }

      }
      return null
    } catch (error) {
      return null
    }
  }

  public static async icon96(companyId: string) {

    try {
      let data: any = await ImagesRepo.getCompanyMedia(companyId)
      if (data) {
        if (data.mediaUrl) {
          const filename = data.mediaUrl.split('/').pop();
          const extension = filename.split('.')[1]
          if (filename) {
            let image = await S3Storage.getMediaImage(filename, companyId, 96, 96)
            return { image: image, extension: extension }
          }
        }

      }
      return null
    } catch (error) {
      return null
    }

  }


  public static async icon128(companyId: string) {


    try {
      let data: any = await ImagesRepo.getCompanyMedia(companyId)
      if (data) {
        if (data.mediaUrl) {
          const filename = data.mediaUrl.split('/').pop();
          const extension = filename.split('.')[1]
          if (filename) {
            let image = await S3Storage.getMediaImage(filename, companyId, 128, 128)
            return { image: image, extension: extension }
          }
        }

      }
      return null
    } catch (error) {
      return null
    }

  }

  public static async icon144(companyId: string) {

    try {
      let data: any = await ImagesRepo.getCompanyMedia(companyId)
      if (data) {
        if (data.mediaUrl) {
          const filename = data.mediaUrl.split('/').pop();
          const extension = filename.split('.')[1]
          if (filename) {
            let image = await S3Storage.getMediaImage(filename, companyId, 144, 144)
            return { image: image, extension: extension }
          }
        }

      }
      return null
    } catch (error) {
      return null
    }


  }

  public static async icon152(companyId: string) {
    try {
      let data: any = await ImagesRepo.getCompanyMedia(companyId)
      if (data) {
        if (data.mediaUrl) {
          const filename = data.mediaUrl.split('/').pop();
          const extension = filename.split('.')[1]
          if (filename) {
            let image = await S3Storage.getMediaImage(filename, companyId, 125, 125)
            return { image: image, extension: extension }
          }
        }

      }
      return null
    } catch (error) {
      return null
    }


  }

  public static async icon192(companyId: string) {
    try {
      let data: any = await ImagesRepo.getCompanyMedia(companyId)
      if (data) {
        if (data.mediaUrl) {
          const filename = data.mediaUrl.split('/').pop();
          const extension = filename.split('.')[1]
          if (filename) {
            let image = await S3Storage.getMediaImage(filename, companyId, 192, 192)
            return { image: image, extension: extension }
          }
        }

      }
      return null
    } catch (error) {
      return null
    }


  }


  public static async icon384(companyId: string) {
    try {
      let data: any = await ImagesRepo.getCompanyMedia(companyId)
      if (data) {
        if (data.mediaUrl) {
          const filename = data.mediaUrl.split('/').pop();
          const extension = filename.split('.')[1]
          if (filename) {
            let image = await S3Storage.getMediaImage(filename, companyId, 384, 384)
            return { image: image, extension: extension }
          }
        }

      }
      return null
    } catch (error) {
      return null
    }


  }


  public static async icon512(companyId: string) {
    try {
      let data: any = await ImagesRepo.getCompanyMedia(companyId)
      if (data) {
        if (data.mediaUrl) {
          const filename = data.mediaUrl.split('/').pop();
          const extension = filename.split('.')[1]
          if (filename) {
            let image = await S3Storage.getMediaImage(filename, companyId, 512, 512)
            return { image: image, extension: extension }
          }
        }

      }
      return null
    } catch (error) {
      return null
    }


  }

  public static async appleSplash(imageSize: string, companyId: string) {
    try {
      let data: any = await ImagesRepo.getCompanyMedia(companyId)
      if (data) {
        if (data.mediaUrl) {
          const filename = data.mediaUrl.split('/').pop();
          const extension = filename.split('.')[1]
          if (filename) {
            let image = await S3Storage.getAppleSplash(imageSize, companyId)

            if (image) {
              return { image: image, extension: extension }
            } else {
              return await this.addAppleSplash(imageSize,companyId,data)
            }
          }
        }

      }
      return null
    } catch (error) {
      return null
    }

  }

  public static async hexToRgbA(hex: string, opacity: number) {
    const bigint = parseInt(hex.replace('#', ''), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${opacity})`;
  }
  public static async getContentType(filename: string) {
    const ext = path.extname(filename).toLowerCase();
    return {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg'
    }[ext] || 'application/octet-stream';
  }
  public static async addAppleSplash(imageSize: string, companyId: string,data:any) {
    try {

      if (data) {
        if (data.mediaUrl) {
          const filename = data.mediaUrl.split('/').pop();
          const extension = filename.split('.')[1]
          if (filename) {
            let image = await S3Storage.getAppleSplash(imageSize, companyId)

            if (image) {
              return { image: image, extension: extension }
            } else {
              let imageData = await S3Storage.getMediaImage(filename, companyId, 512, 512)
              if (imageData) {
                const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
                const logoTmpPath = path.join(__dirname, '../' + process.env.STORAGE_PATH + '/', 'logo-from-base64.png');
                fs.writeFileSync(logoTmpPath, Buffer.from(base64Data, 'base64'));
                // Step 2: Generate splash images
                const outputDir = path.join(__dirname, '../' + process.env.STORAGE_PATH + '/', `pwa-assets-${Date.now()}`)
         


                const savedImages = await favicons(logoTmpPath, {
                
                  background: "#ffffff",
                  theme_color: await this.hexToRgbA(data.theme_color??"#2b92a4", 1),
                  icons: {
                    android: false,
                    appleIcon: false,
                    appleStartup: true,
                    favicons: false,
                    windows: false,
                    yandex:false 
                  }
                });

                let contentType
                for (const img of savedImages.images) {
                  let temp: any = img.contents;
                  let fileName: any = img.name;
           
                  await S3Storage.uploadAppleSplash(temp, fileName, companyId)
                }
                fs.rmSync(outputDir, { recursive: true, force: true });
                fs.unlinkSync(logoTmpPath);
                image = await S3Storage.getAppleSplash(imageSize, companyId)
           

                return { image: image, extension: "" }
              }

            }
          }
        }

      }
      return null
    } catch (error) {
      console.log(error)
      return null
    }

  }
  public static async favicon() {
    try {

    } catch (error) {
      return null
    }
  }

} 