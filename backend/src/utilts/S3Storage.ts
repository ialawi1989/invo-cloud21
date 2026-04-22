
import { DeleteObjectCommand, GetObjectCommand, PutBucketLifecycleConfigurationCommand, S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import sizeOf from 'image-size'
import sharp from 'sharp'

import { Readable } from "node:stream";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { S3Service, safeS3Call } from "../AWS-SERVICES/s3Service";
import { ResponseData } from "@src/models/ResponseData";
import { image } from "pdfkit";
import { DB } from "@src/dbconnection/dbconnection";


export class S3Storage {

    // public static async resizeImage(img: string, width: number | null, height: number | null, extension: string | null = null) {

    //     try {


    //         const buff = Buffer.from(img, 'base64')


    //         console.log(extension)

    //         if (extension == 'png') {
    //             return (await sharp(buff).resize(width, height, { fit: 'inside', position: 'center' }).toFormat('png').toBuffer()).toString('base64')

    //         }
    //         return (await sharp(buff).resize(width, height, { fit: 'inside', position: 'center' }).flatten({ background: { r: 255, g: 255, b: 255, alpha: 0 } }).jpeg({ quality: 80 }).toBuffer()).toString('base64')

    //     } catch (error: any) {
    //         console.log(error)
    //         return null;
    //     }
    // }

    // public static async resizeImage2(
    //     imgBase64: string,
    //     reqWidth: number | null,
    //     reqHeight: number | null,
    //     extension: string | null = null
    // ) {
    //     try {
    //         // remove possible data-uri prefix
    //         const cleaned = imgBase64.replace(/^data:image\/\w+;base64,/, "");
    //         const input = Buffer.from(cleaned, "base64");
    //         const ext = (extension ?? "")
    //             .toLowerCase()
    //             .replace(".", "")
    //             .replace("image/", "");

    //         // sharp pipeline
    //         let base = sharp(input, { failOn: "none" }).rotate();
    //         const meta = await base.metadata();
    //         let width = meta.width!;
    //         let height = meta.height!;
    //         const scale = Math.min(1, 320 / Math.max(width, height));
    //         const outW = Math.round(width * scale);
    //         const outH = Math.round(height * scale);

    //         // if (width > 1600 || height > 1600) {
    //         // width = Math.round(width * 0.15);
    //         // height = Math.round(height * 0.15);


    //         // }
    //         // if (width || height) {
    //         const resized = base
    //             .resize({
    //                 width: outW,
    //                 height: outH,
    //                 fit: "inside",
    //                 withoutEnlargement: true,
    //                 kernel: sharp.kernel.lanczos3,
    //             })
    //             .sharpen({ sigma: 0.6 });


    //         // const out = await s.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    //         // return out.toString("base64");

    //         let startQuality = 80;
    //         let minQuality = 60;
    //         let q = startQuality;
    //         let sizeCapKB: number = 15; //put in parameter
    //         const capBytes = sizeCapKB * 1024;

    //         let lastBuffer: Buffer | null = null;
    //         while (q >= minQuality) {
    //             const buf = await resized
    //                 .clone()
    //                 .webp({
    //                     quality: q,
    //                     effort: 5,            // you can bump to 6 if you prefer smaller size (slower)
    //                     smartSubsample: true,
    //                 })
    //                 .toBuffer();

    //             lastBuffer = buf;

    //             if (buf.length <= capBytes) {
    //                 return buf.toString("base64");
    //             }

    //             q -= 5; // step down quality
    //         }
    //         return lastBuffer ? lastBuffer.toString("base64") : null;
    //     } catch (error) {
    //         console.log(error);
    //         return null;
    //     }
    // }


    public static async resizeImage(
        imgBase64: string,
        reqWidth: number | null,
        reqHeight: number | null,
        max: number | null,
        extension: string | null = null,
        quality: number | null = null
    ) {
        try {
            // remove possible data-uri prefix
            const cleaned = imgBase64.replace(/^data:image\/\w+;base64,/, "");
            const input = Buffer.from(cleaned, "base64");
            const ext = (extension ?? "")
                .toLowerCase()
                .replace(".", "")
                .replace("image/", "");

            // sharp pipeline
            let base = sharp(input, { failOn: "none" }).rotate();
            const meta = await base.metadata();
            let width = meta.width!;
            let height = meta.height!;
            max = max ?? 320;
            const maximum = max
            const scale = Math.min(1, maximum / Math.max(width, height));
            const outW = Math.round(width * scale);
            const outH = Math.round(height * scale);
            quality = quality ?? 80
            const resized = base
                .resize({
                    width: outW,
                    height: outH,
                    fit: "inside",
                    withoutEnlargement: true,
                    kernel: sharp.kernel.lanczos3,
                })
                .sharpen({ sigma: 0.3 });

            // single-pass compression (no loop)
            const buffer = await resized
                .webp({
                    quality: quality,
                    effort: 5,
                    smartSubsample: true,
                })
                .toBuffer();

            return buffer.toString("base64");
        } catch (error) {
            console.log(error);
            return null;
        }
    }


    public static async createBucket(bucketName: string | null = null, rules: any | null = null) {
        const instance = new S3Service()
        const s3 = S3Service.getClient();
        if (s3 == null) return null
        try {
            const name = (bucketName != null && bucketName != "") ? bucketName : process.env.AWS_COMPANIES_BUCKET;
            const params = { Bucket: name, locationConstraint: "eu-west-1" };
            await s3.createBucket(params)

            if (rules) {
                const command = new PutBucketLifecycleConfigurationCommand(rules);
                await s3.send(command);
            }


        } catch (error: any) {
            if (error.Code == "BucketAlreadyOwnedByYou") {
                return null
            }
            throw new Error(error)
        } finally {
            s3.destroy()
        }

    }
    public static async createFolder(folderName: string, bucketName: string | null = null) {
        const instance = new S3Service()
        const s3 = S3Service.getClient();
        if (s3 == null) return null
        try {

            try {
                await this.createBucket(bucketName)
            } catch (error) {
                
            }
            const name = (bucketName != null && bucketName != "") ? bucketName : process.env.AWS_COMPANIES_BUCKET;
            const client = s3;


            const upload = new Upload({
                client,
                params: {
                    Bucket: name,
                    Key: folderName + '/',
                    Body: '',
                },
            });

            await upload.done();

        } catch (error: any) {

            return null;
        } finally {
            s3.destroy();
        }

    }


    public static async uploadImage(mediaId: string, image: any, companyId: string, extension: string, fileType: string, edited = false, bucketName: string | null = null) {

        const instance = new S3Service()
        const s3 = S3Service.getClient();
        if (s3 == null) return null
        try {
            const name = (bucketName != null && bucketName != "") ? bucketName : process.env.AWS_COMPANIES_BUCKET;
            const Key = edited ? companyId + '/' + mediaId + '_Edited.' + extension : companyId + '/' + mediaId + "." + extension;
            let contentType = fileType + "/" + extension

            // let buf:any = image;
            // const match = image.match(/^data:([\w/+.-]+);base64,(.*)$/);

            // if (match) {
            //     contentType = match[1]; // "application/usdz", "image/png", etc.
            //     buf = Buffer.from(match[2], 'base64');
            // } else {
            //     // Fallback: treat the entire string as base64 (no prefix)
            //     buf = Buffer.from(image, 'base64');
            // }
            const base64String = image.toString('base64');
            let imageData = base64String.split(';base64,').pop();
            let buf: any;
            if (imageData) {
                if (fileType != 'application') {
                    let resizeImage = await this.resizeImage(imageData, null, null, 1600, extension, 85);
                    if (!resizeImage) throw new Error("Error In Resize Image")

                    buf = Buffer.from(
                        resizeImage.replace(/^data:[^;]+;base64,/, ""),
                        "base64"
                    );
                } else {
                    buf = Buffer.from(
                        imageData.replace(/^data:[^;]+;base64,/, ""),
                        "base64"
                    );
                }



                const params = {
                    Bucket: name,
                    Key: Key,
                    Body: buf,
                    ContentEncoding: 'base64',
                    ContentType: contentType
                }



                const parallelUploads3 = new Upload({
                    client: s3,
                    params,
                    tags: [
                        /*...*/
                    ], // optional tags
                    queueSize: 4, // optional concurrency configuration
                    partSize: 1024 * 1024 * 5, // optional size of each part, in bytes, at least 5MB
                    leavePartsOnError: false, // optional manually handle dropped parts
                });

                parallelUploads3.on("httpUploadProgress", (progress) => {
                });

                await parallelUploads3.done();
            }

        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        } finally {
            s3.destroy();
        }
    }


    public static async getImageInfo(image: string) {
        try {
            // const base64Image: any = image.split(';base64,').pop();
            // const imgBuffer = Buffer.from(base64Image, 'base64');
            const sizeOfImage = image.length
            const dimensions: any = sizeOf(image);
            const sizeInfo = {
                size: sizeOfImage,
                width: dimensions.width,
                height: dimensions.height
            }
            // const char = base64Image.charAt(0);
            // let extention = "";

            // switch (char) {
            //     case "/":
            //         extention = '.jpg'
            //         break;
            //     case "i":
            //         extention = '.png'
            //         break;
            //     default:
            //         extention = '.jpg'
            //         break;
            // }

            return { sizeInfo: sizeInfo }
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getFileSize(image: string) {
        try {
            //     const base64Image: any = file.split(';base64,').pop();
            //     const imgBuffer = Buffer.from(base64Image, 'base64');
            const sizeOfImage = image.length
            return { sizeInfo: sizeOfImage }
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async saveMediaImage(image: string, mediaId: string, companyId: string, mediaType: any) {
        try {
            let imageInfo;
            let size = {
                size: 0,
            };
            let urls;
            if (mediaType.extension == "usdz") {
                mediaType.fileType = 'application'
            }
            if (mediaType.fileType == "image") {
                imageInfo = await this.getImageInfo(image);
                size = imageInfo.sizeInfo
            } else {
                size.size = (await this.getFileSize(image)).sizeInfo
            }

            let extension = mediaType.extension
            extension = extension.startsWith('svg') ? 'svg' : extension
            const mediaUrl = process.env.APP_BASE_URL + "/Media" + "/getMedia/" + companyId + "/" + mediaId + "." + extension;
            const thumbnail = process.env.APP_BASE_URL + "/Media" + "/getMedia/" + companyId + "/Thumbnail_" + mediaId + "." + extension;
            await this.uploadImage(mediaId, image, companyId, extension, mediaType.fileType)
            if (mediaType.fileType == 'image') {
                await this.uploadThumbnail(mediaId, image, companyId, extension, mediaType.fileType)
            }
            urls = { defaultUrl: mediaUrl, thumbnail: thumbnail }
            if (mediaType.fileType == "application") {
                const downloadUrl = process.env.APP_BASE_URL + "/Media" + "/downloadMediaFile/" + companyId + "/" + mediaId + "." + extension;
                urls = {
                    defaultUrl: null,
                    downloadUrl: downloadUrl
                }
            }
            return { urls: urls, size: size }
        } catch (error: any) {
            console.log(error)
            return null;
        }
    }
    public static async getMediaImage(
        mediaName: string,
        companyId: string,
        width: number | null = null,
        height: number | null = null
    ) {
        
        const s3 = S3Service.getClient();

        if (!s3) return null;

        try {
            const Bucket = process.env.AWS_COMPANIES_BUCKET!;
            const Key = `${companyId}/${mediaName}`;

            const data: any = await safeS3Call(
                s3.getObject({ Bucket, Key }),
                2000 // ⏱ timeout
            );

            if (!data.Body) return null;

            let objectData = await data.Body.transformToString("base64");

            if (width || height) {
                objectData = await this.resizeImage(
                    objectData,
                    width,
                    height,
                    height,
                    mediaName.split(".")[1]
                );
            }

            return objectData;

        } catch (error) {
            console.error("S3 IMAGE ERROR:", error);
            return null;
        }
    }

    public static async getImageUrl(mediaName: string, companyId: string, width: number | null = null, height: number | null = null) {
        const instance = new S3Service()
        const s3 = S3Service.getClient();
        if (s3 == null) return null

        try {
            const name = process.env.AWS_COMPANIES_BUCKET;


            const params = {
                Bucket: name,
                Key: companyId + "/" + mediaName,

            };
            const command = new GetObjectCommand(params);


            const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
            return url;
        } catch (error: any) {
            console.log(error)
            return null
        } finally {
            s3.destroy();
        }
    }



    public static async getMediafile(
        mediaName: string,
        companyId: string
    ) {
        
        const s3 = S3Service.getClient();

        if (!s3) return null;

        try {
            const Bucket = process.env.AWS_COMPANIES_BUCKET!;
            const Key = `${companyId}/${mediaName}`;

            const data: any = await safeS3Call(
                s3.send(new GetObjectCommand({ Bucket, Key })),
                2000 // ⏱ fail fast
            );

            if (!data.Body) return null;

            const image = await safeS3Call(
                data.Body.transformToString("base64"),
                2000
            );

            return image;

        } catch (error) {
            console.error("S3 ERROR:", error);
            return null;
        }
    }

    public static async getImageBase64(
        mediaName: string,
        companyId: string
    ) {
        
        const s3 = S3Service.getClient();

        if (!s3) return null;

        try {
            const Bucket = process.env.AWS_COMPANIES_BUCKET!;
            const Key = `${companyId}/${mediaName}`;

            // ✅ safer extension extraction
            const extensionRaw = mediaName.split('.').pop()?.toLowerCase();
            const extension = extensionRaw === 'jpeg' ? 'jpg' : extensionRaw;

            let fileType = 'data:image/';
            if (extension === 'pdf') {
                fileType = 'data:application/';
            }

            const data: any = await safeS3Call(
                s3.send(new GetObjectCommand({ Bucket, Key })),
                2000
            );

            if (!data.Body) return null;

            const base64 = await safeS3Call(
                data.Body.transformToString('base64'),
                2000
            );

            return `${fileType}${extension};base64,${base64}`;

        } catch (error) {
            console.error("S3 BASE64 ERROR:", error);
            return null;
        }
    }


    public static async getDefaultImageBase64(
        mediaId: string,
        companyId: string,
        extension: string
    ) {
        
        const s3 = S3Service.getClient();

        if (!s3) return null;

        try {
            const Bucket = process.env.AWS_COMPANIES_BUCKET!;
            const Key = `${companyId}/${mediaId}.${extension}`;

            const data: any = await safeS3Call(
                s3.getObject({ Bucket, Key }),
                2000 // ⏱ fail fast
            );

            if (!data.Body) return null;

            const objectData = await data.Body.transformToString("base64");

            const imgBuffer = Buffer.from(objectData, "base64");

            const dimensions = sizeOf(imgBuffer);

            return {
                media: `data:image/${extension};base64,${objectData}`,
                mediaType: "media/jpg",
                size: {
                    size: imgBuffer.length,
                    width: dimensions.width,
                    height: dimensions.height
                }
            };
        } catch (error) {
            console.error("S3 ERROR:", error);
            return null; // fallback
        }
    }
    public static async saveUpdatedImage(image: string, mediaId: string, companyId: string) {
        try {
            // let imageInfo;
            // imageInfo = await this.getImageInfo(image);
            // const extension = imageInfo.extention.split(".")[1]
            //  const mediaUrl = process.env.APP_BASE_URL + "/Media" + "/getMedia/" + companyId + "/" + mediaId + '_Edited' + imageInfo.extention;
            // await this.uploadImage(mediaId, image, companyId, extension, 'image', true) // true for indicating edited image 
            // return { urls: { defaultUrl: mediaUrl }}

        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async deleteImage(mediaId: string, companyId: string, extension: string) {
        const instance = new S3Service()

        const s3 = S3Service.getClient();
        if (s3 == null) return null
        try {


            extension = extension == 'jpeg' ? 'jpg' : extension
            const params = {
                Bucket: process.env.AWS_COMPANIES_BUCKET,
                Key: companyId + "/" + mediaId + '.' + extension,
            }
            await s3.deleteObject(params)
            params.Key = companyId + "/" + mediaId + '_Edited' + '.' + extension;
            await s3.deleteObject(params)
            params.Key = companyId + "/Thumbnail_" + mediaId + '.' + extension;
            await s3.deleteObject(params)
        } catch (error: any) {
            return null
        } finally {
            s3.destroy();
        }
    }

    public static async getThumbnailImageUrl(
        mediaName: string,
        companyId: string
    ) {
        
        const s3 = S3Service.getClient();

        if (!s3) return null;

        try {
            const Bucket = process.env.AWS_COMPANIES_BUCKET!;
            const thumbKey = `${companyId}/Thumbnail_${mediaName}`;
            const originalKey = `${companyId}/${mediaName}`;

            // ✅ Try thumbnail first
            try {
                await safeS3Call(
                    s3.send(new GetObjectCommand({ Bucket, Key: thumbKey })),
                    1500
                );

                return await getSignedUrl(
                    s3,
                    new GetObjectCommand({ Bucket, Key: thumbKey }),
                    { expiresIn: 3600 }
                );

            } catch {
                // ❗ Thumbnail doesn't exist → fallback to original URL (NO processing)
                return await getSignedUrl(
                    s3,
                    new GetObjectCommand({ Bucket, Key: originalKey }),
                    { expiresIn: 3600 }
                );
            }

        } catch (error) {
            console.error("THUMBNAIL ERROR:", error);
            return null;
        }
    }


    public static async uploadThumbnail(mediaId: string, image: any, companyId: string, extension: string, fileType: string, edited = false, bucketName: string | null = null) {

        const instance = new S3Service()
        const s3 = S3Service.getClient();
        if (s3 == null) return null
        try {
            const name = (bucketName != null && bucketName != "") ? bucketName : process.env.AWS_COMPANIES_BUCKET;
            const Key = edited ? companyId + '/' + mediaId + '_Edited.' + extension : companyId + '/Thumbnail_' + mediaId + "." + extension;
            let contentType = fileType + "/" + extension
            const base64String = image.toString('base64');
            let imageData = base64String.split(';base64,').pop();
            if (imageData) {
                let resizeImage = await this.resizeImage(imageData, 250, null, 320, extension);
                if (!resizeImage) throw new Error("Error In Resize Image")
                let buf: any;
                buf = Buffer.from(
                    resizeImage.replace(/^data:[^;]+;base64,/, ""),
                    "base64"
                );



                const params = {
                    Bucket: name,
                    Key: Key,
                    Body: buf,
                    ContentEncoding: 'base64',
                    ContentType: contentType
                }



                const parallelUploads3 = new Upload({
                    client: s3,
                    params,
                    tags: [
                        /*...*/
                    ], // optional tags
                    queueSize: 4, // optional concurrency configuration
                    partSize: 1024 * 1024 * 5, // optional size of each part, in bytes, at least 5MB
                    leavePartsOnError: false, // optional manually handle dropped parts
                });

                parallelUploads3.on("httpUploadProgress", (progress) => {
                });

                await parallelUploads3.done();
            }

        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        } finally {
            s3.destroy();
        }
    }


    public static async insertAttendenceMeida(companyId: string, attendanceId: string, type: string, image: string, extension: string, fileType: string) {
        const instance = new S3Service()
        const s3 = S3Service.getClient();
        if (s3 == null) return null
        try {
            /** insert Bucket */
            let bucket = process.env.AWS_COMPANIES_ATTENDANCE
            let contentType = fileType + "/" + extension
            const Key = companyId + '/' + attendanceId + '_' + type + `.${extension}`
            if (bucket)
                try {
                    const rules = {
                        Bucket: process.env.AWS_COMPANIES_ATTENDANCE,
                        LifecycleConfiguration: {
                            Rules: [
                                {
                                    ID: 'ExpireAttendanceImages',
                                    Expiration: {
                                        Days: 90 // Objects will expire after 30 days

                                    },
                                    Filter: {
                                        Prefix: '' // Apply the rule to objects in the Eman/Images/ folder
                                    },
                                    Status: 'Enabled'
                                }
                            ]
                        }
                    };

                    await this.createBucket(bucket, rules);
                } catch (error) {
                    console.log(error)

                }

            let buf = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ""), 'base64')
            const params = {
                Bucket: process.env.AWS_COMPANIES_ATTENDANCE,
                Key: Key,
                Body: buf,
                ContentEncoding: 'base64',
                ContentType: contentType
            }



            const parallelUploads3 = new Upload({
                client: s3,
                params,
                tags: [
                    /*...*/
                ], // optional tags
                queueSize: 4, // optional concurrency configuration
                partSize: 1024 * 1024 * 5, // optional size of each part, in bytes, at least 5MB
                leavePartsOnError: false, // optional manually handle dropped parts
            });

            parallelUploads3.on("httpUploadProgress", (progress) => {
            });

            await parallelUploads3.done();
            const downloadUrl = process.env.APP_BASE_URL + "/Media" + "/getMedia/attendance/" + companyId + '/' + attendanceId + '_' + type + `.${extension}`
            return downloadUrl
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        } finally {
            s3.destroy()
        }
    }


    public static async getMediaImageAttendance(
        mediaName: string,
        companyId: string,
        width: number | null = null,
        height: number | null = null
    ) {
        
        const s3 = S3Service.getClient();

        if (!s3) return null;

        try {
            const Bucket = process.env.AWS_COMPANIES_ATTENDANCE!;
            const Key = `${companyId}/${mediaName}`;

            // ✅ safer extension
            const extension = mediaName.split('.').pop()?.toLowerCase();

            const data: any = await safeS3Call(
                s3.send(new GetObjectCommand({ Bucket, Key })),
                2000
            );

            if (!data.Body) return null;

            let objectData = await safeS3Call(
                data.Body.transformToString("base64"),
                2000
            );

            // ⚠️ still heavy (but controlled)
            if (width && height) {
                objectData = await this.resizeImage(
                    objectData,
                    width,
                    height,
                    height,
                    extension
                );
            }

            return objectData;

        } catch (error) {
            console.error("ATTENDANCE IMAGE ERROR:", error);
            return null;
        }
    }



    public static async getAppleSplash(
        imageSize: string,
        companyId: string
    ) {
        
        const s3 = S3Service.getClient();

        if (!s3) return null;

        try {
            const Bucket = process.env.AWS_COMPANIES_BUCKET!;
            const Key = `${companyId}/apple-splash/apple-touch-startup-image-${imageSize}.png`;

            const data: any = await safeS3Call(
                s3.send(new GetObjectCommand({ Bucket, Key })),
                2000 // ⏱ prevents hanging
            );

            let objectData;

            if (data.Body) {
                objectData = await safeS3Call(
                    data.Body.transformToString("base64"),
                    2000 // ⏱ prevents conversion hang
                );
            }

            return objectData;

        } catch (error) {
            console.error("APPLE SPLASH ERROR:", error);
            return null;
        }
    }

    public static async uploadAppleSplash(fileContent: any, fileName: string, companyId: string) {

        const instance = new S3Service()
        const s3 = S3Service.getClient();
        if (s3 == null) return null
        try {
            const name = process.env.AWS_COMPANIES_BUCKET;
            const params = {
                Bucket: name,
                Key: companyId + "/apple-splash/" + fileName,
                Body: fileContent,
                ContentEncoding: 'base64',
                ContentType: "image/png"
            }



            const parallelUploads3 = new Upload({
                client: s3,
                params,
                tags: [
                    /*...*/
                ], // optional tags
                queueSize: 4, // optional concurrency configuration
                partSize: 1024 * 1024 * 5, // optional size of each part, in bytes, at least 5MB
                leavePartsOnError: false, // optional manually handle dropped parts
            });

            parallelUploads3.on("httpUploadProgress", (progress) => {
            });

            await parallelUploads3.done();
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        } finally {
            s3.destroy();
        }
    }

    public static async deleteAppleSplash(companyId: string) {
        const instance = new S3Service()

        const s3 = S3Service.getClient();
        if (s3 == null) return null
        try {
            const listCommand = new ListObjectsV2Command({
                Bucket: process.env.AWS_COMPANIES_BUCKET,
                Prefix: companyId + "/apple-splash/",
            });
            const listResponse = await s3.send(listCommand);
            if (!listResponse.Contents || listResponse.Contents.length === 0) {
                console.log('No objects found under prefix:', companyId + "/apple-splash/");
                return;
            }

            const deleteCommand = new DeleteObjectsCommand({
                Bucket: process.env.AWS_COMPANIES_BUCKET,
                Delete: {
                    Objects: listResponse.Contents.map(obj => ({ Key: obj.Key! }))
                }
            });

            await s3.send(deleteCommand);

        } catch (error: any) {
            console.log(error)
            return null
        } finally {
            s3.destroy();
        }
    }
    public static getImageTypeFromBase64(base64Data: string) {
        const cleanedBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

        // Check the starting bytes
        if (cleanedBase64.startsWith("iVBORw0KGgo")) {
            return "png";
        } else if (cleanedBase64.startsWith("/9j/")) {
            return "jpeg";

        } else {
            throw new Error("Invalid Type")
        }
    }
    public static async uploadSignatureImage(invoiceId: string, image: string, companyId: string, folderName: string) {

        const instance = new S3Service()
        const s3 = S3Service.getClient();
        if (s3 == null) return null
        try {
            let fileType = "image"

            let extension = 'jpeg'
            extension = S3Storage.getImageTypeFromBase64(image)
            const name = process.env.AWS_COMPANIES_BUCKET;
            const Key = companyId + `/Signatures/${folderName}/` + invoiceId + "." + extension;
            let contentType = fileType + "/" + extension
            const cleanedBase64 = image.replace(/^data:.*;base64,|^base64,/, "");
            let buf = Buffer.from(cleanedBase64, "base64");

            // if (fileType == "application") {

            //     buf = Buffer.from(image.replace(/^data:application\/\w+;base64,/, ""), 'base64')
            // } else if (fileType == "image" && extension != "svg") {
            //     buf = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ""), 'base64')
            // } else if (extension == "svg") {
            //     contentType += '+xml'
            //     buf = Buffer.from(image.replace(/^data:image\/[a-zA-Z+]+;base64,/, ''), 'base64')
            // } else if (extension == "ttf") {
            //     buf = Buffer.from(image.replace(/^data:application\/[a-zA-Z+-]+;base64,/, ''), 'base64')
            // }
            const params = {
                Bucket: name,
                Key: Key,
                Body: buf,
                ContentEncoding: 'base64',
                ContentType: contentType
            }



            const parallelUploads3 = new Upload({
                client: s3,
                params,
                tags: [
                    /*...*/
                ], // optional tags
                queueSize: 4, // optional concurrency configuration
                partSize: 1024 * 1024 * 5, // optional size of each part, in bytes, at least 5MB
                leavePartsOnError: false, // optional manually handle dropped parts
            });

            parallelUploads3.on("httpUploadProgress", (progress) => {
            });

            await parallelUploads3.done();
            return process.env.APP_BASE_URL + `/Signatures/${folderName}/` + companyId + '/' + invoiceId + "." + extension;

        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        } finally {
            s3.destroy();
        }
    }
    public static async getSignatureImage(
        mediaName: string,
        companyId: string,
        fileName: string
    ) {
        
        const s3 = S3Service.getClient();

        if (!s3) return null;

        try {
            const Bucket = process.env.AWS_COMPANIES_BUCKET!;
            const Key = `${companyId}/Signatures/${fileName}/${mediaName}`;

            const data: any = await safeS3Call(
                s3.send(new GetObjectCommand({ Bucket, Key })),
                2000 // ⏱ prevent hanging
            );

            let objectData;

            if (data.Body) {
                objectData = await safeS3Call(
                    data.Body.transformToString("base64"),
                    2000 // ⏱ prevent conversion hang
                );
            }

            return objectData;

        } catch (error) {
            console.error("SIGNATURE IMAGE ERROR:", error);
            return null;
        }
    }


    public static async reUploadComapnyThumpnail(companyId: string) {
        try {
            const query = {
                text: `SELECT id,"url","url"->>'defaultUrl' as "imageUrl" from "Media" where "companyId" = $1 and "contentType" = 'image'`,
                values: [companyId]
            }

            let data = await DB.excu.query(query.text, query.values);

            const newArray: any[] = [];

            for (let index = 0; index < data.rows.length; index++) {
                const element = data.rows[index];
                const url = new URL(element.imageUrl);

                const parts = url.pathname.split("/");
                const fileName = parts.pop()!; // test.jpg
                parts.push(`Thumbnail_${fileName}`);

                url.pathname = parts.join("/");
                element.url.thumbnail = url.toString()
                let object = { id: element.id, url: element.url };
                newArray.push(object)
                const exstention = fileName.split('.')[1]

                let image = await this.getDefaultImageBase64(element.id, companyId, exstention)
                if (image) {
                    const cleaned = image.media.replace(/^data:image\/\w+;base64,/, '');
                    const buffer = Buffer.from(cleaned, 'base64');


                    await this.uploadImage(element.id, buffer, companyId, exstention, 'image', false)
                    await this.uploadThumbnail(element.id, buffer, companyId, exstention, 'image', false)

                }
            }


            if (newArray.length > 0) {
                const chunks = this.chunkArray(newArray, 100);

                for (const batch of chunks) {
                    const query = `
                   UPDATE "Media" m
                    SET "url" = v."url"
                    FROM (
                        SELECT
                            (item->>'id')::uuid AS id,
                            item->'url' as "url"
                        FROM jsonb_array_elements($1::jsonb) AS item
                    ) v
                    WHERE m.id = v.id;
                    `;

                    await DB.excu.query(query, [JSON.stringify(batch)]);
                }
            }
            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }

    private static chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }


    public static async getImageBase64Jpeg(mediaId: string, companyId: string, extension: string) {
        
        const s3 = S3Service.getClient();
        if (s3 == null) return null
        try {
            const bucketName = process.env.AWS_COMPANIES_BUCKET!;
            const params = {
                Bucket: bucketName,
                Key: `${companyId}/${mediaId}.${extension}`
            };

            const data = await s3.getObject(params);
            if (!data.Body) return null;

            // Convert S3 Body to Buffer
            const buffer: Buffer = Buffer.isBuffer(data.Body)
                ? data.Body
                : Buffer.from(await data.Body.transformToString('base64'), 'base64');

            // Convert image to JPEG using Sharp
            const jpegBuffer = await sharp(buffer)
                .jpeg() // convert to JPEG
                .toBuffer();

            // Encode as Base64
            const base64Image = 'data:image/jpeg;base64,' + jpegBuffer.toString('base64');

            // Get dimensions and size
            const dimensions = sizeOf(jpegBuffer);
            const size = {
                size: jpegBuffer.length,
                width: dimensions.width,
                height: dimensions.height
            };

            return base64Image

        } catch (error: any) {
            console.error('Error fetching/converting image:', error);
            return null;
        } finally {
            s3.destroy();
        }
    }
}