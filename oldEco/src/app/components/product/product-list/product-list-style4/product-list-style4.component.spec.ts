import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductListStyle4Component } from './product-list-style4.component';

describe('ProductListStyle4Component', () => {
  let component: ProductListStyle4Component;
  let fixture: ComponentFixture<ProductListStyle4Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductListStyle4Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductListStyle4Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
