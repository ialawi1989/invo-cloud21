export class BranchDevice {
    id: string = "";
    branchId: string = "";
    companyId: string = "";
    deviceType: string = "";  // 'pos' | 'kds' | 'kiosk' | 'ready_screen'
    deviceName: string = "";
    serialNumber: string = "";
    status: "active" | "inactive" | "decommissioned" = "active";
    lastSeenAt: Date | null = null;
    metadata: any = null;
    createdAt: Date = new Date();
    updatedAt: Date = new Date();

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                (this as any)[key] = json[key];
            }
        }
    }
}
