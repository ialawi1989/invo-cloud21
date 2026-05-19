import { Component, HostListener } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { PromoService } from 'src/app/services/promoService/promo.service';

@Component({
  selector: 'app-promo-popup',
  imports: [
    TranslateModule
  ],
  templateUrl: './promo-popup.component.html',
  styleUrl: './promo-popup.component.css'
})
export class PromoPopupComponent {

  promoData: any = {};

  constructor(
    public activeModal: NgbActiveModal,) { }

  ngOnInit() {
    // this.promoService.promoState$.subscribe((data) => {
    //   this.promoData = data;
    //   console.log("ngOnInit > this.promoData", this.promoData);
    // });
  }

  loadData(data: any) {
    this.promoData = data;
  }


  closePromo() {
    setTimeout(() => {
      this.activeModal.close();
    }, 75);
  }

}
