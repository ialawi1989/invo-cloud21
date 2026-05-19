import * as uuid from 'uuid';
import { LogoImage } from '../../pageData';

export class ProductCollectionStyle5 {

  title1 = " ";
  title1Color = "#000";
  title2 = "";
  title2Color = "#000";
  title3 = "";
  title3Color = "#000";
  collectionSlug1 = "";
  collectionSlug2 = "";
  collectionSlug3 = "";
  products1: CollectionProductStyle5[] = [];
  products2: CollectionProductStyle5[] = [];
  products3: CollectionProductStyle5[] = [];
  translation:any = {};

  addCollectionProductStyle5prods1() {
    this.products1.push(new CollectionProductStyle5());
  }
  addCollectionProductStyle5prods2() {
    this.products2.push(new CollectionProductStyle5());
  }
  addCollectionProductStyle5prods3() {
    this.products3.push(new CollectionProductStyle5());
  }

  ParseJson(json: any): void {
    let _data: CollectionProductStyle5;
    let temp;
    for (const key in json) {
      // if (key === "products1") {
      //   this.products1 = [];
      //   temp = json[key];
      //   // Limit products to 4 items
      //   const limit = Math.min(temp.length, 3); // Ensure we don't exceed the available items
      //   for (let i = 0; i < limit; i++) {
      //     _data = new CollectionProductStyle5();
      //     _data.ParseJson(temp[i]);
      //     this.products1.push(_data);
      //   }
      // } else if (key === "products2") {
      //   this.products2 = [];
      //   temp = json[key];
      //   // Limit products to 4 items
      //   const limit = Math.min(temp.length, 4); // Ensure we don't exceed the available items
      //   for (let i = 0; i < limit; i++) {
      //     _data = new CollectionProductStyle5();
      //     _data.ParseJson(temp[i]);
      //     this.products2.push(_data);
      //   }
      // } else if (key === "products3") {
      //   this.products3 = [];
      //   temp = json[key];
      //   // Limit products to 4 items
      //   const limit = Math.min(temp.length, 4); // Ensure we don't exceed the available items
      //   for (let i = 0; i < limit; i++) {
      //     _data = new CollectionProductStyle5();
      //     _data.ParseJson(temp[i]);
      //     this.products3.push(_data);
      //   }
      // } else 
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class CollectionProductStyle5 {
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

