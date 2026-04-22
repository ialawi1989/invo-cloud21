import { ParseOldInvoData } from "@src/models/admin/ParseOldInvoData";
import { Company } from "@src/models/admin/company";
import { FileStorage } from "@src/utilts/fileStorage";
import { OptionRepo } from "../app/product/option.repo";
import { Option } from "@src/models/product/Option";
import { ResponseData } from "@src/models/ResponseData";
import { Category } from "@src/models/product/Category";
import { CategoryRepo } from "../app/product/category.repo";
import { Department } from "@src/models/product/Department";
import { DepartmentRepo } from "../app/product/department.repo";
import { Menu } from "@src/models/product/Menu";
import { MenuSection } from "@src/models/product/MenuSection";
import { Product } from "@src/models/product/Product";
import { MediaRepo } from "../app/settings/media.repo";
import { ProductController } from "@src/controller/app/products/product.controller";
import { CompanyRepo } from "./company.repo";
import { OptionGroupList } from "@src/models/product/OptionGroupList";
import { MenuRepo } from "../app/product/menu.repo";
import { TablesRepo } from "../app/settings/tables.repo";
import { BranchesRepo } from "./branches.repo";
import { EmployeeRepo } from "./employee.repo";
import { DB } from "@src/dbconnection/dbconnection";
import { CompanyGroupRepo } from "./companyGroups.repo";
import { CustomerRepo } from "../app/accounts/customer.repo";
import { SurchargeRepo } from "../app/accounts/surcharge.repo";
import { DiscountRepo } from "../app/accounts/discount.repo";
import { priceManagmentRepo } from "../app/product/priceManagment.repo";
import { PoolClient } from "pg";
import { TaxesRepo } from "../app/accounts/taxes.repo";
import { ProductRepo } from "../app/product/product.repo";


import { name } from "ejs";


export class ImportJsonData {

    options: Option[] = [];
    categoreies: Category[] = [];

    menus: Menu[] = [];
    menuSections: MenuSection[] = [];

    products: Product[] = [];

