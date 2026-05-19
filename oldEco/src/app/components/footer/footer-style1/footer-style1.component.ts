import { Component, Input, OnInit } from '@angular/core';
import { Company } from '../../../models/company.model';
import { AppServices } from '../../../services/appServices';
import { Footer } from '../../../models/theme-settings.model';

@Component({
  selector: 'app-footer-style1',
  standalone: false,
  templateUrl: './footer-style1.component.html',
  styleUrl: './footer-style1.component.css'
})



export class FooterStyle1Component implements OnInit {

  @Input() companyData: Company | any = new Company();
  currentYear = new Date().getFullYear();
  
  constructor(
    public appService: AppServices
  ) {
  }

  ngOnInit(){
    let tempData: Footer = new Footer();
    tempData.ParseJson(this.companyData.themeSettings.template.footer);
    this.companyData.themeSettings.template.footer = tempData
  }

  // showHomeAsDefault() {
  //   let menuList = this.companyData.menuSettings.primaryMenu[0]?.template?.list;
  //   if (menuList) {
  //     return !menuList.some((page: any) => {
  //       page.abbr?.toLowerCase() === 'home' || 
  //       page.abbr?.toLowerCase() === 'homepage' ||
  //       page.abbr?.toLowerCase() === 'home-sample' 
  //     });
  //   } else {
  //     return true;
  //   }
  // }

}
