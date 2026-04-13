import { Component,OnChanges,SimpleChanges,Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccountService } from '../../../accounting/services/account.service';
import { BranchService } from '../../../settings/services/branch.service';

@Component({
  standalone: true,
  imports: [CommonModule, TranslateModule],
  selector: 'app-low-qty-products',
  templateUrl: './low-qty-products.component.html',
  styleUrls: ['./low-qty-products.component.scss']
})
export class LowQtyProductsComponent implements OnInit, OnChanges {

  sortBy: any = {}
  @Input() branchId: any = "";
  docs: any = [];

  constructor(
    private accountService: AccountService,
    public branchService: BranchService,
  ) {
  }

  async ngOnInit() {
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (
      (changes.branchId && changes.branchId.currentValue !== changes.branchId.previousValue)) {
      await this.loadReorderProducts();
    }
  }

  async loadReorderProducts() {
    let branch = this.branchId!= null ? (typeof this.branchId=="string" ? this.branchId: this.branchId.id) : null

    let tempData: any = await this.accountService.reorderProducts({
      branchId: branch
    });
    if (tempData && tempData.data && tempData.data.length > 0) {
      this.docs = tempData.data;
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
    this.docs.sort((a: any, b: any) => {
      if (this.sortBy.sortDirection === 'asc') {
        return a[value] - b[value];
      } else if (this.sortBy.sortDirection === 'desc') {
        return b[value] - a[value];
      } else {
        return 0;
      }
    });
  }

}
