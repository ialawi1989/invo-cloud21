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
