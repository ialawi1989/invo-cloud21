import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductGridStyle1Component } from './product-grid-style1.component';

describe('ProductGridStyle1Component', () => {
  let component: ProductGridStyle1Component;
  let fixture: ComponentFixture<ProductGridStyle1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductGridStyle1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductGridStyle1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