    public async importData(data: any, company: Company, employeeId: string) {
        const client = await DB.excu.client(1000);
        try {


            // const fileStorage = new FileStorage();
            // data = (await fileStorage.getJsonData()).data
            const branches = await BranchesRepo.getBranchList(client, company.id);
            let branchList = branches.data
            await client.query("BEGIN")
            const priceLabels = data["Price_Labels"];
            await this.insertPriceLabels(client, priceLabels, company)
            const menuModifiers = data["MenuModifiers"];
            await this.insertMenuModifiers(client, menuModifiers, company)
            const menuCategories = data['MenuCategories']
            await this.insertmenuCategories(client, menuCategories, company)
            const menuItmes = data['MenuItems'];
            await this.insertMenuItems(client, menuItmes, branchList, company, employeeId)

            const menuTypes = data['MenuTypes'];
            const menuGroups = data['MenuGroups'];
            const menuItemGroups = data['MenuItemGroups'];

            await this.insertMenu(client, menuTypes, menuGroups, menuItemGroups, branchList, company)
            const dineInSections = data['DineInSections'];
            await this.insertDineInSections(client, dineInSections, company)
            const employees = data['Employees']
            await this.insertEmployees(client, employees, company)
            const customers = data['Customers']
            await this.insertCustomers(client, customers, company)
            const surcharges = data['Surcharges']
            await this.insertSurcharges(client, surcharges, company)

            const discounts = data['Discounts']
            await this.insertDiscounts(client, discounts, company)
            await client.query("COMMIT")
            return new ResponseData(true, "Successfully Uploaded", [])
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
          
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public async insertMenuItems(client: PoolClient, menuItems: any, branches: any[], company: Company, employeeId: string) {
        try {
            const parseData = new ParseOldInvoData();
            if (menuItems) {
                const menuItemProducts = menuItems.filter((f: any) => f.type == 1)
                const packageProducts = menuItems.filter((f: any) => f.type == 2)
                const menuSelectionProducts = menuItems.filter((f: any) => f.type == 3)
                const inventoryProducts = menuItems.filter((f: any) => f.type == 5)

                let taxId = (await TaxesRepo.getDefaultTax(client, company.id)).data.id;

                for (let index = 0; index < inventoryProducts.length; index++) {
                    const element = inventoryProducts[index];
                    const product: any = parseData.menuItemsParse(element, branches, company);
                    product.taxId = taxId;
                    product.createdAt = new Date();
                    if (product.base64Image != "" && product.base64Image != null) {
                        const media = await this.insertToMedia(product.name, product.base64Image, company)
                        if (media.data)
                            product.mediaId = media.data.lastId[0];
                    }
                    let isExist = await ProductRepo.checkIfProductNameExists(client, null, product.name, company.id)
                    if (!isExist) {
                        const resault: any = await ProductController.addNew(client, product, company, employeeId)
                        product.newId = resault.data.id
                        this.products.push(product)
                    }

                }

                await this.insertmenuItemsProducts(client, menuItemProducts, branches, company, employeeId)
                await this.insertmenuSelectionProducts(client, menuSelectionProducts, branches, company, employeeId)
                await this.insertPackageProducts(client, packageProducts, branches, company, employeeId)
            }


            return new ResponseData(true, "", [])
        } catch (error: any) {
          
            console.log(error)
            throw new Error(error)
        }
    }

    public async insertPackageProducts(client: PoolClient, packageItems: [], branches: any[], company: Company, employeeId: string) {
        try {
            const parseData = new ParseOldInvoData();
            let taxId = (await TaxesRepo.getDefaultTax(client, company.id)).data.id;

            for (let index = 0; index < packageItems.length; index++) {
                const element: any = packageItems[index];
                const product: any = parseData.menuItemsParse(element, branches, company);
                product.taxId = taxId;
                if (product.base64Image != "" && product.base64Image != null) {
                    const media = await this.insertToMedia(product.name, product.base64Image, company)
                    product.mediaId = media.data.lastId[0];
                }

                for (let index = 0; index < element.menu_item_combo.length; index++) {
                    const combo = element.menu_item_combo[index];
                    const comboProductId: any = this.products.find((f: any) => f.id == combo.sub_menu_item_id)
                    const productData = {
                        productId: comboProductId.newId,
                        qty: combo.qty
                    }
                    product.package.push(productData)
                }
                let isExist = await ProductRepo.checkIfProductNameExists(client, null, product.name, company.id)
                if (!isExist) {
                    const resault: any = await ProductController.addNew(client, product, company, employeeId)
                    product.newId = resault.data.id
                    this.products.push(product)
                }

            }
        } catch (error: any) {
          
            console.log(error)
            throw new Error(error)
        }
    }

    public async insertmenuSelectionProducts(client: PoolClient, menuSelectionItems: [], branches: any[], company: Company, employeeId: string) {
        try {
            const parseData = new ParseOldInvoData();
            let taxId = (await TaxesRepo.getDefaultTax(client, company.id)).data.id;

            for (let index = 0; index < menuSelectionItems.length; index++) {
                const element: any = menuSelectionItems[index];
                const product: any = parseData.menuItemsParse(element, branches, company);
                product.taxId = taxId;
                if (product.base64Image != "" && product.base64Image != null) {
                    const media = await this.insertToMedia(product.name, product.base64Image, company)
                    product.mediaId = media.data.lastId[0];
                }
                const selectionData: any = {
                    name: "Level ",
                    index: 0,
                    noOfSelection: 0,
                    items: [],
                }
                for (let index = 0; index < element.selections.length; index++) {
                    selectionData.items = [];
                    const selection = element.selections[index];
                    selectionData.noOfSelection = selection.no_of_selection;
                    selectionData.name += selection.level;
                    for (let i = 0; i < selection.Selections.length; i++) {
                        const selectionItems = selection.Selections[index];
                        if (selectionItems) {
                            const selectionProduct: any = this.products.find((f: any) => f.id == selectionItems.menu_item_id)
                            if (selectionProduct) {
                                const productData: any = {
                                    productId: selectionProduct.newId,
                                    index: i
                                }
                                selectionData.items.push(productData);
                            }
                        }

                    }
                    product.selection.push(selectionData)
                }
                let isExist = await ProductRepo.checkIfProductNameExists(client, null, product.name, company.id)
                if (!isExist) {
                    const resault: any = await ProductController.addNew(client, product, company, employeeId)
                    product.newId = resault.data.id
                    this.products.push(product)
                }

            }
        } catch (error: any) {
          
            console.log(error)
            throw new Error(error)
        }
    }

    public async insertmenuItemsProducts(client: PoolClient, menuItems: [], branches: any[], company: Company, employeeId: string) {
        try {
            const parseData = new ParseOldInvoData();
            let taxId = (await TaxesRepo.getDefaultTax(client, company.id)).data.id;

            for (let index = 0; index < menuItems.length; index++) {
                const element: any = menuItems[index];
                const product: any = parseData.menuItemsParse(element, branches, company);
                product.taxId = taxId;
                if (product.base64Image != "" && product.base64Image != null) {
                    const media = await this.insertToMedia(product.name, product.base64Image, company)
                    product.mediaId = media.data.lastId[0];
                }

                if (element.quick_mod != "" && element.quick_mod != null && element.quick_mod.length > 0) {
                    element.quick_mod.forEach((mod: any) => {
                        const option: any = this.options.find((f: any) => f.id == mod.modifier_id);
                        if (option)
                            product.quickOptions.push({ id: option.newId })
                    });
                }
                if (element.popup_mod != "" && element.popup_mod != null && element.popup_mod.length > 0) {
                    for (let index = 0; index < element.popup_mod.length; index++) {
                        const modGroup = element.popup_mod[index];
                        modGroup.title = product.name + " Option Group " + index;
                        const optionGroup: any = parseData.optionGroupParse(modGroup);

                        for (let i = 0; i < modGroup.modifiers.length; i++) {
                            const groupOptions = modGroup.modifiers[i];
                            const option: any = this.options.find((f: any) => f.id == groupOptions.modifier_id)
                            if (option) {
                                const isExist = optionGroup.options.find((f: any) => f.optionId == option.newId)
                                if (!isExist) {
                                    const newOption: any = { index: i, optionId: option.newId };
                                    optionGroup.options.push(newOption)
                                }

                            }
                        }
                        optionGroup.minSelectable = Math.min(optionGroup.minSelectable, optionGroup.options.length);

                        let isExist = await OptionRepo.checkIfOptionGroupTitleExist(client, null, optionGroup.title, company.id);
                        if (!isExist) {
                            const optionGroupInsert = await OptionRepo.InsertOptionGroup(client, optionGroup, company)
                            optionGroup.id = optionGroupInsert.data.id;
                            const gropData = { index: 0, optionGroupId: optionGroup.id }
                            product.optionGroups.push(gropData)
                        }

                    }
                }

                let isExist = await ProductRepo.checkIfProductNameExists(client, null, product.name, company.id)
                if (!isExist) {
                    const resault: any = await ProductController.addNew(client, product, company, employeeId)
                    product.newId = resault.data.id
                    this.products.push(product)
                }

            }
        } catch (error: any) {
          
            console.log(error)
            throw new Error(error)
        }
    }

    public async insertToMedia(productName: string, base64Image: string, company: Company) {
        try {
            base64Image = 'data:image/' + 'jpg' + ';base64,' + base64Image
            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

            // Convert to Buffer
            const buffer = Buffer.from(base64Data, "base64");
            const data = {
                media: buffer,
                name: productName + '.jpg',
                mediaType: {
                    fileType: "image",
                    extension: "jpg"
                }
            }
            const resault = await MediaRepo.importMedia(data, company)

            return resault
        } catch (error: any) {

            throw new Error(error)
        }
    }
    public async insertMenuModifiers(client: PoolClient, menuModifiers: any, company: Company) {
        try {
            const parseData = new ParseOldInvoData();
            if (menuModifiers) {
                for (let index = 0; index < menuModifiers.length; index++) {
                    const element = menuModifiers[index];
                    const option: any = parseData.menuModifierParse(element);

                    let isExist = await OptionRepo.checkIfOptionNameExist(client, null, option.name.trim(), company.id);

                    if (!isExist) {
                        option.createdAt = new Date()
                        const resault = await OptionRepo.addOption(client, option, company)
                        option.newId = resault.data.id
                        this.options.push(option)
                    }

                }
            }



            return new ResponseData(true, "", [])
        } catch (error: any) {
            console.log(error)
          

            throw new Error(error)
        }
    }

    public async insertmenuCategories(client: PoolClient, menuCategories: any, company: Company) {
        try {

            const department = new Department();
            department.name = "Default Department";
            let isExist = await DepartmentRepo.checkDepartmentNameExist(client, null, department.name, company.id)
            if (!isExist) {
                department.createdAt = new Date();
                const departmentData = await DepartmentRepo.addDepartment(client, department, company)
                department.id = departmentData.data.id
            } else {
                department.id = (await DepartmentRepo.getDepartmentId(client, department.name, company.id)).id
            }
            const parseData = new ParseOldInvoData();
            if (menuCategories) {
                for (let index = 0; index < menuCategories.length; index++) {
                    const element = menuCategories[index];
                    const category: any = parseData.menuCategoriesParse(element);
                    category.departmentId = department.id;
                    category.createdAt = new Date();
                    isExist = await CategoryRepo.checkCategoryNameExist(client, null, category.name, company.id)
                    if (!isExist) {
                        const resault = await CategoryRepo.addCategory(client, category, company)
                        category.newId = resault.data.id
                        this.categoreies.push(category)
                    }

                }
            }


            return new ResponseData(true, "", [])
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error)
        }
    }

    public async insertMenu(client: PoolClient, menuTypes: any, menuGroups: any, menuItemGroups: any, branches: any[], company: Company) {
        try {
            let branchIds: any[] = []
            branches.forEach(element => {
                let data = { "branchId": "" }
                data.branchId = element.id;
                branchIds.push(data)
            });

            const parseData = new ParseOldInvoData();
            if (menuTypes) {
                for (let index = 0; index < menuTypes.length; index++) {
                    const element = menuTypes[index];
                    const menu = parseData.menuTypesParse(element);
                    menu.branchIds = branchIds

                    const menuSections = menuGroups.filter((f: any) => f.menu_type_id == element.id)

                    for (let i = 0; i < menuSections.length; i++) {
                        const section = menuSections[i];
                        const menuSection = parseData.menuGroupsParse(section)
                        menuSection.index = index;
                        const sectionProducts = menuItemGroups.filter((f: any) => f.menu_group_id == section.id)
                        sectionProducts.forEach((product: any) => {
                            const productData: any = this.products.find((p: any) => p.id == product.menu_item_id)
                            if (productData) {
                                const sectionProduct = parseData.menuItemGroupsParse(product);
                                sectionProduct.productId = productData.newId;
                                sectionProduct.doubleHeight = sectionProduct.doubleHeight ? sectionProduct.doubleHeight : false;
                                sectionProduct.doubleWidth = sectionProduct.doubleWidth ? sectionProduct.doubleWidth : false;
                                menuSection.products.push(sectionProduct)
                            }

                        });
                        menu.sections.push(menuSection)

                    }

                    menu.startAt = '00:00:00'
                    menu.endAt = '23:59:00'
                    let isExist = await MenuRepo.checkIfMenuNameExist(client, null, menu.name, company.id)
                    if (!isExist) {
                        await MenuRepo.addMenu(client, menu, company)

                    }
                }
            }



            return new ResponseData(true, "", [])
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error)
        }
    }

