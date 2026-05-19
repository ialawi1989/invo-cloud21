import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductCollectionStyle2Component } from './product-collection-style2.component';

describe('ProductCollectionStyle2Component', () => {
  let component: ProductCollectionStyle2Component;
  let fixture: ComponentFixture<ProductCollectionStyle2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCollectionStyle2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductCollectionStyle2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
