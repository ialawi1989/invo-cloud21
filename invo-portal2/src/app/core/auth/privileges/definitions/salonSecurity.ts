import { PrivilegeSetting } from "../models/privilege-setting.model";

export function salonSecurity() {
  return new PrivilegeSetting({
    name: "Salon Security",
    securityType: "POS",
    securityGroup: "settings",
    actions: {
      "changeTask": new PrivilegeSetting({
        name: "Change Task",
        securityType: "POS",
      }),
      "newAppointment": new PrivilegeSetting({
        name: "Add New Appointment",
        securityType: "POS",
      }),
      "editAppointment": new PrivilegeSetting({
        name: "Edit Appointment",
        securityType: "POS",
      })
    }
  });
}
