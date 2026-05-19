import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoryCollectionStyle5Component } from './category-collection-style5.component';

describe('CategoryCollectionStyle5Component', () => {
  let component: CategoryCollectionStyle5Component;
  let fixture: ComponentFixture<CategoryCollectionStyle5Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryCollectionStyle5Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CategoryCollectionStyle5Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
