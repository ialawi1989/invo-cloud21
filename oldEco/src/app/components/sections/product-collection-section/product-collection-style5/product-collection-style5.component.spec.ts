import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductCollectionStyle5Component } from './product-collection-style5.component';

describe('ProductCollectionStyle5Component', () => {
  let component: ProductCollectionStyle5Component;
  let fixture: ComponentFixture<ProductCollectionStyle5Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCollectionStyle5Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductCollectionStyle5Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
