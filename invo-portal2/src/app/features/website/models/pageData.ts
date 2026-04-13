import { Footer, Header, LogoImage } from './theme-builder';
import { Background } from './backgroundPicker';

import { cleanForDb, isPlainObject } from './pageBuilderUtils';

export class PageData {
  id: string | any = '';
  pageName: string = '';
  name: string = '';
  slug = '';
  templateType = 'custom'; //menu , collection, shop , appointment , view-product , blog , table-reservation , custom
  isHomePage: boolean = false;
  isStatic: boolean = false;
  sections: Section[] = [];
  settings: any = {};

  constructor() {}

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

  toCleanJson() {
    const cleanedSections = this.sections
      .map((section) => section.toCleanJson())
      .filter((s) => s && Object.keys(s).length > 0);

    let temp: any = cleanForDb(this, new PageData());
    temp['sections'] = cleanedSections;
    temp['isStatic'] = this.isStatic;
    return temp;
  }
}

export class PageSections {
  content = new WebsiteContent();

  constructor() {}

  ParseJson(json: any): void {
    for (const key in json) {
      if (key == 'content') {
        const _data = new WebsiteContent();
        _data.ParseJson(json[key]);
        this[key] = _data;
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }

  toCleanJson() {
    const result: any = {};
    const defaultSections = new PageSections();

    const content = this.content?.toCleanJson();
    if (Object.keys(content).length > 0) result.content = content;

    return result;
  }
}

export class WebsiteContent {
  sections: Section[] = [];
  ParseJson(json: any): void {
    let temp;
    let _section: Section;
    for (const key in json) {
      if (key == 'sections') {
        this.sections = [];
        temp = json[key];

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

  toCleanJson() {
    const cleanedSections = this.sections
      .map((section) => section.toCleanJson())
      .filter((s) => s && Object.keys(s).length > 0);

    return cleanedSections.length > 0 ? { sections: cleanedSections } : {};
  }
}

export class Section {
  id: string = '';
  sectionName = '';
  sectionType = '';
  sectionStyle = '';
  sectionLayout = 1;
  sectionBackground = new Background();
  sectionWidth = 'Boxed'; // Boxed , Full
  sectionHeight = 'Auto'; // Auto , Full
  marginHorizontal = 0;
  marginVertical = 0;
  paddingHorizontal = 0;
  paddingVertical = 0;
  isShow = true;
  sectionData: any = {};
  animationOptions: AnimationOptions = new AnimationOptions();

  // for preview
  isSelected = false;

  constructor(data?: any) {
    if (data) {
      this.sectionData = data;
    }
  }

  parseType(obj: any) {
    console.log(obj.sectionType);
    try {
      let parsed: any;
      switch (obj.sectionType) {
        case 'Header':
          parsed = new Header();
          break;
        case 'Footer':
          parsed = new Footer();
          break;
        case 'Category collection':
          parsed = this.parseCategoryCollection(obj);
          break;
        case 'Product collection':
          parsed = this.parseProductCollection(obj);
          break;
        case 'Button section':
          parsed = this.parseButtonsSection(obj);
          break;
        default:
          console.warn(`Unknown section type: ${obj.sectionType}`);
          return null;
      }

      if (parsed) {
        parsed.ParseJson(obj.sectionData);
      }

      return parsed;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  private parseCategoryCollection(obj: any): any {
    let parsed: any;
    parsed.ParseJson(obj);
    return parsed;
  }

  private parseProductCollection(obj: any): any {
    let parsed: any;
    switch (obj.sectionStyle) {


      default:
        console.warn(`Unknown section style: ${obj.sectionStyle}`);
        return null;
    }
    return parsed;
  }

  private parseButtonsSection(obj: any): any {
    let parsed: any;
    switch (obj.sectionStyle) {

      default:
        console.warn(`Unknown section style: ${obj.sectionStyle}`);
        return null;
    }
    return parsed;
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key == 'sectionBackground') {
        const _data = new Background();
        _data.ParseJson(json[key]);
        this[key] = _data;
      } else if (key == 'animationOptions') {
        const _data = new AnimationOptions();
        _data.ParseJson(json[key]);
        this[key] = _data;
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }

    // Parse the sectionData if it exists
    if (json.sectionData) {
      const parsedSection = this.parseType(json);
      console.log(json);
      if (parsedSection) {
        this.sectionData = parsedSection;
      }
    }
  }

  toCleanJson() {
    let x =  cleanForDb(this, new Section());
    x['isShow'] = this.isShow;
    return x;
  }
}
export class AnimationOptions {
  name = 'fadeIn';
  duration = '1.2s';
  delay = '';

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
// export class SectionPadding {
//   top = 0;
//   bottom = 0;
//   left = 0;
//   right = 0;
//   ParseJson(json: any): void {
//     for (const key in json) {
//       if (key in this) {
//         this[key as keyof typeof this] = json[key];
//       }
//     }
//   }
// }

// export class SectionMargin {
//   top = 0;
//   bottom = 0;
//   left = 0;
//   right = 0;
//   ParseJson(json: any): void {
//     for (const key in json) {
//       if (key in this) {
//         this[key as keyof typeof this] = json[key];
//       }
//     }
//   }
// }
