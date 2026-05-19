import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Injectable({
  providedIn: 'root',
})
export class PromoService {

  private promoSubject = new BehaviorSubject<{ show: boolean; data?:any }>({
    show: false,
    data: null
  });


  constructor(
    private modalService: NgbModal
  ) {
  }

  promoState$ = this.promoSubject.asObservable();

  showPromo(data?:any) {
    this.promoSubject.next({ show: true, data });
    document.body.style.overflow = 'hidden';
  }

  hidePromo() {
    this.promoSubject.next({ show: false, data:null });
    document.body.style.overflow = 'auto';
  }

}