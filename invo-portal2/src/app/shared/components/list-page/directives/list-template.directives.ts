import { Directive, Input, TemplateRef } from '@angular/core';

/**
 * Directive for projecting custom cell templates
 * Usage:
 * <ng-template listCellTemplate="columnKey" let-row let-col="col">
 *   <custom-component [data]="row"></custom-component>
 * </ng-template>
 */
@Directive({
  selector: '[listCellTemplate]',
  standalone: true
})
export class ListCellTemplateDirective {
  @Input('listCellTemplate') columnKey!: string;

  constructor(public template: TemplateRef<any>) {}
}

/**
 * Directive for projecting custom header templates
 * Usage:
 * <ng-template listHeaderTemplate let-col="col">
 *   <custom-header [column]="col"></custom-header>
 * </ng-template>
 */
@Directive({
  selector: '[listHeaderTemplate]',
  standalone: true
})
export class ListHeaderTemplateDirective {
  constructor(public template: TemplateRef<any>) {}
}

/**
 * Directive for projecting custom row actions
 * Usage:
 * <ng-template listRowActions let-row>
 *   <button (click)="customAction(row)">Action</button>
 * </ng-template>
 */
@Directive({
  selector: '[listRowActions]',
  standalone: true
})
export class ListRowActionsDirective {
  constructor(public template: TemplateRef<any>) {}
}

/**
 * Mobile-card thumbnail slot (left, ~38×31). Absent → a default placeholder.
 * Usage: <ng-template listMobileThumb let-row> … </ng-template>
 */
@Directive({ selector: '[listMobileThumb]', standalone: true })
export class ListMobileThumbDirective {
  constructor(public template: TemplateRef<any>) {}
}

/**
 * Mobile-card line-1 slot — title text (truncated by the frame) + status badge.
 * Usage: <ng-template listMobileTitle let-row> … </ng-template>
 */
@Directive({ selector: '[listMobileTitle]', standalone: true })
export class ListMobileTitleDirective {
  constructor(public template: TemplateRef<any>) {}
}

/**
 * Mobile-card line-2 conditional chip(s) (e.g. "1/2 translated"). Self-guard
 * with @if so nothing renders when irrelevant.
 * Usage: <ng-template listMobileChip let-row> … </ng-template>
 */
@Directive({ selector: '[listMobileChip]', standalone: true })
export class ListMobileChipDirective {
  constructor(public template: TemplateRef<any>) {}
}
