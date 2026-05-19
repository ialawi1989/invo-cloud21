import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID, inject, OnDestroy} from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AlertService } from '../../services/alertService/alert.service';
import { BranchService } from '../../services/branchServices/branch.service';
import { CurrencyService } from '../../services/currencyService/currency.service';
import { LoadingService } from '../../services/loadingService/loading.service';
import { PaymentService } from '../../services/paymentServices/payments.service';
import { Branch } from '../../models/branch.model';
import { TranslateModule } from '@ngx-translate/core';
import { ReservationService } from '../../services/reservationServices/reservation.service';
import { SpinnerComponent } from "../../components/spinner/spinner.component";
import { Shopper } from '../../models/shopper.module';
import { AuthService } from '../../services/authService/auth.service';
import { HttpClient } from '@angular/common/http';
import { Reservation } from 'src/app/models/reservation.model';
import { AppServices } from 'src/app/services/appServices';
import { PageData } from 'src/app/models/page-data/pageData';
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';
import { Location } from '@angular/common';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { PhoneVerificationComponent } from 'src/app/components/auth/phone-verification/phone-verification.component';
import { ModalService } from 'src/app/services/modal.service';
import { Company } from 'src/app/models/company.model';
import { CompanyServices } from 'src/app/services/companyServices/company.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-table-reservation',
  imports: [
    FormsModule,
    TranslateModule,
    SpinnerComponent,
    RouterLink
  ],
  templateUrl: './table-reservation.component.html',
  styleUrl: './table-reservation.component.css'
})
export class TableReservationComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  private logger = inject(LoggerService);
  userData: Shopper | any = new Shopper();

  countries: any[] = [];
  dates: any[] = [];
  date: any = null;
  times: any[] = [];
  time: any = null;
  branches: any[] = [];
  filteredDates: any[] = [];
  branchStatus: any = null;
  branchId: any = null;
  branch: any = null;
  filteredTimes: any[] = [];
  customer: any = {
    name: "",
    phone: "",
    email: "",
    phoneCode: "",
    phoneNumber: ""
  };

  companyData: Company | any = new Company();

  payments: any[] = [];
  selectedPayment: string = "Cash";
  serviceName: string = "TableReservation";
  loading: boolean = true;
  guests: number = 1;
  note: string = "";
  payment: any = {};

  //special cases
  isQuickOrder: boolean = false;
  isViewOnly: boolean = false;
  isBenefitPayOpened: boolean = false;
  // Prevents double-submit: lock on entry, release on every validation return
  // and before the OTP modal so the modal callback can re-enter cleanly.
  isPlacingOrder: boolean = false;

  currentCurrency: any = {};
  isBrowser: boolean;
  isPhoneValidated = false;
  detectedCustomerData = false;
  pageData: PageData | any = new PageData();
  canGoBack: boolean = false;

  constructor(
    private http: HttpClient,
    private paymentService: PaymentService,
    private branchService: BranchService,
    private router: Router,
    private loadingService: LoadingService,
    private alertService: AlertService,
    private currencyService: CurrencyService,
    private reservationService: ReservationService,
    private authService: AuthService,
    public appService: AppServices,
    private location: Location,
    private modalService: ModalService,
    private pageBuilderServices: PageBuilderService,
    private companyService: CompanyServices,
    @Inject(PLATFORM_ID) private platformId: any,) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  }

  async ngOnInit() {
    await this.getPageData();
    window.scrollTo({ top: 0 });

    this.getCompanyData();
    this.customer.phoneCode = "+" + this.companyData.settings.countryCode;

    this.countries = this.appService.allCountries;
    this.loadDates();
    this.loadTimes();
    this.currencyService.currentCurrency.pipe(takeUntil(this.destroy$)).subscribe(currency => {
      this.currentCurrency = currency;
    });

    if (this.isBrowser) {
      const savedCurrency = localStorage.getItem('selectedCurrency');

      if (savedCurrency) {
        const currency = JSON.parse(savedCurrency);
        this.currentCurrency = currency;
      }
    }

    this.getUserData();
    this.getPayments();
    this.getBranches().then(() => {
      this.loading = false;

      if (this.branches.length == 1) {
        this.branch = this.branches[0];
        this.branchId = this.branch.id;
        if (this.isBranchHaveWorkingSchedule(this.branchId, this.branches)) {
          this.filteredDates = this.filterDatesByWorkingSchedule(this.dates, this.branchId, this.branches).slice(0, 8);
          if (!(this.filteredDates.length > 0)) {
            this.branchStatus = "close";
          } else {
            this.branchStatus = "open";
          }
        } else {
          this.branchStatus = "close";
        }
      } else {
        if (this.branchId) {
          this.branch = this.branches.find(branch => branch.id === this.branchId);
          if (this.isBranchHaveWorkingSchedule(this.branchId, this.branches)) {
            this.filteredDates = this.filterDatesByWorkingSchedule(this.dates, this.branchId, this.branches).slice(0, 8);
            if (!(this.filteredDates.length > 0)) {
              this.branchStatus = "close";
            } else {
              this.branchStatus = "open";
            }
          } else {
            this.branchStatus = "close";
          }
        }
      }

    })
  }

  getConvertedPrice(totalPrice: number) {
    var price = (totalPrice / (this.currentCurrency.rate || 0)) || 0
    return price.toFixed(this.currentCurrency.afterDecimal);
  }


  isBranchHaveWorkingSchedule(branchId: any, branchesData: any) {
    const targetBranch = branchesData.find((branch: Branch) => branch.id === branchId);
    if (targetBranch) {
      if (targetBranch.workingSchedule) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  filterDatesByWorkingSchedule(dates: any, branchId: any, branchesData: any) {
    const branch = branchesData.find((branch: Branch) => branch.id === branchId);
    if (!branch || !branch.workingSchedule) {
      return [];
    }
    const filteredDates = dates.filter((date: any) => {
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
      const workingHours = branch.workingSchedule[dayOfWeek];
      return workingHours && workingHours.length > 0;
    });
    let i = 0;
    filteredDates.forEach((date: any) => {
      if (!(this.filterTimesByWorkingScheduleAndDate(this.times, date, this.branchId, this.branches).length > 0)) {
        filteredDates.splice(i, 1);
        i--;
      }
      i++;
    });
    return filteredDates;
  }

  filterTimesByWorkingScheduleAndDate(times: any, selectedDate: any, branchId: any, branchesData: any[]) {
    const branch = branchesData.find((branch: any) => branch.id === branchId);
    if (!branch || !branch.workingSchedule) {
      return [];
    }

    const dayOfWeek = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });
    const workingHours = branch.workingSchedule[dayOfWeek];

    if (!Array.isArray(workingHours) || workingHours.length === 0) {
      return [];
    }

    const currentTime = new Date();
    const filteredTimes = times.filter((time: any) => {
      const [hours, minutes] = time.split(':');
      const timeValue = new Date(selectedDate);
      timeValue.setHours(hours);
      timeValue.setMinutes(minutes);

      return (
        timeValue >= currentTime &&
        workingHours.some(({ from, to }) => {
          const [fromHours, fromMinutes] = from.split(':');
          const [toHours, toMinutes] = to.split(':');
          const fromTime = new Date(selectedDate);
          const toTime = new Date(selectedDate);
          fromTime.setHours(fromHours);
          fromTime.setMinutes(fromMinutes);
          toTime.setHours(toHours);
          toTime.setMinutes(toMinutes);

          return timeValue >= fromTime && timeValue < toTime;
        })
      );
    });

    return filteredTimes;
  }

  loadDates() {
    var dates = [];
    var today = new Date();
    for (var i = 0; i < 62; i++) {
      var date = new Date(today);
      date.setDate(today.getDate() + i);
      var year = date.getFullYear();
      var month = String(date.getMonth() + 1).padStart(2, '0');
      var day = String(date.getDate()).padStart(2, '0');
      var formattedDate = `${year}-${month}-${day}`;
      dates.push(formattedDate);
    }
    this.dates = dates;
  }

  loadTimes() {
    //1hour
    // var times = [];
    // for (var i = 0; i < 24; i++) {
    //   var hour = String(i).padStart(2, '0');
    //   var time = `${hour}:00`;
    //   times.push(time);
    // }
    // this.times = times;

    // 30min
    var times = [];
    for (var i = 0; i < 24; i++) {
      for (var j = 0; j <= 30; j += 30) {
        var hour = String(i).padStart(2, '0');
        var minute = String(j).padStart(2, '0');
        var time = `${hour}:${minute}`;
        times.push(time);
      }
    }
    this.times = times;
  }

  getUserData() {
    this.authService.userData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: any) => {
        if (responseData) {
          this.userData = {};
          this.detectedCustomerData = false;
          this.isPhoneValidated = false;
          this.userData = responseData;
        }
        this.loadUserSavedData();
      },
    });
  }

  getCompanyData() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: Company) => {
        this.companyData = responseData;
      },
    });
  }

  loadUserSavedData() {
    let checkoutCustomer: any = localStorage.getItem('checkoutCustomer');
    if (checkoutCustomer) {
      let checkoutCustomerData = JSON.parse(checkoutCustomer);
      if (checkoutCustomerData.name) {
        this.customer.name = checkoutCustomerData.name;
      }
      if (checkoutCustomerData.phoneCode) {
        this.customer.phoneCode = checkoutCustomerData.phoneCode;
      }
      if (checkoutCustomerData.phoneNumber) {
        this.customer.phoneNumber = checkoutCustomerData.phoneNumber;
      }
      if (checkoutCustomerData.isPhoneValidated) {
        this.isPhoneValidated = true;
      }
      if (checkoutCustomerData.email) {
        this.customer.email = checkoutCustomerData.email;
      }
    }
    if (this.userData?.id) {
      if (this.userData.name) {
        this.customer.name = this.userData.name;
      }
      if (this.userData.phoneCode) {
        this.customer.phoneCode = this.userData.phoneCode;
      }
      if (this.userData.phoneNumber) {
        this.customer.phoneNumber = this.userData.phoneNumber;
      }
      if (this.userData.phone) {
        this.customer.phone = this.userData.phone;
      } else if (this.userData.phoneCode && this.userData.phoneNumber) {
        this.customer.phone = this.userData.phoneCode + this.userData.phoneNumber;
      }
      if (this.userData.email) {
        this.customer.email = this.userData.email;
      }
      if (this.userData.isPhoneValidated) {
        this.isPhoneValidated = this.userData.isPhoneValidated;
      } else {
        this.isPhoneValidated = false;
      }
      if (
        this.customer.name &&
        (
          this.userData.phone ||
          (this.customer.phoneCode &&
            this.customer.phoneNumber)
        ) &&
        this.isPhoneValidated
      ) {
        this.detectedCustomerData = true;
      }
    }
  }

  getPayments() {
    this.payments.push({
      id: "",
      name: "Cash",
      image: "/assets/images/payments/cash.png"
    });
    this.selectedPayment = "Cash";
    this.paymentService.getPaymentsMethods().pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData) => {
        if (responseData) {
          responseData.forEach((element: any) => {
            if (element.icon == "Debit Card") {
              element.image = "/assets/images/payments/debit-card.svg"
            } else if (element.icon == "Credit Card") {
              element.image = "/assets/images/payments/credit-card.svg"
            } else {
              if (element.name.toLowerCase() == "afs") {
                element.image = "/assets/images/payments/afs.png"
              } else if (element.name.toLowerCase() == "benefitpay") {
                element.image = "/assets/images/payments/benefitpay.png"
              } else if (element.name.toLowerCase() == "thawanipayment") {
                element.image = "/assets/images/payments/thawanipayment.png"
              } else if (element.name.toLowerCase() == "tappayment") {
                element.image = "/assets/images/payments/tappayment.png"
              } else if (element.name.toLowerCase() == "benefit") {
                element.image = "/assets/images/payments/benefit.png"
              } else if (element.name.toLowerCase() == "gatee") {
                element.image = "/assets/images/payments/gatee.png"
              } else if (element.name.toLowerCase() == "credimax ecr") {
                element.image = "/assets/images/payments/credimax.png"
              } else if (element.name.toLowerCase() == "aps ecr") {
                element.image = "/assets/images/payments/aps.png"
              }
            }
            this.payments.push(element);
          });
        }
      }
    })
  }

  getBranches() {
    return new Promise(response => {
      this.branchService.getBranchList().pipe(takeUntil(this.destroy$)).subscribe({
        next: (responseData) => {
          if (responseData) {
            this.branches = responseData;
            //remove branches if !onlineAvailability
            this.branches = this.branches.filter((branch: Branch) => branch.onlineAvailability);
            response(true);
          } else {
            response(false);
          }
        }
      });
    });
  }


  editBranch() {
    this.branch = null;
    this.branchId = null;
    this.branchStatus = null;
    this.filteredDates = [];
    this.date = null;
    this.filteredTimes = [];
    this.time = null;
  }

  selectBranch(branch: any) {
    this.branch = branch;
    this.branchId = this.branch.id;
    if (this.isBranchHaveWorkingSchedule(this.branchId, this.branches)) {
      this.filteredDates = this.filterDatesByWorkingSchedule(this.dates, this.branchId, this.branches).slice(0, 8);
      if (!(this.filteredDates.length > 0)) {
        this.branchStatus = "close";
      } else {
        this.branchStatus = "open";
      }
    } else {
      this.branchStatus = "close";
    }
  }

  editDate() {
    this.date = null;
    this.filteredTimes = [];
    this.time = null;
  }

  selectDate(date: any) {
    this.date = date;
    this.filteredTimes = this.filterTimesByWorkingScheduleAndDate(this.times, this.date, this.branchId, this.branches);
  }

  getDayDescription(dateString: any) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const inputDate = new Date(dateString);

    if (
      inputDate.getFullYear() === today.getFullYear() &&
      inputDate.getMonth() === today.getMonth() &&
      inputDate.getDate() === today.getDate()
    ) {
      return 'Today';
    } else if (
      inputDate.getFullYear() === tomorrow.getFullYear() &&
      inputDate.getMonth() === tomorrow.getMonth() &&
      inputDate.getDate() === tomorrow.getDate()
    ) {
      return 'Tomorrow';
    } else {
      const weekdays = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday'
      ];
      const dayIndex = inputDate.getDay();
      return weekdays[dayIndex];
    }
  }

  convertToAmPm(time: any) {
    var hour = parseInt(time.substr(0, 2));
    var minute = time.substr(3, 2);
    var period = hour < 12 ? "AM" : "PM";
    if (hour === 0) {
      hour = 12;
    } else if (hour > 12) {
      hour -= 12;
    }
    return hour + ":" + minute + " " + period;
  }

  editTime() {
    this.time = null;
  }

  selectTime(time: any) {
    this.time = time;
  }

  convertToTimestamp(date: any, time: any) {
    // Combine the date and time strings
    const dateTimeString = `${date} ${time}`;
    // Create a new Date object from the combined string
    const dateTime = new Date(dateTimeString);
    // Get the timestamp in milliseconds
    const timestamp = dateTime.getTime();
    // Return the timestamp
    return timestamp;
  }

  clear() {
    this.editBranch();
  }

  isValidName(name: string) {
    // Check if the name is empty
    if (!name) {
      return false;
    }
    // Remove leading and trailing spaces from the name
    name = name.trim();
    // Regular expression to match names with only letters, non-English characters, and spaces
    const regex = /^[\p{L}\s]+$/u;
    // Check if the name matches the regular expression
    if (!regex.test(name)) {
      return false;
    }
    return true;
  }

  isValidPhoneNumber(phoneNumber: any) {
    const phone = phoneNumber?.toString() ?? '';
    return phone.length >= 8 && !/\s/.test(phone);
  }

  isValidEmail(email: any) {
    if (!email || !email.trim()) {
      return true; // optional — empty is valid
    }
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email.trim());
  }

  placeReservation() {
    // Lock immediately on entry — prevents double-tap (button has no [disabled])
    // and the OTP modal callback path. Released on every early return so the
    // user can correct input and retry.
    if (this.isPlacingOrder) {
      return;
    }
    this.isPlacingOrder = true;

    if (!this.customer.phone && this.customer.phoneCode && this.customer.phoneNumber) {
      this.customer.phone = this.customer.phoneCode + this.customer.phoneNumber;
    }
    this.customer.isPhoneValidated = this.isPhoneValidated;
    let customer = { ...this.customer };
    localStorage.setItem('checkoutCustomer', JSON.stringify(this.customer));
    localStorage.setItem('orderPlaced', 'true');

    if (!this.branchId) {
      if (this.isQuickOrder) {
        this.branchId = this.branches[0].id;
        this.isPlacingOrder = false;
        this.placeReservation();
        return;
      } else {
        this.alertService.showAlert({ title: "Please select the branch" });
        const element = document.getElementById('scroll-to-select-the-branch');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
        this.isPlacingOrder = false;
        return;
      }
    }
    if (this.branchStatus != 'open' && this.branchStatus != null) {
      if (this.branchStatus == 'close' || this.branchStatus == 'closed') {
        this.alertService.showAlert({ title: "Branch Close!", subtitle: " Please select other branch to continue your appointment." });
      } else if (this.branchStatus == 'busy') {
        this.alertService.showAlert({ title: "Branch Busy!", subtitle: " Please select other branch to continue your appointment." });
      } else {
        this.alertService.showAlert({ title: "Branch Not Ready!", subtitle: " Please select other branch to continue your appointment." });
      }
      this.isPlacingOrder = false;
      return;
    }
    if (!this.date) {
      this.alertService.showAlert({ title: "Please select the date" });
      const element = document.getElementById('scroll-to-select-the-date');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
      this.isPlacingOrder = false;
      return;
    }
    if (!this.time) {
      this.alertService.showAlert({ title: "Please select the time" });
      const element = document.getElementById('scroll-to-select-the-time');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
      this.isPlacingOrder = false;
      return;
    }
    if (!this.isValidName(customer.name)) {
      this.alertService.showAlert({ title: "Please enter a valid name" });
      const element = document.getElementById('scroll-to-customer-details-name');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
      this.isPlacingOrder = false;
      return;
    }
    if (!this.isValidPhoneNumber(customer.phone)) {
      this.alertService.showAlert({ title: "Please enter a valid phone number" });
      const element = document.getElementById('scroll-to-customer-details-phone');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
      this.isPlacingOrder = false;
      return;
    }
    if (!this.isValidEmail(customer.email)) {
      this.alertService.showAlert({ title: "Please enter a valid email address" });
      const element = document.getElementById('scroll-to-customer-details-email');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
      this.isPlacingOrder = false;
      return;
    }
    if (!this.selectedPayment) {
      this.alertService.showAlert({ title: "Please select the payment method" });
      this.isPlacingOrder = false;
      return;
    }
    this.payments.forEach(paymnt => {
      if (paymnt.name == this.selectedPayment) {
        this.payment = paymnt;
      }
    });
    if (this.payment.name == null) {
      this.selectedPayment = "Cash";
      this.payment.name = "Cash";
      this.isPlacingOrder = false;
      return;
    }

    if (!this.isPhoneValidated && !this.appService.disableOtp) {
      // Release the lock before opening the modal so the modal callback can
      // call placeReservation() again after OTP success.
      this.isPlacingOrder = false;
      this.validatePhone();
      return;
    }

    // All validation passed — proceed with the HTTP call.
    this.loadingService.showLoadingSpinner();
    let reservation: any = {
      branchId: this.branchId,
      guests: Number(this.guests),
      note: this.note,
      phone: customer.phone,
      phoneCode: customer.phoneCode,
      phoneNumber: customer.phoneNumber,
      email: customer.email || null,
      name: customer.name,
      isPhoneValidated: customer.isPhoneValidated
    }
    const dateTimeString = `${this.date}T${this.time}:00`;
    reservation.reservationDate = new Date(dateTimeString);
    let tempReservation: Reservation = new Reservation();
    tempReservation.ParseJson(reservation);
    this.reservationService.saveReservation(reservation).pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: any) => {
        this.isPlacingOrder = false;
        if (responseData) {
          if (this.userData?.id) {
            this.reloadUserData();
          }
          this.loadingService.hideLoadingSpinner();
          this.setReservationToLocalStorage(responseData.reservationSessionId);
          this.router.navigate(['/reservation/' + responseData.reservationSessionId]);
        } else {
          this.loadingService.hideLoadingSpinner();
        }
      },
      error: (err: any) => {
        this.isPlacingOrder = false;
        localStorage.setItem('placeReservation', 'false');
        this.loadingService.hideLoadingSpinner();
      },
    });
  }

  createScheduleTime(date: any, time: any) {
    if (date && time) {
      const [year, month, day] = date.split("-");
      const [hours, minutes] = time.split(":");
      // Create a new Date object with the provided date and time components
      const scheduleDate = new Date(Date.UTC(year, month - 1, day, hours - 3, minutes));
      // Convert the date to the desired format
      const scheduleTime = scheduleDate.toISOString();
      return scheduleTime;
    } else {
      return null;
    }
  }

  setReservationToLocalStorage(reservationId: string): void {
    let reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
    const index = reservations.findIndex((item: any) => item === reservationId);
    if (index !== -1) {
      // Reservation is in the reservationList, remove it
      reservations.splice(index, 1);
      //console.log('Reservation removed from reservationList:', reservationId);
    } else {
      // Reservation is not in the reservationList, add it
      reservations.push({
        id: reservationId,
        date: new Date()
      });
      //console.log('Reservation added to reservations:', reservationId);
    }
    if (this.isBrowser) {
      localStorage.setItem('reservations', JSON.stringify(reservations));
    }
  }

  validatePhone() {
    if (!this.isBrowser) return;
    try {
      // Check if modal service is available
      if (!this.modalService) {
        this.logger.error('Modal service not available', { context: 'TableReservationComponent.openModal' });
        return;
      }
      // Open the modal using the ModalService
      const modalRef = this.modalService.openWithData(PhoneVerificationComponent, {
        phoneCode: this.customer.phoneCode,
        phoneNumber: this.customer.phoneNumber
      }, {
        centered: true,
        windowClass: "modal-sm",
        backdrop: 'static', // Prevent closing on backdrop click
        keyboard: false     // Prevent closing on escape
      });

      // Handle modal result
      this.handleModalResult(modalRef);
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'TableReservationComponent.openModal' });
    }
  }


  // Helper method to handle modal results
  private handleModalResult(modalRef: NgbModalRef): void {
    modalRef.result.then(
      (data: any) => {
        if (data && data.success) {
          // Handle success
          if (data.validation) {
            this.isPhoneValidated = true;
            this.placeReservation();
          } else {
            this.isPhoneValidated = false;
          }
        }
      },
      (reason: any) => {
        // Handle dismissal
      }
    ).catch((error: any) => {
      this.logger.error(error?.message, { stack: error?.stack, context: 'TableReservationComponent.handleModalResult' });
    });
  }



  checkPhoneValidate() {
    if (this.userData) {
      if ((this.customer.phoneCode + this.customer.phoneNumber) != this.userData.phone) {
        this.isPhoneValidated = false;
      } else {
        this.isPhoneValidated = true;
      }
    } else {
      this.isPhoneValidated = false;
    }
  }

  async reloadUserData() {
    await this.authService.getLoggedInUser();
  }

  async getPageData() {
    let data = await this.pageBuilderServices.getPage('table-reservation');

    if (data) {
      this.pageData = data;
    }
  }



  getHeaderBackground(subheader_settings: any) {
    if (subheader_settings) {
      if (subheader_settings.style == 'Color' && subheader_settings.defaultColor) {
        return subheader_settings.defaultColor || "gray";
      }
      else
        if (subheader_settings.style == 'Pattern' && subheader_settings.defaultPattern) {
          return `url(assets/images/page-builder/patterns/ ${subheader_settings.defaultPattern} .png)`;
        }
        else
          if (subheader_settings.style == 'Image' && subheader_settings.defaultImage && subheader_settings.defaultImage.defaultUrl) {
            return `url( ${subheader_settings.defaultImage.defaultUrl})`;
          }
      return "gray";
    } else {
      return "gray";
    }
  }

  goBack() {
    if (this.canGoBack) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}