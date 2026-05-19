import { Component, Input } from '@angular/core';
import { ServiceRequestCompoComponent } from "src/app/pages/pager/service-request-compo/service-request-compo.component";

@Component({
  selector: 'app-service-request',
  imports: [ServiceRequestCompoComponent],
  templateUrl: './service-request.component.html',
  styleUrl: './service-request.component.css'
})
export class ServiceRequestComponent {

  @Input() showContainer = false;

}
