import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PickupSelectorPopComponent } from './pickup-selector-pop.component';

describe('PickupSelectorPopComponent', () => {
  let component: PickupSelectorPopComponent;
  let fixture: ComponentFixture<PickupSelectorPopComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PickupSelectorPopComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PickupSelectorPopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
