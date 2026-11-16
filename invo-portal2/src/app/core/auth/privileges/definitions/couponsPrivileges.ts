import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Coupons & stamp cards (promotions module). Group + action keys are the legacy
 * persisted ones so saved role data keeps working; every switch defaults to OFF.
 */
const ACTIONS: { key: string; name: string }[] = [
  { key: "EnableDisableCouponSets", name: "Enable/Disable coupon Sets" },
  { key: "AddCouponSets",           name: "Add coupon Sets" },
  { key: "ActiveCouponSets",        name: "Active coupon Sets" },
  { key: "CancelCoupon",            name: "Cancel coupon" },
  { key: "DeactivateCouponSets",    name: "Deactivate coupon Sets" },
  { key: "IssueCouponSets",         name: "Issue coupon Sets" },
  { key: "EditCouponSets",          name: "Edit coupon Sets" },
  { key: "ActiveCoupon",            name: "Active coupon" },
  { key: "ExtendCoupon",            name: "Extend coupon" },
  { key: "SendEmail",               name: "Send Email" },
];

export function couponsPrivileges() {
  const actions: Record<string, PrivilegeSetting> = {};
  for (const a of ACTIONS) {
    const s = new PrivilegeSetting({ name: a.name, securityType: "cloud" });
    s.access = false;
    actions[a.key] = s;
  }
  const group = new PrivilegeSetting({
    name: "Coupons",
    securityType: "cloud",
    securityGroup: "promotions",
    actions,
  });
  group.access = false;
  return group;
}
