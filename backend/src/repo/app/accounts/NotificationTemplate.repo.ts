import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
// Assuming these imports are from your project's utility/error files


import { DB } from '@src/dbconnection/dbconnection';
import { AppError } from '@src/utilts/Exception';
import { ResponseData } from '@src/models/ResponseData';

import { PairedDeviceNotificationValidator } from '@src/validationSchema/invoWatch/pairedDevice.Schema';
import { PairedDeviceRepo } from '@src/repo/invoWatch/pairedDevice.repo';
import { InvoWatchSocketRepo } from '@src/repo/socket/invoWatch.socket';
dotenv.config();

// --- Interfaces for Clarity ---
// Defines the structure of a notification template as stored
// export interface NotificationTemplate {
//     id: string; // The ID used as the key in the JSONB object
//     title: string;
//     body: string;
//     extraData?: Record<string, any>;
// }

// Defines the expected input data structure for saving a notification
export interface NotificationTemplate {
    id?: string; // Optional: If provided, attempts to update existing or use this ID
    // name?: string; // Removed 'name' as it's not currently used in the stored template
    title?: string | null;
    body: string;
    icon: string;
    extraData?: Record<string, any>; // Optional: Additional data payload
}

export class NotificationTemplateRepo {


    public static async saveNotificationTemplate(companyId: string, data: NotificationTemplate): Promise<ResponseData> {
        try {

            /**
             * Saves or updates a company notification template in the 'notifications' JSONB column.
             * Notifications are stored as a JSON object where keys are notification IDs and values are the templates.
             * @param companyId The ID of the company.
             * @param data The notification template data (title, body, optional data, optional id).
             * @returns The saved notification template including its ID and createdAt timestamp.
             * @throws AppError if input is invalid or a database operation fails.
            */


            // ###################  Input Validation  ################### 
            const validate = await PairedDeviceNotificationValidator.NotificationTemplateSchema(data);
            if (!validate.valid) {
                throw new AppError(validate.error, 400);
            }

            // #####################  Prepare Data  ##################### 
            const id = data.id || uuidv4(); // Use provided ID or generate a new one

            const newTemplate: Omit<NotificationTemplate, 'id'> = (data.extraData) ?
                { body: data.body, icon: data.icon, extraData: data.extraData } :
                { icon: data.icon, body: data.body };

            // ###################### Insert Data #######################

            const updateQuery = {
                text: `
                    UPDATE "Companies"
                    SET "notifications" = COALESCE("notifications", '{}'::jsonb) || jsonb_build_object($1::text, $2::jsonb)
                    WHERE id = $3
                    RETURNING id
                `,
                values: [id, JSON.stringify(newTemplate), companyId]
            };


            const result = await DB.excu.query(updateQuery.text, updateQuery.values);

            // ######################   Response  #######################
            if (result.rowCount === 0) {
                // If rowCount is 0, the companyId likely does not exist
                throw new AppError(`Company with ID "${companyId}" not found. Notification template not saved.`, 404)
            }
            return new ResponseData(true, "", { id, ...newTemplate });

        } catch (error: any) {
          
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(`Failed to save/update notification template: ${error.message}`, 500);
        }
    }

    public static async getNotificationTemplateById(companyId: string, id: string): Promise<ResponseData> {
        try {

            /**
             * Retrieves a specific company notification template by its ID.
             * @param companyId The ID of the company.
             * @param id The ID of the notification template to retrieve.
             * @returns The retrieved notification template.
             * @throws AppError if input is invalid, company not found, or template not found.
             */

            // ###################  Input Validation  ################### 
            if (typeof companyId !== 'string' || !companyId.trim()) {
                throw new AppError('Company ID is required and must be a non-empty string.', 400);
            }
            if (typeof id !== 'string' || !id.trim()) {
                throw new AppError('Notification template ID is required and must be a non-empty string.', 400);
            }

            // ###################### Select Data #######################
            const query = {
                text: ` SELECT "notifications" -> $1 AS template 
                FROM "Companies" 
                WHERE id = $2
                `,
                values: [id, companyId]
            };

            const result = await DB.excu.query(query.text, query.values);

            // ######################   Response  #######################
            if (result && result.rows.length > 0) {
                const template = result.rows[0].template;

                if (!template) {
                    // If template is null, the specific notification ID was not found within the company's notifications
                    throw new AppError(`Notification template with ID "${id}" not found for company "${companyId}".`, 404);

                }
                return new ResponseData(true, "", { id, ...(template as Omit<NotificationTemplate, 'id'>) });
            }

            return new ResponseData(true, "", {});


        } catch (error: any) {
          
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(`Failed to retrieve notification template: ${error.message}`, 500);
        }
    }

