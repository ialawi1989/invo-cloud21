import { DB } from "@src/dbconnection/dbconnection";
import { PairedDevice } from "@src/models/account/PairedDevice";
import { ResponseData } from "@src/models/ResponseData";
import { RedisClient } from "@src/redisClient";
import { AppError } from "@src/utilts/Exception";
import FCMService from "@src/utilts/firebase";
import { PairedDeviceValidator } from "@src/validationSchema/invoWatch/pairedDevice.Schema";
import { PoolClient } from "pg";
import { Socket } from "socket.io/dist/socket";




const EXPIRE_TIME_SEC = 5 * 60; // 5 دقائق


export class PairedDeviceRepo {

    public static generateNumericCode(length: number): string {

        /***********************************************************************************
         * Generates a random numeric string of a specified length.
         * @param length The desired length of the numeric string.
         * @returns A string consisting only of digits.
        ************************************************************************************/

        if (length <= 0) { return ''; }

        // Calculate the minimum and maximum numbers for the given length
        // e.g., for length 6: min = 100000, max = 999999
        const min = Math.pow(10, length - 1);
        const max = Math.pow(10, length) - 1;

        // Generate a random integer within the [min, max] range
        const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;

        // Convert to string. Ensures it's always 'length' digits long (e.g., no leading zeros for smaller numbers within the range, but it ensures total length)
        return String(randomNumber);
    }

    public static async generateUniquePairingCode(length = 6): Promise<string> {

        /*************************************************************************************
         * Generates a unique numeric pairing code by checking against existing active pairing connections.
         * @param length The desired length of the unique numeric code (default is 6).
         * @returns A unique numeric pairing code.
         * @throws AppError if an issue occurs during the uniqueness check.
        ************************************************************************************/

        let code: string;
        let exists: boolean;

        // To prevent infinite loops in extremely rare cases or if Redis is down
        const MAX_RETRIES = 10;
        let attempts = 0;

        do {
            // Generate a numeric code
            code = this.generateNumericCode(length);

            try {
                // Check if this code already exists in Redis for a pending pairing connection
                // Assuming getPairingConnection is the correct method for checking uniqueness of the code
                const record = await PairedDeviceRepo.getPairingConnection(code);
                exists = record !== null;
            } catch (error: any) {
                // Log and re-throw, or handle the error gracefully based on your error handling strategy
                console.error(`Error checking pairing code existence: ${error.message}`);
                // If the database/Redis is unreachable, we can't guarantee uniqueness.
                // Consider throwing a more specific error or failing fast.
                throw new AppError(`Failed to generate unique pairing code due to a system error: ${error.message}`, 500);
            }

            attempts++;
            if (attempts >= MAX_RETRIES && exists) {
                throw new AppError(`Failed to generate a unique pairing code after ${MAX_RETRIES} attempts.`, 500);
            }

        } while (exists);

        return code;
    }

    public static async savePairing(client: PoolClient, data: any): Promise<PairedDevice> {

        /*********************************************************************************
         * Saves or updates a device pairing record in the database.
         * Uses ON CONFLICT (UPSERT) to avoid race conditions and ensure atomicity.
         * @param client - PostgreSQL PoolClient for transaction management.
         * @param data - The raw data for the device pairing.
         * @returns The saved PairedDevice object or null if no operation occurred.
        **********************************************************************************/
        try {

            // ############### Parse and validate input ###############  
            const pairedDevice = new PairedDevice();
            pairedDevice.ParseJson(data);

            const validate = await PairedDeviceValidator.pairedDeviceValidation(data);
            if (!validate.valid) {
                throw new AppError(validate.error, 400);
            }


            // ###################### Insert Data #######################
            const query = {
                text: `
                    INSERT INTO "PairedDevices" ("deviceId", token, type,  "branchId", "employeeId", "pairedAt")
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT ("deviceId") DO UPDATE
                    SET
                        token = EXCLUDED.token,
                        type = EXCLUDED.type,
                        "branchId" = EXCLUDED."branchId",
                        "employeeId" = EXCLUDED."employeeId",
                        "pairedAt" = EXCLUDED."pairedAt" 
                    RETURNING *; 
                `,
                values: [
                    pairedDevice.deviceId,
                    pairedDevice.token,
                    pairedDevice.type,
                    pairedDevice.branchId,
                    pairedDevice.employeeId,
                    pairedDevice.pairedAt
                ]
            };

            const result = await client.query(query.text, query.values);


            // ######################   Response  #######################
            if (result.rows.length === 0) {
                throw new AppError('Failed to save or update device pairing.', 500);
            }
            const savedPairing = new PairedDevice();
            savedPairing.ParseJson(result.rows[0]);
            return savedPairing;


        } catch (error: any) {
          
    
            if (error instanceof AppError) {
                throw error; // Re-throw custom errors as-is
            }
            throw new AppError(`Failed to save pairing: ${error.message}`, 500);
        }
    }

