import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Section } from 'src/app/models/page-data/pageData';

@Component({
  selector: 'app-text-section-style2',
  imports: [],
  templateUrl: './text-section-style2.component.html',
  styleUrl: './text-section-style2.component.css'
})
export class TextSectionStyle2Component implements OnChanges {

  @Input() section!: Section;
  @Input() themeBuilder: any = {};
  @Input() background: string = 'white';

  sanitizedHtml: any;

  constructor(private sanitizer: DomSanitizer) {}

  getBackground(): string { return this.background; }

  ngOnChanges(changes: SimpleChanges) {
    if (this.section?.sectionData?.body) {
      this.sanitizedHtml = this.sanitizer.bypassSecurityTrustHtml(this.section.sectionData.body);
    }
  }
}
