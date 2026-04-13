import { Component, OnDestroy, Input, OnInit, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BranchService } from '../../../settings/services/branch.service';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  standalone: true,
  imports: [CommonModule, TranslateModule],
  selector: 'open-cashiers',
  templateUrl: './number-of-open-cashiers.component.html',
  styleUrls: ['./number-of-open-cashiers.component.scss']
})
export class OpenCashiersComponent implements OnInit, OnDestroy {

  reportData: any;
  @Input() currentBranch: any;

  constructor(
    private dashboardService: DashboardService,
    public branchService: BranchService,
  ) { }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (
      (changes.currentBranch && changes.currentBranch.currentValue !== changes.currentBranch.previousValue)) {
      await this.loadData();
    }
  }
  async loadData() {
    let branch = this.currentBranch != null ? (typeof this.currentBranch  =="string" ? this.currentBranch : this.currentBranch.id) : null

    let data = { branchId: branch };
    let response = await this.dashboardService.numberOfOpenCashiers();

    this.reportData = response;

  }
}
