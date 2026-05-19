import { Component, OnInit, OnDestroy} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ServiceRequestCompoComponent } from "src/app/pages/pager/service-request-compo/service-request-compo.component";
import { Company } from 'src/app/models/company.model';
import { AppServices } from 'src/app/services/appServices';
import { CompanyServices } from 'src/app/services/companyServices/company.service';
import { LanguageService } from 'src/app/services/langauge.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-service-request-blank',
  imports: [
    ServiceRequestCompoComponent,
    TranslateModule
  ],
  templateUrl: './service-request-blank.component.html',
  styleUrl: './service-request-blank.component.css'
})

export class ServiceRequestBlankComponent implements OnInit , OnDestroy{
  private destroy$ = new Subject<void>();
  
  companyData: Company = new Company();
  branchId: string | any = null;
  tableId: string | any = null;
  tableNumber: string | any = null;

  constructor(
    private route: ActivatedRoute,
    private languageService: LanguageService,
    private companyService: CompanyServices,
    public appService: AppServices,
  ) {}

  async ngOnInit() {
    await this.getCompanyData();
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params: Record<string, any>) => {
      this.branchId = params['branch_id'];
      this.tableId = params['table_id'];
      this.tableNumber = params['table_number'];
    });
  }

  getCompanyData() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => {
        this.companyData = data;
      },
    });
  }

  onLanguageSelected(Language: string) {
    this.appService.lang = Language;
    this.saveLanguage(Language);
  }

  saveLanguage(Language: any) {
    this.languageService.setLanguage(Language);
  }



  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
