import path from "path";
import { promises as fs } from 'fs';

import { Storage } from "../interfaces/storageInterface";

import csvToJson from 'csvtojson';
import sizeOf from 'image-size'


import { ResponseData } from "@src/models/ResponseData";
import { Company } from "@src/models/admin/company";
import { RedisClient } from "@src/redisClient";
export class FileStorage implements Storage {

    //retrive json file of database structure for reports
    public async getDataSource() {
        try {
            const rootDirectory = path.dirname(__dirname)
            const storagePath = process.env.STORAGE_PATH;

            const filePath = path.join(rootDirectory, storagePath + "/reports/dataSources.json");

            const rawdata: any = await fs.readFile(filePath);

            const dataSources = JSON.parse(rawdata);
            return new ResponseData(true, "", { dataSources: dataSources })
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public async getLogo(name: string, company: Company) {
        try {
            const rootDirectory = path.dirname(__dirname)
            const storagePath = process.env.STORAGE_PATH;


            /**Get Invo Logo from storage */
            let filePath = path.join(rootDirectory, storagePath + "/" + name);
            return filePath

        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    //for testin
    public async getJsonData() {
        try {
            const rootDirectory = path.dirname(__dirname)
            const storagePath = process.env.STORAGE_PATH;

            const filePath = path.join(rootDirectory, storagePath + "/data3.json");

            const rawdata: any = await fs.readFile(filePath);

            const data = JSON.parse(rawdata);
            return new ResponseData(true, "", data)
        } catch (error: any) {
            throw new Error(error)
        }
    }



    public async getCsvFile() {
        try {

        } catch (error) {

        }
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;

        const filePath = path.join(rootDirectory, storagePath + "/testBackup/menuSectionProduct.csv");

        const rawdata: any = await fs.readFile(filePath);
        return csvToJson()
            .fromFile(filePath)
            .then((jsonArray) => {
                // Do something with the JSON array
                // You can save the JSON array to a file if needed
                return jsonArray
            })


    }

    public async checkIfItemImageExist(companyId: string, productId: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        try {

            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/thumbnails/" + productId.toString().concat(".jpg"));
            await fs.unlink(imagePath)
        } catch (error) {
            try {
                const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/thumbnails/" + productId.toString().concat(".png"));
                await fs.unlink(imagePath)
            } catch (error: any) {
                return null
            }
        }
    }
    public async saveItemImage(image: string, companyId: string, productId: string) {

        const base64Image: any = image.split(';base64,').pop();
        const char = base64Image.charAt(0);
        let extention = "";

        switch (char) {
            case "/":
                extention = '.jpg'
                break;
            case "i":
                extention = '.png'
                break;
            default:
                break;
        }
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        const imageUrl = process.env.APP_BASE_URL + "/product" + "/getProductImage/" + companyId + "/" + productId;
        const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/thumbnails/" + productId.toString().concat(extention));
        try {
            await this.checkIfItemImageExist(companyId, productId)
            await fs.mkdir(path.join(rootDirectory, storagePath + "/" + companyId + "/thumbnails" + "/"), { recursive: true })
            await fs.writeFile(imagePath, base64Image, { encoding: 'base64' });
            return imageUrl;
        } catch (error: any) {
            try {

                await this.checkIfItemImageExist(companyId, productId)
                //Store New Image
                await fs.writeFile(imagePath, base64Image, { encoding: 'base64' })
                return imageUrl;
            } catch (error: any) {
                throw new Error(error.message)
            }

        }
    }
    public async getItemImage(companyId: string, productId: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        try {

            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/thumbnails/" + productId.toString().concat(".jpg"));

            await fs.readFile(imagePath)
            return imagePath;
        } catch (error: any) {
            try {
                const imagePath2 = path.join(rootDirectory, storagePath + "/" + companyId + "/thumbnails/" + productId.toString().concat(".png"));
                await fs.readFile(imagePath2)
                return imagePath2;
            } catch (error: any) {
                return null;
            }
        }
    }
    public async getItemImageBase64(companyId: string, productId: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        try {
            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/thumbnails/" + productId.toString().concat(".jpg"));
            await fs.access(imagePath)
            const image = await fs.readFile(imagePath)
            const base64Image = Buffer.from(image).toString('base64');
            return base64Image;
        } catch (error: any) {
            try {
                const imagePath2 = path.join(rootDirectory, storagePath + "/" + companyId + "/thumbnails/" + productId.toString().concat(".png"));
                const image = await fs.readFile(imagePath2)
                const base64Image = Buffer.from(image).toString('base64');
                return base64Image;
            } catch (error) {
                return null
            }
        }
    }
    public async getCompanySettings(country: string) {
        try {

            let rootDirectory = path.dirname(__dirname)

            // if(process.env.NODE_ENV == 'local'){
            //     rootDirectory = ""
            // }
            const redis = RedisClient.getRedisClient();
            let key = `CompanySettings:${country}`
            const cached = await redis.client?.get(key);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    return { settings: parsed };
                } catch {
                    // invalid JSON in cache? ignore
                }
            }

            const storagePath = process.env.STORAGE_PATH;

            const filePath = path.join(rootDirectory, storagePath + "/" + country + "/Settings.json");
            console.log("path:", filePath)
            const rawdata: any = await fs.readFile(filePath);

            const settings = JSON.parse(rawdata);
            if (settings) {
                await redis.client?.set(key, JSON.stringify(settings))
            }

            if (settings.afterDecimal == null || settings.afterDecimal === undefined) {
                const warningMessage = `[Settings Warning] Missing 'afterDecimal' for country: ${country}`;
                console.warn(warningMessage);

        
            }

            if (settings) {
                return {
                    settings: settings
                }
            }

        } catch (error: any) {
            const errorMessage = `[Settings Error] Failed to load settings for ${country}: ${error.message}`;
            console.warn(errorMessage);

            // 🔥 Capture the actual error in Sentry as a high-severity issue
    
            return null;
        }
    }



    public async checkIfEmployeeImageExist(companyId: string, employeeId: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        try {

            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/employees/" + employeeId.toString().concat(".jpg"));
            await fs.unlink(imagePath)
            return true;
        } catch (error) {
            try {
                const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/employees/" + employeeId.toString().concat(".png"));
                await fs.unlink(imagePath)
                return true;
            } catch (error) {
                return false;
            }
        }
    }
    public async saveEmployeeImage(image: string, companyId: string, employeeId: string) {

        const base64Image: any = image.split(';base64,').pop();
        const char = base64Image.charAt(0);
        let extention = "";

        switch (char) {
            case "/":
                extention = '.jpg'
                break;
            case "i":
                extention = '.png'
                break;
            default:
                break;
        }
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        const imageUrl = process.env.APP_BASE_URL + "/employee" + "/getEmployeeImage/" + companyId + "/" + employeeId;
        const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/employees/" + employeeId.toString().concat(extention));

        try {
            await this.checkIfEmployeeImageExist(companyId, employeeId)
            await fs.mkdir(path.join(rootDirectory, storagePath + "/" + companyId + "/employees" + "/"), { recursive: true })
            await fs.writeFile(imagePath, base64Image, { encoding: 'base64' });
            return imageUrl;
        } catch (error: any) {
            try {
                //Delete Old Image
                await this.checkIfEmployeeImageExist(companyId, employeeId)
                //Store New Image
                await fs.writeFile(imagePath, base64Image, { encoding: 'base64' })
                return imageUrl;
            } catch (error: any) {
                throw new Error(error.message)
            }

        }
    }
    public async getemployeeImage(companyId: string, employeeId: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        try {

            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/employees/" + employeeId.toString().concat(".jpg"));

            await fs.readFile(imagePath)
            return imagePath;
        } catch (error: any) {
            try {
                const imagePath2 = path.join(rootDirectory, storagePath + "/" + companyId + "/employees/" + employeeId.toString().concat(".png"));
                await fs.readFile(imagePath2)
                return imagePath2;
            } catch (error: any) {
                return null;
            }
        }
    }
    public async getEmployeeImageBase64(companyId: string, employeeId: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        try {
            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/employees/" + employeeId.toString().concat(".jpg"));
            await fs.access(imagePath)
            const image = await fs.readFile(imagePath)
            const base64Image = Buffer.from(image).toString('base64');
            return base64Image;
        } catch (error: any) {
            try {
                const imagePath2 = path.join(rootDirectory, storagePath + "/" + companyId + "/employees/" + employeeId.toString().concat(".png"));
                const image = await fs.readFile(imagePath2)
                const base64Image = Buffer.from(image).toString('base64');
                return base64Image;
            } catch (error) {
                return null
            }
        }
    }



    public async getImageType(companyId: string, productId: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        try {

            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/thumbnails/" + productId.toString().concat(".jpg"));

            await fs.readFile(imagePath)
            return 'jpg';
        } catch (error: any) {

            try {
                const imagePath2 = path.join(rootDirectory, storagePath + "/" + companyId + "/thumbnails/" + productId.toString().concat(".png"));
                await fs.readFile(imagePath2)
                return 'png';
            } catch (error: any) {
                return null;
            }
        }
    }



    public async saveComapnyLogo(companyId: string, image: string) {

        const base64Image: any = image.split(';base64,').pop();
        const char = base64Image.charAt(0);
        let extention = "";

        switch (char) {
            case "/":
                extention = '.jpg'
                break;
            case "i":
                extention = '.png'
                break;
            default:
                break;
        }
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        const imageUrl = process.env.APP_BASE_URL + "/logo/" + companyId;
        const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/" + (companyId + "_logo").toString().concat(extention));
        try {
            await fs.mkdir(path.join(rootDirectory, storagePath + "/" + companyId), { recursive: true })
            await fs.writeFile(imagePath, base64Image, { encoding: 'base64' });
            return imageUrl;
        } catch (error: any) {

            throw new Error(error.message)

        }
    }
    public async getComapnyLogo(companyId: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        try {
            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/" + companyId + "_logo.jpg")

            await fs.readFile(imagePath)
            return imagePath;
        } catch (error: any) {
            try {

                const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/" + companyId + "_logo.png")
                await fs.readFile(imagePath)

                return imagePath;
            } catch (error: any) {

                return null;
            }
        }
    }
    public async getCompanyLogoBase64(companyId: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        try {
            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/" + companyId + "_logo.jpg")
            await fs.access(imagePath)
            const image = await fs.readFile(imagePath)

            const base64Image = Buffer.from(image).toString('base64');
            return base64Image;
        } catch (error: any) {
            try {
                const imagePath2 = path.join(rootDirectory, storagePath + "/" + companyId + "/" + companyId + "_logo.png")
                const image = await fs.readFile(imagePath2)

                const base64Image = Buffer.from(image).toString('base64');
                return base64Image;
            } catch (error) {
                return null
            }
        }
    }


    public async saveMediaImage(image: string, mediaId: string, companyId: string, mediaType: any) {


        const base64Image: any = image.split(';base64,').pop();

        let extention = '.' + mediaType.extension;
        let type = mediaType.extension;

        if (mediaType.extension == "jpeg" || mediaType.extension == "JPEG") {
            extention = '.jpg'
            type = 'jpg'
        }

        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;

        const imgBuffer = Buffer.from(base64Image, 'base64');
        const sizeOfImage = imgBuffer.length
        const dimensions: any = sizeOf(imgBuffer);
        const size = {
            size: sizeOfImage,
            width: dimensions.width,
            height: dimensions.height
        }

        try {
            await fs.mkdir(path.join(rootDirectory, storagePath + "/" + companyId + "/Media" + "/"), { recursive: true })
            const imageUrl = await this.saveMediaLargeImage(mediaId, companyId, base64Image, extention)
            const thumbnailUrl = await this.saveMediaThumbnail(mediaId, companyId, base64Image, extention)
            const defaultUrl = await this.saveDefaultMediaImage(mediaId, companyId, base64Image, extention)


            const urls = {
                imageUrl: imageUrl,
                thumbnailUrl: thumbnailUrl,
                defaultUrl: defaultUrl,

            }

            return { urls: urls, size: size, mediaType: "image/" + type }
        } catch (error: any) {
            try {
                const imageUrl = await this.saveMediaLargeImage(mediaId, companyId, base64Image, extention)
                const thumbnailUrl = await this.saveMediaThumbnail(mediaId, companyId, image, extention)
                const defaultUrl = await this.saveDefaultMediaImage(mediaId, companyId, base64Image, extention)
                const urls = {
                    imageUrl: imageUrl,
                    thumbnailUrl: thumbnailUrl,
                    defaultUrl: defaultUrl,

                }

                return { urls: urls, size: size, mediaType: "image/" + type }
            } catch (error: any) {
                return null
            }

        }
    }
    public async saveMediaFile(file: string, mediaId: string, companyId: string, mediaType: any) {



        const fileBase64: any = file.split(';base64,').pop();

        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        const buf = Buffer.from(fileBase64, 'base64');
        const sizeOfImage = buf.length

        const size = {
            size: sizeOfImage,
        }
        const extention = mediaType.extension;
        try {
            await fs.mkdir(path.join(rootDirectory, storagePath + "/" + companyId + "/Media" + "/"), { recursive: true })
            const filePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + mediaId + "." + extention)
            const defaultUrl = process.env.APP_BASE_URL + "/Media" + "/getMedia/" + companyId + "/File/" + mediaId;
            await fs.writeFile(filePath, buf)
            return { urls: { defaultUrl: defaultUrl }, size: size, mediaType: "file/pdf" }
        } catch (error: any) {

            throw new Error(error.message)
        }
    }
    public async saveDefaultMediaImage(mediaId: string, companyId: string, image: string, extention: string) {

        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;

        const defaultUrl = process.env.APP_BASE_URL + "/Media" + "/getMedia/" + companyId + "/default/" + mediaId;
        const defaultPath: string = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + "default_" + mediaId.toString().concat(extention));
        try {
            await fs.access(defaultPath)
            return null;
        } catch (error) {
            await fs.writeFile(defaultPath, image, { encoding: 'base64' })
            return defaultUrl

        }
    }
    public async saveMediaLargeImage(mediaId: string, companyId: string, image: string, extention: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + mediaId.toString().concat(extention));
        const imageUrl = process.env.APP_BASE_URL + "/Media" + "/getMedia/" + companyId + "/" + mediaId;


