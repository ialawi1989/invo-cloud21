import { Injectable, inject } from '@angular/core';
import { BranchConnectionService } from '@core/layout/services/branch.service';

/**
 * An appointment must always be written against a real branch. A staff
 * member can have no branch assigned (`EmployeeSummary.branchId` is `""`),
 * so fall back to the company's first branch instead of sending `null` —
 * the backend's Estimate pipeline is only reliably exercised with a real
 * branch id (the New Appointment form always sends one).
 */
@Injectable({ providedIn: 'root' })
export class AppointmentBranchService {
  private branches = inject(BranchConnectionService);

  async resolve(employeeBranchId?: string | null): Promise<string | null> {
    if (employeeBranchId) return employeeBranchId;
    try {
      await this.branches.load();
    } catch {
      return null;
    }
    return this.branches.branches()[0]?.id || null;
  }
}
