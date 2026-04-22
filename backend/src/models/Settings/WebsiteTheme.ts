import { integer } from "aws-sdk/clients/cloudfront";

export class ThemeSettings {
    headerStyle = ""
    footerStyle = ""
    productsGridStyle = "";
    productsListStyle = "";
    style: any = {};
    logoUrl = { dark: "", light: "" }
    homeBannerSubtitle = "";
    homeBannerURL = "";
    subHeaderDarkness = 66;
    subHeaderURL = "";
    aboutText = "";
    termsText = "";
    contactEmail = "";
    contactPhone = "";
    socialMedia: any[] = [];
    fonts: Font[] = [];
    sideBars: [] = []
    showChangeCurrency = false;
    homeSections: HomeSection[] = [];
    promotion: promotion | {} = {};
    presets: [] = [];
    viewOnly = false
    quickOrder = false
    homeBannerDarkness = 66;
    disableMenuDelivery = false;
    disableMenuPickup = false;
    disableScheduleOrder = false;
    disableShop = false;
    disablePayLater = false;
    processPaymentAfterAcceptance = false;
    hideMenuDeliveryButton = false;
    hideMenuPickupButton = false;
    hideAppointmentButton = false;
    hideShopButton = false;
    disableDelivery = false;
    disablePickup = false;
    hideOutOfStocks = false
    translation = {}
    ParseJson(json: any): void {
        for (const key in json) {

            if (key == "homeSections") {
                const sectionsTemp: HomeSection[] = [];
                let section: HomeSection;
                json[key].forEach((line: any) => {
                    section = new HomeSection();
                    section.ParseJson(line);
                    sectionsTemp.push(section);
                });
                this.homeSections = sectionsTemp;
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }

        }
    }
}

export class HomeSection {
    id = "";
    title = "";
    elementId = "";
    slug = "";
    style = "swipe";
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}

export class Font {
    id = "";
    title = ""
    links: any = {};
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}
export class ThemeMenuList {
    id = '';
    menuName = '';
    menuChilds: ThemeMenuItem[] = [];
    options: any = {};

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}



export class ThemeMenuItem {
    id: string = '';
    title: string = '';
    slug: string = '';
    index: integer = 0;
    customUrl: string = '';
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}
export class Widget {
    type = "" //example:priceFilter , sideBar 
    source = "" // refrence from themeSettings.sideBars.find((f)=>f.name == source) 
    filter: any;//depends on typefilte 
    // examplye when type = "price" => filter = {min:0,max:10}
    // when type =sizeFilter => filter =["small","m","l"]
    position = "" // left,right,top,bottom

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}
export class PageBuilder {
    pageName = "";
    slug = "";// '' home or 'shop'=> /shop,
    templateType = ""//[shop, staticPage],
    //example: when page is sales page to display onle items on sales 
    pageFilterType = ""//[tag,price,discounted]
    pageFilterSource = ""//[products,employees,branches,categories]
    pageFilters = []//
    pageContent = {
        sections: {
            sectionStyle: {},
            elements: [
                {
                    displayTemplate: "",//=> [slider, grid],
                    filterType: "",//[tag,price,discounted]
                    filterSource: "",//[products,employees,branches,categories]
                    filters: []
                }
            ] // array of objects 
        }
    }
    widgets = []

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}

export class Menus {
    name = "";
    list: any[] = [];
    options: any = {};

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}

export class WebsiteTheme {
    id = "";
    companyId = "";
    type = ""; //[PageBuilder,ThemeSettings,menu]  => one company => ONE WebSiteSettings AND  MANY PageBuilder
    template: any = {};
    isPrimaryMenu = false;
    isFooterMenu = false;
    isHomePage = false;
    translation = {}
    name = ""
    createdAt = new Date()
    constructor() {
    }
    ParseJson(json: any): void {
        for (const key in json) {


            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }

    set themeType(type: string) {
        this.type = type
        let temp;
        if (type == "PageBuilder") {
            temp = new PageBuilder();

        } else {
            temp = new ThemeSettings();

        }

        this.template = temp

    }
}

export class promotion {
    title = "";
    linkURL = "";
    ImageURL = "";
    description = "";
    showInHomeOnly: boolean = false;
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}


/** to convert old data to new website builder */
export class PageThemeSettings{
    "id"= "";
    "sectionName"= "";
    "sectionType"= "Text section";
    "sectionStyle"= "Style 2";
    "sectionData"= {
        "body": ""
      }
}

export class PageTheme{
    slug = "";
    sections:PageThemeSettings[ ] = []
}

export class MenuThemeSettings{
    "name"= "";
    "abbr"= "menu"; /**slug*/
    "uId"= ""
}
export class CustomMenuThemeSettings{
    "name"= "";
    "type"= "customUrl";
    "customUrl"= "https://gg.ss";
    "uId"= ""
}
export class MenuTheme{
    list:any[ ] = []
}