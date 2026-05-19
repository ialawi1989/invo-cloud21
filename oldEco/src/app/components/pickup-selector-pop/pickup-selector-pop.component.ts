import { Component, OnInit, signal, computed, Input, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { Branch } from 'src/app/models/branch.model';
import { MynumberPipe } from 'src/app/pipes/mynumber.pipe';
import { BranchService } from 'src/app/services/branchServices/branch.service';
import { Invoice } from 'src/app/models/invoice-model';
import { CartService } from 'src/app/services/cartServices/cart.service';
import { ShopService } from 'src/app/services/shopServices/shop.service';
import { SharedCompanyData } from 'src/app/shared/modules/shared-company-data';
import { map, takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { AppServices } from 'src/app/services/appServices';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-pickup-selector-pop',
  imports: [TranslateModule, FormsModule, MynumberPipe,],
  templateUrl: './pickup-selector-pop.component.html',
  styleUrl: './pickup-selector-pop.component.css',
  providers: [MynumberPipe]
})
export class PickupSelectorPopComponent extends SharedCompanyData implements OnInit, OnDestroy {

  page: string = "";
  context: string = 'menu';
  currentBranchId: string = '';
  isRetrying = signal<boolean>(false);
  locationAttempts = signal<number>(0);
  showingAllBranches = signal<boolean>(false);

  invoiceData!: Invoice;
  isPickUpMaxDistance: boolean = false;

  // Signals for reactive state management
  branches = signal<Branch[]>([]);
  searchText = signal<string>('');
  isLoading = signal<boolean>(true);
  locationAvailable = signal<boolean>(false);
  showLocationError = signal<boolean>(false);

  // Computed signals for filtered data and display states
  filteredBranches = computed(() => {
    const search = this.searchText().toLowerCase().trim();
    const allBranches = this.branches();

    let filtered = allBranches;

    if (search) {
      filtered = allBranches.filter(branch =>
        branch.name.toLowerCase().includes(search) ||
        branch.address?.toLowerCase().includes(search)
      );
    }

    // Sort alphabetically by branch name
    return filtered.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  });

  loadData(data: any) {
    this.context = data.context;
    this.currentBranchId = data.currentBranchId
    this.page = data.page || ""
  }
  // Computed signal for display messages
  displayState = computed(() => {
    const allBranches = this.branches();
    const filtered = this.filteredBranches();
    const search = this.searchText().trim();
    const loading = this.isLoading();
    let locationError = false;
    if (!this.appService.isLocalConfig()) {
      locationError = this.showLocationError();
    }

    if (locationError) {
      return {
        type: 'location-error',
        message: 'Location access is required',
        showBranches: false
      };
    }

    if (loading) {
      return {
        type: 'loading',
        message: 'Loading branches...',
        showBranches: false
      };
    }

    if (allBranches.length === 0) {
      return {
        type: 'no-branches',
        message: 'No locations available',
        showBranches: false
      };
    }

    if (search && filtered.length === 0) {
      return {
        type: 'no-matches',
        message: `No branches found for "${search}"`,
        showBranches: false
      };
    }

    return {
      type: 'show-branches',
      message: '',
      showBranches: true
    };
  });

  constructor(
    private branchService: BranchService,
    private router: Router,
    private cartService: CartService,
    public activeModal: NgbActiveModal,
    public appService: AppServices
  ) {
    super()
  }