        try {

            await this.unlinkMediaIfExist(imagePath)
            await fs.writeFile(imagePath, image, { encoding: 'base64' });
            return imageUrl
        } catch (error) {
            return null;
        }
    }
    public async saveMediaThumbnail(mediaId: string, companyId: string, image: any, extention: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        const thumbNailPath: string = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + "thumbnail_" + mediaId.toString().concat(extention));
        const thumbnailUrl = process.env.APP_BASE_URL + "/Media" + "/getMedia/" + companyId + "/thumbnail/" + mediaId;
        try {
            await this.unlinkMediaIfExist(thumbNailPath)

            await fs.writeFile(thumbNailPath, image, { encoding: 'base64' });
            return thumbnailUrl
        } catch (error) {
            return null;
        }
    }
    public async getMedia(companyId: string, mediaId: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        try {
            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + mediaId.toString().concat(".jpg"));
            await fs.readFile(imagePath)
            return imagePath;
        } catch (error: any) {
            try {

                const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + mediaId.toString().concat(".png"));
                await fs.readFile(imagePath)

                return imagePath;
            } catch (error: any) {
                try {
                    const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + mediaId.toString().concat(".gif"));
                    const image = await fs.readFile(imagePath)
                    return imagePath;
                } catch (error) {
                    const filePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + mediaId + ".pdf")
                    await fs.readFile(filePath)
                    return filePath;
                }

            }
        }
    }
    public async getImageMediaBase64(companyId: string, mediaId: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        try {
            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + mediaId.toString().concat(".jpg"));
            await fs.access(imagePath)
            const image = await fs.readFile(imagePath)
            let base64Image = 'data:image/jpg;base64,'
            base64Image += Buffer.from(image).toString('base64');
            return { image: base64Image, type: "media/jpg" };
        } catch (error) {
            try {
                const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + mediaId.toString().concat(".png"));
                await fs.access(imagePath)
                const image = await fs.readFile(imagePath)
                let base64Image = 'data:image/png;base64,'
                base64Image += Buffer.from(image).toString('base64');
                return { image: base64Image, type: "media/png" };
            } catch (error) {
                try {
                    const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + mediaId.toString().concat(".gif"));
                    await fs.access(imagePath)
                    const image = await fs.readFile(imagePath)

                    let base64Image = 'data:gif/png;base64,'
                    base64Image += Buffer.from(image).toString('base64');
                    return { image: base64Image, type: "media/gif" };
                } catch (error) {
                    const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + mediaId.toString().concat(".pdf"));
                    await fs.access(imagePath)
                    const file = await fs.readFile(imagePath)

                    return { file: imagePath, type: "file" };
                }

            }

        }
    }
    public async getThumbnailMedia(companyId: string, mediaId: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        try {
            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + "thumbnail_" + mediaId.toString().concat(".jpg"));

            await fs.readFile(imagePath)
            return imagePath;
        } catch (error: any) {
            try {

                const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + "thumbnail_" + mediaId.toString().concat(".png"));
                await fs.readFile(imagePath)

                return imagePath;
            } catch (error: any) {

                const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + mediaId.toString().concat(".gif"));
                const image = await fs.readFile(imagePath)
                return imagePath;


            }
        }
    }
    public async getdefaultMedia(companyId: string, mediaId: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        try {
            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + "default_" + mediaId.toString().concat(".jpg"));

            const image = await fs.readFile(imagePath)
            let base64Image = 'data:image/jpg;base64,'
            base64Image += Buffer.from(image).toString('base64');
            const imgBuffer = Buffer.from(Buffer.from(image).toString('base64'), 'base64');
            const sizeOfImage = imgBuffer.length
            const dimensions: any = sizeOf(imgBuffer);
            const size = {
                size: sizeOfImage,
                width: dimensions.width,
                height: dimensions.height
            }
            return { media: base64Image, mediaType: "media/jpg", size: size };
        } catch (error: any) {
            try {

                const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + "default_" + mediaId.toString().concat(".png"));
                const image = await fs.readFile(imagePath)
                let base64Image = 'data:image/jpg;base64,'
                base64Image += Buffer.from(image).toString('base64');
                const imgBuffer = Buffer.from(Buffer.from(image).toString('base64'), 'base64');
                const sizeOfImage = imgBuffer.length
                const dimensions: any = sizeOf(imgBuffer);
                const size = {
                    size: sizeOfImage,
                    width: dimensions.width,
                    height: dimensions.height
                }
                return { media: base64Image, mediaType: "media/jpg", size: size };

            } catch (error: any) {

                return null;
            }
        }
    }
    public async unlinkMediaIfExist(path: string) {
        try {
            await fs.access(path)
            await fs.unlink(path)
        } catch (error: any) {

            return null
        }
    }
    public async deleteMediaImage(mediaId: string, companyId: string, extention: string) {
        try {
            const rootDirectory = path.dirname(__dirname)
            const storagePath = process.env.STORAGE_PATH;
            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + mediaId.toString().concat(extention));
            const thumbNailPath: string = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + "thumbnail_" + mediaId.toString().concat(extention));
            const defaultPath: string = path.join(rootDirectory, storagePath + "/" + companyId + "/Media/" + "default_" + mediaId.toString().concat(extention));

            await this.unlinkMediaIfExist(imagePath)
            await this.unlinkMediaIfExist(thumbNailPath)
            await this.unlinkMediaIfExist(defaultPath)
        } catch (error: any) {
            throw new Error(error.message)
        }
    }



    public async getDeliveryAddresses(country: string) {
        try {
            const rootDirectory = path.dirname(__dirname)
            const storagePath = process.env.STORAGE_PATH;

            const filePath = path.join(rootDirectory, storagePath + "/" + country + "/DeliveryAddresses.json");

            const rawdata: any = await fs.readFile(filePath);

            const addresses = JSON.parse(rawdata);
            return {
                addresses: addresses
            }
        } catch (error: any) {
            return {
                addresses: []
            }
        }
    }

    public async getAddressFormats(country: string) {
        try {

        } catch (error: any) {
            throw new Error(error)
        }
    }


    public async checkIfSignaturesImageExist(companyId: string, employeeId: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        try {

            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Signatures/" + employeeId.toString().concat(".jpg"));
            await fs.unlink(imagePath)
            return true;
        } catch (error) {
            try {
                const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Signatures/" + employeeId.toString().concat(".png"));
                await fs.unlink(imagePath)
                return true;
            } catch (error) {
                return false;
            }
        }
    }
    public async saveSignatureImage(image: string, companyId: string, employeeId: string) {

        const base64Image: any = image.split(';base64,').pop();
        const char = base64Image.charAt(0);
        let extention = "";

        switch (char) {
            case "/":
                extention = '.jpg'
                break;
            case "i":
                extention = '.png'
                break;
            default:
                break;
        }
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        const imageUrl = process.env.APP_BASE_URL + "/Signatures" + "/getSignatureImage/" + companyId + "/" + employeeId;
        const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Signatures/" + employeeId.toString().concat(extention));

        try {
            await this.checkIfSignaturesImageExist(companyId, employeeId)
            await fs.mkdir(path.join(rootDirectory, storagePath + "/" + companyId + "/Signatures" + "/"), { recursive: true })
            await fs.writeFile(imagePath, base64Image, { encoding: 'base64' });
            return imageUrl;
        } catch (error: any) {
            try {
                //Delete Old Image
                await this.checkIfSignaturesImageExist(companyId, employeeId)
                //Store New Image
                await fs.writeFile(imagePath, base64Image, { encoding: 'base64' })
                return imageUrl;
            } catch (error: any) {
                throw new Error(error.message)
            }

        }
    }
    public async getSignatureImage(companyId: string, invoiceId: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        try {

            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Signatures/" + invoiceId.toString().concat(".jpg"));

            await fs.readFile(imagePath)
            return imagePath;
        } catch (error: any) {
            try {
                const imagePath2 = path.join(rootDirectory, storagePath + "/" + companyId + "/Signatures/" + invoiceId.toString().concat(".png"));
                await fs.readFile(imagePath2)
                return imagePath2;
            } catch (error: any) {
                return null;
            }
        }
    }
    public async getSignatureImageBase64(companyId: string, invoiceId: string) {
        const rootDirectory = path.dirname(__dirname)
        const storagePath = process.env.STORAGE_PATH;
        try {
            const imagePath = path.join(rootDirectory, storagePath + "/" + companyId + "/Signatures/" + invoiceId.toString().concat(".jpg"));
            await fs.access(imagePath)
            const image = await fs.readFile(imagePath)
            const base64Image = Buffer.from(image).toString('base64');
            return base64Image;
        } catch (error: any) {
            try {
                const imagePath2 = path.join(rootDirectory, storagePath + "/" + companyId + "/employees/" + invoiceId.toString().concat(".png"));
                const image = await fs.readFile(imagePath2)
                const base64Image = Buffer.from(image).toString('base64');
                return base64Image;
            } catch (error) {
                return null
            }
        }
    }

    public async getApplePayCertandkey() {
        try {

            const rootDirectory = path.dirname(__dirname)
            const storagePath = process.env.STORAGE_PATH;

            const certFile = path.join(
                rootDirectory,
                storagePath + "/applePay/Client-Cer.pem"
            );

            const keyFile =path.join(
                rootDirectory,
                storagePath + "/applePay/Client-Key.key"
            );

            const cert = await fs.readFile(certFile);
            const key = await fs.readFile(keyFile);

            return new ResponseData(true, "", { cert, key });

        } catch (error) {
            throw error;
        }
    }


    public async getApplePayTextFile() {
        try {
            const rootDirectory = path.dirname(__dirname)
            const storagePath = process.env.STORAGE_PATH;

            const pathString = path.join(
                rootDirectory,
                storagePath + "/applePay/apple-developer-merchantid-domain-association.txt"
            );

            // const file = await fs.readFile(pathString);

            return pathString;
        } catch (error) {
            throw error;
        }
    }

    public async getLogFile(){
        try {
            const logPath = path.join(__dirname,  process.env.STORAGE_PATH + "/myapp.log");
            return logPath
        } catch (error) {
            throw error;
        }
    }
}

