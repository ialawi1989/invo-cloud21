import { ThemeBuilder } from './theme-builder';
import { Translation } from '../.././../core/models/translation';
import { FormsList } from './forms';
import { MobileIconBarList } from './mobileIconBar';
import { NavigationList } from './navigation-list';
import { cleanForDb, deepEquals } from './pageBuilderUtils';
import { PageData } from './pageData';
import { ContentLibraryTemplate, ContentItemTemplate } from '../content-library/models/content-library.model';

export class Website {
  id: any = '';
  companyId = '';
  name = '';
  type = ''; //[Page,WebSiteSettings,Menu,CmsCollection,CmsItem]
  template: any;
  isPrimaryMenu?: boolean = false;
  isFooterMenu?: boolean = false;
  isHomePage?: boolean = false;

  translation = new Translation();

  ParseJson(json: any): void {
    for (const key in json) {
      if (key == 'template') {
        if (json['type'] == 'Page' || json['type'] == 'StaticPage') {
          let temp = new PageData();
          temp.ParseJson(json[key]);
          this[key] = temp;
        } else if (json['type'] == 'ThemeSettings') {
          let temp = new ThemeBuilder();
          temp.ParseJson(json[key]);
          this[key] = temp;
        } else if (json['type'] == 'Menus') {
          let temp = new NavigationList();
          temp.ParseJson(json[key]);
          this[key] = temp;
        } else if (json['type'] == 'MobileIconBar') {
          let temp = new MobileIconBarList();
          temp.ParseJson(json[key]);
          this[key] = temp;
        } else if (json['type'] == 'Forms') {
          let temp = new FormsList();
          temp.ParseJson(json[key]);
          this[key] = temp;
        } else if (json['type'] == 'ContentLibrary') {
          let temp = new ContentLibraryTemplate();
          temp.ParseJson(json[key]);
          this[key] = temp;
        } else if (json['type'] == 'ContentItem') {
          let temp = new ContentItemTemplate();
          temp.ParseJson(json[key]);
          this[key] = temp;
        }
      } else {
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
      }
    }
  }

  toCleanJson(): any {
    const defaultWebsite = new Website();
    const result: any = {};

    for (const key in this) {
      const value = this[key as keyof Website];
      const defaultValue = defaultWebsite[key as keyof Website];

      if (key === 'template') {
        let cleanedTemplate: any;

        if ((this.type === 'Page' || this.type === 'StaticPage') && typeof this.template?.toCleanJson === 'function') {
          cleanedTemplate = this.template.toCleanJson();
        } else if (this.type === 'ThemeSettings') {
          cleanedTemplate = cleanForDb(this.template, new ThemeBuilder());
        } else if (this.type === 'Menus') {
          cleanedTemplate = cleanForDb(this.template, new NavigationList());
        } else if (this.type === 'MobileIconBar') {
          cleanedTemplate = cleanForDb(this.template, new MobileIconBarList());
        } else if (this.type === 'Forms') {
          cleanedTemplate = cleanForDb(this.template, new FormsList());
        } else if (this.type === 'ContentLibrary') {
          cleanedTemplate = typeof this.template?.toJson === 'function'
            ? this.template.toJson()
            : this.template;
        } else if (this.type === 'ContentItem') {
          cleanedTemplate = typeof this.template?.toJson === 'function'
            ? this.template.toJson()
            : this.template;
        }

        if (cleanedTemplate && Object.keys(cleanedTemplate).length > 0) {
          result.template = cleanedTemplate;
        }
      } else {
        if (
          value !== null &&
          value !== undefined &&
          value !== '' &&
          !deepEquals(value, defaultValue)
        ) {
          if (!(typeof value === 'object' && Object.keys(value).length === 0)) {
            result[key] = value;
          }
        }
      }
    }

    return result;
  }
}
