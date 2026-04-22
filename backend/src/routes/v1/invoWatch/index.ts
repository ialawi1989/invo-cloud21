import { PairedDeviceController } from "@src/controller/invoWatch/pairedDevice.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";
import { authenticatedContextMiddleware } from "@src/middlewear/authenticatedContextMiddleware";
import express from "express";
const router = createAsyncRouter();
router.use(authenticatedContextMiddleware("watch"))


router.post('/init-pairing',PairedDeviceController.initiatePairingConnection);
router.post('/check-pairing-status',PairedDeviceController.checkPairingStatus)
router.post('/complete-pairing',PairedDeviceController.completePairingConnection)

// router.post("/init-pairing", async (req, res) => {
//     const { deviceToken, deviceType } = req.body;
//     if (!deviceToken || !deviceType) {
//         return res.status(400).json({ error: "Missing fields" });
//     }

//     //Generate a pairing code and store it in Redis
//     let code = await generateUniquePairingCode();

//     await createPairing(code, {
//         deviceToken,
//         deviceType,
//     });

//     res.json({ code: code, success: true });
// });

// router.get("/check-pairing-status", async (req, res) => {
//     const code = req.query.code;
//     const record = await getPairing(code);
//     if (!record) return res.json({ paired: false });

//     if (record.companyId) {
//         return res.json({ paired: true, companyId: record.companyId, branchId: record.branchId });
//     } else {
//         return res.json({ paired: false });
//     }
// });

// router.post("/complete-pairing", async (req, res) => {
//     const { code, companyId, branchId, userId } = req.body;

//     if (!code || !companyId) {
//         return res.status(400).json({ error: "Missing fields" });
//     }

//     const paired = await completePairing(code, {
//         companyId,
//         branchId,
//         userId,
//     });

//     if (!paired) {
//         return res.status(404).json({ error: "Invalid or expired code" });
//     }

   

//     console.log("✅ Device paired:", paired);
//     // TODO: Save to database or assign push role

//     await FCMService.sendNotification(paired.token, "Device Paired", "Your device has been successfully paired with the system.", {
//         status: 'paired',
//         companyId: companyId,
//         branchId: branchId,
//     });

//     res.json({
//         message: "Device paired successfully",
//         device: paired,
//     });
// });

// router.post("/send-notification", async (req, res) => {
//     const { token, title, body, data } = req.body;

//     if (!token || !title || !body) {
//         return res.status(400).json({ error: "Missing fields" });
//     }

//     try {
//         // Assuming FCMService is properly imported and initialized
//         const response = await FCMService.sendNotification(token as string, title as string, body as string, data as Record<string, string>);
//         res.json({ success: true, response });
//     } catch (error) {
//         console.error("❌ Failed to send notification:", error);
//         res.status(500).json({ error: "Failed to send notification" });
//     }

// });



export default router;