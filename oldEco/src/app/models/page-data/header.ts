import { LogoImage } from "./pageData";

export class Header {
    style: string = "Style 1";
    menuId: string = "";
    menuAlignment = "Left";
    backgroundColor = "#ffffff";
    textColor = "#000000";
    menuBackgroundColor= "#222222";
    menuTextColor= "#ffffff";
    overlayTextColor= "#fff";
    borderBottomThickness = 1;
    headerColor = "#fff";
    menuBorderBottomThickness = 1;
    logo: LogoImage = new LogoImage();
    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "logo") {
                const _light = new LogoImage();
                _light.ParseJson(json[key])
                this[key] = _light
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }
        }
    }
}