import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

/**
 * service-duration
 * ────────────────
 * Single-field card for `service` products — captures expected service
 * duration (minutes). Kept tiny on purpose; the old project pulled this
 * out as its own component and we preserve the structure.
 */
@Component({
  selector: 'app-pf-service-duration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './service-duration.component.html',
  styleUrl: './service-duration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceDurationComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  group!: FormGroup;

  ngOnInit(): void {
    const info = this.productInfo();
    const f = this.fieldsOptions()?.serviceTime;

    this.group = this.fb.group({
      serviceTime: [info.serviceTime ?? 30,
                    f?.isRequired
                      ? [Validators.required, Validators.min(1)]
                      : [Validators.min(1)]],
    });

    this.productForm().setControl('service', this.group);

    this.group.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        this.productInfo().serviceTime = Number(v.serviceTime ?? 30);
      });
  }

  c(name: 'serviceTime') {
    return this.group.controls[name];
  }
}