    public async insertDineInSections(client: PoolClient, dineInSections: any, company: Company) {
        try {
            const parseData = new ParseOldInvoData();

            const branches = await BranchesRepo.getBranchList(client, company.id);
            const branchId = branches.data[0].id;
            if (dineInSections) {
                for (let index = 0; index < dineInSections.length; index++) {
                    const element = dineInSections[index];
                    const table = parseData.dineInSectionsParse(element);
                    table.branchId = branchId;
                    let isExist = await TablesRepo.checkIfGroupNameExist(client, null, table.name, branchId);
                    if (!isExist) {
                        await TablesRepo.addTableGroups(client, table, company.id)

                    }
                }
            }

        } catch (error: any) {
          
            console.log(error)
            throw new Error(error)
        }
    }

    public async insertEmployees(client: PoolClient, employees: any, company: Company) {


        try {

            const parseData = new ParseOldInvoData();

            const branches = await BranchesRepo.getBranchList(client, company.id);
            const companyGroupId = await CompanyRepo.getCompanyGroupId(company.id);
            if (employees) {
                for (let index = 0; index < employees.length; index++) {
                    const element = employees[index];
                    const employee = parseData.employeesParse(element);
                    employee.branches = branches.data
                    employee.companyGroupId = companyGroupId.data.id;
                    employee.companyId = company.id;
                    employee.createdAt = new Date();
                    let isExist = false;
                    if (employee.email) {
                        isExist = await EmployeeRepo.checkEmployEmailExist(client, null, employee.email)

                    }
                    if (!isExist) {
                        await EmployeeRepo.InsertEmployee(client, employee, company.id)

                    }
                }

            }


        } catch (error: any) {

          
            console.log(error)
            throw new Error(error)
        }
    }


