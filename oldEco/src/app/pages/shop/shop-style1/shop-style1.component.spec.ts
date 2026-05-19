import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShopStyle1Component } from './shop-style1.component';

describe('ShopStyle1Component', () => {
  let component: ShopStyle1Component;
  let fixture: ComponentFixture<ShopStyle1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShopStyle1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShopStyle1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
