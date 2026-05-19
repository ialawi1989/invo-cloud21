import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductListStyle3Component } from './product-list-style3.component';

describe('ProductListStyle3Component', () => {
  let component: ProductListStyle3Component;
  let fixture: ComponentFixture<ProductListStyle3Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductListStyle3Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductListStyle3Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
