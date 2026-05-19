import { Footer } from './footer';
import { Header } from './header';
import { BannerSectionStyle1 } from './widgets/banner-section/banner-section-style1';
import { BannerSectionStyle2 } from './widgets/banner-section/banner-section-style2';
import { BannerSectionStyle3 } from './widgets/banner-section/banner-section-style3';
import { BannerSectionStyle4 } from './widgets/banner-section/banner-section-style4';
import { BannerSectionStyle5 } from './widgets/banner-section/banner-section-style5';
import { BannerSectionStyle6 } from './widgets/banner-section/banner-section-style6';
import { BannerSectionStyle7 } from './widgets/banner-section/banner-section-style7';
import { BannerSectionStyle8 } from './widgets/banner-section/banner-section-style8';
import { ButtonsSectionStyle1 } from './widgets/buttons-section/buttons-section-style1';
import { ButtonsSectionStyle2 } from './widgets/buttons-section/buttons-section-style2';
import { CategoryCollectionStyle } from './widgets/category-collection/category-collection-style';
import { CategoryCollectionStyle1 } from './widgets/category-collection/category-collection-style1';
import { CategoryCollectionStyle2 } from './widgets/category-collection/category-collection-style2';
import { CategoryCollectionStyle3 } from './widgets/category-collection/category-collection-style3';
import { CategoryCollectionStyle4 } from './widgets/category-collection/category-collection-style4';
import { CategoryCollectionStyle5 } from './widgets/category-collection/category-collection-style5';
import { ProductCollectionStyle1 } from './widgets/product-collection/product-collection-style1';
import { ProductCollectionStyle2 } from './widgets/product-collection/product-collection-style2';
import { ProductCollectionStyle3 } from './widgets/product-collection/product-collection-style3';
import { ProductCollectionStyle4 } from './widgets/product-collection/product-collection-style4';
import { ProductCollectionStyle5 } from './widgets/product-collection/product-collection-style5';
import { RichTextStyle1 } from './widgets/rich-text/rich-text-style1';
import { RichTextStyle2 } from './widgets/rich-text/rich-text-style2';
import { RichTextStyle3 } from './widgets/rich-text/rich-text-style3';
import { CustomTextWidget } from './widgets/text/custom-text-widget';
import { TextWidget } from './widgets/text/text-widget';
import { getLogger } from '../../services/logger/logger.service';

export class PageData {
  id: string = "";
  name: string = "";
  template = new PageTemplate();

  constructor() {
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key == "template") {
        const _data = new PageTemplate();
        _data.ParseJson(json[key])
        this[key] = _data
      } else
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
    }
  }
}

