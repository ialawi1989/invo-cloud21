import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Salon + Appointments share one privilege group (the former `appointmentsSecurity` was created by mistake for the
 * same feature). Add / edit are separate actions; the appointment form route picks one by its `mode` query param.
 */
export function salonSecurity() {
  return new PrivilegeSetting({
    name: "Salon Security",
    securityType: "common",
    securityGroup: "sales",
    actions: {
      "changeTask": new PrivilegeSetting({
        name: "Change Task",
        securityType: "POS",
      }),
      "newAppointment": new PrivilegeSetting({
        name: "Add New Appointment",
        securityType: "common",
      }),
      "editAppointment": new PrivilegeSetting({
        name: "Edit Appointment",
        securityType: "common",
      }),
      "view": new PrivilegeSetting({
        name: "View Appointments",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Cancel Appointments",
        securityType: "cloud",
      }),
      "serviceTeam": new PrivilegeSetting({
        name: "Manage Service Team (staff capability)",
        securityType: "cloud",
      })
    }
  });
}
