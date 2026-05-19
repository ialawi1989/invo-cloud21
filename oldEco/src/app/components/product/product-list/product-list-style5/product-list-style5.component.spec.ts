import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductListStyle5Component } from './product-list-style5.component';

describe('ProductListStyle5Component', () => {
  let component: ProductListStyle5Component;
  let fixture: ComponentFixture<ProductListStyle5Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductListStyle5Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductListStyle5Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
