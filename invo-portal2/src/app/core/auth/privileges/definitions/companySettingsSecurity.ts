import { PrivilegeSetting } from "../models/privilege-setting.model";

export function companySettingsSecurity() {
  return new PrivilegeSetting({
    name: "Company Settings Security",
    securityType: "cloud",
    securityGroup: "company",
    actions: {
      "businessSettings": new PrivilegeSetting({
        name: "Business Settings",
        securityType: "cloud",
      }),
      "roundingSettings": new PrivilegeSetting({
        name: "Rounding Settings",
        securityType: "cloud",
      }),
      "invoiceOptions": new PrivilegeSetting({
        name: "Invoice Settings",
        securityType: "cloud",
      }),
      "estimateOptions": new PrivilegeSetting({
        name: "Estimate Settings",
        securityType: "cloud",
      }),
      "customFields": new PrivilegeSetting({
        name: "Custom Fields",
        securityType: "cloud",
      })
    }
  });
}
