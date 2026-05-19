import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductCollectionSectionComponent } from './product-collection-section.component';

describe('ProductCollectionSectionComponent', () => {
  let component: ProductCollectionSectionComponent;
  let fixture: ComponentFixture<ProductCollectionSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCollectionSectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductCollectionSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
