import { Component, Input } from '@angular/core';
import { Section } from '../../../../models/page-data/pageData';
import { AppServices } from '../../../../services/appServices';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rich-text-style1',
  imports: [CommonModule],
  templateUrl: './rich-text-style1.component.html',
  styleUrl: './rich-text-style1.component.css'
})
export class RichTextStyle1Component {

  // ── Inputs ────────────────────────────────────────────────────────────────
  @Input() section!: Section;
  @Input() themeBuilder: any = {};
  @Input() background: string = 'white';

  constructor(public appService: AppServices) {}

  /** Compatibility shim */
  getBackground(): string { return this.background; }
}
