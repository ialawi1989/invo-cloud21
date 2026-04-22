import { Socket } from "socket.io";

 // Optional monitoring
import { AuthRepo } from "@src/repo/app/auth.repo";
import { EmployeeRepo } from "@src/repo/admin/employee.repo";
import { DriverRepo } from "@src/repo/deliveryApp/driver";

export class DriverSocketHandler {

    // 🔒 Internal reusable error handler
    public static handleUnauthorized(client: Socket, next: (err?: Error) => void, message: string) {

        client.emit("error", {
            type: "AUTH_ERROR",
            message,
            timestamp: new Date().toISOString(),
        });
        client.disconnect(true);
        return next(new Error(message));
    }


    // ✅ Middleware function as a method
    public static async authenticate(client: Socket, next: (err?: Error) => void) {
        try {
                       

            const accessToken =
                client.handshake.auth?.token ??
                client.handshake.headers["api-auth"] ??
                client.handshake.headers["token"] ??
                null;

            if (!accessToken || typeof accessToken !== "string" || accessToken.trim() === "") {
                return DriverSocketHandler.handleUnauthorized(client, next, "Unauthorized: No token provided");
            }

            // 1. Decode and validate the access token
            const auth = await AuthRepo.authenticate(accessToken);
            if (!auth?.success) {
                return DriverSocketHandler.handleUnauthorized(client, next, "Unauthorized: Invalid or expired token");
            }

            const { employeeId, companyId, company } = auth.data;

            // 2. Get employee email and branches
            const emailResult = await EmployeeRepo.getEmployeeEmail(employeeId, null);
            const email = emailResult?.email;
            const branches = emailResult?.branches ?? [];

            if (!email) {
                return DriverSocketHandler.handleUnauthorized(client, next, "Unauthorized: No email found");
            }

            // 3. Enforce single-device login via Redis
            const sessionKey = `session:${email.toLowerCase()}`;
            const storedToken = await AuthRepo.getRedis(sessionKey);
            if (!storedToken || storedToken !== accessToken) {
                return DriverSocketHandler.handleUnauthorized(client, next, "Unauthorized: Session invalidated by another login");
            }

            // 4. Check if employee in shift 
            const employeeShiftId = await DriverRepo.checkEmployeeInShift(null, employeeId);
            if (!employeeShiftId) {
                return DriverSocketHandler.handleUnauthorized(client, next, "Unauthorized: Shift expired or not started");
            }

            // 5. Check access to branches
            const branchIds = branches.map((b: any) => b.id);
            if (branchIds.length === 0) {
                return DriverSocketHandler.handleUnauthorized(client, next, "Unauthorized: No branch access assigned");
            }

            // 6. Attach user context
            client.data.user = {
                employeeId, employeeShiftId,
                companyId,
                company,
                branchIds,
                email,
            };

            return next();
        } catch (error: any) {
          
            
            console.error("Socket auth error:", error.message);
            return this.handleUnauthorized(client, next, "Unauthorized: Internal server error");
        }
    }



}
