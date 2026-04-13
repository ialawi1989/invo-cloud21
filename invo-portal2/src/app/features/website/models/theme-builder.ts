import { Background } from './backgroundPicker';
// import { ShippingOptions } from './shipping';

export class ThemeBuilder {
  websiteTitle: string = '';
  logos: ThemeLogo = new ThemeLogo();
  background: Background = new Background();
  schemes: Scheme[] = [];
  colors: Colors = new Colors();
  typography: Typography = new Typography();
  buttons: Buttons = new Buttons();
  inputs: Inputs = new Inputs();
  productCards: ProductCards = new ProductCards();
  media: Media = new Media();
  contactInformation: ContactInformation = new ContactInformation();
  socialmedia: SocialMedia = new SocialMedia();
  other: Other = new Other();
  layout: Layout = new Layout();
  header: Header = new Header();
  footer: Footer = new Footer();
  promotionBanners: PromotionBanner[] = [];
  // header:any = {};
  // footer:any = {};
  viewOnly = false;
  hideOutOfStocks = false;
  processPaymentAfterAcceptance = false;
  redirectMenuToShop = false;
  allowDeliveryOrderIfTotalBranchesHasStock = false;
  deliveryAreaType = "addresses"; //addresses or zones
  // shippingOptions : ShippingOptions = new ShippingOptions();
  googleAnalyticsId = "";
  facebookPixelId = "";
  tiktokPixelId="";
  showLocationPicker=true;
  promo:any={};
  enforceServiceSelection:boolean=false;
  serviceMenus:any={};

  resetThemeSettings(): void {
    this.logos = new ThemeLogo();
    this.background = new Background();
    this.schemes = [];
    this.typography = new Typography();
    this.buttons = new Buttons();
    this.inputs = new Inputs();
    this.productCards = new ProductCards();
    this.media = new Media();
    this.contactInformation = new ContactInformation();
    this.socialmedia = new SocialMedia();
    this.other = new Other();
    // this.shippingOptions = new ShippingOptions();
  }

  ParseJson(json: any): void {
    let temp;

    for (const key in json) {
      if (key == 'schemes') {
        this.schemes = [];
        temp = json[key];

        for (const propName in temp) {
          let _schemes = new Scheme();
          _schemes.ParseJson(temp[propName]);
          this.schemes.push(_schemes);
        }
      } else if (key == 'promotionBanners') {
        this.promotionBanners = [];
        temp = json[key];

        for (const propName in temp) {
          let _promotionBanners = new PromotionBanner();
          _promotionBanners.ParseJson(temp[propName]);
          this.promotionBanners.push(_promotionBanners);
        }
      } else if (key == 'logos') {
        const _themeLogo = new ThemeLogo();
        _themeLogo.ParseJson(json[key]);
        this[key] = _themeLogo;
      } else if (key == 'header') {
        const _header = new Header();
        _header.ParseJson(json[key]);
        this[key] = _header;
      } else if (key == 'footer') {
        const _footer = new Footer();
        _footer.ParseJson(json[key]);
        this[key] = _footer;
      }
      // else if (key == 'shippingOptions') {
      //   const _shOptions = new ShippingOptions();
      //   _shOptions.ParseJson(json[key]);
      //   this[key] = _shOptions;
      // }
      else {
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
      }
    }
  }
}

export class Scheme {
  background: string = 'ff0';
  backgroundGradient: string = '';
  textColor: string = '';
  solidButtonBg: string = '';
  solidButtonText: string = '';
  outlineBtn: string = '';
  shadow: string = '';
  colorHistory: string[] = [];

