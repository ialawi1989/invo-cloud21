import { Component, Input } from '@angular/core';
import { Section } from '../../../../models/page-data/pageData';
import { AppServices } from '../../../../services/appServices';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rich-text-style3',
  imports: [CommonModule],
  templateUrl: './rich-text-style3.component.html',
  styleUrl: './rich-text-style3.component.css'
})
export class RichTextStyle3Component {

  // ── Inputs ────────────────────────────────────────────────────────────────
  @Input() section!: Section;
  @Input() themeBuilder: any = {};
  @Input() background: string = 'white';

  constructor(public appService: AppServices) {}

  /** Compatibility shim */
  getBackground(): string { return this.background; }
}
