import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-font-style-buttons',
  template: `
    <div class="font-style-buttons">
      <button type="button" class="btn-font-style"
              [class.active]="bold"
              (click)="toggleBold()">
        <strong>B</strong>
      </button>
      <button type="button" class="btn-font-style"
              [class.active]="italic"
              (click)="toggleItalic()">
        <em>I</em>
      </button>
      <button type="button" class="btn-font-style"
              [class.active]="underline"
              (click)="toggleUnderline()">
        <u>U</u>
      </button>
    </div>
  `,
  styleUrls: ['./font-style-buttons.component.scss']
})
export class FontStyleButtonsComponent {
  @Input() bold: boolean = false;
  @Input() italic: boolean = false;
  @Input() underline: boolean = false;

  @Output() boldChange = new EventEmitter<boolean>();
  @Output() italicChange = new EventEmitter<boolean>();
  @Output() underlineChange = new EventEmitter<boolean>();

  toggleBold(): void {
    this.bold = !this.bold;
    this.boldChange.emit(this.bold);
  }

  toggleItalic(): void {
    this.italic = !this.italic;
    this.italicChange.emit(this.italic);
  }

  toggleUnderline(): void {
    this.underline = !this.underline;
    this.underlineChange.emit(this.underline);
  }
}
