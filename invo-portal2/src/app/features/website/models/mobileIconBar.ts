
import { Translation } from '../.././../core/models/translation';

export class MobileIconBarOptions {
  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class MobileIconBarItem {
  index: number = 0;
  name: string = '';
  translation: Translation = new Translation();
  uId: string;
  slug: string = '';
  enabled: boolean = false;
  icon: string = '';

  constructor() {
    this.uId = crypto.randomUUID();
  }

  ParseJson(json: any): void {
    let temp;
    for (const key in json) {
      if (key == 'translation') {
        const _translation = new Translation();
        _translation.ParseJson(json[key]);
        this[key] = _translation;
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class MobileIconBarList {
  id = '';
  name = '';
  options: MobileIconBarOptions = new MobileIconBarOptions();
  list: MobileIconBarItem[] = [];



  ParseJson(json: any): void {
    let _menuList: MobileIconBarItem;
    let temp;
    let index = 0;
    for (const key in json) {
      if (key == 'list') {
        this.list = [];
        temp = json[key];

        for (const propName in temp) {
          _menuList = new MobileIconBarItem();
          _menuList.ParseJson(temp[propName]);
          _menuList.index = index;
          this.list.push(_menuList);
          index++;
        }
      } else if (key == 'options') {
        const _thiemeMenuOption = new MobileIconBarOptions();
        _thiemeMenuOption.ParseJson(json[key]);
        this[key] = _thiemeMenuOption;
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
