import { Company } from "@src/models/admin/company"
import { DB } from "../../dbconnection/dbconnection"

import { ResponseData } from "@src/models/ResponseData"
import { Employee } from "@src/models/admin/employee"

import { CompanyGroupValidation } from "@src/validationSchema/admin/companyGroups.Schema"
import { CompanyGroup } from "@src/models/admin/companyGroup"
import { CompanyRepo } from "./company.repo"


import { PoolClient } from "pg"
import { ValidationException } from "@src/utilts/Exception"
import { values } from "lodash"


export class CompanyGroupRepo {


  public static async checkCompanyGroupNameExist(client: PoolClient, id: string | null, name: string) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "CompanyGroups" where id <> $1 and LOWER(name) = LOWER($2)`,
      values: [
        id,
        name,
      ],
    }

    if (id == null) {
      query.text = `SELECT count(*) as qty FROM "CompanyGroups" where LOWER(name) = LOWER($1)`
      query.values = [name]
    }
    const resault = await client.query(query.text, query.values)
    if ((<any>resault.rows[0]).qty > 0) {
      return true
    }
    return false
  }








  public static async getAdminLog() {
    const client = await DB.excu.client()
    try {
      await client.query("BEGIN")
      const query: { text: string } = {
        text: `select a2."name" , a.log, a."createdAt"  from adminlogs a join admins a2 on a.adminid  = a2.id`,
      }
      const logInsert = await client.query(query.text);
      const rows = (<any>logInsert.rows)
      await client.query("COMMIT")
      // return rows;

      return new ResponseData(true, "", rows);
    } catch (e) {
      await client.query("ROLLBACK")
    } finally {
      client.release()
    }

  }




  public static async getAllAdminInvoices() {
    const client = await DB.excu.client(30, 'Admin')
    try {
      await client.query("BEGIN")
      const query: { text: string } = {
        text: `select * from "Invoices"`,
      }
      const logInsert = await client.query(query.text);
      const rows = (<any>logInsert.rows)
      await client.query("COMMIT")
      // return rows;

      return new ResponseData(true, "", rows);
    } catch (e) {
      await client.query("ROLLBACK")
    } finally {
      client.release()
    }

  }








 static formatQuery(queryText: any, values: any) {
    // This will replace placeholders ($1, $2, ...) with corresponding values in the query.
    let formattedQuery = queryText;

    values.forEach((value: any, index: any) => {
      const placeholder = `$${index + 1}`;

      // Handling special cases for complex values like arrays or JSON
      if (Array.isArray(value)) {
        // Format array as a string for logging
        formattedQuery = formattedQuery.replace(placeholder, `'{${value.join(', ')}}'`);
      } else if (typeof value === 'string') {
        // Escape single quotes in string values
        formattedQuery = formattedQuery.replace(placeholder, `'${value.replace(/'/g, "''")}'`);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        // Directly insert number or boolean
        formattedQuery = formattedQuery.replace(placeholder, value);
      } else if (value === null || value === undefined) {
        // Handle null/undefined values
        formattedQuery = formattedQuery.replace(placeholder, 'NULL');
      } else {
        // Assume it's a complex object like JSON or a UUID; stringify it
        formattedQuery = formattedQuery.replace(placeholder, `'${JSON.stringify(value)}'`);
      }
    });

    return formattedQuery;
  }









  public static async getSocketLog(data: any): Promise<ResponseData> {
    try {


      let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';
      const filter = data.filter;


      let types = ["inventory", "batch", "serialized", "service", "menuSelection", "menuItem", "package", "kit"]

      if (data.filter && data.filter.type && data.filter.type.length > 0) {
        types = data.filter.type;

      }
      let sort = data.sortBy;
      let sortValue = !sort ? "log_element -> 'data' ->'createdAt'" : '"' + sort.sortValue + '"';
      let sortDirection = !sort ? "DESC" : sort.sortDirection;
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = ` Order by ` + sortTerm;

      let page = data.page ?? 1;
      let offset = 0;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }

      const companies = filter && filter.companies ? filter.companies : [];
      const query: { text: string, values: any } = {
        text: `	select COUNT(*)OVER(), c."name" as companyName , b."name" as branchName ,sl."dbTable" ,log_element , c.id as companyId , b.id as branchId , "logtime"
FROM "SocketLogs" sl
JOIN "Companies" c ON sl."companyId" = c.id
JOIN "Branches" b ON b.id = sl."branchId"
CROSS JOIN LATERAL jsonb_array_elements(sl.logs) AS log_element
where (array_length($1::uuid[], 1) IS NULL OR (c.id =any($1::uuid[])))
Order By "logtime" DESC
	Limit $2 offset $3	 
      `,
        values: [companies, limit, offset]
      }


      const formattedQuery = this.formatQuery(query.text, query.values);
      console.log('Formatted SQL Query:', formattedQuery);

      let list = await DB.excu.query(query.text, query.values);
      let count = list.rows && list.rows.length > 0 ? Number((<any>list.rows[0]).count) : 0
      let pageCount = Math.ceil(count / limit)

      offset += 1
      let lastIndex = ((page) * limit)
      if (list.rows.length < limit || page == pageCount) {
        lastIndex = count
      }
      const resData = {
        list: list.rows,
        count: count,
        pageCount: pageCount,
        startIndex: offset,
        lastIndex: lastIndex
      }

      return new ResponseData(true, "", resData)
    } catch (error: any) {

    
      throw new Error(error)
    }
  }












  public static async addAdminLog(client: PoolClient, name: string, log: string, AdminId: string, addedid: string) {

    const query: { text: string, values: any } = {
      text: `INSERT INTO "adminlogs"(name,
                                           log,
                                           adminid,addedid) VALUES($1,$2,$3,$4) RETURNING id`,
      values: [
        name,
        log,
        AdminId,
        addedid
      ]
    }

    const logInsert = await client.query(query.text, query.values);
    const logId = (<any>logInsert.rows[0]).id


    return logId;

  }



  public static async InsertCompanyGroup(data: any, adminId = null) {

    const client = await DB.excu.client()
    try {

      //Validate CompanyGroup Data 
      const validate = await CompanyGroupValidation.addcompanyGroupValidation(data)
      if (!validate.valid) {
        throw new ValidationException(validate.error)
      }

      const isCompanyNameExist = await this.checkCompanyGroupNameExist(client, null, data.companyGroup.name)
      if (isCompanyNameExist) {
        throw new ValidationException("Compnay Group Name Already Exist")
      }


      const companyGroupData = data.companyGroup
      const companydata = data.company
      const employeedata = data.employee
      const branchdata = data.branch

      const companyGroup = new CompanyGroup()
      companyGroup.ParseJson(companydata)

      const employee = new Employee()
      employee.ParseJson(employeedata)


      const company = new Company()
      company.ParseJson(companydata)


      await client.query("BEGIN")
      //Insert Company Group
      const query: { text: string, values: any } = {
        text: `INSERT INTO "CompanyGroups"(name, slug,translation) VALUES($1, $2,$3) RETURNING id`,
        values: [companyGroupData.name, companyGroupData.slug, companyGroupData.translation]
      }
      const insert = await client.query(query.text, query.values)
      const companyGroupId = insert.rows[0].id


      companydata.companyGroupId = companyGroupId

      let CompnayInsertdata = {
        company: companydata,
        employee: employeedata,
        branch: branchdata,
      }



      if (adminId != null) {
        let logid = await this.addAdminLog(client, `Company Group`, `Added Company Group ${companyGroupData.name}`, adminId, companyGroupId);
      }

      //Insert Company
      const insertCompany = await CompanyRepo.insertCompany(client, CompnayInsertdata, adminId)
      const companyId = insertCompany.data.id


      await client.query("COMMIT")
      return new ResponseData(true, "Added Successfully", { id: companyGroupId })
    } catch (error: any) {
      await client.query("ROLLBACK")
      
      throw new Error(error)
    } finally {
      client.release()
    }
  }
  public static async EditCompanyGroup(data: any) {
    const client = await DB.excu.client();
    try {
      //Validate Company Group Data 

      const validate = await CompanyGroupValidation.editompanyGroupyValidation(data)
      if (!validate.valid) {
        throw new ValidationException(validate.error)
      }
      if (data.id == null || data.id == "") {
        throw new ValidationException("Company Group Id is Required")
      }
      await client.query("BEGIN")
      const isCompanyGroupNameExist = await this.checkCompanyGroupNameExist(client, data.id, data.name)
      if (isCompanyGroupNameExist) {
        throw new ValidationException("Compnay Name Already Used")
      }


      const companyGroup = new CompanyGroup()
      companyGroup.ParseJson(data)
      //Update Company
      const query: { text: string, values: any } = {
        text: 'UPDATE "CompanyGroups" SET name = ($1), translation = ($2), slug=($3) WHERE id = $4 RETURNING id ',
        values: [companyGroup.name, companyGroup.translation, companyGroup.slug, companyGroup.id],
      }

      await client.query(query.text, query.values)
      await client.query("COMMIT")

      return new ResponseData(true, "Updated Successfully", [])
    } catch (error: any) {
      await client.query("ROLLBACK")
      
      throw new Error(error)
    } finally {
      client.release()
    }
  }
  public static async getAllCompanyGroups() {
    try {
      const companies: any[] = (await DB.excu.query('SELECT * FROM "CompanyGroups"')).rows
      const temp: Company[] = []
      companies.forEach((element) => {
        let company = new Company()
        company.ParseJson(element)
        temp.push(company)
      })
      return new ResponseData(true, "", temp)

    } catch (error: any) {
      
      throw new Error(error)
    }
  }
  public static async getCompanyGroupById(companyGroupId: any) {
    try {
      const query: { text: string, values: any } = {
        text: 'SELECT * FROM "CompanyGroups" WHERE id = ($1)',
        values: [companyGroupId]
      }
      const company = (await DB.excu.query(query.text, query.values)).rows[0]
      return new ResponseData(true, "", company)

    } catch (error: any) {
      
      throw new Error(error)
    }
  }

  // Delete Only for Testing
  public static async TestingDelete(data: any) {
    const client = await DB.excu.client()
    try {

      await client.query("BEGIN")

      const companyId = data.companyId
      const companyGroupId = data.companyGroupId

      const inventoryMovmentLines = `delete from "InventoryMovmentLines"
      using "InventoryMovments","Branches"
      where "InventoryMovmentLines"."inventoryMovmentId" = "InventoryMovments".id
      and "InventoryMovments"."branchId" ="Branches".id  
      and "Branches"."companyId" = any($1)`
      await client.query(inventoryMovmentLines, [companyId])


      const inventoryMovment = `delete from "InventoryMovments"
      using "Branches"
      where "InventoryMovments"."branchId" ="Branches".id  
      and "Branches"."companyId" = any($1)`
      await client.query(inventoryMovment, [companyId])


      const appliedCredits = `delete from "AppliedCredits"
      using "Invoices","Branches"
      where "Invoices"."branchId" = "Branches".id
      and "Branches"."companyId" = any($1)`
      await client.query(appliedCredits, [companyId])

      const creditNoteRefundLines = `delete from "CreditNoteRefundLines"
      using "CreditNoteRefunds","Branches"
      where "CreditNoteRefundLines"."creditNoteRefundId" = "CreditNoteRefunds".id
      and "CreditNoteRefunds"."branchId" ="Branches".id  
      and "Branches"."companyId" = any($1)`
      await client.query(creditNoteRefundLines, [companyId])


      const creditNoteRefunds = `delete from "CreditNoteRefunds"
      using "Branches"
      where "CreditNoteRefunds"."branchId" ="Branches".id  
      and "Branches"."companyId" = any($1)`

      await client.query(creditNoteRefunds, [companyId])

      const creditNoteLines = `delete from "CreditNoteLines"
      using "CreditNotes","Branches"
      where "CreditNoteLines"."creditNoteId" = "CreditNotes".id
      and "CreditNotes"."branchId" ="Branches".id  
      and "Branches"."companyId" = any($1)`

      await client.query(creditNoteLines, [companyId])


      const creditNotes = `delete from "CreditNotes"
      using "Branches"
      where "CreditNotes"."branchId" ="Branches".id  
      and "Branches"."companyId" = any($1)`

      await client.query(creditNotes, [companyId])


      const invoicePaymentLines = `delete from "InvoicePaymentLines"
      using "InvoicePayments","Branches"
      where "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id
      and "InvoicePayments"."branchId" ="Branches".id  
      and "Branches"."companyId" = any($1)`
      await client.query(invoicePaymentLines, [companyId])


      const invoicePayments = `delete from "InvoicePayments"
      using "Branches"
      where "InvoicePayments"."branchId" ="Branches".id  
      and "Branches"."companyId" = any($1)
      `
      await client.query(invoicePayments, [companyId])

      const estimateLineOptions = `delete from "EstimateLineOptions"
      using "Estimates","EstimateLines","Branches"
      where "EstimateLineOptions"."estimateLineId" = "EstimateLines".id
      and "EstimateLines"."estimateId" = "Estimates".id
      and "Estimates"."branchId" ="Branches".id  
      and "Branches"."companyId" = any($1)`
      await client.query(estimateLineOptions, [companyId])

      const estimateLines = `delete from "EstimateLines"
      using "Estimates","Branches"
      where "EstimateLines"."estimateId" = "Estimates".id
      and "Estimates"."branchId" ="Branches".id  
      and "Branches"."companyId" = any($1)`
      await client.query(estimateLines, [companyId])


      const estimates = `delete from "Estimates"
      using "Branches"
      where "Estimates"."branchId" ="Branches".id  
      and "Branches"."companyId" = any($1)`
      await client.query(estimates, [companyId])


      const invoiceLineOptions = `delete from "InvoiceLineOptions"
      using "Invoices","InvoiceLines","Branches"
      where "InvoiceLineOptions"."invoiceLineId" = "InvoiceLines".id
      and "InvoiceLines"."invoiceId" = "Invoices".id
      and "Invoices"."branchId" ="Branches".id  
      and "Branches"."companyId" = any($1)`
      await client.query(invoiceLineOptions, [companyId])


      const invoiceLines = `delete from "InvoiceLines"
      using "Invoices","Branches"
      where "InvoiceLines"."invoiceId" = "Invoices".id
      and "Invoices"."branchId" ="Branches".id  
      and "Branches"."companyId" = any($1)`
      await client.query(invoiceLines, [companyId])


      const invoices = `delete from "Invoices"
      using "Branches"
      where "Invoices"."branchId" ="Branches".id  
      and "Branches"."companyId" = any($1)`
      await client.query(invoices, [companyId])

      const supplierAppliedCredits = `delete from "SupplierAppliedCredits"
      using "SupplierCredits","Branches"
      where "SupplierAppliedCredits"."supplierCreditId" = "SupplierCredits".id
      and "SupplierCredits"."branchId" ="Branches".id 
      and "Branches"."companyId" = any($1)`
      await client.query(supplierAppliedCredits, [companyId])


      const supplierRefundLines = `delete from "SupplierRefundLines"
      using "SupplierRefunds"
      where "SupplierRefundLines"."supplierRefundId" = "SupplierRefunds".id
      and "SupplierRefunds"."companyId"  = any($1)`
      await client.query(supplierRefundLines, [companyId])

      const SupplierRefunds = `delete from "SupplierRefunds"
      where "SupplierRefunds"."companyId"  = any($1)`
      await client.query(SupplierRefunds, [companyId])

      const supplierCreditLines = `delete from "SupplierCreditLines"
      using "SupplierCredits","Branches"
      where "SupplierCreditLines"."supplierCreditId" = "SupplierCredits".id
      and "SupplierCredits"."branchId" ="Branches".id 
      and "Branches"."companyId" = any($1)`
      await client.query(supplierCreditLines, [companyId])

      const supplierCredit = `delete from "SupplierCredits"
      using "Branches"
      where "SupplierCredits"."branchId" ="Branches".id 
      and "Branches"."companyId" = any($1)`
      await client.query(supplierCredit, [companyId])


      const purchaseOrderLines = `delete from "PurchaseOrderLines"
      using "PurchaseOrders","Branches"
      where "PurchaseOrderLines"."purchaseOrderId" = "PurchaseOrders".id
      and "PurchaseOrders"."branchId" ="Branches".id 
      and "Branches"."companyId" = any($1)`
      await client.query(purchaseOrderLines, [companyId])



      const purchaseOrders = `delete from "PurchaseOrders"
      using "Branches"
      where "PurchaseOrders"."branchId" ="Branches".id 
      and "Branches"."companyId" = any($1)`
      await client.query(purchaseOrders, [companyId])


      const billingPaymentLines = `delete from "BillingPaymentLines"
      using "BillingPayments"
      where "BillingPaymentLines"."billingPaymentId" = "BillingPayments".id
      and "BillingPayments"."companyId" = any($1)`
      await client.query(billingPaymentLines, [companyId])


      const billingPayments = `delete from "BillingPayments"
      using "Branches"
      where "BillingPayments"."companyId" = any($1)`

      await client.query(billingPayments, [companyId])

      const billingLines = `delete from "BillingLines"
      using "Billings","Branches" 
      where "BillingLines"."billingId" = "Billings".id
      and "Billings"."branchId" = "Branches".id
      and "Branches"."companyId" = any($1)`
      await client.query(billingLines, [companyId])


      const billings = `delete from "Billings"
      using "Branches"
      where "Billings"."branchId" = "Branches".id
      and "Branches"."companyId" = any($1)`
      await client.query(billings, [companyId])

      const inventoryTransferLines = `delete from "InventoryTransferLines"
      using "InventoryTransfers","Branches" 
      where "InventoryTransferLines"."inventoryTransferId" = "InventoryTransfers".id
      and "InventoryTransfers"."branchId" = "Branches".id
      and "Branches"."companyId" = any($1)
      `
      await client.query(inventoryTransferLines, [companyId])

      const InventoryTransfers = `delete from "InventoryTransfers"
      using "Branches"
      where "InventoryTransfers"."branchId" = "Branches".id
      and "Branches"."companyId" = any($1)`
      await client.query(InventoryTransfers, [companyId])


      const PhysicalCountLines = `delete from "PhysicalCountLines"
      using "PhysicalCounts","Branches" 
      where "PhysicalCountLines"."physicalCountId" = "PhysicalCounts".id
      and "PhysicalCounts"."branchId" = "Branches".id
      and "Branches"."companyId" = any($1)`
      await client.query(PhysicalCountLines, [companyId])

      const PhysicalCounts = `delete from "PhysicalCounts"
      using "Branches"
      where "PhysicalCounts"."branchId" = "Branches".id
      and "Branches"."companyId" = any($1)`
      await client.query(PhysicalCounts, [companyId])

      const ExpenseLines = `delete from "ExpenseLines"
      using "Expenses","Branches" 
      where "ExpenseLines"."expenseId" = "Expenses".id
      and "Expenses"."branchId" = "Branches".id
      and "Branches"."companyId" = any($1)`
      await client.query(ExpenseLines, [companyId])

      const Expenses = `delete from "Expenses"
      using "Branches"
      where "Expenses"."branchId" = "Branches".id
      and "Branches"."companyId" = any($1)`
      await client.query(Expenses, [companyId])


      const JournalLines = `delete from "JournalLines"
      using "Journals","Branches" 
      where "JournalLines"."journalId" = "Journals".id
      and "Journals"."branchId" = "Branches".id
      and "Branches"."companyId" = any($1)`

      await client.query(JournalLines, [companyId])

      const Journals = `delete from "Journals"
      using "Branches"
      where "Journals"."branchId" = "Branches".id
      and "Branches"."companyId" = any($1)`
      await client.query(Journals, [companyId])

      const ProductBatches = `delete from "ProductBatches"
      using"BranchProducts", "Branches" 
      where "BranchProducts".id = "ProductBatches"."branchProductId"
      and "BranchProducts"."branchId" = "Branches".id
      and "Branches"."companyId" = any($1)`

      await client.query(ProductBatches, [companyId])

      const ProductSerials = `delete from "ProductSerials"
      using"BranchProducts", "Branches" 
      where "BranchProducts".id = "ProductSerials"."branchProductId"
      and "BranchProducts"."branchId" = "Branches".id
      and "Branches"."companyId" = any($1)`

      await client.query(ProductSerials, [companyId])


      const EmployeePrices = `delete from "EmployeePrices"
      where "EmployeePrices"."companyId" = any($1)`
      await client.query(EmployeePrices, [companyId])


      const MenuSectionProduct = `delete from "MenuSectionProduct"
      using "MenuSection","Menu"
      where "MenuSectionProduct"."menuSectionId" = "MenuSection".id
      and "MenuSection"."menuId" = "Menu".id
      and "Menu"."companyId" = any($1)`
      await client.query(MenuSectionProduct, [companyId])


      const MenuSection = `delete from "MenuSection"
      using "Menu"
      where "MenuSection"."menuId" = "Menu".id
      and "Menu"."companyId" = any($1)`
      await client.query(MenuSection, [companyId])

      const Menu = `delete from "Menu"
      where "Menu"."companyId" = any($1)`
      await client.query(Menu, [companyId])

      const BranchProducts = `delete from "BranchProducts"
      using "Branches" 
      where "BranchProducts"."branchId" = "Branches".id
      and "Branches"."companyId" = any($1)`
      await client.query(BranchProducts, [companyId])

      const ProductBarcodes = `delete from "ProductBarcodes"
      where "ProductBarcodes"."companyId" = any($1)`
      await client.query(ProductBarcodes, [companyId])

      const Recipe = `delete from "Recipe"
      where "Recipe"."companyId" = any($1)`
      await client.query(Recipe, [companyId])

      const Products = `delete from "Products"
      where "Products"."companyId" = any($1)`
      await client.query(Products, [companyId])

      const ProductMatrix = `delete from "ProductMatrix"
      where "ProductMatrix"."companyId" = any($1)`
      await client.query(ProductMatrix, [companyId])

      const Employees = `delete from "Employees"
      where "Employees"."companyId" = any($1)`
      await client.query(Employees, [companyId])

      const EmployeePrivileges = `delete from "EmployeePrivileges"
      where "EmployeePrivileges"."companyId" = any($1)`
      await client.query(EmployeePrivileges, [companyId])



      const Terminals = `delete from "Terminals"
      using "Branches" 
      where "Terminals"."branchId" = "Branches".id
      and "Branches"."companyId" = any($1)`
      await client.query(Terminals, [companyId])

      const Services = `delete from "Services"
      using "Branches" 
      where "Services"."branchId" = "Branches".id
      and "Branches"."companyId" = any($1)`
      await client.query(Services, [companyId])


      const Tables = `delete from "Tables" 
      Using "Branches","TableGroups" 
      where "TableGroups".id = "Tables"."tableGroupId"
      and "Branches".id = "TableGroups"."branchId"
      and "Branches"."companyId"= any($1)`
      await client.query(Tables, [companyId])

      const TableGroups = `delete from "TableGroups" 
      Using "Branches"
      where "Branches".id = "TableGroups".  "branchId"
      and "Branches"."companyId"= any($1)`
      await client.query(TableGroups, [companyId])


      const Branches = `delete from "Branches"
      where "Branches"."companyId" = any($1)`
      await client.query(Branches, [companyId])

      const Categories = `delete from "Categories"
      using "Departments" 
      where "Categories"."departmentId" = "Departments".id
      and "Departments"."companyId" = any($1)`
      await client.query(Categories, [companyId])

      const Departments = `delete from "Departments"
      where "Departments"."companyId" = any($1)`
      await client.query(Departments, [companyId])



      const Discounts = `delete from "Discounts"
      where "Discounts"."companyId" = any($1)`
      await client.query(Discounts, [companyId])



      const PaymentMethods = `delete from "PaymentMethods"
      where "PaymentMethods"."companyId" = any($1)`
      await client.query(PaymentMethods, [companyId])


      const Accounts = `delete from "Accounts"
      where "Accounts"."companyId" = any($1)`
      await client.query(Accounts, [companyId])

      const Customers = `delete from "Customers"
      where "Customers"."companyId" = any($1)`
      await client.query(Customers, [companyId])

      const Media = `delete from "Media"
      where "Media"."companyId" = any($1)`
      await client.query(Media, [companyId])



      const RecieptTemplates = `delete from "RecieptTemplates"
      where "RecieptTemplates"."companyId" = any($1)`
      await client.query(RecieptTemplates, [companyId])

      const LabelTemplates = `delete from "LabelTemplates"
      where "LabelTemplates"."companyId" = any($1)`
      await client.query(LabelTemplates, [companyId])

      const SupplierItems = `delete from "SupplierItems" 
      using "Suppliers" 
      where "Suppliers".id = "SupplierItems"."supplierId"
      and "Suppliers"."companyId"= any($1)`
      await client.query(SupplierItems, [companyId])


      const Suppliers = `delete from "Suppliers" 
      where "Suppliers"."companyId"= any($1)`
      await client.query(Suppliers, [companyId])

      const Surcharges = `delete from "Surcharges" 
      where "Surcharges"."companyId"= any($1)`
      await client.query(Surcharges, [companyId])

      const PriceLabels = `delete from "PriceLabels" 
      where "PriceLabels"."companyId"= any($1)`
      await client.query(PriceLabels, [companyId])

      const Taxes = `delete from "Taxes" 
      where "Taxes"."companyId"= any($1);`
      await client.query(Taxes, [companyId])

      const KitchenSections = `delete from "KitchenSections" 
      where "KitchenSections"."companyId"= any($1);`
      await client.query(KitchenSections, [companyId])

      const OptionGroups = `delete from "OptionGroups" 
      where "OptionGroups"."companyId"= any($1)`
      await client.query(OptionGroups, [companyId])

      const Options = `delete from "Options" 
      where "Options"."companyId"= any($1)`
      await client.query(Options, [companyId])

      const ReportModules = `delete from "ReportModules" 
      where "ReportModules"."companyId"= any($1)`
      await client.query(ReportModules, [companyId])

      const ReportQueries = `delete from "ReportQueries" 
      where "ReportQueries"."companyId"= any($1)`
      await client.query(ReportQueries, [companyId])



      const Companies = `delete from "Companies"
      where "Companies".id = any($1)`
      await client.query(Companies, [companyId])

      const CompanyGroups = `delete from "CompanyGroups"
      where "CompanyGroups".id = $1`
      await client.query(CompanyGroups, [companyGroupId])




      await client.query("COMMIT")
      return new ResponseData(true, "Deleted Successfully", [])
    } catch (error: any) {
      await client.query("ROLLBACK")
      console.log(error)
      return new ResponseData(false, error, [])
    } finally {
      client.release()
    }
  }

  public static async getCompanyGroupSuperAdmin(companyGroupId: string) {
    try {
      const query={
        text:`Select name , "email" from "Employees" where "companyGroupId" = $1 and "superAdmin"= true`,
        values:[companyGroupId]
      }

      let data = await DB.excu.query(query.text,query.values)
      return new ResponseData(true, "", data.rows[0])

    } catch (error:any) {
      throw new Error(error)
    }
  }
}
