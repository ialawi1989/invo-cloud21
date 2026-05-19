import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { RichTextStyle1Component } from "./rich-text-style1/rich-text-style1.component";
import { RichTextStyle2Component } from "./rich-text-style2/rich-text-style2.component";
import { RichTextStyle3Component } from "./rich-text-style3/rich-text-style3.component";
import { Section } from '../../../models/page-data/pageData';

@Component({
  selector: 'app-rich-text-section',
  imports: [
    RichTextStyle1Component,
    RichTextStyle2Component,
    RichTextStyle3Component
  ],
  templateUrl: './rich-text-section.component.html',
  styleUrl: './rich-text-section.component.css'
})
export class RichTextSectionComponent implements OnChanges {

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