    public async insertCustomers(client: PoolClient, customers: any, company: Company) {

        try {

            const parseData = new ParseOldInvoData();
            if (customers) {
                for (let index = 0; index < customers.length; index++) {
                    const element = customers[index];
                    const customer = parseData.customerParse(element);

                    let isExist = await CustomerRepo.checkIfCustomerExists(customer.phone, company.id, client)
                    if (typeof customer.name != "string") {
                        console.log(customer)
                    }
                    if (typeof customer.name === "string" && customer.name.trim() != "" && customer.name != null && !isExist)
                        await CustomerRepo.addCustomer(client, customer, company)
                }

            }

        } catch (error: any) {
          
            console.log(error)
            throw new Error(error)
        }
    }


    public async insertSurcharges(client: PoolClient, surcharges: any, company: Company) {


        try {
            const parseData = new ParseOldInvoData();
            if (surcharges) {
                for (let index = 0; index < surcharges.length; index++) {
                    const element = surcharges[index];
                    const surcharge = parseData.surchargeParse(element);

                    let isExist = await SurchargeRepo.checkIfSurchargeNameExists(client, null, surcharge.name, company.id)


                    if (surcharge.name != "" && surcharge.name != null && !isExist)
                        await SurchargeRepo.addSurcharge(client, surcharge, company.id)
                }
            }

        } catch (error: any) {
          
            console.log(error)
            throw new Error(error)
        }
    }

