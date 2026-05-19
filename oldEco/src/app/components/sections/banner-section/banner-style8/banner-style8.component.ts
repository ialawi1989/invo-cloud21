import { Component, Input } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';
import { Section } from '../../../../models/page-data/pageData';
import { AppServices } from '../../../../services/appServices';

@Component({
  selector: 'app-banner-style8',
  imports: [],
  templateUrl: './banner-style8.component.html',
  styleUrl: './banner-style8.component.css'
})
export class BannerStyle8Component {

  // ── Inputs (set by banner-section parent) ─────────────────────────────────
  @Input() section!: Section;
  @Input() background: string = 'gray';
  @Input() youtubeEmbedUrl: SafeResourceUrl | string = '';

  constructor(public appService: AppServices) {}

  /** Compatibility shim — templates still call getBackground() */
  getBackground(): string { return this.background; }
}
