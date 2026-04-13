import { PrivilegeSetting } from "../models/privilege-setting.model";

export function dineInSecurity() {
  return new PrivilegeSetting({
    name: "Dine In Security",
    securityType: "POS",
    securityGroup: "settings",
    actions: {
      "changeTable": new PrivilegeSetting({
        name: "Change Table",
        securityType: "POS",
      }),
      "makeReservation": new PrivilegeSetting({
        name: "Make Reservation",
        securityType: "POS",
      }),
      "viewReservations": new PrivilegeSetting({
        name: "View Reservations",
        securityType: "POS",
      }),
      "editReservations": new PrivilegeSetting({
        name: "Edit Reservations",
        securityType: "POS",
      })
    }
  });
}
