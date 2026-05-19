import { Component, Input } from '@angular/core';
import { Product } from '../../../../models/product.model';
import { FormsModule } from '@angular/forms';
import { AppServices } from '../../../../services/appServices';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-package-selector',
  imports: [
    FormsModule,
    TranslateModule
  ],
  templateUrl: './package-selector.component.html',
  styleUrl: './package-selector.component.css'
})
export class PackageSelectorComponent {

  @Input() product !: Product;
  @Input() currentCurrency: any;

  constructor(
    public appService: AppServices,
  ) {
    setTimeout(() => {
      let fixedPackage:any = [];
      this.product.package.forEach((pkg:any, index) => {
        let packageGroups = [];
        if (pkg.qty > 1) {
          for (let index = 0; index < pkg.qty; index++) {
            packageGroups.push(pkg);
          }
          fixedPackage.push({
            name: "package" + index,
            packageGroups: packageGroups
          });
        } else {
          fixedPackage.push({
            name: "package" + index,
            packageGroups: [pkg]
          });
        }
      });
      this.product.fixedPackage = fixedPackage;
      
    }, 1000);
  }


  isPackageIsNotMinimumSelection(packge: any, packageGroupIndex: any, product: any, group: any) {
    let fixedSelectedPackageOptionsData = this.fixSelectedPackageOptionsData(this.product.selectedPackageOptions);
    let countSelected = 0;
    fixedSelectedPackageOptionsData?.forEach((packageData: any) => {
      if (packageData.packageName == packge.name) {
        packageData.products?.forEach((productData: any) => {
          if (productData.productId == product.productId) {
            productData.options?.forEach((optionData: any) => {
              if (optionData.optionGroupId == group.optionGroupId && optionData.packageGroup == packageGroupIndex) {
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

  fixSelectedPackageOptionsData(data: any) {
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
      const packageName = params.get('packageName');
      const packageGroup = parseInt(params.get('packageGroup'));
      const optionPrice = params.get('optionPrice');
      const productId = params.get('productId');
      let optionGroupId = params.get('optionGroupId');
      let optionId = params.get('optionId');

      // Check if the packageName already exists in the accumulator
      let packageNameData = acc.find((item: any) => item.packageName === packageName);
      if (!packageNameData) {
        // If not, create a new object for the packageName
        packageNameData = {
          packageName,
          // packageGroup,
          products: []
        };
        acc.push(packageNameData);
      }

      // Check if the productId already exists in the products array
      // let productData = packageNameData.products.find(item => item.productId === productId);
      // if (!productData) {
      // If not, create a new object for the product
      let productData: any = {
        productId,
        packageGroup,
        options: []
      };
      packageNameData.products.push(productData);
      // }

      // Add the option data to the options array
      if (optionGroupId && optionId) {
        productData.options.push({
          optionGroupId,
          optionId,
          optionPrice,
          packageGroup
        });
      }

      return acc;
    }, []);

    return result;
  }

  isPackageIsMaximumSelection(packge: any, packageGroupIndex: any, product: any, group: any, option: any) {
    if (group.maxSelectable != 1) {
      let fixedSelectedPackageOptionsData = this.fixSelectedPackageOptionsData(this.product.selectedPackageOptions);
      let countSelected = 0;
      let isOptionSameSelectedOptions = false;
      fixedSelectedPackageOptionsData?.forEach((packageData: any) => {
        if (packageData.packageName == packge.name) {
          packageData.products?.forEach((productData: any) => {
            if (productData.productId == product.productId) {
              productData.options?.forEach((optionData: any) => {
                if (optionData.optionGroupId == group.optionGroupId && optionData.packageGroup == packageGroupIndex) {
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

  checkPackageCheckBoxSelection(packge: any, packageGroupIndex: any, product: any, group: any, option: any) {
    if (group.maxSelectable == 1) {
      let fixedSelectedPackageOptionsData = this.fixSelectedPackageOptionsData(this.product.selectedPackageOptions);
      fixedSelectedPackageOptionsData?.forEach((packageData: any) => {
        if (packageData.packageName == packge.name) {
          packageData.products?.forEach((productData: any) => {
            if (productData.productId == product.productId) {
              productData.options?.forEach((optionData: any) => {
                if (optionData.optionGroupId == group.optionGroupId) {
                  if (optionData.optionId != option.optionId) {
                    delete this.product.selectedPackageOptions[`packageName=${packageData.packageName}&packageGroup=${packageGroupIndex}&productId=${productData.productId}&optionGroupId=${optionData.optionGroupId}&optionId=${optionData.optionId}&optionPrice=${optionData.optionPrice}`];
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

}
