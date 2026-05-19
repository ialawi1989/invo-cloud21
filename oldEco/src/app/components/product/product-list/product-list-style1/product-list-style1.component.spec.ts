import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductListStyle1Component } from './product-list-style1.component';

describe('ProductListStyle1Component', () => {
  let component: ProductListStyle1Component;
  let fixture: ComponentFixture<ProductListStyle1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductListStyle1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductListStyle1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
