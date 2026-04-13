import { ChangeDetectorRef, Component, Input, OnInit, ViewChild, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeneralHelpers } from '../../../../core/helpers/utils/general';
import { AccountService } from '../../../accounting/services/account.service';
import { BranchService } from '../../../settings/services/branch.service';
import { SharedService } from '../../../shared/services/shared.service';
import { OnChanges } from '@angular/core';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-expire-products',
  templateUrl: './expire-products.component.html',
  styleUrls: ['./expire-products.component.scss']
})
export class ExpireProductsComponent implements OnChanges {


  sortBy: any = {}
  @Input() branchId: any;
  docsData: any = {};

  pageLimit = 7;
  pageNum = 1;

  constructor(
    private accountService: AccountService,
    public branchService: BranchService,
    public sharedService: SharedService,
  ) {
  }

  async ngOnInit() {
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (
      (changes.branchId && changes.branchId.currentValue !== changes.branchId.previousValue)) {
      await this.loadData();
    }
  }
  async loadData() {
    let branch = this.branchId != null ? (typeof this.branchId == "string" ? this.branchId : this.branchId.id) : null
    console.log(this.branchId)
    let tempData: any = await this.accountService.getExpireBatches({
      page: this.pageNum,
      limit: this.pageLimit,
      filter: {
        //branches: this.selectedBranches
        branches: this.branchId == 'All' ? [] : [branch]
      }
    });
    console.log(tempData)
    if (tempData && tempData.records) {
      this.docsData = tempData;
    }

  }

  onSort(value: any) {
    this.sortBy.sortValue = value;

    if (this.sortBy.sortDirection == '' || this.sortBy.sortDirection == null)
      this.sortBy.sortDirection = 'asc';
    else if (this.sortBy.sortDirection == 'asc')
      this.sortBy.sortDirection = 'desc';
    else if (this.sortBy.sortDirection == 'desc')
      this.sortBy = {};
    this.docsData.sort((a: any, b: any) => {
      if (this.sortBy.sortDirection === 'asc') {
        return a[value] - b[value];
      } else if (this.sortBy.sortDirection === 'desc') {
        return b[value] - a[value];
      } else {
        return 0;
      }
    });
  }



  async goToPrevPage() {
    if (this.pageNum > 1) {
      this.pageNum = (+this.pageNum) - 1;
      await this.loadData()
    }
  }

  async goToNextPage() {
    if (this.pageNum < this.docsData.pageCount) {
      this.pageNum = (+this.pageNum) + 1;
      await this.loadData()
    }
  }

  isExpired(date: string | Date): boolean {
    if (!date) return false;
    return new Date(date) < new Date();
  }

  isExpiringSoon(date: string | Date): boolean {
    if (!date) return false;
    const expireDate = new Date(date);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expireDate >= new Date() && expireDate <= thirtyDaysFromNow;
  }
}
