import { Component, Input, OnChanges, SimpleChanges, inject, OnDestroy} from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { Order } from 'src/app/models/order.model';
import { FeedbacksService } from 'src/app/services/feedbacksServices/feedbacks.service';
import { Company } from 'src/app/models/company.model';
import { CompanyServices } from 'src/app/services/companyServices/company.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-feedback-compo',
  imports: [TranslateModule, FormsModule],
  templateUrl: './feedback-compo.component.html',
  styleUrls: ['./feedback-compo.component.css']
})
export class FeedbackCompoComponent implements OnChanges , OnDestroy{
  private destroy$ = new Subject<void>();

  private logger = inject(LoggerService);
  @Input() showContainer = false;
  @Input() feedbackData:any;

  rating = 0;
  comment = '';
  name = '';
  phone = '';
  hoveredStar = 0;
  submitted = false;
  isSubmitting = false;

  // Track if fields were auto-filled from order data
  isNameDisabled = false;
  isPhoneDisabled = false;

  status = {
    show: false,
    type: '',
    message: '',
    subMessage: ''
  };

  private statusTimeout: any;

  companySettings!: Company;

  constructor(
    private feedbacksService: FeedbacksService,
    private companyService: CompanyServices
  ) {
    this.loadCompany();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['feedbackData'] && this.feedbackData) {
      this.populateOrderData();
    }
  }

  /**
   * Auto-fill name and phone from order data if available
   * Fields are disabled if they contain auto-filled data
   */
  populateOrderData() {
    // Try to get phone from order
    if (this.feedbackData?.customerContact) {
      this.phone = this.feedbackData.customerContact;
      this.isPhoneDisabled = true;
    }

    // Try to get name from order
    if (this.feedbackData?.customerName) {
      this.name = this.feedbackData.customerName;
      this.isNameDisabled = true;
    }
  }

  /**
   * Enable phone field if user clears it
   */
  onPhoneChange() {
    if (!this.phone || this.phone.trim() === '') {
      this.isPhoneDisabled = false;
    }
  }

  /**
   * Enable name field if user clears it
   */
  onNameChange() {
    if (!this.name || this.name.trim() === '') {
      this.isNameDisabled = false;
    }
  }

  loadCompany() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => {
        this.companySettings = data;
        CompanyServices.companySettings = this.companySettings;
      },
    });
  }

  setRating(star: number) {
    this.rating = star;
  }

  setHoveredStar(star: number) {
    this.hoveredStar = star;
  }

  clearHover() {
    this.hoveredStar = 0;
  }

  async submitFeedback() {
    if (this.rating === 0) {
      this.showStatus('error', 'Please select a rating', 'Rating is required');
      return;
    }

    if (!this.name || this.name.trim() === '') {
      this.showStatus('error', 'Please enter your name', 'Name is required');
      return;
    }

    if (!this.phone || this.phone.trim() === '') {
      this.showStatus('error', 'Please enter your phone', 'Phone is required');
      return;
    }

    this.isSubmitting = true;
    this.showStatus('pending', 'Sending feedback...', 'Please wait');

    const body = {
      transactionId: this.feedbackData?.id || '',
      comment: this.comment || '',
      rating: this.rating,
      name: this.name.trim(),
      phone: this.phone.trim()
    };

    this.feedbacksService.saveFeedback(body).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: any) => {
        this.isSubmitting = false;

        if (data == null) {
          this.showStatus('error', 'Failed to send feedback', 'Please try again');
          return;
        }

        this.hideStatus();
        this.submitted = true;

        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
      },
      error: (err: any) => {
        this.logger.error(err?.message, { stack: err?.stack, context: 'FeedbackCompoComponent.submitFeedback' });
        this.isSubmitting = false;
        this.showStatus('error', 'Failed to send feedback', 'Please try again');
      }
    });
  }

  resetForm() {
    this.submitted = false;
    this.rating = 0;
    this.comment = '';
    this.name = '';
    this.phone = '';
    this.hoveredStar = 0;
    this.isNameDisabled = false;
    this.isPhoneDisabled = false;
    this.hideStatus();
  }

  showStatus(type: string, message: string, subMessage: string) {
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
      this.statusTimeout = null;
    }

    this.status = {
      show: true,
      type,
      message,
      subMessage
    };

    if (type === 'error') {
      this.statusTimeout = setTimeout(() => {
        this.hideStatus();
      }, 5000);
    }
  }

  hideStatus() {
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
      this.statusTimeout = null;
    }
    this.status.show = false;
  }

  /**
   * Check if Google feedback link should be shown
   * Returns true if:
   * 1. Google feedback settings exist
   * 2. Ratings array is defined and not empty
   * 3. Current rating is included in the ratings array
   */
  shouldShowGoogleFeedbackLink(): boolean {
    if (!this.companySettings?.googleFeedbackSettings) {
      return false;
    }

    const { ratings } = this.companySettings.googleFeedbackSettings;
    if (!ratings || !Array.isArray(ratings) || ratings.length === 0) {
      return false;
    }

    return ratings.includes(this.rating);
  }

  /**
   * Open Google feedback URL in a new blank window
   */
  openGoogleFeedbackLink(): void {
    if (this.companySettings?.googleFeedbackSettings?.url) {
      window.open(this.companySettings.googleFeedbackSettings.url, '_blank');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}