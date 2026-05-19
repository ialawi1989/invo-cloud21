import * as uuid from 'uuid';
import { LogoImage } from '../../pageData';

export class ButtonsSectionStyle2 {

  buttons: ButtonSectionStyle2[] = [];
  translation:any = {};
  
  addCollectionProductStyle2() {
    this.buttons.push(new ButtonSectionStyle2());
  }

  ParseJson(json: any): void {
    let _data: ButtonSectionStyle2;
    let temp;
    for (const key in json) {
      if (key === "buttons") {
        this.buttons = [];
        temp = json[key];

        // Limit buttons to 8 items
        const limit = Math.min(temp.length, 8); // Ensure we don't exceed the available items
        for (let i = 0; i < limit; i++) {
          _data = new ButtonSectionStyle2();
          _data.ParseJson(temp[i]);
          this.buttons.push(_data);
        }
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }

}

export class ButtonSectionStyle2 {
  id = "";
  title = "";
  subtitle = "";
  color = "#aaa";
  titleColor = "black";
  subtitleColor = "black";
  image = new LogoImage();
  buttonLink = {};
  translation:any = {};

  constructor() {
    this.id = uuid.v4()
  }
  ParseJson(json: any): void {
    for (const key in json) {
      if (key == "image") {
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