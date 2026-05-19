import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductCollectionStyle1Component } from './product-collection-style1.component';

describe('ProductCollectionStyle1Component', () => {
  let component: ProductCollectionStyle1Component;
  let fixture: ComponentFixture<ProductCollectionStyle1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCollectionStyle1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductCollectionStyle1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
