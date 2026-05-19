import { Component, OnDestroy} from '@angular/core';
import { Company } from '../../models/company.model';
import { CompanyServices } from '../../services/companyServices/company.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
  standalone: false
})
export class FooterComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  style = "Style 1";
  companyData: Company = new Company();


  constructor(
    private companyService: CompanyServices
  ) {
    this.getCompanyData();
  }

  getCompanyData() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => {
        this.companyData = data;
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
