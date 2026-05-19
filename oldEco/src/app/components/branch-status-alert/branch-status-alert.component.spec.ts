import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BranchStatusAlertComponent } from './branch-status-alert.component';

describe('BranchStatusAlertComponent', () => {
  let component: BranchStatusAlertComponent;
  let fixture: ComponentFixture<BranchStatusAlertComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BranchStatusAlertComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BranchStatusAlertComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