    public static async initiatePairingConnection(data: { deviceToken: string; deviceType: string; deviceName: string; deviceId: string }): Promise<ResponseData> {

        /***********************************************************************************
         * Initiates a pairing connection by storing device info in Redis with an expiration.
         * @param data - Device token and type.
         * @returns code The saved PairedDevice object
        **********************************************************************************/

        try {

            // ##################### validate input #####################    
            const validate = await PairedDeviceValidator.deviceInfoValidation(data);
            if (!validate.valid) {
                throw new AppError(validate.error, 400);
            }

            // ############## save temporary PairedDevice  ##############  
            // save  PairedDevice temporary in Redis
            let code = await PairedDeviceRepo.generateUniquePairingCode();

            const record: { token: string, type: string, name: string, deviceId: string } = {
                token: data.deviceToken,
                type: data.deviceType,
                name: data.deviceName,
                deviceId: data.deviceId
            };

            const redis = RedisClient.getRedisClient();
            await redis.client!.setex(`pairing:${code}`, EXPIRE_TIME_SEC, JSON.stringify(record));

            // ######################   Response  #######################
            return new ResponseData(true, "", { code: code })


        } catch (error: any) {
          
          
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(`Failed to initiate pairing connection: ${error.message}`, 500);
        }
    }

    public static async completePairingConnection(client: PoolClient, data: { code: string, branchId: string; employeeId?: string }) {

        /***********************************************************************************
         * Completes the pairing connection by retrieving from Redis, saving to DB, and clearing Redis.
         * @param client - PostgreSQL PoolClient for transaction management.
         * @param code - The pairing code.
         * @param tenantData - branch, and user ID from the tenant completing the pairing.
         * @returns The completed PairedDevice object or null if the pairing code is invalid/expired.
        **********************************************************************************/

        try {

            // ##################### validate input #####################    
            const validate = await PairedDeviceValidator.pairingValidation(data);
            if (!validate.valid) {
                throw new AppError(validate.error, 400);
            }

            // ################  validate Pairing code  ################  
            const paired = await PairedDeviceRepo.getPairingConnection(data.code);
            if (!paired) {
                throw new AppError('Invalid or expired code.', 400);
            }

            // ##################  Piring Device data  ##################  
            const pairingDevice = new PairedDevice();
            pairingDevice.ParseJson(paired)

            pairingDevice.branchId = data.branchId;
            pairingDevice.employeeId = data.employeeId ?? null;
            pairingDevice.pairedAt = new Date();
            // ############ store Pairing Device in database  ############  
            const savedPairing = await PairedDeviceRepo.savePairing(client, pairingDevice)
            if (!savedPairing.id) {
                throw new AppError(`Failed to complete pairing connection`, 500);
            }

            // ###########  successfully pairing notification  ###########
            await FCMService.sendNotification(paired.token, "Device Paired", "Your device has been successfully paired with the system.", {
                status: 'paired',
                branchId: savedPairing.branchId ?? ""
            });

            // #####################   Clean Redis  ##################### 
            // Clean up Redis after successful database save
            const redis = RedisClient.getRedisClient();
            await redis.deletKey(`pairing:${data.code}`);

            // ######################   Response  #######################
            return new ResponseData(true, "", savedPairing)


        } catch (error: any) {
          
    
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(`Failed to complete pairing connection: ${error.message}`, 500);
        }
    }

