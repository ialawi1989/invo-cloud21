import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContinueShoppingSectionComponent } from './continue-shopping.component';

describe('ContinueShoppingSectionComponent', () => {
  let component: ContinueShoppingSectionComponent;
  let fixture: ComponentFixture<ContinueShoppingSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContinueShoppingSectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContinueShoppingSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
