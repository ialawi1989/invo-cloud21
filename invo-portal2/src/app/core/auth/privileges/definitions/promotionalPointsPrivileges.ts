import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Promotional Points (promotions module). Group + action keys are the legacy persisted ones
 * so saved role data keeps working. Like the legacy definition every switch
 * defaults to OFF (`access: false`).
 */
const ACTIONS: { key: string; name: string }[] = [
  { key: "EditRate",           name: "Edit Promotional Points Rate" },
  { key: "SendEmail",          name: "Send Email" },
  { key: "AddPoints",          name: "Add Points" },
  { key: "ActivePoints",       name: "Active Points" },
  { key: "ExtendPoints",       name: "Extend Points" },
  { key: "SpendPoints",        name: "Spend Points" },
  { key: "CancelPoints",       name: "Cancel Points" },
  { key: "RefundPoints",       name: "Refund Points" },
  { key: "Enable/DisablePoints", name: "Enable/Disable Points" },
];

export function promotionalPointsPrivileges() {
  const actions: Record<string, PrivilegeSetting> = {};
  for (const a of ACTIONS) {
    const s = new PrivilegeSetting({ name: a.name, securityType: "cloud" });
    s.access = false;
    actions[a.key] = s;
  }
  const group = new PrivilegeSetting({
    name: "Promotional Points",
    securityType: "cloud",
    securityGroup: "promotions",
    actions,
  });
  group.access = false;
  return group;
}