  //for display
  selectedToEdit = false;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class ThemeLogo {
  defaultLogo: LogoImage = new LogoImage();
  darkLogo: LogoImage = new LogoImage();
  brandMark: LogoImage = new LogoImage();

  ParseJson(json: any): void {
    for (const key in json) {
      if (key == 'defaultLogo') {
        const _light = new LogoImage();
        _light.ParseJson(json[key]);
        this[key] = _light;
      } else if (key == 'darkLogo') {
        const _light = new LogoImage();
        _light.ParseJson(json[key]);
        this[key] = _light;
      } else if (key == 'brandMark') {
        const _light = new LogoImage();
        _light.ParseJson(json[key]);
        this[key] = _light;
      } else {
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
      }
    }
  }
}

export class Typography {
  headingFontName: string = '';
  headingFontStyle: string = ''; //regular , bold , etc....
  headingFontSizeScale: number = 130;
  headingFontColor: string = '#000000';
  bodyFontName: string = '';
  bodyFontStyle: string = ''; //regular , bold , etc....
  bodyFontSizeScale: number = 100;
  bodyFontColor: string = '#000000';
  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class Buttons {
  backgroundColor: string = '#32acc1';
  fontColor: string = '#ffffff';
  fontSizeScale: number = 100;
  borderColor: string = '#000000';
  borderThickness: number = 0;
  borderOpacity: number = 100;
  borderCornerRadius: number = 6;
  shadowOpacity: number = 0;
  shadowHorizontalOffset: number = 0;
  shadowVerticalOffset: number = 4;
  shadowBlur: number = 5;
  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class Colors {
  primaryColor: string = '#000';
  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class Inputs {
  borderThickness: number = 1;
  borderBackground: string = '#ffffff';
  borderColor: string = '#cccccc';
  borderOpacity: number = 20;
  borderCornerRadius: number = 6;
  shadowOpacity: number = 0;
  shadowHorizontalOffset: number = 0;
  shadowVerticalOffset: number = 4;
  shadowBlur: number = 5;
  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class ProductCards {
  style: string = 'Standard'; //Standard , Card
  imagePadding: number = 0;
  textAlignment: string = 'Left'; //Left , Center , Right
  colorScheme: Scheme = new Scheme();
  borderBackground: string = '#ffffff';
  borderColor: string = '#dddddd';
  borderThickness: number = 1;
  borderOpacity: number = 100;
  borderCornerRadius: number = 0;
  shadowOpacity: number = 0;
  shadowHorizontalOffset: number = 0;
  shadowVerticalOffset: number = 4;
  shadowBlur: number = 5;
  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class Media {
  borderThickness: number = 0;
  borderOpacity: number = 100;
  borderCornerRadius: number = 0;
  shadowOpacity: number = 0;
  shadowHorizontalOffset: number = 0;
  shadowVerticalOffset: number = 4;
  shadowBlur: number = 5;
  defaultImage: LogoImage = new LogoImage();
  ParseJson(json: any): void {
    for (const key in json) {
      if (key == 'defaultImage') {
        const _light = new LogoImage();
        _light.ParseJson(json[key]);
        this[key] = _light;
      } else {
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
      }
    }
  }
}

export class ContactInformation {
  phone: string = '';
  whatsapp:string = '';
  email: string = '';
  fax: string = '';
  address: string = '';
  workingHours: string = '';

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class Header {
  style: string = 'Style 1';
  menuId: string = '';
  menuAlignment = 'Left';
  backgroundColor = '#ffffff';
  textColor = '#000000';
  menuBackgroundColor = '#222222';
  menuTextColor = '#ffffff';
  borderBottomThickness = 1;
  menuBorderBottomThickness = 1;
  logo: LogoImage = new LogoImage();
  logoWidth: number = 100;
  showWelcomeMessage: boolean = true;
  showChangeCurrency: boolean = true;
  showChangeLanguage: boolean = true;
  showContactPhone: boolean = true;
  showWishList: boolean = true;
  ParseJson(json: any): void {
    for (const key in json) {
      if (key == 'logo') {
        const _light = new LogoImage();
        _light.ParseJson(json[key]);
        this[key] = _light;
      } else {
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
      }
    }
  }
}

export class Footer {
  style: string = 'Style 1';
  backgroundColor: string = '#222';
  textColor: string = '#ffffff';
  brandInformation: BrandInformation = new BrandInformation();
  logo: LogoImage = new LogoImage();
  logoWidth: number = 100;
  showContactInfo: boolean = false;
  showTopLink: boolean = false;
  showQuickLink: boolean = false;
  showCopyRightsReserved: boolean = true;
  ParseJson(json: any): void {
    for (const key in json) {
      if (key == 'logo') {
        const _light = new LogoImage();
        _light.ParseJson(json[key]);
        this[key] = _light;
      } else {
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
      }
    }
  }
}

export class BrandInformation {
  headline: string = '';
  description: string = '';
  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class PromotionBanner {
  title = '';
  linkURL = '';
  ImageURL = '';
  description = '';
  showInHomeOnly = false;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class SocialMedia {
  facebook: string = '';
  instagram: string = '';
  youtube: string = '';
  tiktok: string = '';
  x: string = '';
  snapchat: string = '';
  pinterest: string = '';
  tumblr: string = '';
  vimeo: string = '';
  whatsapp:string = '';
  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class Other {
  allowCart: boolean = true;
  allowLogin: boolean = true;
  allowChangeLanguage: boolean = true;
  allowChangeCurrency: boolean = true;
  // disableScheduleOrder: boolean = false;
  signInMandatory: boolean = false;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class Layout {
  width: string = 'Boxed';

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class LogoImage {
  mediaId: string = '';
  defaultUrl: string = '';
  thumbnailUrl: string = '';
  width: number = 0;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
