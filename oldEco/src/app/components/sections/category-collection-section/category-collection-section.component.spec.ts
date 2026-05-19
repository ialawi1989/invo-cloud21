import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoryCollectionSectionComponent } from './category-collection-section.component';

describe('CategoryCollectionSectionComponent', () => {
  let component: CategoryCollectionSectionComponent;
  let fixture: ComponentFixture<CategoryCollectionSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryCollectionSectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CategoryCollectionSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
