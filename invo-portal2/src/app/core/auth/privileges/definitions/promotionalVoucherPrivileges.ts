import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Gift vouchers (promotions module). Group key + action keys are the legacy
 * persisted ones (`PromotionalVoucherPrivileges.actions.<Key>`) — including the
 * odd `Enable/DisableVoucher` — so saved role data keeps working. Like the
 * legacy definition every switch defaults to OFF (`access: false`).
 */
const ACTIONS: { key: string; name: string }[] = [
  { key: "EditRate",           name: "Edit Gift Voucher Rate" },
  { key: "SendEmail",          name: "Send Email" },
  { key: "AddVoucher",         name: "Add Gift Voucher" },
  { key: "ActiveVoucher",      name: "Active Gift Voucher" },
  { key: "CancelVoucher",      name: "Cancel Gift Voucher" },
  { key: "SpendVoucher",       name: "Spend Gift Voucher" },
  { key: "RefundVoucher",      name: "Refund Gift Voucher" },
  { key: "Enable/DisableVoucher", name: "Enable/Disable Gift Voucher" },
  { key: "ExtendVoucher",      name: "Extend Gift Voucher" },
];

export function promotionalVoucherPrivileges() {
  const actions: Record<string, PrivilegeSetting> = {};
  for (const a of ACTIONS) {
    const s = new PrivilegeSetting({ name: a.name, securityType: "cloud" });
    s.access = false;
    actions[a.key] = s;
  }
  const group = new PrivilegeSetting({
    name: "Gift Voucher",
    securityType: "cloud",
    securityGroup: "Voucher",
    actions,
  });
  group.access = false;
  return group;
}
