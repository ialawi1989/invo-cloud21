import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeliverySelectorPopComponent } from './delivery-selector-pop.component';

describe('DeliverySelectorPopComponent', () => {
  let component: DeliverySelectorPopComponent;
  let fixture: ComponentFixture<DeliverySelectorPopComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeliverySelectorPopComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeliverySelectorPopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
