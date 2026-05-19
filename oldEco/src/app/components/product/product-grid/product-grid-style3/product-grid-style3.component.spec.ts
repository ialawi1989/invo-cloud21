import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductGridStyle3Component } from './product-grid-style3.component';

describe('ProductGridStyle3Component', () => {
  let component: ProductGridStyle3Component;
  let fixture: ComponentFixture<ProductGridStyle3Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductGridStyle3Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductGridStyle3Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