    public async insertDiscounts(client: PoolClient, discounts: any, company: Company) {


        try {
            const parseData = new ParseOldInvoData();
            if (discounts) {
                for (let index = 0; index < discounts.length; index++) {
                    const element = discounts[index];
                    const discount = parseData.discountParse(element);
                    const isExist = await DiscountRepo.checkDiscountNameExist(client, null, discount.name, company.id)

                    if (discount.name != "" && discount.name != null && !isExist)
                        await DiscountRepo.addDiscount(client, discount, company)
                }
            }

        } catch (error: any) {
          
            console.log(error)
            throw new Error(error)
        }
    }

    public async insertPriceLabels(client: PoolClient, priceLabels: any, company: Company) {


        try {

            const labels: any = [];
            const parseData = new ParseOldInvoData();
            if (priceLabels) {
                for (let index = 0; index < priceLabels.length; index++) {
                    const element = priceLabels[index];
                    const priceLabel = parseData.priceLabelsParse(element);
                    if (priceLabel.name != "" && priceLabel.name != null) {
                        priceLabel.createdAt = new Date()
                        // const isNameExist = await priceManagmentRepo.checkIfPriceLableNameExist(null,priceLabel.name,company.id)

                        if (labels.find((f: any) => f.name == priceLabel.name) && index != 0) {
                            continue;
                        }

                        let isExist = await priceManagmentRepo.checkIfPriceLableNameExist(client, null, priceLabel.name, company.id)
                        if (!isExist) {
                            await priceManagmentRepo.addPriceLabel(client, priceLabel, company)

                        }
                    }
                    labels.push(priceLabel)
                }
            }


        } catch (error: any) {
          
            console.log(error)

            throw new Error(error)
        }
    }
}