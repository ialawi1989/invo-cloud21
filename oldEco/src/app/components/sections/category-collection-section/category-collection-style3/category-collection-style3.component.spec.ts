import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoryCollectionStyle3Component } from './category-collection-style3.component';

describe('CategoryCollectionStyle3Component', () => {
  let component: CategoryCollectionStyle3Component;
  let fixture: ComponentFixture<CategoryCollectionStyle3Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryCollectionStyle3Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CategoryCollectionStyle3Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
