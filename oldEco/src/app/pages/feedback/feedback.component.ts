import { Component, OnInit, OnDestroy} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Company } from 'src/app/models/company.model';
import { AppServices } from 'src/app/services/appServices';
import { CompanyServices } from 'src/app/services/companyServices/company.service';
import { LanguageService } from 'src/app/services/langauge.service';
import { Order } from 'src/app/models/order.model';
import { CartService } from 'src/app/services/cartServices/cart.service';
import { FeedbackCompoComponent } from './feedback-compo/feedback-compo.component';
import { AuthService } from 'src/app/services/authService/auth.service'; // ← ADD
import { FeedbacksService } from 'src/app/services/feedbacksServices/feedbacks.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-feedback',
  imports: [
    TranslateModule,
    FeedbackCompoComponent
  ],
  templateUrl: './feedback.component.html',
  styleUrl: './feedback.component.css'
})
export class FeedbackComponent implements OnInit , OnDestroy{
  private destroy$ = new Subject<void>();

  loading: boolean = true;
  companyData: Company = new Company();
  id: string | any = null;
  feedbackData!: Order;

  constructor(
    private route: ActivatedRoute,
    private languageService: LanguageService,
    private companyService: CompanyServices,
    private cartService: CartService,
    public appService: AppServices,
    private feedbacksService: FeedbacksService,
    private authService: AuthService, // ← ADD
  ) {}

  async ngOnInit() {
    await this.getCompanyData();
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.id = params['invoice'] || params['invoiceId'];
      if (this.id) {
        this.getOrder(); // ← MOVED inside subscribe so it reacts to param changes
      }
    });
  }

  /**
   * Fetches order data with fallback mechanism.
   * First tries getOrderData (guest/session-based order).
   * If that fails or returns no data, tries getOrderById (authenticated user order).
   */
  getOrder() {
    this.loading = true;

    this.feedbacksService.getFeedbackOrderData(this.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Order | any) => {
        if (data) {
          // Successfully loaded order from primary method
          this.feedbackData = data;
          this.feedbackData.id = data.id || this.id;
          this.extractEmployeeAndServiceDetails();
          this.loading = false;
        } else {
        }
      },
      error: (err: any) => {
      },
    });
  }

  /**
   * Extracts and processes order details from the loaded order object.
   */
  private extractEmployeeAndServiceDetails() {
    if (!this.feedbackData) return;

    if (this.feedbackData.lines && this.feedbackData.lines.length > 0) {
      this.feedbackData.employeeName = this.feedbackData.lines[0].employeeName || "Any";
      this.feedbackData.serviceDate = this.feedbackData.lines[0].serviceDate;
    }
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