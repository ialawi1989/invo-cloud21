import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit } from '@angular/core';
import { AlertService } from 'src/app/services/alertService/alert.service';
import { LoadingService } from 'src/app/services/loadingService/loading.service';
import { ServiceRequestService } from 'src/app/services/serviceRequestServices/serviceRequest.service';
import { ServiceRequestCompoComponent } from "src/app/pages/pager/service-request-compo/service-request-compo.component";

@Component({
  selector: 'app-service-request-pop',
  imports: [
    ServiceRequestCompoComponent
],
  templateUrl: './service-request-pop.component.html',
  styleUrl: './service-request-pop.component.css',
  // encapsulation: ViewEncapsulation.ShadowDom
})
export class ServiceRequestPopComponent implements OnInit {

  @Input() tableNumber: number | any;
  @Input() branchId : string | null = null;
  @Input() tableId: string | null = null;
  
  showServiceRequest = false;

  constructor(
    private http: HttpClient,
    private serviceRequestService: ServiceRequestService,
    private alertService: AlertService,
    private loadingService: LoadingService,
  ) {
  }

  serviceRequestSubscription: any;

  async ngOnInit() {
    this.serviceRequestSubscription = this.serviceRequestService.serviceRequestPopState$.subscribe((data) => {
      this.showServiceRequest = data;
    });
  }

  ngOnDestroy() {
    if (this.serviceRequestSubscription) {
      this.serviceRequestSubscription.unsubscribe();
    }
  }

  closePop() {
    this.serviceRequestService.hideServiceRequestPop();
  }


}
