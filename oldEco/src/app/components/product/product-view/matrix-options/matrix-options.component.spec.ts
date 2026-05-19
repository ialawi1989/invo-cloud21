import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatrixOptionsComponent } from './matrix-options.component';

describe('MatrixOptionsComponent', () => {
  let component: MatrixOptionsComponent;
  let fixture: ComponentFixture<MatrixOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatrixOptionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MatrixOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
