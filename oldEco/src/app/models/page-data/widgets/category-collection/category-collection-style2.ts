
import * as uuid from 'uuid';
import { LogoImage } from '../../pageData';

export class CategoryCollectionStyle2 {
  title = "";
  titleColor = "#000";
  categoryData1 = new CollectionCategory1Style2();
  categoryData2 = new CollectionCategory2Style2();
  categoryData3 = new CollectionCategory3Style2();
  translation:any = {};

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}


export class CollectionCategory1Style2 {
  id = "";
  categoryId = "";
  departmentId = "";
  url = "";
  mediaUrl: LogoImage = new LogoImage();
  title = "";

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

export class CollectionCategory2Style2 {
  id = "";
  categoryId = "";
  departmentId = "";
  url = "";
  mediaUrl: LogoImage = new LogoImage();
  title = "Category";

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

export class CollectionCategory3Style2 {
  id = "";
  categoryId = "";
  departmentId = "";
  url = "";
  mediaUrl: LogoImage = new LogoImage();
  title = "Category";

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