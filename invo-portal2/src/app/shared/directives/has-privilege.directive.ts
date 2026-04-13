import {
  Directive, Input, OnInit, OnDestroy,
  TemplateRef, ViewContainerRef, inject
} from '@angular/core';
import { PrivilegeService } from '../../core/auth/privileges/privilege.service';

/**
 * Structural directive — shows/hides elements based on privilege path.
 *
 * Usage:
 *   <button *hasPrivilege="'invoiceSecurity.actions.add'">Add Invoice</button>
 *   <li *hasPrivilege="'reportsSecurity.access'">Reports</li>
 */
@Directive({ selector: '[hasPrivilege]', standalone: true })
export class HasPrivilegeDirective implements OnInit {
  @Input('hasPrivilege') permissionPath!: string;

  private tpl              = inject(TemplateRef<any>);
  private vcr              = inject(ViewContainerRef);
  private privilegeService = inject(PrivilegeService);

  ngOnInit(): void {
    this.vcr.clear();
    if (this.privilegeService.check(this.permissionPath)) {
      this.vcr.createEmbeddedView(this.tpl);
    }
  }
}