    public static async getPairingConnection(code: string): Promise<PairedDevice | null> {

        /***********************************************************************************
         * Retrieves a pending pairing connection from Redis.
         * @param code - The pairing code.
         * @returns The PairedDevice object or null if not found/expired.
        **********************************************************************************/

        try {

            // ##################### Data Validation #####################  
            if (typeof code !== 'string' || !code.trim()) {
                throw new AppError('Pairing code is invalid.', 400);
            }

            // ##################### check Pending Pairing ##################### 
            const redis = RedisClient.getRedisClient();
            let val = await redis.get(`pairing:${code}`);
            if (!val) {
                return null; // Key not found or expired by Redis itself
            }
            //parse val
            val = JSON.parse(val);
            // ######################   Response  #######################
            const record = new PairedDevice();
            record.ParseJson(val);
            return record;

        } catch (error: any) {
          
          
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(`Failed to retrieve pairing connection: ${error.message}`, 500);
        }
    }

    public static async getPairing(branchId: string, token: string): Promise<PairedDevice[]> {

        /***********************************************************************************
         * Retrieves a device pairing record from the database.
         * @param companyId - The ID of the company.
         * @param token - The device token.
         * @returns An array of PairedDevice objects (should typically be one or zero).
        **********************************************************************************/

        try {

            if (typeof token !== 'string' || !token.trim()) {
                throw new AppError('Device token is required.', 400);
            }
            if (typeof branchId !== 'string' || !branchId.trim()) {
                throw new AppError('Company ID is required.', 400);
            }

            const query = {
                text: `SELECT * FROM "PairedDevices" WHERE "branchId" = $1 AND "token" = $2`,
                values: [branchId, token]
            };

            const result = await DB.excu.query(query.text, query.values);
            // Map raw rows to PairedDevice objects
            return result.rows.map((row: any) => {
                const pairedDevice = new PairedDevice();
                pairedDevice.ParseJson(row);
                return pairedDevice;
            });
        } catch (error: any) {
          
          
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(`Failed to retrieve pairing: ${error.message}`, 500);
        }
    }

    public static async unpairDevice(branchId: string, deviceId: string): Promise<boolean> {

        /***********************************************************************************
         * Deletes a device pairing record from the database.
         * @param companyId - The ID of the company.
         * @param token - The device token.
         * @returns A boolean indicating success of the deletion.
         *********************************************************************************/

        try {

            // #################### data validation #####################
            const validate = await PairedDeviceValidator.unPairedDataValidation({ branchId: branchId, deviceId: deviceId });
            if (!validate.valid) {
                throw new AppError(validate.error, 400);
            }

            // #################### unpaired device #####################
            //remove unpaired device from dataBase Data
            const query = {
                text: `DELETE FROM public."PairedDevices" WHERE "branchId" = $1 AND id = $2`,
                values: [branchId, deviceId]
            };


            // ######################   Response  #######################
            const result = await DB.excu.query(query.text, query.values);
            return (result.rowCount != null && result.rowCount > 0); // Return true if at least one row was deleted


        } catch (error: any) {
          
           
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(`Failed to delete device pairing: ${error.message}`, 500);
        }
    }

