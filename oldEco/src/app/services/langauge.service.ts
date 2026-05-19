import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  public languages: string[] = ['en', 'ar'];

  constructor(public $t: TranslateService,
    @Inject(PLATFORM_ID) private platformId: any,) {
    const isBrowser = isPlatformBrowser(this.platformId);
    if (!isBrowser) {
      return ;
    }
    this.$t.addLangs(this.languages);
    this.setLanguage(this.getBrowserLanguage());
  }


  private getBrowserLanguage(): string {
    const isBrowser = isPlatformBrowser(this.platformId);
    if (!isBrowser) {
      return 'en';
    }
    let browserLang: any = localStorage.getItem('lang');
    if (!browserLang) {
      browserLang = this.$t.getBrowserLang();
    }
    return browserLang?.match(/en|ar/) ? browserLang : 'en';
  }

  public setLanguage(lang: string) {

    this.$t.use(lang);
    localStorage.setItem('lang', lang);

    // if (lang === 'ar') {
    //   document.getElementsByTagName("html")[0].setAttribute("dir", "rtl");
    // } else {
    //   document.getElementsByTagName("html")[0].setAttribute("dir", "ltr");
    // }
  }

  public getLanguage() {
    return localStorage.getItem('lang');
  }

  translate(value:any){
    this.$t.get(value).subscribe((translationData:any) => {
      return translationData
    });
  }
}
