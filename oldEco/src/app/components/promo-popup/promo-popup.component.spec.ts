import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PromoPopupComponent } from './promo-popup.component';

describe('PromoPopupComponent', () => {
  let component: PromoPopupComponent;
  let fixture: ComponentFixture<PromoPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PromoPopupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PromoPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
