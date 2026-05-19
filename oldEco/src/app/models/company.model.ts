import { MenuSettings } from "./menu-settings.model";
import { MobileIconBarSettings } from "./mobile-bar-settings.model";
import { ThemeSettings } from "./theme-settings.model";

export class Company {
  name: string = "";
  type: string = "";
  country: string = "";
  isInclusiveTax: boolean = true;
  defaultUrl: string = "";
  translation: { [key: string]: any } = {};
  noSaleWhenZero: boolean = true;
  isInvoiceOptionGroupVisible: boolean = true;
  settings: any = {};
  mobileIconBar: MobileIconBarSettings = new MobileIconBarSettings();
  themeSettings: ThemeSettings = new ThemeSettings();
  menuSettings: MenuSettings = new MenuSettings();
  oldThemeSettings: any = {};
  googleFeedbackSettings:any = {};
  pickUpMaxDistance = 0; // 0 disable check on max distance

  // for display only
  displayOptions:any = {}

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        if (key === "themeSettings" && json[key]) {
          this.themeSettings = new ThemeSettings().ParseJson(json[key]);
        } else if (key === "menuSettings" && json[key]) {
          this.menuSettings = new MenuSettings().ParseJson(json[key]);
        } else {
          this[key as keyof this] = json[key] ?? this[key as keyof this];
        }
      }
    }
    if (this.pickUpMaxDistance == null) {
      this.pickUpMaxDistance = 0
    }
  }
}
