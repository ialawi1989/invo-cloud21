import { DB } from "@src/dbconnection/dbconnection";

import { ResponseData } from "@src/models/ResponseData";
import { BranchesRepo } from "@src/repo/callCenter/branch.repo";
import { Request, Response, NextFunction } from 'express';


import { order } from "@src/Integrations/whatsapp/Order"
import { PairedDeviceRepo } from "@src/repo/invoWatch/pairedDevice.repo";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";
const router = createAsyncRouter();
export class PairedDeviceController {

    public static async initiatePairingConnection(req: Request, res: Response, next: NextFunction) {
        try {
            const { deviceToken, deviceType, deviceName, deviceId } = req.body;
            if (!deviceToken || !deviceType) {
                return res.status(400).json({ error: "Missing fields" });
            }

            //Generate a pairing code and store it in Redis

            const response = await PairedDeviceRepo.initiatePairingConnection({
                deviceToken,
                deviceType,
                deviceName,
                deviceId
            });

            res.json(response);

        } catch (error: any) {
          
              throw error
        }
    }

    public static async checkPairingStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const code = req.body.code;
            const record = await PairedDeviceRepo.getPairingConnection(code);
            if (!record) return res.json({ paired: false });

            if (record.companyId) {
                return res.json({ paired: true, companyId: record.companyId, branchId: record.branchId });
            } else {
                return res.json({ paired: false });
            }

        } catch (error: any) {
          
              throw error
        }
    }

    public static async completePairingConnection(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const data = req.body;
            const paired = await PairedDeviceRepo.completePairingConnection(client, data);
            await client.query("COMMIT");
            return res.json({
                message: "Device paired successfully",
                device: paired,
            });

        } catch (error: any) {
          
            await client.query("ROLLBACK")
              throw error
        } finally {
            client.release();
        }
    }

    // public static async sendMulticastNotificationToBranch(req: Request, res: Response, next: NextFunction) {
    //     try {
    //          const code = req.body.code;
    //            const record = await  PairedDeviceRepo.sendMulticastNotificationToBranch(branchId, code);
    //          return res.json(new ResponseData(false, record.message, record))

    //     } catch (error: any) {
    //       
    //           throw error
    //     }
    // } 





}