import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrackOrderMapPopComponent } from './track-order-map-pop.component';

describe('TrackOrderMapPopComponent', () => {
  let component: TrackOrderMapPopComponent;
  let fixture: ComponentFixture<TrackOrderMapPopComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrackOrderMapPopComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrackOrderMapPopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
