import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductGridStyle5Component } from './product-grid-style5.component';

describe('ProductGridStyle5Component', () => {
  let component: ProductGridStyle5Component;
  let fixture: ComponentFixture<ProductGridStyle5Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductGridStyle5Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductGridStyle5Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
