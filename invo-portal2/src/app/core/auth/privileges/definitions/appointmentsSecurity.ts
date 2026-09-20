import { PrivilegeSetting } from "../models/privilege-setting.model";

export function appointmentsSecurity() {
  return new PrivilegeSetting({
    name: "Appointments Security",
    securityType: "cloud",
    securityGroup: "sales",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Appointments",
        securityType: "cloud",
      }),
      "add": new PrivilegeSetting({
        name: "Add/Edit Appointments",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Cancel Appointments",
        securityType: "cloud",
      }),
      "serviceTeam": new PrivilegeSetting({
        name: "Manage Service Team (staff capability)",
        securityType: "cloud",
      }),
    }
  });
}
