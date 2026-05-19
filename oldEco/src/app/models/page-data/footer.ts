import { LogoImage } from "./pageData";

export class Footer {
    style: string = "Style 1";
    backgroundColor: string = "#222";
    textColor:string = "#ffffff";
    brandInformation: BrandInformation = new BrandInformation();
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
export class BrandInformation {
    headline: string = "";
    description: string = "";
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}