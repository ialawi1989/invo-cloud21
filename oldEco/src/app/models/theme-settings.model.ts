import { BrandInformation } from "./page-data/footer";
import { LogoImage } from "./page-data/pageData";

export class ThemeSettings {
  id: string = "";
  companyId: string = "";
  type: string = "";
  template: any = {};
  parentId?: string;

  ParseJson(json: any): ThemeSettings {
    for (const key in json) {
      if (key in this) {
        this[key as keyof this] = json[key] ?? this[key as keyof this];
      }
    }
    return this;
  }

  toMap(): { [key: string]: any } {
    return {
      id: this.id,
      companyId: this.companyId,
      type: this.type,
      template: this.template,
      parentId: this.parentId,
    };
  }
}

  
  
  export class Header {
    style: string = "Style 1";
    menuId: string = "";
    menuAlignment = "Left";
    backgroundColor = "#ffffff";
    headerColor = "#ffffff"
    textColor = "#000000";
    menuBackgroundColor= "#222222";
    menuTextColor= "#ffffff";
    enabledOverlay = false;
    overlayTextColor = "#fff";
    borderBottomThickness = 1;
    menuBorderBottomThickness = 1;
    logo: LogoImage = new LogoImage();
    logoWidth:number = 100;
    showWelcomeMessage:boolean = true;
    showChangeCurrency:boolean = true;
    showChangeLanguage:boolean = true;
    showContactPhone:boolean = true;
    showWishList:boolean = true;

    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "logo") {
                const _light = new LogoImage();
                _light.ParseJson(json[key])
                this[key] = _light
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }
        }
    }
}


export class Footer {
  style: string = "Style 1";
  backgroundColor: string = "#222";
  textColor:string = "#ffffff";
  brandInformation: BrandInformation = new BrandInformation();
  logo: LogoImage = new LogoImage();
  logoWidth:number = 100;
  showContactInfo:boolean = false;
  showTopLink:boolean = false;
  showQuickLink:boolean = false;
  showCopyRightsReserved:boolean = true;

  ParseJson(json: any): void {
      for (const key in json) {
          if (key == "logo") {
              const _light = new LogoImage();
              _light.ParseJson(json[key])
              this[key] = _light
          } else {
              if (key in this) {
                  this[key as keyof typeof this] = json[key];
              }
          }
      }
  }
}