    public static async getNotificationTemplateList(companyId: string): Promise<ResponseData> {
        try {

            /**
             * Retrieves a list of all notification templates for a given company.
             * @param companyId The ID of the company.
             * @returns The retrieved notification template List.
             * @throws AppError if input is invalid or a database operation fails, or if company is not found.
            */



            // ###################  Input Validation  ################### 
            if (typeof companyId !== 'string' || !companyId.trim()) {
                throw new AppError('Company ID is required and must be a non-empty string.', 400);
            }

            // ###################### Select Data #######################
            let list2: any = []
            const query = {
                text: ` SELECT "notifications" FROM "Companies" WHERE id = $1`,
                values: [companyId]
            };

            const result = await DB.excu.query(query.text, query.values);

            // ######################   Response  #######################
            if (result && result.rows.length > 0) {
                const notifications = result.rows[0].notifications || {};

                // Convert JSONB object to array
                list2 = Object.entries(notifications).map(([id, template]) => ({
                    id,
                    ...(template as object),
                }));

            }


            return new ResponseData(true, "", list2);


        } catch (error: any) {
          
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(`Failed to retrieve notification template list: ${error.message}`, 500);
        }
    }

    public static async deleteNotificationTemplate(companyId: string, id: string): Promise<boolean> {
        try {

            /**
             * Deletes a specific company notification template by its ID.
             * @param companyId The ID of the company.
             * @param id The ID of the notification template to delete.
             * @returns True if the template was successfully deleted, false otherwise (e.g., company or template not found).
             * @throws AppError if input is invalid or a database operation fails.
            */
            // ###################  Input Validation  ###################
            if (typeof companyId !== 'string' || !companyId.trim()) {
                throw new AppError('Company ID is required and must be a non-empty string.', 400);
            }
            if (typeof id !== 'string' || !id.trim()) {
                throw new AppError('Notification template ID is required and must be a non-empty string.', 400);
            }

            // ###################### Delete notif #######################
            const query = {
                text: `
                    UPDATE "Companies"
                    SET notifications = notifications - $1
                    WHERE id = $2
                    RETURNING id; 
                `,
                values: [id, companyId]
            };

            const result = await DB.excu.query(query.text, query.values);

            // ######################   Response  #######################
            // If rowCount is 0, either the company didn't exist, or the template didn't exist within it.
            // The `notifications - $1` operator silently does nothing if the key doesn't exist.
            // To distinguish, you might need an extra SELECT query beforehand,
            // but for a simple "deleted or not" boolean, checking rowCount is sufficient.
            return (result && result.rowCount != null && result.rowCount > 0);

        } catch (error: any) {
          
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(`Failed to delete notification template: ${error.message}`, 500);
        }
    }

    public static async sendNotificationByBranch(companyId: string, branchId: string, id: string, data: {} | null): Promise<ResponseData> {
        try {
            // ################### Input Validation ###################
            const validate = await PairedDeviceNotificationValidator.sendNotificationSchema({ companyId, branchId, id });
            if (!validate.valid) {
                throw new AppError(validate.error, 400);
            }

            // ###################### Retrieve Notif Template #######################
            const templateNotif = await this.getNotificationTemplateById(companyId, id);

            if (!templateNotif.success || !templateNotif.data) {
                throw new AppError(`Failed to retrieve notification template for sending: ${templateNotif.msg}`, 404);
            }

            const notifContent = templateNotif.data;


            notifContent.extraData = { ...(data || {}) }


            // ###################### Dispatch Notification #######################
            const notification = (notifContent.extraData && Object.keys(notifContent.extraData).length > 0) ?
                { body: notifContent.body, extraData: notifContent.extraData } :
                { body: notifContent.body }

            // #################### send notification to POS #####################    
            let pos_notification: any = notification
            pos_notification.title = 'Ecommerce_notification';
            await InvoWatchSocketRepo.sendEcommerceNotification({ notification: pos_notification }, branchId);

            // #################### send notification to FCM #####################    
            const fcmNotification = await PairedDeviceRepo.sendMulticastNotificationToBranch(branchId, notification);
            // if (fcmNotification.successCount && fcmNotification.successCount > 0) {
                
            // }
            return new ResponseData(true, "Notification dispatched successfully.", fcmNotification);
            // return new ResponseData(false, "Failed to send FCM notification", fcmNotification);
        } catch (error: any) {
          
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(`Failed to send notification by branch: ${error.message}`, 500);
        }
    }

}



