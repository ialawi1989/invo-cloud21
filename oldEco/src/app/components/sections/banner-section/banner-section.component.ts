import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BannerStyle1Component } from './banner-style1/banner-style1.component';
import { BannerStyle2Component } from "./banner-style2/banner-style2.component";
import { BannerStyle3Component } from "./banner-style3/banner-style3.component";
import { BannerStyle4Component } from "./banner-style4/banner-style4.component";
import { BannerStyle8Component } from "./banner-style8/banner-style8.component";
import { BannerStyle7Component } from "./banner-style7/banner-style7.component";
import { BannerStyle6Component } from "./banner-style6/banner-style6.component";
import { BannerStyle5Component } from "./banner-style5/banner-style5.component";
import { Section } from '../../../models/page-data/pageData';

@Component({
  selector: 'app-banner-section',
  imports: [
    BannerStyle1Component,
    BannerStyle2Component,
    BannerStyle3Component,
    BannerStyle4Component,
    BannerStyle8Component,
    BannerStyle7Component,
    BannerStyle6Component,
    BannerStyle5Component
  ],
  templateUrl: './banner-section.component.html',
  styleUrl: './banner-section.component.css'
})
export class BannerSectionComponent implements OnChanges {

  @Input() style = "Style 1";
  @Input() section!: Section;

  background: string = 'gray';
  youtubeEmbedUrl: SafeResourceUrl | string = '';

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['section'] && this.section) {
      this.background = this.getBackground();
      this.youtubeEmbedUrl = this.buildYoutubeEmbedUrl();
    }
  }

  // ── Shared helpers (used by all banner styles) ────────────────────────────

  getBackground(): string {
    const bg = this.section?.sectionBackground;
    if (!bg) return 'gray';
    if (bg.style === 'Color' && bg.defaultColor) return bg.defaultColor;
    if (bg.style === 'Pattern' && bg.defaultPattern)
      return `url(assets/images/page-builder/patterns/ ${bg.defaultPattern} .png)`;
    if (bg.style === 'Image' && bg.defaultImage?.defaultUrl)
      return `url( ${bg.defaultImage.defaultUrl})`;
    return 'gray';
  }

  buildYoutubeEmbedUrl(): SafeResourceUrl | string {
    const url = this.section?.sectionBackground?.youtubeUrl;
    if (!url) return '';
    let videoId = '';
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtu.be')) {
        videoId = parsed.pathname.slice(1);
      } else if (parsed.hostname.includes('youtube.com')) {
        videoId = parsed.searchParams.get('v') || parsed.pathname.split('/embed/')[1] || '';
      }
    } catch { return ''; }
    if (!videoId) return '';
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&modestbranding=1`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }
}
