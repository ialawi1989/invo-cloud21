import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductCollectionStyle4Component } from './product-collection-style4.component';

describe('ProductCollectionStyle4Component', () => {
  let component: ProductCollectionStyle4Component;
  let fixture: ComponentFixture<ProductCollectionStyle4Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCollectionStyle4Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductCollectionStyle4Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
