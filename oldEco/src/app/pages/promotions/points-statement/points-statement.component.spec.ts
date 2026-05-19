import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PointsStatementComponent } from './points-statement.component';

describe('PointsStatementComponent', () => {
  let component: PointsStatementComponent;
  let fixture: ComponentFixture<PointsStatementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PointsStatementComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PointsStatementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