interface PageSettings {
  sort_By?: string;
  page_limit?: string;
  default_view?: string;
  redirect_to_shop?: boolean;
  enforce_service_selection_on_menu_entry?: boolean;
}
export function isPlainObject(value: any): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export class PageTemplate {
  slug: string = "";
  isHomePage: boolean = false;
  sections :Section[]=[];
  settings: PageSettings = {}

  ParseJson(json: any): void {
    let temp;
    let _section: Section;
    for (const key in json) {
      if (key == 'sections') {
        this.sections = [];
        temp = json[key];
        if(isPlainObject(temp)){
          temp = temp['content']['sections']
        }
        for (const propName in temp) {
          _section = new Section();
          _section.ParseJson(temp[propName]);
          this.sections.push(_section);
        }
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class PageSections {
  header = new WebsiteHeader();
  content = new WebsiteContent();
  footer = new WebsiteFooter()

  ParseJson(json: any): void {
    for (const key in json) {
      if (key == "header") {
        const _data = new WebsiteHeader();
        _data.ParseJson(json[key])
        this[key] = _data
      } else if (key == "content") {
        const _data = new WebsiteContent();
        _data.ParseJson(json[key])
        this[key] = _data
      } else if (key == "footer") {
        const _data = new WebsiteFooter();
        _data.ParseJson(json[key])
        this[key] = _data
      } else
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
    }
  }
}

export class WebsiteHeader {
  sections: Section[] = [];
  ParseJson(json: any): void {
    let _section: Section;
    let temp;
    for (const key in json) {
      if (key == "sections") {
        this.sections = [];
        temp = json[key];
        for (const propName in temp) {
          _section = new Section();
          _section.ParseJson(temp[propName]);
          this.sections.push(_section);
        }
      } else
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
    }
  }
}

export class WebsiteContent {
  sections: Section[] = [];
  ParseJson(json: any): void {
    let _section: Section;
    let temp;
    for (const key in json) {
      if (key == "sections") {
        this.sections = [];
        temp = json[key];
        for (const propName in temp) {
          _section = new Section();
          _section.ParseJson(temp[propName]);
          this.sections.push(_section);
        }
      } else
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
    }
  }
}

export class WebsiteFooter {
  sections: Section[] = [];
  ParseJson(json: any): void {
    let _section: Section;
    let temp;
    for (const key in json) {
      if (key == "sections") {
        this.sections = [];
        temp = json[key];
        for (const propName in temp) {
          _section = new Section();
          _section.ParseJson(temp[propName]);
          this.sections.push(_section);
        }
      } else
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
    }
  }
}
export class AnimationOptions {
  name = "fadeIn";
  duration = "1.2s";
  delay = "";

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
export class Background {
  style: string | null = "Color";
  defaultColor = "";
  defaultPattern = "";
  defaultImage = new LogoImage();
  overlayOpacity = 0;
  overlayColor = "#000";
  youtubeUrl = "";
  isParallax = false;
  ParseJson(json: any): void {
    for (const key in json) {
      if (key == "defaultImage") {
        const _image = new LogoImage();
        _image.ParseJson(json[key])
        this[key] = _image
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class LogoImage {
  mediaId: string = "";
  defaultUrl: string = "";
  thumbnailUrl: string = "";
  width: number = 0;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class Section {

  id: string = "";
  sectionName = "";
  sectionType = "";
  sectionStyle = "";
  sectionBackground = new Background();
  sectionWidth = "Boxed"; // Boxed , Full
  sectionHeight = "Auto"; // Auto , Full
  sectionHeightSize = "200";
  marginHorizontal = 0;
  marginVertical = 0;
  paddingHorizontal = 0;
  paddingVertical = 0;
  isShow = true;
  sectionData: any;
  defaultHeight = 350
  animationOptions: AnimationOptions = new AnimationOptions()

  // for preview
  show = false

  constructor() {
    this.show = false
  }

  parseType(obj: any) {
    try {
      let parsed: any;
      switch (obj.sectionType) {
        case "Banner section":
          parsed = this.parseBanner(obj);
          break;
        case "Category collection":
          parsed = this.parseCategoryCollection(obj);
          break;
        case "Product collection":
          parsed = this.parseProductCollection(obj);
          break;
        case "Rich text section":
          parsed = this.parseRichText(obj);
          break;
        case "Buttons section":
          parsed = this.parseButtonsSection(obj);
          break;
        case "Text section":
          parsed = this.parseTextSection(obj);
          break;
          default:
          console.warn(`Unknown section type: ${obj.sectionType}`);
          return null;
      }

      if (parsed) {
        parsed.ParseJson(obj.sectionData);
      }

      return parsed;
    } catch (error: any) {
      getLogger()?.error(error?.message, { stack: error?.stack, context: 'PageData.parseSection' });
      return null;
    }
  }

  private parseRichText(obj: any): any {
    let parsed: any;
    switch (obj.sectionStyle) {
      case "Style 1":
        parsed = new RichTextStyle1();
        break;
      case "Style 2":
        parsed = new RichTextStyle2();
        break;
      case "Style 3":
        parsed = new RichTextStyle3();
        break;
      default:
        console.warn(`Unknown section style: ${obj.sectionStyle}`);
        return null;
    }
    return parsed;
  }

  private parseButtonsSection(obj: any): any {
    let parsed: any;
    switch (obj.sectionStyle) {
      case "Style 1":
        parsed = new ButtonsSectionStyle1();
        break;
      case "Style 2":
        parsed = new ButtonsSectionStyle2();
        break;
      default:
        console.warn(`Unknown section style: ${obj.sectionStyle}`);
        return null;
    }
    return parsed;
  }

  private parseTextSection(obj: any): any {
    let parsed: any;
    switch (obj.sectionStyle) {
      case "Style 1":
        parsed = new TextWidget();
        break;
      case "Style 2":
        parsed = new CustomTextWidget();
        break;
      default:
        console.warn(`Unknown section style: ${obj.sectionStyle}`);
        return null;
    }
    return parsed;
  }


  private parseBanner(obj: any): any {
    let parsed: any;
    switch (obj.sectionStyle) {
      case "Style 1":
        parsed = new BannerSectionStyle1();
        break;
      case "Style 2":
        parsed = new BannerSectionStyle2();
        break;
      case "Style 3":
        parsed = new BannerSectionStyle3();
        break;
      case "Style 4":
        parsed = new BannerSectionStyle4();
        break;
      case "Style 5":
        parsed = new BannerSectionStyle5();
        break;
      case "Style 6":
        parsed = new BannerSectionStyle6();
        break;
      case "Style 7":
        parsed = new BannerSectionStyle7();
        break;
      case "Style 8":
        parsed = new BannerSectionStyle8();
        break;
      default:
        console.warn(`Unknown section style: ${obj.sectionStyle}`);
        return null;
    }
    return parsed;
  }

  private parseCategoryCollection(obj: any): any {
    let parsed: any;
    switch (obj.sectionStyle) {
      case "Style 1":
        parsed = new CategoryCollectionStyle();
        break;
      case "Style 2":
        parsed = new CategoryCollectionStyle();
        break;
      case "Style 3":
        parsed = new CategoryCollectionStyle();
        break;
      case "Style 4":
        parsed = new CategoryCollectionStyle();
        break;
      case "Style 5":
        parsed = new CategoryCollectionStyle();
        break;
      default:
        console.warn(`Unknown section style: ${obj.sectionStyle}`);
        return null;
    }
    return parsed;
  }

  private parseProductCollection(obj: any): any {
    let parsed: any;
    switch (obj.sectionStyle) {
      case "Style 1":
        parsed = new ProductCollectionStyle1();
        break;
      case "Style 2":
        parsed = new ProductCollectionStyle2();
        break;
      case "Style 3":
        parsed = new ProductCollectionStyle3();
        break;
      case "Style 4":
        parsed = new ProductCollectionStyle4();
        break;
      case "Style 5":
        parsed = new ProductCollectionStyle5();
        break;

      default:
        console.warn(`Unknown section style: ${obj.sectionStyle}`);
        return null;
    }
    return parsed;
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key == "sectionBackground") {
        const _data = new Background();
        _data.ParseJson(json[key])
        this[key] = _data
      } else if (key == "animationOptions") {
        const _data = new AnimationOptions();
        _data.ParseJson(json[key])
        this[key] = _data
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }

      // Parse the sectionData if it exists
      if (json.sectionData) {
        const parsedSection = this.parseType(json);
        if (parsedSection) {
          this.sectionData = { ...parsedSection };
        }
      }
    }
    if (this.show == null || this.show == undefined) {
      this.show = false
    }


  }
}

export class SectionPadding {
  top = 0;
  bottom = 0;
  left = 0;
  right = 0;
  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class SectionMargin {
  top = 0;
  bottom = 0;
  left = 0;
  right = 0;
  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}



