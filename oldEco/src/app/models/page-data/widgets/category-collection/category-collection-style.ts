import * as uuid from 'uuid';
import { LogoImage } from '../../pageData';

export class CategoryCollectionStyle {
  
  title = "";
  titleColor = "#000";
  categories: CollectionCategoryStyle[] = [];
  settings: any = {};
  translation:any = {};


  ParseJson(json: any): void {
    let _data: CollectionCategoryStyle;
    let temp;
    for (const key in json) {
      if (key === "categories") {
        this.categories = [];
        temp = json[key];        
     
        for (const propName in temp) {
          _data = new CollectionCategoryStyle();
          _data.ParseJson(temp[propName]);
          this.categories.push(_data);
        }
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class CollectionCategoryStyle {
  id = "";
  categoryId = "";
  departmentId = "";
  url = "";
  mediaUrl: LogoImage = new LogoImage();
  name = "";
  translation:any = {};

  constructor() {
    this.id = uuid.v4()
  }
  ParseJson(json: any): void {
    for (const key in json) {
      if (key == "mediaUrl") {
        const _image = new LogoImage();
        _image.ParseJson(json[key])
        this[key] = _image
      } else
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
    }
  }
}

