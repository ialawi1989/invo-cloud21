import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LastReservationPlacedSectionComponent } from './last-reservation-placed-section.component';

describe('LastReservationPlacedSectionComponent', () => {
  let component: LastReservationPlacedSectionComponent;
  let fixture: ComponentFixture<LastReservationPlacedSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LastReservationPlacedSectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LastReservationPlacedSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
