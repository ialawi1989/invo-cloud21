import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-alignment-buttons',
  template: `
    <div class="alignment-buttons">
      <button type="button" class="btn-alignment"
              [class.active]="alignment === 'left'"
              (click)="setAlignment('left')">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="17" y1="10" x2="3" y2="10"></line>
          <line x1="21" y1="6" x2="3" y2="6"></line>
          <line x1="21" y1="14" x2="3" y2="14"></line>
          <line x1="17" y1="18" x2="3" y2="18"></line>
        </svg>
      </button>
      <button type="button" class="btn-alignment"
              [class.active]="alignment === 'center'"
              (click)="setAlignment('center')">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="10" x2="6" y2="10"></line>
          <line x1="21" y1="6" x2="3" y2="6"></line>
          <line x1="21" y1="14" x2="3" y2="14"></line>
          <line x1="18" y1="18" x2="6" y2="18"></line>
        </svg>
      </button>
      <button type="button" class="btn-alignment"
              [class.active]="alignment === 'right'"
              (click)="setAlignment('right')">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="21" y1="10" x2="7" y2="10"></line>
          <line x1="21" y1="6" x2="3" y2="6"></line>
          <line x1="21" y1="14" x2="3" y2="14"></line>
          <line x1="21" y1="18" x2="7" y2="18"></line>
        </svg>
      </button>
    </div>
  `,
  styleUrls: ['./alignment-buttons.component.scss']
})
export class AlignmentButtonsComponent {
  @Input() alignment: string = 'left';
  @Output() alignmentChange = new EventEmitter<string>();

  setAlignment(value: string): void {
    this.alignment = value;
    this.alignmentChange.emit(this.alignment);
  }
}
