import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductSearchResultsComponent } from './product-search-results.component';

describe('ProductSearchResultsComponent', () => {
  let component: ProductSearchResultsComponent;
  let fixture: ComponentFixture<ProductSearchResultsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductSearchResultsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductSearchResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
