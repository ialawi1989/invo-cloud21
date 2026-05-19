import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeasurementsOptionsComponent } from './measurements-options.component';

describe('MeasurementsOptionsComponent', () => {
  let component: MeasurementsOptionsComponent;
  let fixture: ComponentFixture<MeasurementsOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeasurementsOptionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MeasurementsOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
