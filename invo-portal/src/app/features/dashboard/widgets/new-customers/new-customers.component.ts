import { ChangeDetectorRef, Component, OnChanges, OnInit, ViewChild, SimpleChanges, OnDestroy, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as moment from 'moment';
import { Customer } from '../../../customers/models/customer';
import { BranchService } from '../../../settings/services/branch.service';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  standalone: true,
  imports: [CommonModule, TranslateModule],
  selector: 'new-customers',
  templateUrl: './new-customers.component.html',
  styleUrls: ['./new-customers.component.scss']
})
export class NewCustomersComponent implements OnInit, OnChanges {

  customerList: Customer[] = [];
  @Input() currentBranch: any;

  // Modern color palette for avatars
  private avatarColors: string[] = [
    '#00aab3', // Teal (brand)
    '#7c3aed', // Purple
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#14b8a6', // Teal light
    '#f97316'  // Orange
  ];

  constructor(
    private dashboardService: DashboardService,
    public branchService: BranchService,
  ) { }

  async ngOnInit() {
    await this.loadData();
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (
      (changes.currentBranch && changes.currentBranch.currentValue !== changes.currentBranch.previousValue)) {
      await this.loadData();
    }
  }

  async loadData() {
    let branch = this.currentBranch != null ? (typeof this.currentBranch == "string" ? this.currentBranch : this.currentBranch.id) : null

    let data = { branchId: branch };
    let response = await this.dashboardService.getNewCustomers();

    this.customerList = response;

    this.customerList.forEach((element: any) => {
      element['ago'] = moment.default(element.createdAt).fromNow(true);
    });
  }

  /**
   * Get avatar color based on index
   */
  getAvatarColor(index: number): string {
    return this.avatarColors[index % this.avatarColors.length];
  }

  /**
   * Get initials from customer name
   */
  getInitials(name: string): string {
    if (!name) return '?';

    const parts = name.trim().split(' ').filter(part => part.length > 0);

    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
}
