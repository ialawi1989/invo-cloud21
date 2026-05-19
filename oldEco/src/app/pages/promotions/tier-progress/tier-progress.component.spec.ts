import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TierProgressComponent } from './tier-progress.component';

describe('TierProgressComponent', () => {
  let component: TierProgressComponent;
  let fixture: ComponentFixture<TierProgressComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TierProgressComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TierProgressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
