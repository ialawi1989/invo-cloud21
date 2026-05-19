import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductGridStyle2Component } from './product-grid-style2.component';

describe('ProductGridStyle2Component', () => {
  let component: ProductGridStyle2Component;
  let fixture: ComponentFixture<ProductGridStyle2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductGridStyle2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductGridStyle2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
