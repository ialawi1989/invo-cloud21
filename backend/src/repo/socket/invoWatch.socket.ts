import { Socket } from "socket.io";





import { PairedDeviceRepo } from "../invoWatch/pairedDevice.repo";
import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { SocketController } from "@src/socket";
import { RedisClient } from "@src/redisClient";
import s from "connect-redis";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";

export class InvoWatchSocketRepo {
    static redisClient: any;

    public static async completePairingConnection(client: Socket, data: { code: string, employeeId?: string }, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        try {
            /**Begin Client */
            await dbClient.query("BEGIN")
            const response = await PairedDeviceRepo.completePairingConnection(dbClient, { code: data.code, branchId: branchId, employeeId: data.employeeId ?? undefined });
            callback(JSON.stringify(response))
            /**Commit Client */
            await dbClient.query("COMMIT")
        } catch (error: any) {
            /**ROLLBACK Client */
            await dbClient.query("ROLLBACK")
          

            callback(JSON.stringify(new ResponseData(false, error.message, [])))
            logPosErrorWithContext(error, data, branchId, null, "completePairingConnection")

        } finally {
            /**Release Client */
            dbClient.release()
        }
    }


    public static async unpairDevice(client: Socket, branchId: string, data: { deviceId: string }, callback: CallableFunction) {
        try {

            let code: boolean = await PairedDeviceRepo.unpairDevice(branchId, data.deviceId);
            callback(JSON.stringify({ "success": code }));

        } catch (error: any) {

            callback(JSON.stringify(new ResponseData(false, error.message, [])))
            logPosErrorWithContext(error, data, branchId, null, "unpairDevice")


        }
    }




    public static async getPairingListByBranch(client: Socket, branchId: string, callback: CallableFunction) {
        try {

            const DevicePairings = await PairedDeviceRepo.getPairingListByBranch(branchId);
            callback(JSON.stringify(DevicePairings))

        } catch (error: any) {

            callback(JSON.stringify(new ResponseData(false, error.message, [])))
            logPosErrorWithContext(error, null, branchId, null, "getPairingListByBranch")
        }
    }

    public static async sendNotification(client: Socket, branchId: string, data: any, callback: CallableFunction) {
        try {

            const DevicePairings = await PairedDeviceRepo.sendMulticastNotificationToBranch(branchId, data);
            callback(JSON.stringify(DevicePairings))

        } catch (error: any) {
            console.log(error);

            callback(JSON.stringify(new ResponseData(false, error.message, [])))
            logPosErrorWithContext(error, data, branchId, null, "sendNotification")
        }
    }

    public static async sendEcommerceNotification(data: {}, branchId: string) {
        try {
            if (!branchId) {
                console.warn('[sendEcommerceNotification] branchId is missing, skipping.');
                return null;
            }

            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()

            const clientId: any = await this.redisClient.get("Socket" + branchId);
            if (!clientId) {
                console.warn(`[sendEcommerceNotification] No socket client found for branch ${branchId}, skipping.`);
                return null;
            }

            instance.io.of('/api').in(clientId).emit("ecommerceNotification", JSON.stringify(data));
            return true;

        } catch (error: any) {
            console.error(`[sendEcommerceNotification] Failed for branch ${branchId}:`, error.message);
            return null;
        }
    }



}
