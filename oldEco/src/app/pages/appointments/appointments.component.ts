import { Component, Inject, OnInit, PLATFORM_ID, inject, OnDestroy } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { PaymentService } from '../../services/paymentServices/payments.service';
import { Branch } from '../../models/branch.model';
import { SpinnerComponent } from "../../components/spinner/spinner.component";
import { FormsModule } from '@angular/forms';
import { BranchService } from '../../services/branchServices/branch.service';
import { AppointmentService } from '../../services/appointmentServices/appoitment.service';
import { CartService } from '../../services/cartServices/cart.service';
import { Invoice } from '../../models/invoice-model';
import { Router, RouterLink } from '@angular/router';
import { LoadingService } from '../../services/loadingService/loading.service';
import { isPlatformBrowser } from '@angular/common';
import { CurrencyService } from '../../services/currencyService/currency.service';
import { AlertService } from '../../services/alertService/alert.service';
import { TranslateModule } from '@ngx-translate/core';
import { Shopper } from '../../models/shopper.module';
import { AuthService } from '../../services/authService/auth.service';
import { AppServices } from 'src/app/services/appServices';
import { HttpClient } from '@angular/common/http';
import { Team } from 'src/app/models/team.model';
import { Service } from 'src/app/models/service.model';
import { PageData } from 'src/app/models/page-data/pageData';
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';
import { Location } from '@angular/common';
import { PhoneVerificationComponent } from 'src/app/components/auth/phone-verification/phone-verification.component';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { ModalService } from 'src/app/services/modal.service';
import { Company } from 'src/app/models/company.model';
import { CompanyServices } from 'src/app/services/companyServices/company.service';
import { NgSelectModule } from '@ng-select/ng-select';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-appointments',
  imports: [
    SpinnerComponent,
    FormsModule,
    TranslateModule,
    RouterLink,
    NgSelectModule
  ],
  templateUrl: './appointments.component.html',
  styleUrl: './appointments.component.css'
})
export class AppointmentsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  private logger = inject(LoggerService);
  appointmentCartData: Invoice | any = new Invoice();
  userData: Shopper | any = new Shopper();

  countries: any[] = [];
  dates: any[] = [];
  date: any = null;
  times: any[] = [];
  time: any = null;
  branches: Branch[] = [];
  filteredDates: any[] = [];
  branchStatus: string | null = null;
  branchId: string | null = null;
  branch: any = null;
  teams: Team[] = [];
  team: any = null;
  teamId: any = null;
  filteredTimes: any[] = [];
  services: Service[] = [];
  service?: Service;
  serviceId: any = null;
  filteredServices: Service[] = [];
  customer: any = {
    name: "",
    phone: "",
    phoneCode: "",
    phoneNumber: "",
    email: ""
  };

  companyData: Company | any = new Company();
  payments: any[] = [];
  selectedPayment: string = "Cash";
  serviceName: string = "Salon";
  loading: boolean = true;
  note: string = "";
  payment: any = {};

  //special cases
  isQuickOrder: boolean = false;
  isViewOnly: boolean = false;
  isBenefitPayOpened: boolean = false;
  // FIX: prevents double-submit of /cart/checkOut. The Confirm button only
  // toggles a CSS class (not [disabled]), so a fast double-click would fire
  // two requests; the first succeeds and clears the Redis cart, the second
  // hits getRedisCart()==null and replies "Cart is not created" even though
  // the appointment was actually placed. Same issue and fix as checkout.
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
    private appointmentService: AppointmentService,
    private cartService: CartService,
    private router: Router,
    private loadingService: LoadingService,
    private alertService: AlertService,
    private currencyService: CurrencyService,
    private authService: AuthService,
    public appService: AppServices,
    private modalService: ModalService,
    private location: Location,
    private companyService: CompanyServices,
    private pageBuilderServices: PageBuilderService,
    @Inject(PLATFORM_ID) private platformId: any
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  }

  async ngOnInit() {
    await this.getPageData();

    this.getCompanyData();
    this.customer.phoneCode = "+" + this.companyData.settings.countryCode;

    this.countries = this.appService.allCountries;
    window.scrollTo({ top: 0 });
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


  getCompanyData() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => {
        this.companyData = data;
      },
    });
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

  filterDatesByWorkingSchedule(dates: any, branchId: any, branchesData: Branch[]) {
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
      next: (data: any) => {
        if (data) {
          this.userData = {};
          this.detectedCustomerData = false;
          this.isPhoneValidated = false;
          this.userData = data;
        }
        this.loadUserSavedData();
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
      next: (data) => {
        if (data) {
          data.forEach((element: any) => {
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
        next: (data: Branch[] | null) => {
          if (data) {
            this.branches = data;
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
    this.teams = [];
    this.teamId = null;
    this.team = null;
    this.filteredTimes = [];
    this.time = null;
    this.services = [];
    this.filteredServices = [];
    this.appointmentCartData = new Invoice();
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
    this.teams = [];
    this.team = null;
    this.teamId = null;
    this.filteredTimes = [];
    this.time = null;
    this.services = [];
    this.filteredServices = [];
    this.appointmentCartData = new Invoice();
  }

  selectDate(date: any) {
    this.date = date;
    this.loading = true;
    this.getTeams().then(() => {
      this.loading = false;
    })
  }

  getTeams() {
    return new Promise(response => {
      this.appointmentService.getTeamList(
        {
          branchId: this.branchId,
          date: this.date
        }
      ).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: Team[] | null) => {
          if (data) {
            this.teams = data;
            response(true);
          } else {
            response(false);
          }
        }
      });
    });
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

  editTeam() {
    this.team = null;
    this.teamId = null;
    this.filteredTimes = [];
    this.time = null;
    this.services = [];
    this.filteredServices = [];
    this.appointmentCartData = new Invoice();
  }

  selectTeam(team: any) {
    this.team = team;
    this.teamId = this.team.employeeId;
    this.filteredTimes = this.filterTimesByWorkingScheduleAndDateAndEmployeeShift(
      this.times,
      this.date,
      this.branchId,
      this.branches,
      this.team
    );
  }

  filterTimesByWorkingScheduleAndDateAndEmployeeShift(times: any, date: any, branchId: any, branches: any, team: any) {
    let filteredTimesByWorkingSchedule = this.filterTimesByWorkingScheduleAndDate(times, date, branchId, branches);
    if (!team.employeeId) {
      return filteredTimesByWorkingSchedule;
    }
    let filteredTimesByShifts = this.filterTimesByShiftAndBusyTime(times, team);
    return filteredTimesByShifts.length ? filteredTimesByShifts : times;
  }

  filterTimesByShiftAndBusyTime(times: any, employeeSchedule: any) {
    const shifts = employeeSchedule.days.shift; // Get all shifts for the day
    const busyTimes = employeeSchedule.days.busyTimes; // Get the busy times for the day

    return times.filter((time: any) => {
      const [hours, minutes] = time.split(':');
      const timeInMinutes = parseInt(hours) * 60 + parseInt(minutes);

      for (const shift of shifts) {
        const [shiftFromHours, shiftFromMinutes] = shift.from.split(':');
        const [shiftToHours, shiftToMinutes] = shift.to.split(':');
        const shiftFromInMinutes = parseInt(shiftFromHours) * 60 + parseInt(shiftFromMinutes);
        const shiftToInMinutes = parseInt(shiftToHours) * 60 + parseInt(shiftToMinutes);

        if (timeInMinutes >= shiftFromInMinutes && timeInMinutes < shiftToInMinutes) {
          for (const busyTime of busyTimes) {
            const [busyFromHours, busyFromMinutes] = busyTime.from.split(':');
            const [busyToHours, busyToMinutes] = busyTime.to.split(':');
            const busyFromInMinutes = parseInt(busyFromHours) * 60 + parseInt(busyFromMinutes);
            const busyToInMinutes = parseInt(busyToHours) * 60 + parseInt(busyToMinutes);

            if (timeInMinutes >= busyFromInMinutes && timeInMinutes < busyToInMinutes) {
              return false; // Exclude the time if it matches a busy time
            }
          }

          return true;
        }
      }
      return false;
    });
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
    this.services = [];
    this.filteredServices = [];
    this.appointmentCartData = new Invoice();
  }

  selectTime(time: any) {
    this.time = time;
    this.loading = true;
    this.initCart();
    this.getServices().then(() => {
      this.loading = false;
      this.filteredServices = this.filterService();
    })
  }

  initCart() {
    return new Promise(response => {
      this.cartService.createAppointmentCart(
        {
          branchId: this.branchId,
          serviceName: this.serviceName,
          teamId: this.teamId,
          date: this.date,
          time: this.time,
          sessionId: "",
        }
      ).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: any) => {
          if (data) {
            this.appointmentCartData = data;
            response(true);
          } else {
            response(false);
          }
        }
      });
    });

  }

  getServices() {
    return new Promise(response => {
      this.appointmentService.getServiceList(
        {
          branchId: this.branchId,
          employeeId: this.team.employeeId
        }
      ).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: Service[] | null) => {
          if (data) {
            this.services = data;
            response(true);
          } else {
            response(false);
          }
        }
      });
    });
  }

  filterService() {
    let filteredServices = [];
    filteredServices = this.services;
    return filteredServices;
  }

  addService(serviceId: any) {
    if (serviceId && this.appointmentCartData?.onlineData?.sessionId) {
      this.loadingService.showLoadingSpinner();
    } else {
      this.alertService.showAlert({ title: "Failed to add service", subtitle: "Please try again later to create appointment" })
      return;
    }

    this.service = this.services.find(service => service.id === serviceId);

    this.cartService.addItemToAppointmentCart({
      sessionId: this.appointmentCartData?.onlineData?.sessionId,
      productId: serviceId,
      employeeId: this.team.employeeId || null,
      date: this.date,
      time: this.time,
      timestamp: this.convertToTimestamp(this.date, this.time),
      qty: 1
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: Invoice | null) => {
        this.serviceId = null;
        this.loadingService.hideLoadingSpinner();
        if (invoiceData) {
          this.appointmentCartData = invoiceData;
        } else {
          this.alertService.showAlert({ title: "Failed to add service case employee busy or service not available" })
        }
      }
    });
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
    this.appointmentCartData = new Invoice();
  }

  removeService(lineId: any) {
    this.cartService.removeItemFromCart({ transactionId: lineId, sessionId: this.appointmentCartData.onlineData.sessionId }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: Invoice | null) => {
        if (invoiceData) {
          this.appointmentCartData = invoiceData;
        }
      },
    });
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

  placeAppointment() {
    // Lock immediately on entry — prevents double-tap on mobile (the confirm
    // button only toggles a CSS class, not [disabled]) and the modal callback
    // path (validatePhone → placeAppointment). Released on every early return
    // so the user can correct input and retry.
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
        if (this.branchId) {
          this.isPlacingOrder = false;
          this.placeAppointment();
        } else {
          this.isPlacingOrder = false;
        }
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
    if (!this.team) {
      this.alertService.showAlert({ title: "Please select the team" });
      const element = document.getElementById('scroll-to-select-the-team');
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
    if (!(this.appointmentCartData?.lines?.length > 0)) {
      if (this.isQuickOrder) {
        this.serviceName = "PickUp";
        this.isPlacingOrder = false;
        this.placeAppointment();
        return;
      } else {
        this.alertService.showAlert({ title: "Please select the services" });
        const element = document.getElementById('scroll-to-select-the-service');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
        this.isPlacingOrder = false;
        return;
      }
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
      // Release the lock before opening the modal — the modal callback will
      // call placeAppointment() again after OTP success and the lock at the
      // top will guard that re-entry correctly.
      this.isPlacingOrder = false;
      this.validatePhone();
      return;
    }

    // All validation passed — proceed with the HTTP call.
    this.loadingService.showLoadingSpinner();
    let sessionId = this.appointmentCartData.onlineData.sessionId;
    this.paymentService.checkoutCart({
      sessionId: sessionId,
      userSessionId: this.userData.sessionId,
      branchId: this.branchId,
      serviceName: this.serviceName,
      serviceId: this.appointmentCartData.serviceId || this.serviceName,
      teamId: this.teamId,
      employeeId: this.teamId,
      payment: {
        name: this.payment.name
      },
      customer: customer,
      note: this.note,
      date: this.date,
      time: this.time,
      scheduleTime: this.createScheduleTime(this.date, this.time),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        if (response.success) {
          localStorage.setItem('appointmentSessionId', sessionId);
          let data = response.data;
          if (this.userData?.id) {
            this.reloadUserData();
          }
          localStorage.setItem('lastPage', window.location.pathname);

          if (this.payment.name == 'afs') {
            // Re-enable before handing off — if the gateway returns the user
            // to this page (failure / cancel) the button must be clickable.
            this.isPlacingOrder = false;
            this.paymentService.AfsPayment(data.config);
          } else if (this.payment.name == 'CrediMax') {
            // Same reasoning as afs above.
            this.isPlacingOrder = false;
            this.paymentService.CrediMaxPayment(data);

          } else if (this.payment.name == 'BenefitPay') {
            this.isBenefitPayOpened = true;
            this.loadingService.hideLoadingSpinner();

            InApp.open(
              data,
              // Success callback — always verify server-side regardless of
              // transactionStatus; client result alone cannot be trusted.
              (success: any) => {
                this.isBenefitPayOpened = false;
                this.isPlacingOrder = false;
                this.paymentService
                  .checkBenefitPayStatus2(data.referenceNumber, sessionId)
                  .then((isSuccess: boolean) => {
                    this.router.navigate([isSuccess ? 'order/complete' : 'order/error']);
                  })
                  .catch(() => {
                    this.router.navigate(['order/error']);
                  });
              },
              // Error callback — payment gateway reported an error; still
              // verify server-side as charge may have gone through.
              (error: any) => {
                if (this.isBenefitPayOpened) {
                  this.isBenefitPayOpened = false;
                  this.isPlacingOrder = false;
                  this.paymentService
                    .checkBenefitPayStatus2(data.referenceNumber, sessionId)
                    .then((isSuccess: boolean) => {
                      this.router.navigate([isSuccess ? 'order/complete' : 'order/error']);
                    })
                    .catch(() => {
                      this.router.navigate(['order/error']);
                    });
                }
              },
              // Cancel callback — user dismissed the InApp dialog; still check
              // status because payment may have completed before cancel.
              (cancel: any) => {
                if (this.isBenefitPayOpened) {
                  this.isBenefitPayOpened = false;
                  this.isPlacingOrder = false;
                  this.paymentService
                    .checkBenefitPayStatus2(data.referenceNumber, sessionId)
                    .then((isSuccess: boolean) => {
                      if (isSuccess) {
                        this.router.navigate(['order/complete']);
                      }
                      // If not paid, stay on appointments page — flag already reset above.
                    })
                    .catch(() => {
                      // Stay on page silently — flag already reset above.
                    });
                }
              }
            );

          } else {
            this.loadingService.hideLoadingSpinner();
            if (data.url || data.data?.url) {
              // Reset before navigating away — protects against popup
              // blockers or gateway errors that keep the user on this page.
              this.isPlacingOrder = false;
              window.open(data.url || data.data?.url, "_self");
            } else {
              this.isPlacingOrder = false;
              this.router.navigate(['order/complete']);
            }
          }
        } else {
          // Server returned success: false — show the error and let the user retry.
          this.isPlacingOrder = false;
          this.loadingService.hideLoadingSpinner();
          if (response.msg) {
            this.alertService.showAlert({ title: response.msg });
          }
        }
      },
      error: (err: any) => {
        this.isPlacingOrder = false;
        localStorage.setItem('orderPlaced', 'false');
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

  setOrderToLocalStorage(orderId: string): void {
    let orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const index = orders.findIndex((item: any) => item === orderId);
    if (index !== -1) {
      // Order is in the orderList, remove it
      orders.splice(index, 1);
    } else {
      // Order is not in the orderList, add it
      orders.push(orderId);
    }
    if (this.isBrowser) {
      localStorage.setItem('orders', JSON.stringify(orders));
    }
  }

  validatePhone() {
    if (!this.isBrowser) return;
    try {
      // Check if modal service is available
      if (!this.modalService) {
        this.logger.error('Modal service not available', { context: 'AppointmentsComponent.validatePhone' });
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
      this.logger.error(error?.message, { stack: error?.stack, context: 'AppointmentsComponent.validatePhone' });
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
            this.placeAppointment();
          } else {
            this.isPhoneValidated = false;
          }
        }
      },
      (reason: any) => {
        // Handle dismissal
      }
    ).catch((error: any) => {
      this.logger.error(error?.message, { stack: error?.stack, context: 'AppointmentsComponent.handleModalResult' });
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
    let data = await this.pageBuilderServices.getPage('appointments');

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