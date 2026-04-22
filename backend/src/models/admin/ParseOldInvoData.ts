import { Branch } from "aws-sdk/clients/sagemaker";
import { GroupProperties, TableGroups } from "../Settings/TableGroups";
import { TableProperties, Tables } from "../Settings/Tables";
import { Customer, CustomerAddress } from "../account/Customer";
import { Discount } from "../account/Discount";
import { Surcharge } from "../account/Surcharge";
import { Category } from "../product/Category";
import { Menu } from "../product/Menu";
import { MenuSection } from "../product/MenuSection";
import { MenuSectionProduct } from "../product/MenuSectionProduct";
import { Option } from "../product/Option";
import { OptionGroup } from "../product/OptionGroup";
import { Product } from "../product/Product";
import { Employee } from "./employee";
import { BranchProducts } from "../product/BranchProducts";
import { Company } from "./company";
import { PriceLabel } from "../product/PriceLabel";


/**
 * 
 * to parse data from old invo  when importing company Data 
 * 
 */
export class ParseOldInvoData {


    menuModifierParse(json: any) {
        const option = new Option();
        option.ParseJson(json)
        for (const key in json) {
            switch (key) {
                case 'display_name':
                    option.displayName = json[key]
                    break;
                case 'additional_price':
                    option.price = json[key]
                    break;
                case 'is_multiple':
                    option.isMultiple = json[key]
                    break;
                case 'is_visible':
                    option.isVisible = json[key]
                    break;
                default:
                    break;
            }
        }
        return option;
    }

    menuCategoriesParse(json: any) {
        const category = new Category();
        category.ParseJson(json)
        for (const key in json) {
        }
        return category;
    }

    optionGroupParse(json: any) {
        const optionGroup = new OptionGroup();
        optionGroup.ParseJson(json);
        for (const key in json) {

            switch (key) {
                case 'is_forced':
                    optionGroup.minSelectable = json[key] ? 1 : 0
                    break;
                case 'repeat':
                    optionGroup.maxSelectable = json[key]
                    break;
                default:
                    break;
            }

        }
        return optionGroup;
    }

    menuItemsParse(json: any, branches: any[], company: Company) {
        const product = new Product();
        product.ParseJson(json)

        for (let index = 0; index < branches.length; index++) {
            const element: any = branches[index];
            const branchProduct = new BranchProducts();
            branchProduct.companyId = company.id;
            branchProduct.branchId = element.id;
            branchProduct.price = null;
            product.branchProduct.push(branchProduct)
        }
        for (const key in json) {

            switch (key) {
                case 'default_price':
                    product.defaultPrice = json[key]
                    break;
                case 'icon':
                    product.base64Image = json[key]
                    break;
                case 'type':
                    switch (json[key]) {
                        case 1:
                            product.type = 'menuItem'
                            break;
                        case 2:
                            product.type = 'package'
                            break;
                        case 3:
                            product.type = 'menuSelection'
                            break;
                        case 5:
                            product.type = 'inventory'
                            break;
                        default:
                            break;
                    }
                    break;
                case 'default_forecolor':
                    product.color = json[key]
                    break;
                default:
                    break;
            }

        }
        return product;
    }
    menuTypesParse(json: any) {
        const menu = new Menu();
        menu.ParseJson(json)
        for (const key in json) {
        }

        return menu;
    }

    menuGroupsParse(json: any) {
        const menuSection = new MenuSection();
        menuSection.ParseJson(json)

        if (json['backcolor'] != null && json['backcolor']!= "") {
            menuSection.properties = { "color": { "colorName": "Default", "borderColor": "rgba(202, 0, 80, 1)", "colorStart": "rgba(202, 0, 80,1)", "colorEnd": "rgba(202, 0, 80,1)" } };
        }

        for (const key in json) {
            if (key == "backcolor") {

            }
        }
        return menuSection;
    }
    menuItemGroupsParse(json: any) {
        const menuItemGroup = new MenuSectionProduct();
        menuItemGroup.ParseJson(json)

        for (const key in json) {
            switch (key) {
                case "double_height":
                    menuItemGroup.doubleHeight = json[key]
                    break;
                case "double_width":
                    menuItemGroup.doubleWidth = json[key]
                    break;
                default:
                    break;
            }
        }
        return menuItemGroup;
    }

