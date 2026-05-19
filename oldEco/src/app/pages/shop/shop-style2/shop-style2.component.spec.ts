import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShopStyle2Component } from './shop-style2.component';

describe('ShopStyle2Component', () => {
  let component: ShopStyle2Component;
  let fixture: ComponentFixture<ShopStyle2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShopStyle2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShopStyle2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
