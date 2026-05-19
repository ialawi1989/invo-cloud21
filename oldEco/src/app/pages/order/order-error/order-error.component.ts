import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Location } from '@angular/common';

@Component({
  selector: 'app-order-error',
  imports: [
    TranslateModule
  ],
  templateUrl: './order-error.component.html',
  styleUrl: './order-error.component.css'
})
export class OrderErrorComponent implements OnInit{

  sessionId: string = "";
  lastPage:any = "";
  canGoBack: boolean = false;

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: any,
    private location: Location,
  ) {
    this.canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  }

  ngOnInit(){
    this.lastPage = localStorage.getItem('lastPage');
    if(!this.lastPage){
      if (this.canGoBack) {
        this.location.back();
      } else {
        this.router.navigate(['/']);
      }
    }
  }

  goBack() {
    if (this.lastPage) {
      this.router.navigate([this.lastPage]);
      localStorage.removeItem('lastPage');
    } else {
      if (this.canGoBack) {
        this.location.back();
      } else {
        this.router.navigate(['/']);
      }
    }
  }


}