    dineInSectionsParse(json: any) {
        const dineInSection = new TableGroups();
        dineInSection.ParseJson(json)

        dineInSection.properties = new GroupProperties()

        for (const key in json) {
            dineInSection.tables = []
            if (key == "tables") {
                json[key].forEach((tableTemp: any) => {
                    const table: any = new Tables();
                    table.ParseJson(tableTemp)
                    const postion = tableTemp.postion.split(",");
                    table.maxSeat = 8;
                    table.properties = new TableProperties();
                    table.properties.position.x = +postion[0] ? +postion[0] : 0
                    table.properties.position.y = +postion[1] ? +postion[1] : 0
                    if (table.properties == undefined) {

                    }
                    dineInSection.tables.push(table)
                });

            }
        }
        return dineInSection;
    }

    employeesParse(json: any) {
        const employee = new Employee();
        employee.ParseJson(json)
        for (const key in json) {
            switch (key) {
                case "password":
                    employee.password = "";
                    employee.passCode = json[key]
                    break;

                default:
                    break;
            }
        }
        return employee
    }

    customerParse(json: any) {
        const customer = new Customer();
        customer.ParseJson(json)
        const customerAddress = new CustomerAddress();
        customer.addresses = []
        for (const key in json) {
            if (key == "addresses") {
                json[key].forEach((address: any) => {
                    let addressLine1 = address.address_line1;
                    let addressLine2 = address.address_line2;

                    if (addressLine1) {
                        customerAddress.title = "Address Line 1"
                        addressLine1 = addressLine1.split(";")
                        addressLine1.forEach((addressPart: any) => {
                            addressPart = addressPart.split(":")
                            switch (addressPart[0]) {
                                case "Flat":
                                    customerAddress.flat = addressPart[1]
                                    break;
                                case "Building":
                                    customerAddress.building = addressPart[1]
                                    break;
                                case "Road":
                                    customerAddress.road = addressPart[1]
                                    break;
                                case "Block":
                                    customerAddress.block = addressPart[1]
                                    break;
                                case "City":
                                    customerAddress.city = addressPart[1]
                                    break;
                                default:
                                    break;
                            }
                        });

                        customer.addresses.push(customerAddress)
                    }
                    if (addressLine2) {
                        customerAddress.title = "Address Line 2"
                        addressLine2 = addressLine2.split(";")
                        addressLine2.forEach((addressPart: any) => {
                            addressPart = addressPart.split(":")
                            switch (addressPart[0]) {
                                case "Flat":
                                    customerAddress.flat = addressPart[1]
                                    break;
                                case "Building":
                                    customerAddress.building = addressPart[1]
                                    break;
                                case "Road":
                                    customerAddress.road = addressPart[1]
                                    break;
                                case "Block":
                                    customerAddress.block = addressPart[1]
                                    break;
                                case "City":
                                    customerAddress.city = addressPart[1]
                                    break;
                                default:
                                    break;
                            }
                        });

                        customer.addresses.push(customerAddress)
                    }
                });
            }
            if (key == "note") {
                customer.notes.push(json[key])
            }

            if (key == "contacts") {
                const contact1 = json[key][0]
                const contact2 = json[key][1]

                customer.phone = contact1 ? contact1.contact : "";
                customer.mobile = contact2 ? contact2.contact : "";
            }
        }
        return customer
    }

    surchargeParse(json: any) {
        const surcharge = new Surcharge();
        surcharge.ParseJson(json)
        for (const key in json) {
            switch (key) {
                case "is_percentage":
                    surcharge.percentage = json[key]
                    break;

                default:
                    break;
            }
        }
        return surcharge
    }

    discountParse(json: any) {
        const discount = new Discount();
        discount.ParseJson(json)
        for (const key in json) {
            switch (key) {
                case "is_percentage":
                    discount.percentage = json[key]
                    break;

                default:
                    break;
            }
        }
        return discount
    }

    priceLabelsParse(json: any) {
        const label = new PriceLabel();
        label.ParseJson(json)
        for (const key in json) {
            switch (key) {
                case "Name":
                    label.name = json[key]
                    break;

                default:
                    break;
            }
        }
        return label
    }
}