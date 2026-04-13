import {
  Directive, Input, OnInit, OnDestroy,
  TemplateRef, ViewContainerRef, inject
} from '@angular/core';
import { Subscription, combineLatest, of, Observable, from } from 'rxjs';
import { FeatureService } from '../../core/auth/feature.service';
import { PermissionService } from '../../core/auth/permission.service';
import { Permission } from '../../core/auth/auth.models';

export interface CanAccessInput {
  feature?:    string;
  permission?: Permission | Permission[];
}

@Directive({ selector: '[canAccess]', standalone: true })
export class CanAccessDirective implements OnInit, OnDestroy {
  @Input('canAccess') access!: CanAccessInput;

  private tpl               = inject(TemplateRef<any>);
  private vcr               = inject(ViewContainerRef);
  private featureService    = inject(FeatureService);
  private permissionService = inject(PermissionService);
  private sub!: Subscription;

  ngOnInit(): void {
    const featureOk  = this.access.feature
      ? this.featureService.isEnabled(this.access.feature)
      : true;

    const permission$ = this.access.permission
      ? Array.isArray(this.access.permission)
        ? this.permissionService.hasAny$(this.access.permission)
        : this.permissionService.has$(this.access.permission)
      : of(true);

    this.sub = permission$.subscribe(p => {
      this.vcr.clear();
      if (featureOk && p) this.vcr.createEmbeddedView(this.tpl);
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }
}
// HasPrivilegeDirective is exported from has-privilege.directive.ts
