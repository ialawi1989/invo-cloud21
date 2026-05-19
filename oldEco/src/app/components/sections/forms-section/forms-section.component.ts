import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormSectionStyle1Component } from "./form-section-style1/form-section-style1.component";
import { Section } from '../../../models/page-data/pageData';

@Component({
  selector: 'app-forms-section',
  imports: [FormSectionStyle1Component],
  templateUrl: './forms-section.component.html',
  styleUrl: './forms-section.component.css'
})
export class FormsSectionComponent implements OnChanges {

  @Input() style = "Style 1";
  @Input() section!: Section;

  // ── Shared state passed down to style children ────────────────────────────
  background: string = 'white';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['section'] && this.section) {
      this.background = this.getBackground();
    }
  }

  getBackground(): string {
    const bg = this.section?.sectionBackground;
    if (!bg) return 'white';
    if (bg.style === 'Color' && bg.defaultColor) return bg.defaultColor;
    if (bg.style === 'Pattern' && bg.defaultPattern)
      return `url(assets/images/page-builder/patterns/ ${bg.defaultPattern} .png)`;
    if (bg.style === 'Image' && bg.defaultImage?.defaultUrl)
      return `url( ${bg.defaultImage.defaultUrl})`;
    return 'white';
  }
}
