import { Component, Input } from '@angular/core';
import { Section } from '../../../../models/page-data/pageData';
import { AppServices } from '../../../../services/appServices';
import { TranslateModule } from '@ngx-translate/core';
import { Invoice } from 'src/app/models/invoice-model';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-buttons-section-style1',
  imports: [RouterLink, TranslateModule],
  templateUrl: './buttons-section-style1.component.html',
  styleUrl: './buttons-section-style1.component.css'
})
export class ButtonsSectionStyle1Component {

  // ── Inputs ────────────────────────────────────────────────────────────────
  @Input() section!: Section;
  @Input() themeBuilder: any = {};
  @Input() background: string = 'white';
  @Input() invoiceData!: Invoice | any;

  constructor(public appService: AppServices) {}

  /** Compatibility shim */
  getBackground(): string { return this.background; }
}
