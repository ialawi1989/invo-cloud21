export class ThemeSettings {
    headerStyle = "headerStyle1";
    footerStyle = "footerStyle1";
    productsGridStyle = "productsGridStyle1";
    productsListStyle = "productsListStyle1";
    style: ThemeStyle = new ThemeStyle();
    logoUrl = { dark: "", light: "" };
    //---
    homeBannerURL = "";
    homeBannerDarkness = 66;
    homeBannerSubtitle = "";
    subHeaderURL = "";
    subHeaderDarkness = 66;

    hideCompanyName = false;
    hideHomeBanner = false;
    hideSubHeader = false;

    promotion = {
        title: "",
        linkURL :"",
        ImageURL :"",
        description :"",
        showInHomeOnly: false
    };
    translation = {
        homeBannerSubtitle:{},
        aboutText:{},
        termsText:{},
        promotionTitle: {},
        promotionDescription: {}
    };
    homeSections: ThemeHomeSectionItem[] = [];

    showChangeCurrency = false;
    hideOutOfStocks = false;
    viewOnly = false;
    quickOrder = false;
    disablePayLater = false;
    disableScheduleOrder = false;
    processPaymentAfterAcceptance = false;
    allowDeliveryOrderIfTotalBranchesHasStock = false;

    hideMenuDeliveryButton = false;
    hideMenuPickupButton = false;
    hideShopButton = false;
    hideAppointmentButton = false;
    disableDelivery = false;
    disablePickup = false;
    //---
    socialMedia: SocialMediaItem[] = [];
    sideBars: any[] = [];
    fonts: Font[] = [];
    presets: any[] = []; //TODO: save sections as presets
    //---
    aboutText:string = "";
    termsText:string = "";
    contactEmail:string = "";
    contactPhone:string = "";
    subheader_settings:any = "";
    enable_schedule_order:any = true;
    start_day_for_schedule_order:any = ""
    disable_pay_later= false;
    disable_pay_later_for:any[] = [];

    constructor() {
    }

    removeSocialItem(social: SocialMediaItem) {
        let index = this.socialMedia.findIndex(f => f == social)
        this.socialMedia.splice(index, 1);
    }


    ParseJson(json: any): void {

        let _social: SocialMediaItem;
        let temp;

        for (const key in json) {
            if (key == "socialMedia") {
                this.socialMedia = [];
                temp = json[key];

                for (const propName in temp) {
                    _social = new SocialMediaItem();
                    _social.ParseJson(temp[propName]);
                    this.socialMedia.push(_social);
                }
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }


        }
    }
}

export class ThemeMenuList {
    id = '';
    menuName = '';
    menuChilds: ThemeMenuItem[] = [];
    options: ThemeMenuOptions = new ThemeMenuOptions();
    // for preview
    isChanged: boolean = false;

    constructor() {
    }

    removeMenuItem(menuId: string) {
        let index = this.menuChilds.findIndex(f => f.id == menuId)
        this.menuChilds.splice(index, 1);
    }

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }

        let _menuChild: ThemeMenuItem;
        let temp;

        for (const key in json) {
            if (key == "menuChilds") {
                this.menuChilds = [];
                temp = json[key];

                for (const propName in temp) {
                    _menuChild = new ThemeMenuItem();
                    _menuChild.ParseJson(temp[propName]);
                    if (_menuChild.id == '')
                        _menuChild.id = 'menuChild_' + (this.menuChilds.length + 1);
                    this.menuChilds.push(_menuChild);
                }
            } else if (key == "options") {
                const _thiemeMenuOption = new ThemeMenuOptions();
                _thiemeMenuOption.ParseJson(json[key])
                this[key] = _thiemeMenuOption
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }


        }
    }
}

export class ThemeMenuOptions {
    isPrimaryMenu: boolean = false;
    isFooterMenu: boolean = false;

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}

