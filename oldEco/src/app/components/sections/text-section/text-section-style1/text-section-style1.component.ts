import { NgStyle } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Section } from 'src/app/models/page-data/pageData';

@Component({
  selector: 'app-text-section-style1',
  imports: [NgStyle],
  templateUrl: './text-section-style1.component.html',
  styleUrl: './text-section-style1.component.css'
})
export class TextSectionStyle1Component implements OnChanges {

  @Input() section!: Section;
  @Input() themeBuilder: any = {};
  @Input() background: string = 'white';

  getBackground(): string { return this.background; }

  getTextStyles() {
    return {
      color: this.section.sectionData.style.color,
      paddingTop: this.section.sectionData.style.paddingTop + 'px',
      paddingBottom: this.section.sectionData.style.paddingBottom + 'px',
      paddingInlineStart: this.section.sectionData.style.paddingStart + 'px',
      paddingInlineEnd: this.section.sectionData.style.paddingEnd + 'px',
      marginTop: this.section.sectionData.style.paddingTop + 'px',
      marginBottom: this.section.sectionData.style.paddingBottom + 'px',
      marginInlineStart: this.section.sectionData.style.paddingStart + 'px',
      marginInlineEnd: this.section.sectionData.style.paddingEnd + 'px',
      fontSize: this.section.sectionData.style.fontSize + 'px',
      textAlign: this.section.sectionData.style.align,
      fontWeight: this.section.sectionData.style.fontWeight,
      fontStyle: this.section.sectionData.style.fontStyle,
      textDecoration: this.section.sectionData.style.textDecoration,
      whiteSpace: 'pre',
      textWrap: 'auto',
      zIndex: 2,
      position: 'relative'
    };
  }

  ngOnChanges(changes: SimpleChanges) {}
}
