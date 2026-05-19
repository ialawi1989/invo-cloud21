import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductGridStyle4Component } from './product-grid-style4.component';

describe('ProductGridStyle4Component', () => {
  let component: ProductGridStyle4Component;
  let fixture: ComponentFixture<ProductGridStyle4Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductGridStyle4Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductGridStyle4Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
