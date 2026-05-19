import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TierBenefitsComponent } from './tier-benefits.component';

describe('TierBenefitsComponent', () => {
  let component: TierBenefitsComponent;
  let fixture: ComponentFixture<TierBenefitsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TierBenefitsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TierBenefitsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
