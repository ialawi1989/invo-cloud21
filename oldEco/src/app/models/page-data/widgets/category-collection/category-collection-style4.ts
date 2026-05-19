import * as uuid from 'uuid';
import { LogoImage } from '../../pageData';

export class CategoryCollectionStyle4 {
  title = "";
  titleColor = "#000";
  subtitle = "";
  subtitleColor = "#000";
  categories: CollectionCategoryStyle4[] = [];
  translation:any = {};

  addCollectionCategoryStyle4() {
    this.categories.push(new CollectionCategoryStyle4());
  }

  ParseJson(json: any): void {
    let _data: CollectionCategoryStyle4;
    let temp;
    for (const key in json) {
      if (key === "categories") {
        this.categories = [];
        temp = json[key];

        // Limit categories to 4 items
        const limit = Math.min(temp.length, 4); // Ensure we don't exceed the available items
        for (let i = 0; i < limit; i++) {
          _data = new CollectionCategoryStyle4();
          _data.ParseJson(temp[i]);
          this.categories.push(_data);
        }
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class CollectionCategoryStyle4 {
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

