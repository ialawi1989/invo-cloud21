import { Component, Input } from '@angular/core';
import { Section } from '../../../../models/page-data/pageData';
import { AppServices } from '../../../../services/appServices';
import { CommonModule } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-rich-text-style2',
  imports: [CommonModule],
  templateUrl: './rich-text-style2.component.html',
  styleUrl: './rich-text-style2.component.css'
})
export class RichTextStyle2Component {

  // ── Inputs ────────────────────────────────────────────────────────────────
  @Input() section!: Section;
  @Input() themeBuilder: any = {};
  @Input() background: string = 'white';

  constructor(public appService: AppServices, private sanitizer: DomSanitizer) {}

  /** Compatibility shim */
  getBackground(): string { return this.background; }
}
