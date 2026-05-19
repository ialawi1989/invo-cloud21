import { Component, Input, inject, OnDestroy} from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { FormsModule } from '@angular/forms';
import { ShopService } from '../../../../services/shopServices/shop.service';
import { Product } from '../../../../models/product.model';
import { LoadingService } from '../../../../services/loadingService/loading.service';
import { AppServices } from '../../../../services/appServices';
import { TranslateModule } from '@ngx-translate/core';
import { Invoice } from 'src/app/models/invoice-model';
import { CartService } from 'src/app/services/cartServices/cart.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-selections-selector',
  imports: [
    FormsModule,
    TranslateModule
  ],
  templateUrl: './selections-selector.component.html',
  styleUrl: './selections-selector.component.css'
})

export class SelectionsSelectorComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  private logger = inject(LoggerService);
  @Input() product !: Product;
  @Input() currentCurrency: any;
  invoiceData!: Invoice;

  constructor(
    private shopService: ShopService,
    private loadingService: LoadingService,
    public appService: AppServices,
    private cartService: CartService
  ) {
    setTimeout(() => {
      let fixedSelection: any = [];
      this.product.selection.forEach(select => {
        let selectionGroups = [];
        if (select.noOfSelection > 1) {
          for (let index = 0; index < select.noOfSelection; index++) {
            selectionGroups.push(select);
          }
          fixedSelection.push({
            name: select.name,
            selectionGroups: selectionGroups
          });
        } else {
          fixedSelection.push({
            name: select.name,
            selectionGroups: [select]
          });
        }
      });
      this.product.fixedSelection = fixedSelection;
    }, 1000);
  }

  ngOnInit(): void {
    this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: any) => {
        if (invoiceData) this.invoiceData = invoiceData;
      },
    });
  }

  numberToArray(num: number) {
    return Array.from({ length: num }, (_, i) => i + 1);
  }

  consoleData() {
    // console.log("this.tempSelections", this.tempSelections);
  }

  isMenuSelectionSelected(selectName: any, selectionGroupIndex: any) {
    return this.organizeSelectedMenuSelectionData(this.product.selectedMenuSelectionOptions)?.some((selectionData: any) => {
      if (selectionData.selectName === selectName) {
        return selectionData.selectionGroups?.some((selectionGroupData: any) => {
          return selectionGroupData.selectionGroupName === selectionGroupIndex && selectionGroupData.productId;
        });
      }
      return false;
    }) || false;
  }

  organizeSelectedMenuSelectionData(data: any) {
    let tempData: any = [];
    Object.keys(data).forEach(key => {
      if (data[key] === true) {
        tempData.push(key);
      } else {
        tempData.push(data[key]);
      }
    });

    const result = tempData.reduce((acc: any, queryString: any) => {
      const params: any = new URLSearchParams(queryString);
      const selectName = params.get('selectName');
      const selectionGroup = parseInt(params.get('selectionGroup'));
      const productId = params.get('productId');
      const optionPrice = params.get('optionPrice');
      let optionGroupId = params.get('optionGroupId');
      let optionId = params.get('optionId');

      // Check if the selectName already exists in the accumulator
      let selectNameData = acc.find((item: any) => item.selectName === selectName);
      if (!selectNameData) {
        // If not, create a new object for the selectName
        selectNameData = {
          selectName: selectName,
          selectionGroups: []
        };
        acc.push(selectNameData);
      }

      // Check if the selectionGroup already exists in the selectionGroups array
      let selectionGroupData = selectNameData.selectionGroups.find((item: any) => item.selectionGroupName === selectionGroup);
      if (!selectionGroupData) {
        // If not, create a new object for the selectionGroup
        selectionGroupData = {
          selectionGroupName: selectionGroup,
          productId: productId,
          optionGroups: [],
        };
        selectNameData.selectionGroups.push(selectionGroupData);
      }

      // Check if the option group already exists
      if (optionGroupId) {
        let optionGroupData = selectionGroupData.optionGroups.find((group: any) => group.optionGroupId === optionGroupId);
        if (!optionGroupData) {
          optionGroupData = {
            optionGroupId: optionGroupId,
            options: []
          };
          selectionGroupData.optionGroups.push(optionGroupData);
        }

        // Add the option data to the options array
        if (optionId) {
          optionGroupData.options.push({
            optionId: optionId,
            optionGroupId: optionGroupId,
            optionPrice: optionPrice,
            qty: 1
          });
        }
      }

      return acc;
    }, []);

    return result;
  }

  clearMenuSelectionSelectedOption(selectName: any, selectionGroup: any) {
    // Clear the selected option for the specific select.name and selectionGroup
    delete this.product.selectedMenuSelectionOptions[`selectName=${selectName}&selectionGroup=${selectionGroup}`];
    // Clear any other selected options with the same select.name and selectionGroup
    Object.keys(this.product.selectedMenuSelectionOptions).forEach((key) => {
      if (key.startsWith(`selectName=${selectName}&selectionGroup=${selectionGroup}&`)) {
        delete this.product.selectedMenuSelectionOptions[key];
      }
    });
  }

  async selectMenuSelectionOptions(item: any, selection: any) {
    let isLoadedProductData = false;
    setTimeout(() => {
      if (!isLoadedProductData) {
        this.loadingService.showLoadingSpinner();
      }
    }, 750);
    this.shopService.getProductData({ productId: item.productId, branchId: this.product.branchId, sessionId: this.invoiceData.onlineData.sessionId }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: any) => {
        isLoadedProductData = true;
        this.loadingService.hideLoadingSpinner();
        if (data) {
          //set quantity of product
          if (
            data.type == "menuItem"
            || data.type == "service"
            || data.type == "menuSelection"
            || data.type == "package"
            || data.type == "tailoring"
          ) {
            data.quantity = null;
          } else {
            if (this.product.branchId || data.quantity === 'undefined') {
              data.quantity = 0;
              if (data.branchProduct) {
                data.quantity = data.branchProduct[0].onHand || 0;
              }
            } else {
              if (data.branchProduct) {
                data.quantity = Math.max(...data.branchProduct?.map((branch: any) => branch.onHand)) || 0;
              }
            }
          }
          //set price of product
          let tempPrice = 0;
          if (this.product.branchId) {
            tempPrice = data.price ? data.price : data.branchProduct[0]?.price ? data.branchProduct[0]?.price : data.defaultPrice || 0;
          } else {
            tempPrice = data.price ? data.price : data.defaultPrice;
          }
          data.price = tempPrice;
          //sort options group
          item.optionGroups = data.optionGroups?.sort((a: any, b: any) => a.index - b.index) || [];
          if (data.optionGroups?.length) {
            data.optionGroups?.forEach((group: any) => {
              if (group.options?.length) {
                group.options = group.options?.sort((a: any, b: any) => a.index - b.index) || [];
              }
            })
          }
          //set product price
          item.price = data.price || 0;
        }
      },
      error: (err: any) => {
        this.logger.error(err?.message, { stack: err?.stack, context: 'SelectionsSelectorComponent.fetchProduct' }); // Handle errors
      },
    });

  }

  isMenuSelectionIsNotMinimumSelection(select: any, selectionGroupIndex: any, product: any, group: any) {
    let fixedSelectedMenuSelectionOptionsData = this.fixSelectedMenuSelectionOptionsData(this.product.selectedMenuSelectionOptions);
    let countSelected = 0;
    fixedSelectedMenuSelectionOptionsData?.forEach((selectionData: any) => {
      if (selectionData.selectName == select.name) {
        selectionData.products?.forEach((productData: any) => {
          if (productData.productId == product.productId) {
            productData.options?.forEach((optionData: any) => {
              if (optionData.optionGroupId == group.optionGroupId && optionData.selectionGroup == selectionGroupIndex) {
                countSelected++;
              }
            });
          }
        });
      }
    });
    if (countSelected >= Math.min(group.maxSelectable, group.minSelectable)) {
      return false;
    } else {
      return true;
    }
  }

  fixSelectedMenuSelectionOptionsData(data: any) {
    let tempData: any = [];
    Object.keys(data).forEach(key => {
      if (data[key] == true) {
        tempData.push(key);
      } else {
        tempData.push(data[key]);
      }
    });

    const result = tempData.reduce((acc: any, queryString: any) => {
      const params: any = new URLSearchParams(queryString);
      const selectName = params.get('selectName');
      const selectionGroup = parseInt(params.get('selectionGroup'));
      const optionPrice = params.get('optionPrice');
      const productId = params.get('productId');
      let optionGroupId = params.get('optionGroupId');
      let optionId = params.get('optionId');

      // Check if the selectName already exists in the accumulator
      let selectNameData = acc.find((item: any) => item.selectName === selectName);
      if (!selectNameData) {
        // If not, create a new object for the selectName
        selectNameData = {
          selectName,
          // selectionGroup,
          products: []
        };
        acc.push(selectNameData);
      }

      // Check if the productId already exists in the products array
      // let productData = selectNameData.products.find(item => item.productId === productId);
      // if (!productData) {
      // If not, create a new object for the product
      let productData: any = {
        productId,
        selectionGroup,
        options: []
      };
      selectNameData.products.push(productData);
      // }

      // Add the option data to the options array
      if (optionGroupId && optionId) {
        productData.options.push({
          optionGroupId,
          optionId,
          optionPrice,
          selectionGroup
        });
      }

      return acc;
    }, []);

    return result;
  }

  isMenuSelectionIsMaximumSelection(select: any, selectionGroupIndex: any, product: any, group: any, option: any) {
    if (group.maxSelectable != 1) {
      let fixedSelectedMenuSelectionOptionsData = this.fixSelectedMenuSelectionOptionsData(this.product.selectedMenuSelectionOptions);
      let countSelected = 0;
      let isOptionSameSelectedOptions = false;
      fixedSelectedMenuSelectionOptionsData?.forEach((selectionData: any) => {
        if (selectionData.selectName == select.name) {
          selectionData.products?.forEach((productData: any) => {
            if (productData.productId == product.productId) {
              productData.options?.forEach((optionData: any) => {
                if (optionData.optionGroupId == group.optionGroupId && optionData.selectionGroup == selectionGroupIndex) {
                  if (optionData.optionId == option.optionId) {
                    isOptionSameSelectedOptions = true;
                  } else {
                    countSelected++;
                  }
                }
              });
            }
          });
        }
      });
      if (countSelected >= group.maxSelectable) {
        if (isOptionSameSelectedOptions) {
          return false;
        } else {
          return true;
        }
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  checkMenuSelectionCheckBoxSelection(select: any, selectionGroupIndex: any, product: any, group: any, option: any) {
    if (group.maxSelectable == 1) {
      let fixedSelectedMenuSelectionOptionsData = this.fixSelectedMenuSelectionOptionsData(this.product.selectedMenuSelectionOptions);
      fixedSelectedMenuSelectionOptionsData?.forEach((selectionData: any) => {
        if (selectionData.selectName == select.name) {
          selectionData.products?.forEach((productData: any) => {
            if (productData.productId == product.productId) {
              productData.options?.forEach((optionData: any) => {
                if (optionData.optionGroupId == group.optionGroupId) {
                  if (optionData.optionId != option.optionId) {
                    delete this.product.selectedMenuSelectionOptions[`selectName=${selectionData.selectName}&selectionGroup=${selectionGroupIndex}&productId=${productData.productId}&optionGroupId=${optionData.optionGroupId}&optionId=${optionData.optionId}&optionPrice=${optionData.optionPrice}`];
                  }
                }
              });
            }
          });
        }
      });
    }
  }

  decreaseQty(option: any) {
    if (option.tempQty > 0) {
      option.tempQty--;
    }
  }

  increaseQty(option: any) {
    if (option.tempQty < option.qty) {
      option.tempQty++;
    }
  }




  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
