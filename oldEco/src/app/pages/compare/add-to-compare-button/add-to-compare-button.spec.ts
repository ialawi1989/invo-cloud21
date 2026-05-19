import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddToCompareButtonComponent } from './add-to-compare-button';


describe('AddToCompareButtonComponent', () => {
  let component: AddToCompareButtonComponent;
  let fixture: ComponentFixture<AddToCompareButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddToCompareButtonComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddToCompareButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
