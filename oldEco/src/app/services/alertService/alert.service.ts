import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AlertModalComponent } from '../../components/alert-modal/alert-modal.component';
import { ModalService } from '../modal.service';

@Injectable({
  providedIn: 'root',
})
export class AlertService {

  constructor(
    private modalService: ModalService
  ) {

  }

  modal: any;

  showAlert(params: any) {
    this.modalService.openWithData(
      AlertModalComponent,
      params,
      { centered: true, windowClass: 'app-alert-modal' }
    );
  }

}
