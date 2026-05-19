import { LogoImage } from "../../pageData";


export class RichTextStyle3 {

  text1: string = "";
  text1Color: string = "#000";
  text2: string = "";
  text2Color: string = "#000";
  text3: string = "";
  text3Color: string = "#666";
  buttonText: string = "";
  // buttonColor: string = "gold";
  buttonTextColor: string = "#000";
  buttonUrl: string = "";
  buttonLink:any = {};
  image = new LogoImage()
  translation:any = {};

  constructor() {

  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key == "image") {
        const _data = new LogoImage();
        _data.ParseJson(json[key])
        this[key] = _data
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }

}