export class PairedDevice
{
    id : string|null = null;
    deviceId: string|null = null;
    name: string|null = null;
    token="";
    type="";
    companyId="";
    branchId: string|null= null;
    employeeId : string|null= null
    pairedAt = new Date()

     ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

}
