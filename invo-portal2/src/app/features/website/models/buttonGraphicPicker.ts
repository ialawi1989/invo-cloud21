import { LogoImage } from "./theme-builder";

export class ButtonGraphicPicker {
  style: string | null = "icon"; //icon or image
  defaultIcon = "";
  defaultImage = new LogoImage();
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
