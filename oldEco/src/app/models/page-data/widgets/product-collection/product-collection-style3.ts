import * as uuid from 'uuid';
import { LogoImage } from '../../pageData';

export class ProductCollectionStyle3 {
  title = "";
  titleColor = "#000";
  collectionId = "";
  collectionSlug = "";
  collectionStyle = "Style 1";
  products: CollectionProductStyle3[] = [];
  introMedia = new LogoImage();
  translation:any = {};

  addCollectionProductStyle3() {
    this.products.push(new CollectionProductStyle3());
  }

  ParseJson(json: any): void {
    let _data: CollectionProductStyle3;
    let temp;
    for (const key in json) {
      if (key == "introMedia") {
        const _data = new LogoImage();
        _data.ParseJson(json[key])
        this[key] = _data
      } else if (key === "products") {
        this.products = [];
        temp = json[key];

        // Limit products to 4 items
        // const limit = Math.min(temp.length, 4); // Ensure we don't exceed the available items
        // for (let i = 0; i < limit; i++) {
        //   _data = new CollectionProductStyle3();
        //   _data.ParseJson(temp[i]);
        //   this.products.push(_data);
        // }
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}


export class CollectionProductStyle3 {
  id = "";
  productId = "";
  url = "";
  mediaUrl: LogoImage = new LogoImage();
  name = "";
  price = 0;

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