export class ThemeStyle {
    primaryColor: string = '';
    secondaryColor: string = '';
    fontFamily: FontFamily = new FontFamily();
    heading: HeadingStyle = new HeadingStyle();
    paragraph: ParagraphStyle = new ParagraphStyle();

    constructor() {
        this.heading = new HeadingStyle();
        this.paragraph = new ParagraphStyle();
    }

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}

export class FontFamily {
    fontFamily1: string = "";
    fontFamily2: string = "";
    fontFamily3: string = "";
    fontFamily4: string = "";

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}

export class HeadingStyle {
    heading1: TextProps = new TextProps();
    heading2: TextProps = new TextProps();
    heading3: TextProps = new TextProps();
    heading4: TextProps = new TextProps();
    heading5: TextProps = new TextProps();
    heading6: TextProps = new TextProps();

    constructor() {
        this.heading2.fontSize = 24;
        this.heading3.fontSize = 20;
        this.heading4.fontSize = 18;
        this.heading5.fontSize = 16;
        this.heading6.fontSize = 14;
    }

    ParseJson(json: any): void {
        let _heading1: TextProps;
        let _heading2: TextProps;
        let _heading3: TextProps;
        let _heading4: TextProps;
        let _heading5: TextProps;
        let _heading6: TextProps;
        let temp;
        for (const key in json) {
            if (key == "heading1") {
                temp = json[key];

                for (const propName in temp) {
                    _heading1 = new TextProps();
                    _heading1.fontSize = 32;
                    this.heading1 = _heading1;
                }
            }

            if (key == "heading2") {
                temp = json[key];

                for (const propName in temp) {
                    _heading2 = new TextProps();
                    _heading2.fontSize = 24;
                    this.heading2 = _heading2;
                }
            }

            if (key == "heading3") {
                temp = json[key];

                for (const propName in temp) {
                    _heading3 = new TextProps();
                    _heading3.fontSize = 20;
                    this.heading3 = _heading3;
                }
            }

            if (key == "heading4") {
                temp = json[key];

                for (const propName in temp) {
                    _heading4 = new TextProps();
                    _heading4.fontSize = 18;
                    this.heading4 = _heading4;
                }
            }

            if (key == "heading5") {
                temp = json[key];

                for (const propName in temp) {
                    _heading5 = new TextProps();
                    _heading5.fontSize = 16;
                    this.heading5 = _heading5;
                }
            }

            if (key == "heading6") {
                temp = json[key];

                for (const propName in temp) {
                    _heading6 = new TextProps();
                    _heading6.fontSize = 14;
                    this.heading6 = _heading6;
                }
            }

        }
    }
}

export class ParagraphStyle {
    paragraph1: TextProps = new TextProps();
    paragraph2: TextProps = new TextProps();
    paragraph3: TextProps = new TextProps();
    paragraph4: TextProps = new TextProps();

    constructor() {
        this.paragraph1.fontSize = 16;
        this.paragraph2.fontSize = 16;
        this.paragraph3.fontSize = 16;
        this.paragraph4.fontSize = 16;
    }

    ParseJson(json: any): void {
        let _paragraph1: TextProps;
        let _paragraph2: TextProps;
        let _paragraph3: TextProps;
        let _paragraph4: TextProps;
        let temp;
        for (const key in json) {
            if (key == "paragraph1") {
                temp = json[key];

                for (const propName in temp) {
                    _paragraph1 = new TextProps();
                    _paragraph1.fontSize = 16;
                    this.paragraph1 = _paragraph1;
                }
            }

            if (key == "paragraph2") {
                temp = json[key];

                for (const propName in temp) {
                    _paragraph2 = new TextProps();
                    _paragraph2.fontSize = 16;
                    this.paragraph2 = _paragraph2;
                }
            }

            if (key == "paragraph3") {
                temp = json[key];

                for (const propName in temp) {
                    _paragraph3 = new TextProps();
                    _paragraph3.fontSize = 16;
                    this.paragraph3 = _paragraph3;
                }
            }

            if (key == "paragraph4") {
                temp = json[key];

                for (const propName in temp) {
                    _paragraph4 = new TextProps();
                    _paragraph4.fontSize = 16;
                    this.paragraph4 = _paragraph4;
                }
            }

        }
    }
}

