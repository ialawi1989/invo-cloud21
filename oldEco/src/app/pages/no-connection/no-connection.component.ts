import { HttpClient } from '@angular/common/http';
import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { AppConfigService } from 'src/app/services/app-config.service';
import { AppServices } from 'src/app/services/appServices';
import { map, Observable, Subject } from "rxjs";
import { takeUntil } from 'rxjs/operators';
import { NoConnectionStyle2Component } from "./no-connection-style-2/no-connection-style-2.component";

@Component({
  selector: 'app-no-connection',
  imports: [NoConnectionStyle2Component],
  templateUrl: './no-connection.component.html',
  styleUrl: './no-connection.component.css'
})
export class NoConnectionComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  private logger = inject(LoggerService);
  @Input() errData: any;
  slugList: any = [];
  style='1';

  constructor(
    private http: HttpClient,
    private config: AppConfigService,
    private appService: AppServices
  ) {

  }

  async ngOnInit() {
    if (this.errData?.error?.msg) {
      this.logger.error(this.errData.error.msg, { context: 'NoConnectionComponent.ngOnInit', errData: this.errData });
    }
    if(!this.errData){
      this.slugList = await this.getDomainSimilarity(this.appService.subDomain)
    }
  }

  getDomainSimilarity(slug: string) {
    return new Promise(response => {
      this.getDomainSimilarityData(slug).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: any) => {
          if (data) {
            response(data);
          }
        },
        error: (err: any) => {
          this.logger.error(err?.message, { stack: err?.stack, context: 'NoConnectionComponent.getDomainSimilarity' }); // Handle errors
          response(false);
        },
      });
    })
  }

  getDomainSimilarityData(slug: string): Observable<any> {
    return this.http
      .get<{ success: boolean; data: any[] }>(`${this.config.baseUrl?.replace(slug + '/', '')}` + 'domainSimilarity/' + slug)
      .pipe(
        map((response: any) => {
          if (response.success) {
            return response.data;
          }
          return null;
        })
      );
  }

  gotoWebsite(slug:string){
    let url = window.location.href;
    let inv = '';

    if (url.includes('local') || url.includes('10.2.2.82')) {
      inv = 'local';
    } else if (url.includes('dev.invopos.shop')) {
      inv = 'dev';
    } else if (url.includes('test.invopos.shop')) {
      inv = 'test';
    } else if (url.includes('invopos.shop')) {
      inv = 'prod';
    } else {
      this.logger.error('Unknown environment', { context: 'NoConnectionComponent.environmentCheck', url });
      return;
    }

    if (inv == 'local') {
      window.open('http://10.2.2.82:3000/', '_self');
    } else if (inv == 'dev') {
      window.open('https://' + slug + '.dev.invopos.shop/', '_self');
    } else if (inv == 'test') {
      window.open('https://' + slug + '.test.invopos.shop/', '_self');
    } else if (inv == 'prod') {
      window.open('https://' + slug + '.invopos.shop/', '_self');
    }
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
