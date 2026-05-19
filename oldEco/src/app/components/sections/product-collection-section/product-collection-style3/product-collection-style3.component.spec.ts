import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductCollectionStyle3Component } from './product-collection-style3.component';

describe('ProductCollectionStyle3Component', () => {
  let component: ProductCollectionStyle3Component;
  let fixture: ComponentFixture<ProductCollectionStyle3Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCollectionStyle3Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductCollectionStyle3Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
