import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { resolveAvatarUrl } from './auth.models';
import { EmployeeService } from '../../features/employees/services/employee.service';

/**
 * The signed-in employee's picture. The copy stored at sign-in can predate the picture (it is set later in My Account, or
 * on another device), so once per session the employee record is read and its picture is put on the stored employee:
 * the top bar and the account menu then show it. Failing quietly is fine: the initials stay.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeAvatarService {
  private auth = inject(AuthService);
  private employees = inject(EmployeeService);
  private synced = false;

  async sync(): Promise<void> {
    const emp = this.auth.currentEmployee;
    if (this.synced || !emp?.id) return;
    this.synced = true;
    try {
      const full = await this.employees.getOne(emp.id);
      // The sign-in copy may carry no e-mail; the account menu shows it, so keep it in step too.
      if (full?.email && full.email !== emp.email) this.auth.patchEmployee({ email: full.email });
      const url = full?.mediaUrl?.defaultUrl;
      if (url && url !== (emp as any).mediaUrl?.defaultUrl) this.auth.patchEmployee({ mediaUrl: full!.mediaUrl, mediaId: full!.mediaId } as any);
      else if (!url && resolveAvatarUrl(emp)) this.auth.patchEmployee({ mediaUrl: null, mediaId: null } as any); // the picture was removed elsewhere
    } catch { this.synced = false; /* try again next time */ }
  }
}
