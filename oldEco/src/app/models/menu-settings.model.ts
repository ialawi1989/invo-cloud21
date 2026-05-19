export class MenuSettings {
  primaryMenu: any = {};
  footerMenu: any = {};

  ParseJson(json: any): MenuSettings {
    for (const key in json) {
      if (key in this) {
        this[key as keyof this] = json[key] ?? this[key as keyof this];
      }
    }
    return this;
  }

  toMap(): { [key: string]: any } {
    return {
      primaryMenu: this.primaryMenu,
      footerMenu: this.footerMenu
    };
  }
}


export class FooterMenu {

}

export class PrimaryMenu {
  
}
