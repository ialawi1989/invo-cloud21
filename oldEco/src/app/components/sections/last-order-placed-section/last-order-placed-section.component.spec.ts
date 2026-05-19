import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LastOrderPlacedSectionComponent } from './last-order-placed-section.component';

describe('LastOrderPlacedSectionComponent', () => {
  let component: LastOrderPlacedSectionComponent;
  let fixture: ComponentFixture<LastOrderPlacedSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LastOrderPlacedSectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LastOrderPlacedSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