export class TextProps {
    color: string = "#000000";
    //spacing
    padding: any = { top: 0, bottom: 0, left: 0, right: 0 };
    margin: any = { top: 18, bottom: 18, left: 0, right: 0 };
    //typography
    fontFamily: string = "";
    fontSize: number = 32;
    textAlign: string = "left";
    textStyle: any = { bold: false, italic: false, underlined: false, lineThrough: false };
    lineHeight: number = 1;
    letterSpacing: number = 0;
    textTransform: any = "";
    //background
    background: string = "";
    backgroundImage: string = "";
    //border
    borderStyle: string = "solid";
    borderColor: any = { top: "#000000", bottom: "#000000", left: "#000000", right: "#000000" };
    borderThick: any = { top: 0, bottom: 0, left: 0, right: 0 };
    borderRadius: any = { top: 0, bottom: 0, left: 0, right: 0 };
    //advanced
    customCss: any;

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}

export class MenusTheme{
    menus :ThemeMenuList[] = [];
    ParseJson(json: any): void {
        for (const key in json) {
          let menuTemps:ThemeMenuList[]=[]
          let menu = new ThemeMenuList();
          json['menus'].forEach((element:any) => {
            menu.ParseJson(element);
            menuTemps.push(menu)
          });
          this.menus = menuTemps
        }
    }
}

//

export class ThemeMenuItem {
    id: string = '';
    parentId: string = '';
    title: string = '';
    slug: string = '';
    type: string = '';
    customUrl: string = '';
    elementId: string = '';
    children: any = [];

    //for preview only
    isCollapsed: boolean = true;


    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
    }

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}

export class ThemeHomeSectionItem {
    id: string = '';
    title: string = '';
    type: string = '';
    style: string = 'swipe';
    slug: string = '';
    elementId: string = '';
    //for preview only
    isCollapsed: boolean = true;
    backgroundImageUrl:string = "";
    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}

export class Widget {
    id = "";
    title: string = "";
    type = "" //example:priceFilter , sideBar
    source = "" // refrence from themeSettings.sideBars.find((f)=>f.name == source)
    filter: any = { minValue: 0, maxValue: 999 }; //depends on typefilte
    // examplye when type = "price" => filter = {min:0, max:10}
    // when type =sizeFilter => filter =["small","m","l"]
    position = "" // left,right,top,bottom

    isCollapsed: boolean = false; // for preview
    // for preview
    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
    }

    removeThisWidget(widgets: any) {
        const index = widgets.indexOf(this);
        if (index !== -1) {
            widgets.splice(index, 1);
        }
    }

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
    //example: when page is sales page to display only items on sales
    pageFilterType = ""//[tag,price,discounted]
    pageFilterSource = ""//[products,employees,branches,categories]
    pageFilters = [] //
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
    widgets = [];
    parentPageId = "";

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
    type = ""; //[PageBuilder,WebSiteSettings,Menu]  => one company => ONE WebSiteSettings AND  MANY PageBuilder
    template: any;
    ParseJson(json: any): void {
        for (const key in json) {

            if (key == "template") {
                if (json['type'] == "PageBuilder") {
                    let temp = new PageBuilder();
                    temp.ParseJson(json[key]);
                    this[key] = temp
                } else if (json['type'] == "ThemeSettings") {
                    let temp = new ThemeSettings();
                    temp.ParseJson(json[key]);
                    this[key] = temp
                } else if (json['type'] == "Menus") {
                    let temp = new MenusTheme();
                    temp.ParseJson(json[key]);
                    this[key] = temp
                }

            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }
        }
    }
}


export class SocialMediaItem {
    url: string = '';
    icon: string = '';

    //for preview only
    isCollapsed: boolean = true;

    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
    }

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
    links: any = {}
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}
