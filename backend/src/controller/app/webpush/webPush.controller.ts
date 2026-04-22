import { ResponseData } from '@src/models/ResponseData';
import { AttendanceRepo } from '@src/repo/app/settings/attendance.repo';
import { ValidationException } from '@src/utilts/Exception';
import { Request, Response, NextFunction } from 'express';
import { CloudwebPushRepo } from './webPush.repo';
import { Helper } from '@src/utilts/helper';
import { SendInput, SubscriptionType } from './webPush.model';


export class WebPushController {

    public static async subscribe(req: Request, res: Response, next: NextFunction) {
        try {
            const body = req.body || {};
            const companyId = String(res.locals.company.id || "");
            const employeeId = String(res.locals.user || "");
            const enabled = Boolean(body.enabled);
            const device = body.device || {};
            const deviceId = String(device.deviceId || "");

            if (!companyId || !employeeId) {
                return res.status(400).json(new ResponseData(false, "Missing companyId or employeeId", []));
            }
            if (!deviceId) {
                return res.status(400).json(new ResponseData(false, "Missing device.deviceId", []));
            }

            // When enabling, subscription is required
            const subscription: SubscriptionType | null = body.subscription || null;
            if (enabled) {
                if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
                    return res.status(400).json(new ResponseData(false, "Missing/Invalid subscription", []));
                }

                const ipLast = Helper.getClientIp(req);

                const r = await CloudwebPushRepo.subscribe({
                    employeeId,
                    companyId,
                    device: {
                        deviceId,
                        deviceName: device.deviceName ?? null,
                        platform: device.platform ?? "web",
                        appVersion: device.appVersion ?? null,
                        userAgent: device.userAgent ?? req.headers["user-agent"] ?? null,
                        ipLast: ipLast,
                    },
                    subscription,
                });

                return res.json(r);
            } else {
                // disabling: we can disable mapping by endpoint (preferred).
                // If subscription not provided, we can fallback to disable all tokens for this device+company.
                if (subscription?.endpoint) {
                    const r = await CloudwebPushRepo.unsubscribe({
                        employeeId,
                        companyId,
                        endpoint: subscription.endpoint,
                    });
                    return res.json(r);
                }

                const r = await CloudwebPushRepo.disableCompanyForDevice({
                    companyId,
                    employeeId,
                    deviceId,
                });

                return res.json(r);
            }
        } catch (error: any) {
            console.log(error);
              throw error
        }
    }




    public static async companyStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const companyId = String(res.locals.company.id || "");
            const employeeId = String(res.locals.user || "");
            const deviceId = req.query.deviceId ? String(req.query.deviceId) : null;

            if (!companyId || !employeeId) {
                return res.status(400).json(new ResponseData(false, "Missing companyId or employeeId", []));
            }

            // If you want "per device" status, we must know deviceId.
            // We’ll expose both:
            //  - enabledForCompany: for this device if deviceId provided, otherwise for ANY employee device.
            const result = await CloudwebPushRepo.getCompanyToggleStatus({
                companyId,
                employeeId,
                deviceId,
            });

            return res.json(
                new ResponseData(true, "", [
                    {
                        enabledForCompany: result.enabledForCompany,
                        scope: deviceId ? "device" : "employee",
                    },
                ])
            );
        } catch (error: any) {
            console.log(error);
              throw error
        }
    }


    public static async testSendNotifications(req: Request, res: Response, next: NextFunction) {
        try {
            const companyId = String(res.locals.company.id || "");
            const employeeId = String(res.locals.user || "");
            const input: SendInput = {
                companyId: companyId,
                employeeId: employeeId,
                payload: {
                    title: req.body.title,
                    body: req.body.body,
                    icon: req.body.icon,
                    url: req.body.url,
                    tag: req.body.tag,
                    data: req.body.data
                },

            }
            await CloudwebPushRepo.sendNotification(input)
            return res.json(new ResponseData(true, "Message Sent Successfully", []));
        } catch (error: any) {
            console.log(error);
              throw error
        }
    }

    public static async brodcastNotification(req: Request, res: Response, next: NextFunction) {
        try {

            const input: SendInput = {
                companyId: req.body.companyId,
                employeeId: req.body.employeeId,
                payload: {
                    title: req.body.title,
                    body: req.body.body,
                    icon: req.body.icon,
                    url: req.body.url,
                    tag: req.body.tag,
                    data: req.body.data
                },

            }
            await CloudwebPushRepo.brodcastMessage(input)
            return res.json(new ResponseData(true, "Message Sent Successfully", []));
        } catch (error: any) {
            console.log(error);
              throw error
        }
    }
}