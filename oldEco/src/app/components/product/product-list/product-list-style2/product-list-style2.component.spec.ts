import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductListStyle2Component } from './product-list-style2.component';

describe('ProductListStyle2Component', () => {
  let component: ProductListStyle2Component;
  let fixture: ComponentFixture<ProductListStyle2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductListStyle2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductListStyle2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
