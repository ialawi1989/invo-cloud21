import { LogoImage } from "./theme-builder";

export class Background {
  style: string | null = "Color";
  defaultColor = "";
  defaultPattern = "";
  showOvarlayPattern: boolean = false;
  defaultImage = new LogoImage();
  overlayOpacity = 0;
  overlayColor = "#000";
  showOvarlay: boolean =false;
  isParallax:boolean = false;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key == "defaultImage") {
        const _image = new LogoImage();
        _image.ParseJson(json[key])
        this[key] = _image
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