  async ngOnInit() {
    await super.loadCompany();
    this.isPickUpMaxDistance = this.companySettings.pickUpMaxDistance > 0;

    await this.getBranches();
    if (this.isPickUpMaxDistance) {
      // Check location availability first
      const hasLocation = await this.checkLocationAvailability();

      if (!hasLocation) {
        this.showLocationError.set(true);
        this.isLoading.set(false);

        let hideLocationNotification = localStorage.getItem("hideLocationNotification")
        if (hideLocationNotification != 'true' || hideLocationNotification == null) {
          this.presentAlertLocation({
            title: 'Location Required',
            text: 'Please enable location access to find nearby pickup locations',
            position: 'center'
          });
        }

        return;
      }

      this.locationAvailable.set(true);

      await this.getNearestBranch();
    }
    this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: any) => {
        if (invoiceData) this.invoiceData = invoiceData;
      },
    });

    // Auto-select if only one branch
    const availableBranches = this.filteredBranches();
    if (this.page != 'checkout') {
      if (!this.isPickUpMaxDistance && availableBranches.length === 1) {
        this.updateCart(availableBranches[0].id);
        if (this.appService.redirectMenuToShop || this.router.url.includes("/shop")) {
          this.router.navigate(['/shop'], { queryParams: { branch_id: availableBranches[0].id, service_name: "PickUp" } });
        } else {
          this.appService.isMenuDataLoaded = false;
          this.router.navigate(['/menu'], { queryParams: { branch_id: availableBranches[0].id, service_name: "PickUp" } });
        }
        this.closePop();
        window.scrollTo({ top: 0 });
      }
    }
  }

  // Check if location is available
  async checkLocationAvailability(): Promise<boolean> {
    try {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        return false;
      }

      // Check location permission first
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });

        if (permission.state === 'denied') {
          return false;
        }

        if (permission.state === 'granted') {
        }
      }

      // Try to get current position with improved error handling
      try {
        const position = await this.getPositionWithTimeout(15000);
        return position !== null && position !== undefined;
      } catch (error: any) {
        // Handle specific geolocation errors without harsh logging
        this.handleLocationError(error);
        return false;
      }

    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'PickupSelectorPopComponent.locationAvailability' });
      return false;
    }
  }


  // Enhanced getPosition wrapper with better timeout handling
  private getPositionWithTimeout(timeout: number = 15000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject({ code: 3, message: 'Location request timed out' });
      }, timeout);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          resolve([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        {
          enableHighAccuracy: false, // Faster response, less battery
          timeout: timeout - 1000,
          maximumAge: 300000 // Accept 5-minute old location
        }
      );
    });
  }

  private handleLocationError(error: any) {
    if (error.code === 1 || error.err === 'denied') {
    } else if (error.code === 2) {
    } else if (error.code === 3) {
    } else {
    }
  }

  // Retry location access
  async retryLocationAccess() {
    this.isRetrying.set(true);
    this.locationAttempts.set(this.locationAttempts() + 1);
    this.showLocationError.set(false);

    // Add delay to show loading feedback
    await new Promise(resolve => setTimeout(resolve, 800));

    const hasLocation = await this.checkLocationAvailability();

    if (!hasLocation) {
      this.showLocationError.set(true);
      this.isRetrying.set(false);

      // Show different messages based on attempt count
      if (this.locationAttempts() === 1) {
        this.presentAlertLocation({
          title: 'Location Still Required',
          text: 'Please allow location access in your browser. Look for the location icon in your address bar.',
          position: 'center'
        });
      } else if (this.locationAttempts() === 2) {
        this.presentAlertLocation({
          title: 'Location Access Needed',
          text: 'You may need to refresh the page after enabling location in your browser settings.',
          position: 'center'
        });
      } else {
        this.presentAlertLocation({
          title: 'Having Trouble?',
          text: 'Try refreshing the page or check if location services are enabled for your browser.',
          position: 'center'
        });
      }
      return;
    }

    // Success! Location is now available
    this.locationAvailable.set(true);
    this.isRetrying.set(false);
    this.isLoading.set(true);

    // Show success message
    this.presentAlertLocation({
      title: 'Location Enabled!',
      text: 'Finding nearby pickup locations...',
      position: 'top-end',
      timer: 2000
    });

    await this.getNearestBranch();
  }

  showAllBranches() {

    // Update the state to show all branches
    this.showingAllBranches.set(true);
    this.showLocationError.set(false);
    this.isLoading.set(true);

    // Get all branches and mark them as available
    this.getBranches().then(() => {
      const allBranches: any = this.branches().map(branch => ({
        ...branch,
        isCovered: true, // Allow selection of all branches
        distanceFromLocation: undefined // Remove distance info since we don't have location
      }));

      this.branches.set(allBranches);
      this.isLoading.set(false);

      // Show info message
      this.presentAlertLocation({
        title: 'Showing All Locations',
        text: 'You can now select from all available pickup locations. Distance information is not available without location access.',
        position: 'top-end',
        timer: 4000
      });
    });
  }

  private getBrowserInstructions(): string {
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('chrome')) {
      return 'Click the location icon in your address bar and select "Allow".';
    } else if (userAgent.includes('firefox')) {
      return 'Click "Allow" when prompted, or click the shield icon in your address bar.';
    } else if (userAgent.includes('safari')) {
      return 'Go to Safari > Settings for This Website > Location > Allow.';
    } else if (userAgent.includes('edge')) {
      return 'Click the location icon in your address bar and select "Allow".';
    } else {
      return 'Enable location access in your browser settings.';
    }
  }
  closePop() {
    setTimeout(() => {
      this.activeModal.close();
    }, 75);
  }

  // Update search text (this will automatically trigger filtering via computed signal)
  onSearchChange(value: string) {
    this.searchText.set(value);
  }

  async getNearestBranch() {
    try {
      console.time("get Position")
      const current_center = await this.getPosition();
      if (!current_center) return 0;
      console.timeEnd("get Position")

      console.time("get distance")
      const updatedBranches: any = this.branches().map(branch => {
        if (branch.location?.lat && branch.location?.lng) {
          const distance = this.getDistanceFromLatLonInKm(
            branch.location.lat,
            branch.location.lng,
            current_center[0],
            current_center[1]
          );

          return {
            ...branch,
            distanceFromLocation: distance,
            isCovered: distance <= this.companySettings.pickUpMaxDistance
          };
        }
        return branch;
      });
      console.timeEnd("get distance")

      this.branches.set(updatedBranches);

      this.isLoading.set(false);
      return updatedBranches.filter((f: any) => f.isCovered === true).length;

    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'PickupSelectorPopComponent.location' });
      return 0;
    }
  }

  presentAlertLocation(param: any) {
    let title = param.title,
      text = param.text;

    const Toast = Swal.mixin({
      position: param.position || 'top-end',
      backdrop: true,
      toast: param.position === 'center' ? false : true,
      icon: param.position === 'center' ? 'warning' : 'success',
      title: title,
      text: text || '',
      showConfirmButton: param.position === 'center' ? true : false,
      confirmButtonText: param.position === 'center' ? 'Got It' : undefined,
      timer: param.position === 'center' ? undefined : (param.timer ?? 3000),
      timerProgressBar: param.position === 'center' ? false : true,
      background: param.position === 'center' ? undefined : 'rgb(52 195 143 / 90%)',
      color: param.position === 'center' ? undefined : '#fff',
      allowOutsideClick: param.position === 'center' ? false : true,
    });

    Toast.fire().then((result) => {
      if (result.isConfirmed && param.position === 'center') {
        localStorage.setItem("hideLocationNotification", 'true');
      }
    });
  }

  getBranches() {
    return new Promise(resolve => {
      this.branchService.getBranchList().pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => {
          if (data) {
            // Filter only online available branches
            const availableBranches = data.filter((branch: Branch) => branch.onlineAvailability);
            this.branches.set(availableBranches);
            if (this.companySettings.pickUpMaxDistance == 0 || this.companySettings.pickUpMaxDistance == null) {
              this.isLoading.set(false);
            }
          }
          resolve(true);
        },
        error: (error: any) => {
          this.logger.error(error?.message, { stack: error?.stack, context: 'PickupSelectorPopComponent.fetchBranches' });
          this.isLoading.set(false);
          resolve(false);
        }
      });
    });
  }

  async onClickBranch(branch: Branch) {
    // Check if branch is available
    if (this.disableBranch(branch)) {
      return;
    }

    await this.updateCart(branch.id);

    if (this.context === 'checkout') {
      // Close with result for checkout
      setTimeout(() => {
        this.activeModal.close({ success: true, branchId: branch.id, branch: branch });
      }, 75);
    } else {
      if (this.appService.redirectMenuToShop || this.router.url.includes("/shop")) {
        // Navigate to menu for regular menu access
        this.router.navigate(['/shop'], { queryParams: { branch_id: branch.id, service_name: "PickUp" } });
      } else {
        this.appService.isMenuDataLoaded = false;
        // Navigate to menu for regular menu access
        this.router.navigate(['/menu'], { queryParams: { branch_id: branch.id, service_name: "PickUp" } });
      }
      this.closePop();
      window.scrollTo({ top: 0 });
    }
  }

  updateCart(branchId: string) {
    return new Promise(resolve => {
      const res = this.cartService.changeService2({
        sessionId: this.invoiceData.onlineData.sessionId,
        branchId: branchId,
        serviceName: 'PickUp',
      })
      resolve(res)
    });
  }

  // Helper method to check if branch is clickable
  disableBranch(branch: Branch): boolean {
    if (this.companySettings.pickUpMaxDistance != 0 && this.companySettings.pickUpMaxDistance != null) {
      return (!branch.isCovered && this.isPickUpMaxDistance);
    }
    return false
  }

  cancel() {
    this.activeModal.dismiss('');
    if (this.appService.enforceServiceSelection) {
      this.appService.showSelectMenuServicePop = true;
      if (this.router.url.includes('/shop') || this.router.url.includes('/menu')) {
        this.appService.showServiceSelector();
      }
    }
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}