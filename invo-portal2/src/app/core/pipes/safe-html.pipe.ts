import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'safeHtml', standalone: true })
export class SafeHtmlPipe implements PipeTransform {
  private san = inject(DomSanitizer);
  transform(v: string): SafeHtml { return this.san.bypassSecurityTrustHtml(v); }
}
