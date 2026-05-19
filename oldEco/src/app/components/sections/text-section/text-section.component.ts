import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Section } from 'src/app/models/page-data/pageData';
import { TextSectionStyle2Component } from "./text-section-style2/text-section-style2.component";
import { TextSectionStyle1Component } from "./text-section-style1/text-section-style1.component";

@Component({
  selector: 'app-text-section',
  imports: [TextSectionStyle2Component, TextSectionStyle1Component],
  templateUrl: './text-section.component.html',
  styleUrl: './text-section.component.css'
})
export class TextSectionComponent implements OnChanges {

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