    public static async getPairingListByBranch(branchId: string): Promise<ResponseData> {

        /*************************************************************************************
         * Retrieves all device pairing records associated with a specific branch ID.
         * @param branchId - The ID of the branch.
         * @returns An array of PairedDevice objects.
        ************************************************************************************/

        try {

            // #################### data validation #####################
            if (typeof branchId !== 'string' || !branchId.trim()) {
                throw new AppError('BranchId is required.', 400);
            }

            // ###################### select Data #######################
            let list = []

            const query = {
                text: `SELECT id,type,"pairedAt" FROM "PairedDevices" WHERE "branchId" = $1`,
                values: [branchId]
            };

            const records = await DB.excu.query(query.text, query.values);
            if (records.rows && records.rows.length > 0) {
                list = records.rows
            }

            // ######################   Response  #######################
            return new ResponseData(true, "", list)


        } catch (error: any) {
          
      
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(`Failed to retrieve pairings by branch: ${error.message}`, 500);
        }
    }

    public static async sendMulticastNotificationToBranch(branchId: string, data: {  body: string, title?: string|null, extraData?: Record<string, any> }): Promise<any> {

        /*********************************************************************************
         * Sends a multicast push notification to all devices paired with a specific branch.
         * @param branchId - The ID of the branch whose devices will receive the notification.
         * @param title - The title of the notification.
         * @param body - The body/content of the notification.
         * @param extraData - Optional additional data payload for the notification.
         * @returns The response from the FCM service (e.g., success status, message IDs).
        ********************************************************************************/
        try {

            // #################### data validation #####################
            if (typeof branchId !== 'string' || !branchId.trim()) {
                throw new AppError('Branch ID is required for sending multicast notification.', 400);
            }

            const validate = await PairedDeviceValidator.notificationValidation(data);
            if (!validate.valid) {
                throw new AppError(validate.error, 400);
            }

            // ###################### Preper data #######################
            const title = data.title
            const body = data.body
            const extraData = data.extraData ?? {}

            // ###################  send Notification  ####################
            // 1. Get all device pairings for the given branch
            const pairedDevices = (await PairedDeviceRepo.getPairingListByBranch(branchId)).data;

            if (pairedDevices.length === 0) {
                console.log(`No devices paired with branch ${branchId} to send multicast notification.`);
                return { success: true, message: `No devices found for branch ${branchId}. No notification sent.`, results: [] };
            }

            // 2. Extract all device tokens
            const tokens = pairedDevices.map((device: any) => device.token);

            // 3. Send multicast notification using FCMService
            const response = await FCMService.sendMulticastNotification(tokens, title??null, body, extraData);


            // ######################   Response  #######################
            return response;


        } catch (error: any) {
          
        
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(`Failed to send multicast notification to branch ${branchId}: ${error.message}`, 500);
        }
    }

}






export async function createPairing(code: string, data: { deviceToken: string; deviceType: string }) {

    const record = new PairedDevice();
    record.ParseJson(data)

    const redis = RedisClient.getRedisClient()
    await redis.client!.setex(`pairing:${code}`, EXPIRE_TIME_SEC, JSON.stringify(record));
}

export async function getPairing(code: unknown): Promise<PairedDevice | null> {
    if (typeof code !== "string") return null;
    const redis = RedisClient.getRedisClient()
    let val = await redis.get(`pairing:${code}`);
    if (!val) return null;
    val = JSON.parse(val);
    const record = new PairedDevice();
    record.ParseJson(val);



    // تحقق إضافي في حال التوقيت تجاوز المهلة (غير ضروري غالباً لأن Redis سيتولى الأمر)
    const current_date = Date.now()
    const isExpired = (current_date - record.pairedAt.getMilliseconds()) > EXPIRE_TIME_SEC * 1000;
    if (isExpired) {
        const redis = RedisClient.getRedisClient();
        await redis.deletKey(`pairing:${code}`);
        return null;
    }

    return record;
}

export async function completePairing(
    code: unknown,
    tenantData: { companyId: string; branchId?: string; userId?: string }
): Promise<PairedDevice | null> {
    const record = await getPairing(code);
    if (!record) return null;



    const redis = RedisClient.getRedisClient()
    await redis.client!.setex(`pairing:${code}`, EXPIRE_TIME_SEC, JSON.stringify(record)); // إعادة تخزين مع البيانات الجديدة

    return record;
}
