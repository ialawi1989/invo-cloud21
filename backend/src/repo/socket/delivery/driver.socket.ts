import { Socket } from "socket.io";

import { Helper } from "@src/utilts/helper";
import { SocketController } from "@src/socket";
import { RedisClient } from "@src/redisClient";
import { DriverRepo } from "../../deliveryApp/driver";
import { SocketErrorLogs, SocketLogs } from "../socketErrorLogs";
 // Optional: Sentry for production monitoring
import { AuthRepo } from "../../app/auth.repo";
import { EmployeeRepo } from "../../admin/employee.repo";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";

export class DriverSocketRepo {
    static redisClient: any;

    public static async pendingOrders(client: Socket, employeeId: string, callback: CallableFunction) {
        try {

            const resData = await DriverRepo.pendingOrders(employeeId);
            callback(JSON.stringify(resData))

        } catch (error: any) {
            client.emit(error)
            callback(error.message)
            

      
            return null;
        }
    }

    public static async clamiedOrders(client: Socket, employeeId: string, callback: CallableFunction) {
        try {

            const resData = await DriverRepo.clamiedOrders(employeeId);
            callback(JSON.stringify(resData))

        } catch (error: any) {
            client.emit(error)
            callback(JSON.stringify(error.message))
            

      
            return null;
        }
    }

    public static async pickedOrders(client: Socket, employeeId: string, callback: CallableFunction) {
        try {

            const resData = await DriverRepo.pickedOrders(employeeId);
            callback(JSON.stringify(resData))

        } catch (error: any) {
            client.emit(error)
            callback(JSON.stringify(error.message))
            

      
            return null;
        }
    }

    public static async deliveredOrders(client: Socket, employeeId: string, callback: CallableFunction) {
        try {

            const resData = await DriverRepo.deliveredOrders(employeeId);
            callback(JSON.stringify(resData))

        } catch (error: any) {
            client.emit(error)
            callback(JSON.stringify(error.message))
            

      
            return null;
        }
    }
    public static async getOrderById(client: Socket, invoiceId: string, callback: CallableFunction) {
        try {

            const resData = await DriverRepo.getOrderById(invoiceId);
            callback(JSON.stringify(resData))

        } catch (error: any) {
            client.emit(error)
            callback(JSON.stringify(error.message))
            

      
            return null;
        }
    }

    public static async getInvoicePaymentUrl(client: Socket, employeeId: string, invoiceId: string, callback: CallableFunction) {
        try {

            const resData = await DriverRepo.invoicePayment(employeeId, invoiceId);
            callback(JSON.stringify(resData))

        } catch (error: any) {
            client.emit(error)
            callback(JSON.stringify(error.message))
            

      
            return null;
        }
    }

    public static async setDriverLocation(client: Socket, data: any, employeeId: string, callback: CallableFunction) {
        try {
            await DriverRepo.setDriverLocation(employeeId, data);
        } catch (error: any) {
            
      
            return null;
        }
    }

    public static async getAvailableDrivers(client: Socket, branchId: string, callback: CallableFunction) {
        try {

            const drivers = await DriverRepo.getAvailableDrivers(branchId);
            callback(JSON.stringify(drivers))

        } catch (error: any) {
            client.emit(error)
            callback(JSON.stringify(error.message))
            

      
            logPosErrorWithContext(error, null, branchId, null, "getAvailableDrivers")

            return null;
        }
    }

    public static async sendDriverLocation(location: {}, branchIds: string) {
        try {

            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(location);
                instance.io.of('/api').in(clientId).emit("newLoction", JSON.stringify(newData));
            }


        } catch (error: any) {
            
            return null;
        }
    }
    public static async sendDeliveryOrderStatus(data: {}, branchId: string) {
        try {

            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()

            if (branchId) {
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                instance.io.of('/api').in(clientId).emit("deliveryOrderStatus", JSON.stringify(data));
            }
            return

        } catch (error: any) {
            
            return null;
        }
    }



    public static async getDriverList(client: Socket, branchId: string, callback: CallableFunction) {
        try {

            const drivers = await DriverRepo.getDriverList(branchId);
            callback(JSON.stringify(drivers))

        } catch (error: any) {
            console.log(error);
            callback(JSON.stringify(error.message))
            

      
            logPosErrorWithContext(error, null, branchId, null, "getAvailableDrivers")

            return null;
        }
    }

    public static async terminateOldSocket(employeeId: string): Promise<void> {
        try {

            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient();
            const redisKey = `Socket${employeeId}`;

            // 🔑 Retrieve the socket ID stored in Redis for this employee
            const clientId: string | null = await this.redisClient.get(redisKey);
            if (!clientId) {
                console.warn(`[terminateSocket] No active socket found for employeeId: ${employeeId}`);
                return;
            }

            // 🚪 Get the /driver namespace from Socket.IO
            const driverNamespace = instance.io.of('/driver');

            // 🎯 Attempt to retrieve the active socket connection by ID
            const clientSocket = driverNamespace.sockets.get(clientId);

            if (!clientSocket) {
                console.warn(`[terminateSocket] Socket ID ${clientId} not found in /driver namespace`);
                // Optional: Remove stale Redis key if socket not found
                await this.redisClient?.del(redisKey);
                return;
            }

            // 🚫 Emit a forced logout event to notify the client before disconnecting
            clientSocket.emit("error", {
                type: "FORCE_LOGOUT",
                message: "unauthorized -You have been logged out due to another login.",
                timestamp: new Date().toISOString(),
            });

            // 🔌 Forcefully disconnect the socket
            clientSocket.disconnect(true);

            // Cleanup: Remove the Redis entry as the socket is now disconnected
            await this.redisClient.deletKey(redisKey);
            console.info(`[terminateSocket] Successfully terminated socket for employeeId: ${employeeId}`);

        } catch (error: any) {
            
            console.error(`[terminateSocket] Error terminating socket for employeeId: ${employeeId}`, error);
        }
    }




}


