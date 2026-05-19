import { Component, Input } from '@angular/core';
import { OptionGroup } from '../../../../models/option_groups.model';
import { Option } from '../../../../models/option.model';
import { FormsModule } from '@angular/forms';
import { Product } from '../../../../models/product.model';
import { AppServices } from '../../../../services/appServices';

@Component({
  selector: 'app-option-groups-selector',
  imports: [
    FormsModule
  ],
  templateUrl: './option-groups-selector.component.html',
  styleUrl: './option-groups-selector.component.css'
})

export class OptionGroupsSelectorComponent {

  @Input() product !: Product  ;
  @Input() currentCurrency: any;

  constructor(
    public appService: AppServices,
  ){}

  isMinimumSelection(group:any) {
    let countSelected = 0;
    group.options.forEach((option:any) => {
      if (option.isSelected) {
        countSelected++;
      }
    })
    if (countSelected >= group.minSelectable) {
      return true;
    } else {
      return false;
    }
  }

  isMaximumSelection(group:any, option:any) {
    let countSelected = 0;
    group.options.forEach((option:any) => {
      if (option.isSelected) {
        countSelected++;
      }
    })
    if (group.maxSelectable == 1) {
      return false;
    } else {
      if (countSelected >= group.maxSelectable) {
        if (option.isSelected) {
          return false;
        } else {
          return true
        }
      } else {
        return false;
      }
    }
  }

  checkCheckBoxSelection(group:any, option:any) {
    if (group.maxSelectable == 1) {
      group.options.forEach((groupOption:any) => {
        groupOption.isSelected = false;
      })
    }
    option.isSelected = true;
  }


}
