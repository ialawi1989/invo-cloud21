import { promises as fs } from 'fs';

import { Company } from '@src/models/admin/company';

import exceljs, { Borders, Cell, CellValue, Row, RowModel, TableColumnProperties } from 'exceljs';
import Excel from 'exceljs';

import moment from 'moment'

import { BranchesRepo } from '@src/repo/admin/branches.repo';
import { integer } from 'aws-sdk/clients/cloudfront';
import * as _ from 'lodash'
import xlsx, { WorkSheet, writeFileXLSX } from 'xlsx'
import { CompanyRepo } from '@src/repo/admin/company.repo';


interface DataRecord { [key: string]: any; };

export interface DataColumn {
    key: string;
    header?: string;
    childs?: DataColumn[];
    properties?: { hasTotal?: boolean; hasSubTotal?: boolean, groupBy?: boolean | string, columnType?: string, conditionalformatRule?: {} }
};

export class ReportData {
    showFilter: boolean = true;
    filter: any = {};
    columns: DataColumn[] = [];
    records: DataRecord[] = [];
    fileName: string = "";
    ParseJson(json: any): void {
        for (const key in json) {
            this[key as keyof typeof this] = json[key];
        }
    }

}

export class TableRecords {
    columns: DataColumn[] = [];
    records: DataRecord[] = [];
}

export class TableReportData {
    filter: any = {};
    TableRecords: TableRecords[] = []
    fileName: string = "";
    ParseJson(json: any): void {
        for (const key in json) {
            this[key as keyof typeof this] = json[key];
        }
    }

}

interface AccountData {
    grandType: string;
    parentType: string;
    type: string;
    account: string;
    summary: Record<string, number>; // Stores branch-speci


}


export class XLSXGenerator {

    public static async accontIndex(accounts: any[]) {
        try {

            for (let account of accounts) {
                switch (account.parentType) {

                    case 'Current Assets':
                        account.parentTypeIndex = 0
                        account.grandType = 'Assets'
                        account.grandTypeIndex = 0
                        break;
                    case 'Other Current Assets':
                        account.parentTypeIndex = 1
                        account.grandType = 'Assets'
                        account.grandTypeIndex = 0
                        break;
                    case 'Fixed Assets':
                        account.parentTypeIndex = 2
                        account.grandType = 'Assets'
                        account.grandTypeIndex = 0
                        break;
                    case 'Current Liabilities':
                        account.parentTypeIndex = 0
                        account.grandType = 'Liabilities'
                        account.grandTypeIndex = 1
                        break;
                    case 'Long Term Liabilities':
                        account.parentTypeIndex = 1
                        account.grandType = 'Liabilities'
                        account.grandTypeIndex = 1
                        break;
                    case 'Operating Income':
                        account.parentTypeIndex = 0
                        account.grandType = 'Income'
                        account.grandTypeIndex = 2
                        break;
                    case 'Costs Of Goods Sold':
                        account.parentTypeIndex = 0
                        account.grandType = 'Costs Of Goods Sold'
                        account.grandTypeIndex = 3
                        break;

                    case 'Gross Profit':
                        account.parentTypeIndex = 0
                        account.grandType = '"Gross Profit'
                        account.grandTypeIndex = 4
                        break;
                    case 'Expense':
                        account.parentTypeIndex = 1
                        account.grandType = 'Expenses'
                        account.grandTypeIndex = 5
                        break;
                    case 'Operating Expense':
                        account.parentTypeIndex = 0
                        account.grandType = 'Expenses'
                        account.grandTypeIndex = 5
                        break;

                    case 'Operating Profit':
                        account.parentTypeIndex = 0
                        account.grandType = 'Operating Profit'
                        account.grandTypeIndex = 6
                        break;
                    case 'Equity':
                        account.parentTypeIndex = 0
                        account.grandType = 'Equity'
                        account.grandTypeIndex = 7
                        break;
                    default:
                        account.parentTypeIndex = 0
                        account.grandType = account.parentType
                        account.grandTypeIndex = 8
                        break;
                }


            }

            return accounts

        } catch (error: any) {
            throw new Error(error.message)
        }

    }

    public static async addAccountDetails(worksheet: WorkSheet, accountDetils: any, currencySymbol: string, afterDecimal: number) {
        try {


            worksheet.addRow([])

            let accountInfo = worksheet.addRow(['', 'Account Details'])
            accountInfo.getCell(`B`).font = { name: "Calibri", bold: true }

            /**Account Name */
            let accountName = worksheet.addRow(['', 'Account Name', `${accountDetils.name.trim()}`, '']);
            accountName.getCell(`B`).font = { name: "Calibri", bold: true }
            accountName.getCell(`C`).font = { name: "Calibri" }
            accountName.getCell(`B`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }
            accountName.getCell(`C`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }

            /**Account type */
            let accountType = worksheet.addRow(['', `Account Type :`, `${accountDetils.type.trim()} `]);
            accountType.getCell(`B`).font = { name: "Calibri", bold: true }
            accountType.getCell(`C`).font = { name: "Calibri" }
            accountType.getCell(`B`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }
            accountType.getCell(`C`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }
            /**Account Parent Type */
            let accountParentType = worksheet.addRow(['', `Account Parent Type :`, ` ${accountDetils.parentType.trim()}`]);
            accountParentType.getCell(`B`).font = { name: "Calibri", bold: true }
            accountParentType.getCell(`C`).font = { name: "Calibri" }
            accountParentType.getCell(`B`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }
            accountParentType.getCell(`C`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }

            /**Opening And Closing Balance */
            let balanceRows = worksheet.addRow(['', `Opening Balance`, `Closing balance`]);
            balanceRows.getCell(`B`).font = { name: "Calibri", bold: true }
            balanceRows.getCell(`C`).font = { name: "Calibri", bold: true }
            balanceRows.getCell(`B`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }
            balanceRows.getCell(`C`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }
            balanceRows.alignment = { horizontal: "center", vertical: "middle" }

            /**Opening And Closing Balance Totals */
            let balanceTotals = worksheet.addRow(['', `${+Number(accountDetils.openingBalance)}`]);
            balanceTotals.getCell(`B`).font = { name: "Calibri" }
            balanceTotals.getCell(`B`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }
            worksheet.addRow([]);

            return balanceTotals




        } catch (error) {
            console.log(error)
        }
    }

    public static async addStatmentDetails(worksheet: WorkSheet, statmentDetails: any) {
        try {


            worksheet.addRow([])

            let accountInfo = worksheet.addRow(['', 'Account Summary'])
            accountInfo.getCell(`B`).font = { name: "Calibri", bold: true }

            /**Account Name */
            let accountName = worksheet.addRow(['', 'Customer Name', `${statmentDetails.name.trim()}`, '']);
            accountName.getCell(`B`).font = { name: "Calibri", bold: true }
            accountName.getCell(`C`).font = { name: "Calibri" }
            accountName.getCell(`B`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }
            accountName.getCell(`C`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }


            /**Account Parent Type */
            let OpeningBalance = worksheet.addRow(['', `Opening Balance:`,]);
            OpeningBalance.getCell(`B`).font = { name: "Calibri", bold: true }
            OpeningBalance.getCell(`C`).font = { name: "Calibri" }
            OpeningBalance.getCell(`B`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }
            OpeningBalance.getCell(`C`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }
            let InvoicedAmount = worksheet.addRow(['', `Invoiced Amount:`,]);
            InvoicedAmount.getCell(`B`).font = { name: "Calibri", bold: true }
            InvoicedAmount.getCell(`C`).font = { name: "Calibri" }
            InvoicedAmount.getCell(`B`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }
            InvoicedAmount.getCell(`C`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }
            let AmountReceived = worksheet.addRow(['', `Amount Received:`,]);
            AmountReceived.getCell(`B`).font = { name: "Calibri", bold: true }
            AmountReceived.getCell(`C`).font = { name: "Calibri" }
            AmountReceived.getCell(`B`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }
            AmountReceived.getCell(`C`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }
            let BalanceDue = worksheet.addRow(['', `Balance Due:`,]);
            BalanceDue.getCell(`B`).font = { name: "Calibri", bold: true }
            BalanceDue.getCell(`C`).font = { name: "Calibri" }
            BalanceDue.getCell(`B`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }
            BalanceDue.getCell(`C`).border = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }

            return {
                OpeningBalance: OpeningBalance,
                InvoicedAmount: InvoicedAmount,
                AmountReceived: AmountReceived,
                BalanceDue: BalanceDue
            }

        } catch (error) {
            console.log(error)
        }
    }
    public static async conditionalFormat(worksheet: WorkSheet, columnkey: string, startRow: number, endRow: number, rules: {}) {

        const column = worksheet.getColumnKey(columnkey) ?? null;

        if (column) {

            worksheet.addConditionalFormatting({
                ref: `${column.letter}${startRow}:${column.letter}${endRow}`,
                rules: rules
            });
        }



    }

    public static async formatStatmentDetails(worksheet: WorkSheet, rows: any, totals: any, statmentDetails: any, afterDecimal: number, currencySymbol: string) {
        try {

            let format = `"${currencySymbol}" #,##0.${'0'.repeat(afterDecimal)};("${currencySymbol}" #,##0.${'0'.repeat(afterDecimal)})`;


            let AmountReceived = totals.getCell('payment');
            let InvoicedAmount = totals.getCell('amount');
            let BalanceDue = statmentDetails.hasOpeningBalance ? totals.getCell('Balance') : 0;
            let balanceDueFormula = statmentDetails.hasOpeningBalance ? `${_.trim(BalanceDue.value.formula, `'`)} ` : ''

            console.log(totals, rows, statmentDetails)
            rows.OpeningBalance.getCell('C').value = statmentDetails.hasOpeningBalance ? { formula: `${_.trim((<any>BalanceDue).value.formula, `'`)} ` } : 0;
            rows.OpeningBalance.getCell('C').numFmt = format

            let invoiceAmountBalance = statmentDetails.hasOpeningBalance ? ` - ${_.trim((<any>BalanceDue).value.formula, `'`)}` : ''

            rows.InvoicedAmount.getCell('C').value = { formula: `${_.trim((<any>InvoicedAmount).value.formula, `'`)} ${invoiceAmountBalance} ` };
            rows.InvoicedAmount.getCell('C').numFmt = format

            rows.AmountReceived.getCell('C').value = { formula: `${_.trim((<any>AmountReceived).value.formula, `'`)} ` };
            rows.AmountReceived.getCell('C').numFmt = format


            rows.BalanceDue.getCell('C').value = { formula: `${balanceDueFormula} +  ${_.trim(InvoicedAmount.value.formula, `'`)}  ${invoiceAmountBalance}  + ${_.trim(AmountReceived.value.formula, `'`)}` };
            rows.BalanceDue.getCell('C').numFmt = format
            totals.getCell('Balance').value = { formula: ` ${_.trim((<any>InvoicedAmount).value.formula, `'`)} - abs(${_.trim((<any>AmountReceived).value.formula, `'`)} )` }
            // return {
            //     OpeningBalance:OpeningBalance,
            //     InvoicedAmount:InvoicedAmount,
            //     AmountReceived:AmountReceived,
            //     BalanceDue:BalanceDue
            //   }



        } catch (error) {
            console.log(error)
        }
    }

    public static async formatAccountDetails(worksheet: WorkSheet, totalRow: any, accountNature: any, accountClosingBalanceRow: exceljs.Row, afterDecimal: number, currencySymbol: string) {
        try {

            let debit = totalRow.getCell('debit');
            let credit = totalRow.getCell('credit');
            worksheet.deleteColumnKey
            if (credit.value && debit.value) {

                let formula;
                if (accountNature == 'Dr') {
                    formula = { formula: `${+Number(accountClosingBalanceRow.getCell('B').value)}+ ${_.trim((<any>debit).value.formula, `'`)}  - ${_.trim((<any>credit).value.formula, `'`)}` };

                } else {
                    formula = { formula: `${+Number(accountClosingBalanceRow.getCell('B').value)}+   ${_.trim((<any>credit).value.formula, `'`)} - ${_.trim((<any>debit).value.formula, `'`)} ` };

                }
                accountClosingBalanceRow.getCell(`B`).value = +Number(accountNature.getCell('B').value)
                accountClosingBalanceRow.getCell(`B`).numFmt = `"${currencySymbol}" #,##0.${'0'.repeat(afterDecimal)};("${currencySymbol}" #,##0.${'0'.repeat(afterDecimal)})`;

                accountClosingBalanceRow.getCell(`C`).value = formula


                accountClosingBalanceRow.getCell(`C`).font = { name: "Calibri" }
                accountClosingBalanceRow.getCell(`C`).numFmt = `"${currencySymbol}" #,##0.${'0'.repeat(afterDecimal)};("${currencySymbol}" #,##0.${'0'.repeat(afterDecimal)})`;
                accountClosingBalanceRow.getCell(`C`).border = {
                    bottom: { style: 'medium' },
                    right: { style: 'medium' },
                    left: { style: 'medium' },
                    top: { style: 'medium' },
                }
                accountClosingBalanceRow.alignment = { horizontal: "center", vertical: "middle" }
            }




        } catch (error) {
            console.log(error)
        }
    }

    public static async addBalanceTotal(worksheet: WorkSheet, formula: any, data: any, format: any) {
        try {
            let balanceRow = worksheet.addRow(['', '', '', '', 'Closing Balane', '', ''])

            if (data.accountNature == 'Dr') {
                balanceRow.getCell('F').value = formula
                balanceRow.getCell('F').numFmt = format
            } else {
                balanceRow.getCell('G').value = formula
                balanceRow.getCell('F').numFmt = format
            }
            balanceRow.eachCell({ includeEmpty: true }, (cell: any, colIndex: any) => {
                if (colIndex == 1) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'ffffff' },
                        bgColor: { argb: 'ffffff' },
                    }
                } else {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'C8C8C8' },
                        bgColor: { argb: 'C8C8C8' },
                    };
                    cell.font = { bold: true };
                }


            });
        } catch (error: any) {
            throw new Error(error)
        }
    }

    private static pageHeader(worksheet: WorkSheet, filter: any) {
        try {

            //report Title
            worksheet.addRow([])
            let title = filter.title;
            let titleRow = worksheet.addRow(['', title.toUpperCase()]);
            titleRow.font = { name: 'Cambria', family: 4, size: 28, color: { argb: 'C00000' } };
            //worksheet.mergeCells(`B${titleRow.number}: D${titleRow.number}`)


            //report Date
            let dateText = ""
            if (filter.fromDate == null && filter.toDate) {

                dateText = ' As of ' + " " + moment(new Date(filter.toDate)).format("YYYY-MM-DD");

            } else if (filter.date) {
                dateText = ' Date:' + "    " + moment(new Date(filter.date)).format("YYYY-MM-DD");

            }
            else if (filter.fromDate && filter.toDate) {

                dateText = "From: " + moment(new Date(filter.fromDate)).format("YYYY-MM-DD") + '  ' +
                    "To: " + moment(new Date(filter.toDate)).format("YYYY-MM-DD")

            }


            if (dateText) {
                let subTitleRow

                subTitleRow = worksheet.addRow(["", dateText])
                subTitleRow.font = { name: 'Cambria' };
                worksheet.mergeCells(`B${subTitleRow.number}: D${subTitleRow.number}`)
                worksheet.addRow([])
            }

            return titleRow

        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    private static async appliedFilter(worksheet: WorkSheet, filter: any) {
        try {

            let borderStyle: Partial<Borders> = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }

            //filter
            let filterRow = worksheet.addRow(['', 'Applied Filter: '])
            filterRow.font = { name: "Cambria", bold: true }


            let filterRows = []
            // branch
            let branches = filter.branches ? filter.branches : []
            let branchesName: any[] = []
            for (let branchId of branches) {
                let name = await BranchesRepo.getBranchName(branchId)
                branchesName.push(name)
            }

            let branchFilter = branchesName.length > 0 ? branchesName.join(', ') : 'All'
            filterRows.push(['Branches', branchFilter])

            //period

            let period = filter.compareType ? filter.compareType : null
            if (period == 'period') {
                let periodFilter = ` ${filter.period} Qty[${filter.periodQty}]`
                filterRows.push(['Period', periodFilter])
            }

            //productName filter for product Movment

            if (filter && filter.filterList) {
                const filterList = filter.filterList ?? {}
                for (let [key, value] of Object.entries(filterList)) {
                    filterRows.push([_.startCase(key), String(value)])
                }

            }


            filterRows.forEach(e => {

                let filterTitle = e[0]
                let filter = e[1]

                let row = worksheet.addRow(['', `${filterTitle} :`, ` ${filter}`]);
                worksheet.mergeCells(`C${row.number}:D${row.number}`)
                row.font = { name: "Calibri" }
                worksheet.getCell(`B${row.number}`).border = borderStyle
                worksheet.getCell(`C${row.number}`).border = borderStyle

            })


        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    private static sheetFormat(worksheet: WorkSheet, companyName: string) {
        try {
            let lastColumnNumber = worksheet.columnCount + 1

            //companyInfo
            let companyRow = worksheet.addRow([])
            companyRow.font = { name: 'Calibri', color: { argb: 'C00000' } }
            companyRow.alignment = { horizontal: 'left' }
            companyRow.getCell(lastColumnNumber - 1).value = companyName

            // worksheet.getRows(firstRowOfData - 1, worksheet.rowCount)?.forEach((row:any) => {

            //     if (row.getCell(1).value) {
            //         for (let i = 1; i < lastColumnNumber; i++) {
            //             row.getCell(i).fill = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'DBE5F1' }, fgColor: { argb: 'DBE5F1' } }
            //         }
            //         row.getCell(2).value = row.getCell(1).value
            //         row.getCell(1).value = ""

            //     }

            // }
            // )


            let rows = worksheet.getRows(1, worksheet.rowCount + 2) ?? []

            rows.forEach((row: any) => {
                //first and last column => empty column
                row.getCell(1).fill = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'ffffff' }, fgColor: { argb: 'ffffff' } }
                row.getCell(lastColumnNumber).fill = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'ffffff' }, fgColor: { argb: 'ffffff' } }

                if (row.number >= (worksheet.rowCount - 2)) {
                    for (let i = 1; i < lastColumnNumber; i++) {
                        row.getCell(i).fill = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'ffffff' }, fgColor: { argb: 'ffffff' } }
                    }

                }

            }
            )

        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    private static async setHeaders(worksheet: Excel.Worksheet, dataColumns: DataColumn[]) {
        try {

            let columnIndex = 2;
            let headerIdx = worksheet.rowCount + 1
            let subHeaderIdx = headerIdx + 1
            // Start writing headers from column A        
            for (const column of dataColumns) {

                let rowIndex = headerIdx;
                // Start writing headers from row 1          
                // Set main column header l
                let row = worksheet.getCell(rowIndex, columnIndex)
                row.value = column.header ?? _.startCase(column.key);
                row.font = { bold: true }
                let col = worksheet.getColumn(row.col)
                col.key = column.key;

                let rowIndex2 = subHeaderIdx;

                // Check for child columns (sub-headers)          
                if (column.childs) {
                    const subHeaderCount = column.childs.length;
                    // Start writing headers from row 1                 
                    // Conditional merge for sub-headers              
                    for (let i = 0; i < subHeaderCount; i++) {
                        const isLastSubHeader = i === subHeaderCount - 1;
                        const currentColumnIndex = columnIndex + i;
                        worksheet.getCell(rowIndex2, currentColumnIndex).value = column.childs[i].header ?? _.startCase(column.childs[i].key);
                        worksheet.getColumn(row.col + i).key = column.key + '-' + column.childs[i].key;

                    }
                    if (worksheet.getCell(rowIndex, columnIndex + subHeaderCount - 1)) {

                        worksheet.mergeCells(row.$col$row, worksheet.getCell(rowIndex, columnIndex + subHeaderCount - 1).$col$row)
                        worksheet.getCell(row.$col$row).border = { bottom: { style: 'thin', color: { argb: "C0C0C0" } } }

                    }
                    columnIndex += subHeaderCount;
                    // Move to the next main header column         
                } else {
                    columnIndex++;
                    // Move to the next column if no sub-headers         
                }
            }

            worksheet.getRows(headerIdx, worksheet.rowCount - headerIdx + 1)?.forEach((row) => {
                row.alignment = { horizontal: "center", vertical: "middle" }
                row.eachCell({ includeEmpty: true }, (cell, colIndex) => {
                    if (colIndex == 1) {
                        cell.fill = {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: { argb: "ffffff" },
                            bgColor: { argb: "ffffff" },
                        }

                    }
                    else {
                        cell.fill = {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: { argb: "E0E0E0" },
                            bgColor: { argb: "E0E0E0" },
                        }
                    }

                });

            })


        } catch (error: any) {
          
            throw new Error(error.message)
        }

    }

    private static async getCellFormat(cell: exceljs.Cell, type: string, currencySymbol: string | null, afterDecimal: number) {
        try {

            let format = ''
            switch (type) {
                case 'currency':
                    format = `"${currencySymbol}" #,##0.${'0'.repeat(afterDecimal)};("${currencySymbol}" #,##0.${'0'.repeat(afterDecimal)})`
                    break;
                case 'percentage':
                    format = `0.00"%";[Red](0.00##"%")`
                    break;
                case 'date':
                    format = `[$-409]mmmm dd\, yyyy`
                    break;
                case 'date_day':
                    format = `dddd\ yyyy/mm/dd`
                    break;
                case 'date_time':
                    format = `mm/dd/yyyy hh:mm`
                    break;
                case 'timeInMinutes':
                    format = `000"m". 000"s"`
                    break;

                default:
                    format = ''
                    break;
            }
            cell.numFmt = format



        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    private static async formatCurrency(sheet: exceljs.Worksheet, key: string, currencySymbol: string | null, afterDecimal: number, type: string) {
        try {

            let formatedCol = sheet.getColumnKey(key)
            if (formatedCol) {


                switch (type) {
                    case 'currency':
                        formatedCol.numFmt = `"${currencySymbol}" #,##0.${'0'.repeat(afterDecimal)};("${currencySymbol}" #,##0.${'0'.repeat(afterDecimal)})`
                        break;
                    case 'percentage':
                        formatedCol.numFmt = `0.00"%";[Red](0.00##"%")`
                        break;
                    case 'date':
                        // formatedCol.numFmt = `[$-409]mmmm dd\, yyyy`
                        formatedCol.numFmt = `dd/mm/yyyy`
                        break;
                    case 'date_day':
                        formatedCol.numFmt = `dddd\ yyyy/mm/dd`
                        break;
                    case 'date_time':
                        formatedCol.numFmt = `mm/dd/yyyy hh:mm`
                        break;
                    case 'timeInMinutes':

                        // formatedCol.values.forEach((val,indx) =>{

                        //     if(!Number.isNaN(val)){
                        //         console.log(indx)
                        //     let timeInSec = Number(val)
                        //     let min = String(Math.floor(timeInSec / 60))
                        //     let sec = String((timeInSec % 60).toFixed(2)) 
                        //     sheet.getCell(indx,key).value = `${min}m ${sec}s`
                        //     }
                        // })


                        formatedCol.numFmt = ``
                        break;

                    default:
                        break;
                }

            }

        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    private static async addSubtotalRow(worksheet: Excel.Worksheet, columns: DataColumn[], category: string, startRow: number, endRow: number, colKey?: string) {
        try {

            const subTotalRow = colKey ? worksheet.insertRow(endRow + 1, []) : worksheet.insertRow(endRow + 1, ["", `Total ${category}`]);
            let columnNumber: number = 2

            if (colKey) {
                subTotalRow.getCell(colKey).value = `Total ${category}`
                columnNumber = worksheet.getColumn(colKey).number

            }
            columns.forEach((totalCol: DataColumn) => {
                if (totalCol.key && totalCol.properties?.hasSubTotal) {
                    const column = worksheet.getColumnKey(totalCol.key) ?? null;
                    if (column && column.key) {
                        subTotalRow.getCell(column.key).value = {
                            formula: `SUBTOTAL(9,${column.letter}${startRow}:${column.letter}${endRow})`,
                        };
                    }
                    (totalCol.childs || []).forEach((subCol: DataColumn) => {
                        const subColumn = worksheet.getColumnKey(`${totalCol.key}-${subCol.key}`);
                        if (subColumn && subColumn.key) {
                            subTotalRow.getCell(`${totalCol.key}-${subCol.key}`).value = {
                                formula: `SUBTOTAL(9,${subColumn.letter}${startRow}:${subColumn.letter}${endRow})`,
                            };
                        }
                    });
                }
            });

            subTotalRow.eachCell({ includeEmpty: true }, (cell, colIndex) => {
                if (columnNumber && colIndex >= columnNumber) {
                    if (columnNumber != 2) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'CBCBCB' },
                        }
                    } else {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'C8C8C8' },
                        };
                    }

                    cell.font = { bold: true };
                }

            });

        } catch (error: any) {
          
            throw new Error(error.message)
        }

    }

    private static async addGrandTotalRow(worksheet: Excel.Worksheet, columns: DataColumn[], startRow: number, row: number) {
        try {
            const grandTotalRow = worksheet.getRow(row);
            grandTotalRow.getCell(2).value = 'Grand Total';
            grandTotalRow.font = { bold: true };

            columns.forEach((totalCol: DataColumn) => {
                if (totalCol.key && totalCol.properties?.hasTotal) {
                    const column = worksheet.getColumnKey(totalCol.key) ?? null;
                    if (column && column.key) {
                        grandTotalRow.getCell(column.key).value = {
                            formula: `SUBTOTAL(9,${column.letter}${startRow}:${column.letter}${worksheet.rowCount - 1})`,
                        };
                    }
                    (totalCol.childs || []).forEach((subCol: DataColumn) => {
                        const subColumn = worksheet.getColumnKey(`${totalCol.key}-${subCol.key}`);
                        if (subColumn && subColumn.key) {
                            grandTotalRow.getCell(`${totalCol.key}-${subCol.key}`).value = {
                                formula: `SUBTOTAL(9,${subColumn.letter}${startRow}:${subColumn.letter}${worksheet.rowCount - 1})`,
                            };
                        }
                    });
                }
            });
            grandTotalRow.eachCell({ includeEmpty: true }, (cell, colIndex) => {
                if (colIndex == 1) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'ffffff' },
                        bgColor: { argb: 'ffffff' },
                    }
                } else {
                    cell.border = { top: { style: 'medium' }, }
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'C8C8C8' },
                        bgColor: { argb: 'C8C8C8' },
                    };
                    cell.font = { bold: true };
                }


            });

            return grandTotalRow
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async autoFitColumnWidth(worksheet: Excel.Worksheet, minimalWidth = 10) {
        worksheet.columns.forEach((column) => {
            let maxColumnLength = 0;
            if (column && typeof column.eachCell === 'function') {
                column.eachCell({ includeEmpty: true }, (cell) => {
                    if (!cell.isMerged) {
                        maxColumnLength = Math.max(
                            maxColumnLength,
                            minimalWidth,
                            cell.value ? cell.value.toLocaleString().length : 0
                        );
                    }
                });
                column.width = maxColumnLength + 4;
            }
        });
        return worksheet; // for chaining.
    }

    private static async mergeGroupBytest(worksheet: Excel.Worksheet, columns: DataColumn[], firstRowOfData: number) {
        try {

            for (let totalCol of columns.reverse()) {
                if (totalCol.key && totalCol.properties?.groupBy) {
                    const column = worksheet.getColumnKey(totalCol.key) ?? null;
                    if (column && column.key) {
                        let currentCategory = worksheet.getCell(`${column.letter}${firstRowOfData}`).value;
                        let subTotal = 0;
                        let lastRowIndex = firstRowOfData;

                        for (let row = firstRowOfData + 1; row <= worksheet.rowCount; row++) {


                            let cell = worksheet.getCell(`${column.letter}${row}`)
                            let category = cell.value



                            if (category !== currentCategory && (currentCategory != null)) {

                                if (totalCol.properties?.groupBy == 'horizantal') {
                                    const r = worksheet.insertRow(lastRowIndex, [])
                                    r.getCell(column.key).value = currentCategory
                                    row++;
                                    lastRowIndex++;
                                    const headercolumnCount = worksheet.columnCount
                                    for (let j = column.number; j <= headercolumnCount; j++) {
                                        r.getCell(j).fill = {
                                            type: 'pattern',
                                            pattern: 'solid',
                                            fgColor: { argb: 'C8C8C8' },
                                            bgColor: { argb: 'C8C8C8' },
                                        };
                                    }
                                }


                                worksheet.mergeCells(`${column.letter}${lastRowIndex}:${column.letter}${(row - 1)}`)
                                subTotal = 0;
                                const reportHasSubTotal = columns.findIndex(col => col.properties?.hasSubTotal)

                                if (reportHasSubTotal !== -1) {
                                    await this.addSubtotalRow(worksheet, columns, String(currentCategory), lastRowIndex, (row - 1), column.key);
                                    row++;
                                    lastRowIndex++;
                                }

                                const rowCount = worksheet.rowCount
                                while (category == null && row < rowCount) { row++; category = worksheet.getCell(`${column.letter}${row}`).value }
                                currentCategory = category;
                                lastRowIndex = row;

                            }
                            subTotal++;

                        }

                        if (totalCol.properties?.groupBy == 'horizantal') {
                            const r = worksheet.insertRow(lastRowIndex, [])
                            r.getCell(column.key).value = currentCategory
                            lastRowIndex++;
                            const headercolumnCount = worksheet.columnCount
                            for (let j = column.number; j <= headercolumnCount; j++) {
                                r.getCell(j).fill = {
                                    type: 'pattern',
                                    pattern: 'solid',
                                    fgColor: { argb: 'C8C8C8' },
                                    bgColor: { argb: 'C8C8C8' },
                                };
                            }
                            worksheet.mergeCells(`${column.letter}${lastRowIndex}:${column.letter}${(worksheet.rowCount)}`)
                        }
                        if (columns.findIndex(col => col.properties?.hasSubTotal) > -1) { await this.addSubtotalRow(worksheet, columns, String(currentCategory), lastRowIndex, (worksheet.rowCount)); }

                        column.alignment = { 'vertical': 'top' }
                    }
                }
            };


        } catch (error: any) {
          
            throw new Error(error.message)
        }

    }


    public static async exportToExcel(data: ReportData, company: Company, options?: { fileName: string; }) {
        try {
            const workbook = new Excel.Workbook();
            let worksheet = workbook.addWorksheet('Sheet1');
            let fileName = data.fileName ? data.fileName : company.id + 'Report'



            //get companyInfo
            let companyInfo = (await CompanyRepo.getCompanyById(company.id)).data
            const afterDecimal = companyInfo.settings.afterDecimal ?? 3
            const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD"
            worksheet.addRow([])

            //################################# Report Header ################################# 
            let titleRow = this.pageHeader(worksheet, data.filter)

            //report Filter 
            if (data.showFilter && data.filter) {
                await this.appliedFilter(worksheet, data.filter)
            }

            //account Closing Balance
            let accountClosingBalanceRow;
            if (data.filter.accountDetils) {
                accountClosingBalanceRow = await this.addAccountDetails(worksheet, data.filter.accountDetils, currencySymbol, afterDecimal)
            }

            //statment Accounts
            let statmentAccounts;
            if (data.filter.statmentDetails) {
                statmentAccounts = await this.addStatmentDetails(worksheet, data.filter.statmentDetails)
            }

            worksheet.addRow([])
            const headerRowCount = worksheet.rowCount

            //#################################  Table Headers  #################################  
            await this.setHeaders(worksheet, data.columns)

            const headercolumnCount = worksheet.columnCount
            worksheet.mergeCells(`B${titleRow.number}: ${worksheet.lastColumn?.letter}${titleRow.number}`)

            for (let i = 1; i <= headerRowCount; i++) {
                let row = worksheet.getRow(i)
                for (let j = 1; j < headercolumnCount + 1; j++) {
                    row.getCell(j).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'ffffff' },
                        bgColor: { argb: 'ffffff' },
                    };
                }
            }

            //###################################    Data    ###################################

            let firstRowOfData = worksheet.rowCount ? worksheet.rowCount + 1 : 1
            for (const record of data.records) {
                const row = worksheet.addRow([]);
                for (const column of data.columns) {

                    if (column.childs?.length) {
                        for (const child of column.childs) {

                            const childData = record.summary ? record.summary.find((s: any) => s[column.key])?.[column.key]?.[child.key] ?? '' : record[column.key]?.[child.key] ?? '';

                            row.getCell(column.key + '-' + child.key).value = (!isNaN(Number(childData)) && Number(childData) != undefined && child.properties?.columnType != 'date_day' && child.properties?.columnType != 'date' && child.properties?.columnType != 'date_time' && child.properties?.columnType != 'barcode') ? Number(childData) : childData;
                            //row.getCell(column.key+'-'+child.key).numFmt =`"${companyInfo.settings.currencySymbol}" #,##0.${'0'.repeat(companyInfo.settings.afterDecimal)}`
                        }
                    } else {
                        let p;

                        if (record[column.key]) { p = record[column.key] }
                        else if (record.summary?.find((s: any) => s[column.key])?.[column.key]) { p = record.summary.find((s: any) => s[column.key])?.[column.key] }
                        else (p = '')
                        row.getCell(column.key).value = ((p != '' && !isNaN(Number(p)) && Number(p) != undefined && column.properties?.columnType != 'date_day' && column.properties?.columnType != 'date' && column.properties?.columnType != 'date_time' && column.properties?.columnType != 'barcode') ? Number(p) : p);
                        //row.getCell(column.key).numFmt=`"${companyInfo.settings.currencySymbol}" #,##0.${'0'.repeat(companyInfo.settings.afterDecimal)}`

                    }
                }
            }


            //###################################     group By    ###################################
            const reportHasGroupBy = data.columns.findIndex(col => col.properties?.groupBy)
            const reportHasSubTotal = data.columns.findIndex(col => col.properties?.hasSubTotal)

            if (reportHasSubTotal !== -1 && reportHasGroupBy == -1) {
                data.columns[0].properties = data.columns[0].properties || { 'groupBy': true }
                await this.mergeGroupBytest(worksheet, data.columns, firstRowOfData)
            } else {
                if (reportHasGroupBy !== -1) { await this.mergeGroupBytest(worksheet, data.columns, firstRowOfData) }

            }

            //###################################   Grand Total  ###################################
            let totalRow;
            if (data.columns.find(col => col.properties?.hasTotal)) {
                totalRow = await this.addGrandTotalRow(worksheet, data.columns, firstRowOfData, worksheet.rowCount + 1);
            }


            //############################ ADD ACCOUNT CLOSING BALANCE  ############################  
            if (totalRow && data.filter.accountDetils) {

                let debit = totalRow.getCell('debit');
                let credit = totalRow.getCell('credit');
                let formula;
                let format = `"${currencySymbol}" #,##0.${'0'.repeat(afterDecimal)};("${currencySymbol}" #,##0.${'0'.repeat(afterDecimal)})`;
                if (data.filter.accountDetils.accountNature == 'Dr') {
                    formula = { formula: `${+Number(accountClosingBalanceRow.getCell('B').value)}+ ${_.trim((<any>debit).value.formula, `'`)}  - ${_.trim((<any>credit).value.formula, `'`)}` };

                } else {
                    formula = { formula: `${+Number(accountClosingBalanceRow.getCell('B').value)}+   ${_.trim((<any>credit).value.formula, `'`)} - ${_.trim((<any>debit).value.formula, `'`)} ` };

                }
                await this.addBalanceTotal(worksheet, formula, data.filter.accountDetils, format)
            }


            //############################### format columns with currency ###############################
            /**todo: need to be romved amdd add with the data */
            for (let col of data.columns) {
                if (col.properties?.columnType)
                    await this.formatCurrency(worksheet, col.key, currencySymbol, afterDecimal, col.properties.columnType)

                col.childs?.forEach(async (subCol) => {
                    if (subCol.properties?.columnType)
                        await this.formatCurrency(worksheet, col.key + '-' + subCol.key, currencySymbol, afterDecimal, subCol.properties?.columnType)

                }
                )


            }
            //######################################   condtional format   ######################################

            data.columns.forEach(async col => {
                if (col.properties?.conditionalformatRule) {
                    await this.conditionalFormat(worksheet, col.key, firstRowOfData, worksheet.rowCount + 1, col.properties.conditionalformatRule);
                }

            }
            )

            //###################################  Sheet format  ###################################   
            if (data.filter.skipCompanyInfo == null || data.filter.skipCompanyInfo == false) {
                this.sheetFormat(worksheet, companyInfo.name)
            }

            //############################## Statment Details format ###############################
            if (totalRow && statmentAccounts && data.filter.statmentDetails) {
                this.formatStatmentDetails(worksheet, statmentAccounts, totalRow, data.filter.statmentDetails, afterDecimal, currencySymbol)
            }

            //#################################  columns width   ################################### 
            worksheet = await this.autoFitColumnWidth(worksheet)

            //############################### Account Details format ###############################   
            if (totalRow && data.filter.accountDetils) {
                await this.formatAccountDetails(worksheet, totalRow, data.filter.accountDetils.accountNature, accountClosingBalanceRow, afterDecimal, currencySymbol)
            }

            //###################################    Response    ################################### 
            return workbook.xlsx.writeFile(fileName + '.xlsx').then(buffer => {
                fileName;
                const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;application/json; charset=utf-8; text/csv';
                const fileExtension = '.xlsx'

                return {
                    fileName: `${fileName}${fileExtension}`,
                    type,
                    buffer
                }
            });



        } catch (error: any) {
            console.log(error)
            throw new Error(error);
        }
    }

    public static async exportSalesSummary(data: ReportData, company: Company, style?: string) {
        try {



            const workbook = new Excel.Workbook();
            let worksheet = workbook.addWorksheet('Sheet1');
            let fileName = data.fileName ? data.fileName : company.id + 'Report'

            //get companyInfo
            let companyInfo = (await CompanyRepo.getCompanyById(company.id)).data
            const afterDecimal = companyInfo.settings.afterDecimal ?? 3
            const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD"
            worksheet.addRow([])

            //###################################### Report Header ######################################  
            let titleRow = this.pageHeader(worksheet, data.filter)

            //report Filter 
            if (data.filter) {
                await this.appliedFilter(worksheet, data.filter)
            }

            worksheet.addRow([])
            const headerRowCount = worksheet.rowCount
            let headercolumnCount = 4

            worksheet.mergeCells(`B${titleRow.number}: D${titleRow.number}`)
            for (let i = 1; i <= headerRowCount; i++) {
                let row = worksheet.getRow(i)
                for (let j = 1; j < headercolumnCount + 1; j++) {
                    row.getCell(j).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'ffffff' },
                        bgColor: { argb: 'ffffff' },
                    };
                }
            }


            //###################################### Data ###################################### 
            const records: any = data.records
            worksheet.addRow(['']);
            Object.keys(records).forEach(async sectionKey => {

                const headerRow = worksheet.addRow(['', sectionKey]);
                headerRow.font = { bold: true };

                const sectionData = records[sectionKey];
                if (sectionData.style != 'object') {

                    if (sectionData.records[0] && (!Object.keys(sectionData.records[0]).includes('key'))) {


                        const tableHeader = worksheet.addRow([...[''], ...Object.keys(sectionData.records[0])]);

                        tableHeader.eachCell((cell, colNumber) => {
                            if (colNumber != 1) {
                                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCCCCC' } };
                                cell.font = { bold: true };
                                worksheet.getColumn(colNumber).width = 20;
                            }
                        });

                    }
                }

                if (sectionData.style == 'object') {
                    await this.style2(worksheet, sectionData, company)
                } else {

                    sectionData.records.forEach((item: any) => {
                        const row = worksheet.addRow(['']);
                        Object.keys(item).forEach(async (key: string) => {
                            let cell = row.getCell(row.cellCount + 1)
                            cell.value = item[key];
                            if (!(key == 'value' && ['Sales Items', 'Returns Items', 'Total Items', 'Total Order', 'Guests'].includes(item['key']))) {
                                await this.getCellFormat(cell, sectionData.columns[key]?.columnType ?? null, 'BHD', 3)
                            }
                            //cell.fill = {type: 'pattern',pattern:'solid',fgColor:{argb:'ffffff'}}
                            cell.border = { top: { color: { argb: 'CBCBCB' }, style: 'thin' }, bottom: { color: { argb: 'CBCBCB' }, style: 'thin' } };
                        })


                        // const rowData = Object.values(item);
                        // const row = worksheet.addRow(rowData);
                        // row.eachCell((cell, colNumber) => {
                        //   cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                        //   if (colNumber >= 2 && colNumber <= 4) {
                        //     cell.alignment = { horizontal: 'center' };
                        //   }
                        // });
                    });
                }










                //############# total ###################

                let hasTotalIndx = Object.values(sectionData.columns).findIndex((elem: any) => { if (elem.hasOwnProperty('hasTotal')) return elem })

                if (hasTotalIndx > -1) {
                    const grandTotalRow = worksheet.addRow(['', 'Grand Total']);
                    grandTotalRow.font = { bold: true };
                    grandTotalRow.getCell(grandTotalRow.cellCount).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CBCBCB' } }

                    Object.keys(sectionData.columns).slice(1,).forEach(async (colName: any) => {
                        let col = sectionData.columns[colName]
                        let cell = grandTotalRow.getCell(grandTotalRow.cellCount + 1)
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CBCBCB' } }
                        if (col.hasTotal) {
                            let ColLetter = cell.address.charAt(0)
                            let rowNumber: integer = Number(cell.row) ?? 1
                            cell.value = { formula: `SUBTOTAL(9,${ColLetter}${rowNumber - sectionData.records.length}:${ColLetter}${rowNumber - 1})`, };
                            await this.getCellFormat(cell, col.columnType ?? '', 'BHD', 3)
                        }
                        else {
                            cell.value = ''
                        }
                    });
                }



                worksheet.addRow([]);
            });

            //##################################  Sheet format ##################################    
            this.sheetFormat(worksheet, companyInfo.name)

            //##################################  Response  ##################################
            return workbook.xlsx.writeFile(fileName + '.xlsx').then(buffer => {
                fileName;
                const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;application/json; charset=utf-8; text/csv';
                const fileExtension = '.xlsx'

                return {
                    fileName: `${fileName}${fileExtension}`,
                    type,
                    buffer
                }
            });

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async style2(worksheet: WorkSheet, sectionData: any, company: Company) {
        try {



            Object.keys(sectionData.records).forEach(sectionKey2 => {

                const headerRow = worksheet.addRow(['', sectionKey2, '']);
                headerRow.font = { bold: true };
                headerRow.eachCell((cell: any, colNumber: number) => {
                    if (colNumber != 1) {
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCCCCC' } };
                        cell.font = { bold: true };
                        worksheet.getColumn(colNumber).width = 20;
                    }
                });

                const tt = sectionData.records[sectionKey2];

                const convertedArray = Object.entries(tt).map(([key, value]) => {
                    return { 'key': key, 'value': value };
                });

                let records = convertedArray
                records.forEach((item: any) => {
                    const row = worksheet.addRow(['']);
                    Object.keys(item).forEach(async (key: string) => {
                        let cell = row.getCell(row.cellCount + 1)
                        cell.value = item[key];
                        if (!(key == 'value' && ['salesItems', 'returnsItems', 'totalItems', 'totalOrder', 'guests'].includes(item['key']))) {
                            await this.getCellFormat(cell, sectionData.columns[key]?.columnType ?? null, 'BHD', 3)
                        }
                        //cell.fill = {type: 'pattern',pattern:'solid',fgColor:{argb:'ffffff'}}
                        cell.border = { top: { color: { argb: 'CBCBCB' }, style: 'thin' }, bottom: { color: { argb: 'CBCBCB' }, style: 'thin' } };
                    })

                });

            })

            worksheet.addRow([]);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async exportBalanceSheet(data: ReportData, company: Company, options?: { fileName: string; }) {

        try {
            const workbook = new Excel.Workbook();
            let worksheet = workbook.addWorksheet('Sheet1');
            let fileName = data.fileName ? data.fileName : company.id + 'Report'

            //get companyInfo
            let companyInfo = (await CompanyRepo.getCompanyById(company.id)).data
            const afterDecimal = companyInfo.settings.afterDecimal ?? 3
            const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD"
            worksheet.addRow([])

            //###################################### Report Header ######################################  
            let titleRow = this.pageHeader(worksheet, data.filter)

            //report Filter 
            if (data.filter) {
                await this.appliedFilter(worksheet, data.filter)
            }

            worksheet.addRow([])
            const headerRowCount = worksheet.rowCount

            //##################################   Table headers/ subheaders   ###################################   
            await this.setHeaders(worksheet, data.columns)

            const headercolumnCount = worksheet.columnCount
            worksheet.mergeCells(`B${titleRow.number}: ${worksheet.lastColumn?.letter}${titleRow.number}`)

            for (let i = 1; i <= headerRowCount; i++) {
                let row = worksheet.getRow(i)
                for (let j = 1; j < headercolumnCount + 1; j++) {
                    row.getCell(j).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'ffffff' },
                        bgColor: { argb: 'ffffff' },
                    };
                }
            }

            //######################################         Data        ######################################
            let firstRowOfData = worksheet.rowCount ? worksheet.rowCount + 1 : 1

            // Get unique balanceCol names from the data
            const balanceColumns = [...data.columns.slice(2).map(obj => obj.key)]
            const grouped: Record<string, Record<string, Record<string, any[]>>> = {};

            data.records.forEach((item: any) => {
                grouped[item.grandType] ??= {};
                grouped[item.grandType][item.parentType] ??= {};
                grouped[item.grandType][item.parentType][item.type] ??= [];
                grouped[item.grandType][item.parentType][item.type].push(item);
            });

            for (const [grandType, parents] of Object.entries(grouped)) {
                worksheet.addRow({ account: grandType }).font = { bold: true };
                const grandStartRow = worksheet.lastRow?.number ?? 1;

                for (const [parentType, types] of Object.entries(parents)) {
                    const r = worksheet.addRow({ account: parentType })
                    for (let j = 2; j <= headercolumnCount; j++) {
                        r.getCell(j).fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'C8C8C8' },
                            bgColor: { argb: 'C8C8C8' },
                        };
                    }
                    const parentStartRow = worksheet.lastRow?.number ?? 1;

                    for (const [type, accounts] of Object.entries(types)) {

                        if (parentType == 'Current Assets') {
                            const r = worksheet.addRow({ account: type })
                            for (let j = 2; j <= headercolumnCount; j++) {
                                r.getCell(j).fill = {
                                    type: 'pattern',
                                    pattern: 'solid',
                                    fgColor: { argb: 'F2F2F2' },
                                    bgColor: { argb: 'F2F2F2' },
                                };
                            }

                        }
                        const typeStartRow = worksheet.lastRow?.number ?? 1;

                        //-----------add accounts----------
                        for (const acc of accounts) {
                            const rowData: any = { account: (acc.parentId != acc.accountId ? `     ${acc.account}` : ` ${acc.account}`), code: `${acc.code}` };
                            balanceColumns.forEach(balanceCol => {
                                const d = acc.summary?.find((obj: {}) => Object.keys(obj)[0] === balanceCol);
                                rowData[balanceCol] = d ? Object.values(d)[0] : ""
                            });


                            worksheet.addRow(rowData);
                        }

                        //-----------add Total Type----------

                        if (parentType == 'Current Assets') {
                            const typeEndRow = worksheet.lastRow?.number ?? 1;
                            const typeTotalRowData: Record<string, string | { formula: string }> = { account: `Total ${type}` };

                            balanceColumns.forEach((balanceCol: string, index: number) => {
                                worksheet.getColumn(balanceCol).letter
                                const colLetter = worksheet.getColumn(balanceCol).letter; // B, C, D, ...
                                typeTotalRowData[balanceCol] = { formula: `SUBTOTAL(9,${colLetter}${typeStartRow}:${colLetter}${typeEndRow})` };
                            });

                            const typeTotalRow = worksheet.addRow(typeTotalRowData);
                            typeTotalRow.font = { bold: true };
                        }

                    }
                    const parentEndRow = worksheet.lastRow?.number ?? 1;
                    const parentTotalRowData: Record<string, string | { formula: string }> = { account: `Total ${parentType}` };

                    balanceColumns.forEach((balanceCol, index) => {
                        const colLetter = worksheet.getColumn(balanceCol).letter;;// B, C, D, ...
                        parentTotalRowData[balanceCol] = { formula: `SUBTOTAL(9,${colLetter}${parentStartRow}:${colLetter}${parentEndRow})` };
                    });

                    const parentTotalRow = worksheet.addRow(parentTotalRowData);
                    parentTotalRow.font = { bold: true };
                }
                const grandEndRow = worksheet.lastRow?.number ?? 1;
                const grandTotalRowData: Record<string, string | { formula: string }> = { account: `Total ${grandType}` };
                balanceColumns.forEach((balanceCol, index) => {
                    const colLetter = worksheet.getColumn(balanceCol).letter;// B, C, D, ...
                    grandTotalRowData[balanceCol] = { formula: `SUBTOTAL(9,${colLetter}${grandStartRow}:${colLetter}${grandEndRow})` };
                });

                const grandTotalRow = worksheet.addRow(grandTotalRowData);
                grandTotalRow.font = { bold: true };
            }

            // Format all balance columns as currency
            balanceColumns.forEach(balanceCol => {
                worksheet.getColumn(balanceCol).numFmt = `"${companyInfo.settings.currencySymbol}" #,##0.${'0'.repeat(companyInfo.settings.afterDecimal)};("${companyInfo.settings.currencySymbol}" #,##0.${'0'.repeat(companyInfo.settings.afterDecimal)})`

            });


            //############################### Sheet format ###############################  
            this.sheetFormat(worksheet, companyInfo.name)

            //############################### columns Width ###############################   
            worksheet = await this.autoFitColumnWidth(worksheet)

            //###############################    Response    ############################### 
            return workbook.xlsx.writeFile(fileName + '.xlsx').then(buffer => {
                fileName;
                const type = 'application/vnd.openxmlformats-officedocument.spreadworksheetml.worksheet;application/json; charset=utf-8; text/csv';
                const fileExtension = '.xlsx'

                return {
                    fileName: `${fileName}${fileExtension}`,
                    type,
                    buffer
                }
            });



        } catch (error: any) {
            console.log(error)
            throw new Error(error);
        }

    }

    public static async exportProfitAndLoss(data: ReportData, company: Company, options?: { fileName: string; }) {

        try {
            const workbook = new Excel.Workbook();
            let worksheet = workbook.addWorksheet('Sheet1');
            let fileName = data.fileName ? data.fileName : company.id + 'Report'

            //get companyInfo
            let companyInfo = (await CompanyRepo.getCompanyById(company.id)).data
            const afterDecimal = companyInfo.settings.afterDecimal ?? 3
            const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD"
            worksheet.addRow([])

            //###################################### Report Header ######################################  
            let titleRow = this.pageHeader(worksheet, data.filter)

            //report Filter 
            if (data.filter) {
                await this.appliedFilter(worksheet, data.filter)
            }

            worksheet.addRow([])
            const headerRowCount = worksheet.rowCount

            //################################   Table headers/ subheaders   #################################   
            await this.setHeaders(worksheet, data.columns)

            const headercolumnCount = worksheet.columnCount
            worksheet.mergeCells(`B${titleRow.number}: ${worksheet.lastColumn?.letter}${titleRow.number}`)

            for (let i = 1; i <= headerRowCount; i++) {
                let row = worksheet.getRow(i)
                for (let j = 1; j < headercolumnCount + 1; j++) {
                    row.getCell(j).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'ffffff' },
                        bgColor: { argb: 'ffffff' },
                    };
                }
            }

            //######################################         Data        ######################################
            // Get unique balanceCol names from the data
            let firstRowOfData = worksheet.rowCount ? worksheet.rowCount + 1 : 1

            const balanceColumns = [...data.columns.slice(2).map(obj => obj.key)]
            const grouped: Record<string, Record<string, any[]>> = {};
            data.records.forEach((item: any) => {
                grouped[item.parentType] ??= {};
                grouped[item.parentType][item.type] ??= [];
                grouped[item.parentType][item.type].push(item);
            });


            for (const [parentType, types] of Object.entries(grouped)) {
                const r = worksheet.addRow({ account: parentType })
                for (let j = 2; j <= headercolumnCount; j++) {
                    r.getCell(j).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'C8C8C8' },
                        bgColor: { argb: 'C8C8C8' },
                    };
                }
                const parentStartRow = worksheet.lastRow?.number ?? 1;


                for (const [type, accounts] of Object.entries(types)) {

                    // /parent type == type || account name == type and type has only one account



                    if (!((parentType == type) || (accounts.length == 1 && accounts[0].account == type))) {
                        accounts.forEach(acc => acc.account = '   ' + acc.account)
                        const r = worksheet.addRow({ account: type })
                        for (let j = 2; j <= headercolumnCount; j++) {
                            r.getCell(j).fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'F2F2F2' },
                                bgColor: { argb: 'F2F2F2' },
                            };
                        }

                    }
                    const typeStartRow = worksheet.lastRow?.number ?? 1;

                    //-----------add accounts----------
                    for (const acc of accounts) {
                        const rowData: any = { account: (acc.parentId != acc.accountId ? `     ${acc.account}` : ` ${acc.account}`), code: `${acc.code ?? ""}` };
                        balanceColumns.forEach(balanceCol => {
                            const d = acc.summary?.find((obj: {}) => Object.keys(obj)[0] === balanceCol);
                            rowData[balanceCol] = d ? _.isNumber(Object.values(d)[0]) ? Object.values(d)[0] : "" : ""
                        });


                        worksheet.addRow(rowData);
                    }
                }
                const parentEndRow = worksheet.lastRow?.number ?? 1;
                const parentTotalRowData: Record<string, string | { formula: string }> = { account: `Total ${parentType}` };

                balanceColumns.forEach((balanceCol, index) => {
                    const colLetter = worksheet.getColumn(balanceCol).letter;;// B, C, D, ...
                    parentTotalRowData[balanceCol] = { formula: `SUBTOTAL(9,${colLetter}${parentStartRow}:${colLetter}${parentEndRow})` };
                });

                const parentTotalRow = worksheet.addRow(parentTotalRowData);
                parentTotalRow.font = { bold: true };
            }

            // Format all balance columns as currency
            balanceColumns.forEach(balanceCol => {
                worksheet.getColumn(balanceCol).numFmt = `"${companyInfo.settings.currencySymbol}" #,##0.${'0'.repeat(companyInfo.settings.afterDecimal)};("${companyInfo.settings.currencySymbol}" #,##0.${'0'.repeat(companyInfo.settings.afterDecimal)})`

            });


            //############################### Sheet format ###############################  
            this.sheetFormat(worksheet, companyInfo.name)

            //############################### columns Width ###############################   
            worksheet = await this.autoFitColumnWidth(worksheet)

            //###############################    Response    ############################### 
            return workbook.xlsx.writeFile(fileName + '.xlsx').then(buffer => {
                fileName;
                const type = 'application/vnd.openxmlformats-officedocument.spreadworksheetml.worksheet;application/json; charset=utf-8; text/csv';
                const fileExtension = '.xlsx'

                return {
                    fileName: `${fileName}${fileExtension}`,
                    type,
                    buffer
                }
            });



        } catch (error: any) {
            console.log(error)
            throw new Error(error);
        }



    }

    public static async exportVatReport(data: ReportData, company: Company, options?: { fileName: string; }) {
        try {


            const workbook = new Excel.Workbook();
            let worksheet = workbook.addWorksheet('Sheet1');
            let fileName = data.fileName ? data.fileName : company.id + 'Report'

            //get companyInfo
            let companyInfo = (await CompanyRepo.getCompanyById(company.id)).data
            const afterDecimal = companyInfo.settings.afterDecimal ?? 3
            const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD"
            worksheet.addRow([])

            //###################################### Report Header ######################################  
            let titleRow = this.pageHeader(worksheet, data.filter)

            //report Filter 
            if (data.filter) {
                await this.appliedFilter(worksheet, data.filter)
            }

            worksheet.addRow([])
            const headerRowCount = worksheet.rowCount
            let headercolumnCount = 4

            worksheet.mergeCells(`B${titleRow.number}: D${titleRow.number}`)
            for (let i = 1; i <= headerRowCount; i++) {
                let row = worksheet.getRow(i)
                for (let j = 1; j < headercolumnCount + 1; j++) {
                    row.getCell(j).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'ffffff' },
                        bgColor: { argb: 'ffffff' },
                    };
                }
            }


            //###################################### Data ######################################
            const records: any = data.records

            worksheet.addRow(['']);
            let salesVatTotaFormula = ''
            let purchaseVatTotaFormula = ''
            Object.keys(records).forEach(sectionKey => {
                const headerRow = worksheet.addRow(['', sectionKey]);
                headerRow.font = { bold: true };

                const sectionData = records[sectionKey];



                if (!Object.keys(sectionData.records[0]).includes('key')) {

                    const tableHeader = worksheet.addRow([...[''], ...Object.keys(sectionData.records[0])]);

                    tableHeader.eachCell((cell, colNumber) => {
                        if (colNumber != 1) {
                            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCCCCC' } };
                            cell.font = { bold: true };
                            worksheet.getColumn(colNumber).width = 20;
                        }
                    });


                }






                sectionData.records.forEach((item: any) => {
                    const row = worksheet.addRow(['']);

                    console.log(item['#'])
                    Object.keys(item).forEach(async (key: string) => {
                        let cell = row.getCell(row.cellCount + 1)
                        cell.value = (sectionData.columns[key].columnType == 'currency') ? Number(item[key]) : item[key]

                        if (item['#'] == '15' && key == 'Vat Amount') {
                            cell.value = { formula: `${salesVatTotaFormula} - ${purchaseVatTotaFormula}`, };

                        }


                        if (!(key == 'value' && ['salesItems', 'returnsItems', 'totalItems', 'totalOrder', 'guests'].includes(item['key']))) {
                            await this.getCellFormat(cell, sectionData.columns[key].columnType, 'BHD', 3)
                        }
                        //cell.fill = {type: 'pattern',pattern:'solid',fgColor:{argb:'ffffff'}}
                        cell.border = { top: { color: { argb: 'CBCBCB' }, style: 'thin' }, bottom: { color: { argb: 'CBCBCB' }, style: 'thin' } };
                    })


                    // const rowData = Object.values(item);
                    // const row = worksheet.addRow(rowData);
                    // row.eachCell((cell, colNumber) => {
                    //   cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    //   if (colNumber >= 2 && colNumber <= 4) {
                    //     cell.alignment = { horizontal: 'center' };
                    //   }
                    // });
                });

                //############# total ###################
                let grandTotalboxNum = '';
                let grandTotalDescription = '';
                switch (sectionKey) {
                    case 'VAT On Sales':
                        grandTotalboxNum = '7'
                        grandTotalDescription = 'Total Sales';
                        break;
                    case 'VAT On Purchases':
                        grandTotalboxNum = '14'
                        grandTotalDescription = 'Total Purchases';
                        break;
                    case 'Net VAT Due':
                        grandTotalboxNum = '18'
                        grandTotalDescription = 'Net Vat due (or reclaimed)';
                        break;
                    default:
                        break;
                }
                let hasTotalIndx = Object.values(sectionData.columns).findIndex((elem: any) => { if (elem.hasOwnProperty('hasTotal')) return elem })

                if (hasTotalIndx > -1) {

                    const grandTotalRow = worksheet.addRow(['', grandTotalboxNum, grandTotalDescription]);
                    grandTotalRow.font = { bold: true };
                    grandTotalRow.getCell('B').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CBCBCB' } }
                    grandTotalRow.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CBCBCB' } }
                    console.log(sectionData.columns)
                    Object.keys(sectionData.columns).slice(2,).forEach(async (colName: any) => {
                        let col = sectionData.columns[colName]
                        console.log(colName)


                        let cell = grandTotalRow.getCell(grandTotalRow.cellCount + 1)
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CBCBCB' } }
                        if (col.hasTotal) {
                            let ColLetter = cell.address.charAt(0)
                            let rowNumber: integer = Number(cell.row) ?? 1
                            cell.value = sectionKey == 'Net VAT Due' ? { formula: `SUM(${ColLetter}${rowNumber - sectionData.records.length}:${ColLetter}${rowNumber - 1})`, } : { formula: `SUBTOTAL(9,${ColLetter}${rowNumber - sectionData.records.length}:${ColLetter}${rowNumber - 1})`, };
                            if (sectionKey == 'VAT On Purchases' && colName == 'Vat Amount') {
                                purchaseVatTotaFormula = `SUBTOTAL(9,${ColLetter}${rowNumber - sectionData.records.length}:${ColLetter}${rowNumber - 1})`
                            } else if (sectionKey == 'VAT On Sales' && colName == 'Vat Amount') {
                                salesVatTotaFormula = `SUBTOTAL(9,${ColLetter}${rowNumber - sectionData.records.length}:${ColLetter}${rowNumber - 1})`
                            }
                            await this.getCellFormat(cell, col.columnType, 'BHD', 3)
                        }
                        else {
                            cell.value = ''
                        }
                    });
                }



                worksheet.addRow([]);
            });

            //##################################  Sheet format ##################################    
            this.sheetFormat(worksheet, companyInfo.name)

            //####################################  Response  ####################################
            return workbook.xlsx.writeFile(fileName + '.xlsx').then(buffer => {
                fileName;
                const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;application/json; charset=utf-8; text/csv';
                const fileExtension = '.xlsx'

                return {
                    fileName: `${fileName}${fileExtension}`,
                    type,
                    buffer
                }
            });



        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    //not used
    public static async addFilterDetails(worksheet: WorkSheet, filterTitle: string, filter: string) {
        try {

            let borderStyle: Partial<Borders> = {
                bottom: { style: 'medium' },
                right: { style: 'medium' },
                left: { style: 'medium' },
                top: { style: 'medium' },
            }

            let productrow = worksheet.addRow(['', `${filterTitle} :`, ` ${filter}`]);
            worksheet.mergeCells(`C${productrow.number}:D${productrow.number}`)
            productrow.font = { name: "Calibri" }
            worksheet.getCell(`B${productrow.number}`).border = borderStyle
            worksheet.getCell(`C${productrow.number}`).border = borderStyle

        } catch (error) {
            console.log(error)
        }
    }

    private static async mergeGroupBytype(worksheet: Excel.Worksheet, columns: DataColumn[], firstRowOfData: number, lastRow: number) {
        try {



            const column = worksheet.getColumnKey('type') ?? null;
            let numOfRows = 0;
            if (column && column !== undefined) {

                let currentCategory = worksheet.getCell(`${column.letter}${firstRowOfData}`).value;
                let subTotal = 0;
                let lastRowIndex = firstRowOfData;



                for (let row = firstRowOfData; row <= lastRow + 1; row++) {
                    let cell = worksheet.getCell(`${column.letter}${row}`)
                    const category = cell.value
                    if (category !== currentCategory) {

                        // if(totalCol.properties?.groupBy == 'horizantal'){
                        //     const r = worksheet.insertRow(lastRowIndex,['',currentCategory])
                        //     row++;
                        //     lastRowIndex++;
                        //     const headercolumnCount = worksheet.columnCount
                        //     for (let j = 2; j <= headercolumnCount  ; j++){
                        //         r.getCell(j).fill = {
                        //             type: 'pattern',
                        //             pattern: 'solid',
                        //             fgColor: { argb: 'C8C8C8' },
                        //             bgColor: { argb: 'C8C8C8' },
                        //         };
                        //     }
                        // }


                        worksheet.mergeCells(`${column.letter}${lastRowIndex}:${column.letter}${(row - 1)}`)

                        subTotal = 0;



                        const reportHasSubTotal = columns.findIndex(col => col.properties?.hasSubTotal)

                        if (reportHasSubTotal !== -1) {


                            await this.addSubtotalRow(worksheet, columns, String(currentCategory), lastRowIndex, (row - 1), column.key);
                            numOfRows++;
                            row++;
                            lastRowIndex++;
                            lastRow++;


                        }
                        currentCategory = category;
                        lastRowIndex = row;

                    }
                    subTotal++;

                }

                column.alignment = { 'vertical': 'top' }
            }
            return numOfRows




        } catch (error: any) {
            throw new Error(error.message)
        }

    }
    public static async sortColumn(worksheet: Excel.Worksheet, column: number, h2l: boolean = true, startRow: number = 1, endRow?: number) {
        endRow = endRow || worksheet.actualRowCount;
        column--;

        const sortFunction = (a: CellValue[], b: CellValue[]): number => {
            if (a[column] === b[column]) {
                return 0;
            }
            else {

                let aa = a[column] ?? 0
                let bb = b[column] ?? 0
                if (h2l) {
                    return (aa > bb && h2l) ? -1 : 1;
                }
                else {
                    return (aa < bb) ? -1 : 1;
                }
            }

        }

        let rows: CellValue[][] = [];
        for (let i = startRow; i <= endRow; i++) {
            let row: CellValue[] = [];
            for (let j = 1; j <= worksheet.columnCount; j++) {
                row.push(worksheet.getRow(i).getCell(j).value);
            }
            rows.push(row);
        }
        rows.sort(sortFunction);

        // Remove all rows from worksheet then add all back in sorted order
        worksheet.spliceRows(startRow, endRow, ...rows);
    }

    private static async totalForBalanceSheet(worksheet: Excel.Worksheet, columns: DataColumn[], category: string, length: number, endRow: number, colKey?: string) {
        try {

            const subTotalRow = colKey ? worksheet.insertRow(endRow + 1, []) : worksheet.insertRow(endRow + 1, [`Total ${category}`]);
            let columnNumber: number = 2

            if (colKey) {
                subTotalRow.getCell(colKey).value = category
                columnNumber = worksheet.getColumn(colKey).number

            }
            columns.forEach((totalCol: DataColumn) => {
                if (totalCol.key && totalCol.properties?.hasSubTotal) {
                    const column = worksheet.getColumnKey(totalCol.key) ?? null;
                    if (column && column.key) {
                        subTotalRow.getCell(column.key).value = {
                            formula: `SUBTOTAL(9,INDIRECT("${column.letter}${(endRow - length)}: "&ADDRESS(ROW()-1,COLUMN())))`,
                        };
                    }
                    (totalCol.childs || []).forEach((subCol: DataColumn) => {
                        const subColumn = worksheet.getColumnKey(`${totalCol.key}-${subCol.key}`);
                        if (subColumn && subColumn.key) {
                            subTotalRow.getCell(`${totalCol.key}-${subCol.key}`).value = {
                                formula: `SUBTOTAL(9,INDIRECT("${subColumn.letter}${(endRow - length)}: "&ADDRESS(ROW()-1,COLUMN())))`,
                            };
                        }
                    });
                }
            });

            subTotalRow.eachCell({ includeEmpty: true }, (cell, colIndex) => {
                if (columnNumber && colIndex >= columnNumber) {
                    if (columnNumber != 2) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'CBCBCB' },
                        }
                    } else {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'C8C8C8' },
                        };
                    }

                    cell.font = { bold: true };
                }

            });

        } catch (error: any) {
          
            throw new Error(error.message)
        }

    }

    public static async exportToExceltestt(worksheet: exceljs.Worksheet, data: TableRecords, currencySymbol: string | null, afterDecimal: number) {
        try {

            const headerRowCount = worksheet.rowCount

            //###################################### headers/ subheaders ######################################   
            await this.setHeaders(worksheet, data.columns)


            const headercolumnCount = data.columns.length

            for (let i = 1; i <= headerRowCount; i++) {
                let row = worksheet.getRow(i)
                for (let j = 1; j < headercolumnCount + 1; j++) {
                    row.getCell(j).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'ffffff' },
                        bgColor: { argb: 'ffffff' },
                    };
                }
            }

            //######################################         Data        ######################################

            let firstRowOfData = worksheet.rowCount ? worksheet.rowCount + 1 : 1


            for (const record of data.records) {
                const row = worksheet.addRow([]);
                for (const column of data.columns) {

                    if (column.childs?.length) {
                        for (const child of column.childs) {
                            const childData = record.summary?.find((s: any) => s[column.key])?.[column.key]?.[child.key] ?? '';

                            row.getCell(column.key + '-' + child.key).value = (!isNaN(Number(childData)) && Number(childData) != undefined && child.properties?.columnType != 'date_day' && child.properties?.columnType != 'date' && child.properties?.columnType != 'date_time') ? Number(childData) : childData;
                            //row.getCell(column.key+'-'+child.key).numFmt =`"${companyInfo.settings.currencySymbol}" #,##0.${'0'.repeat(companyInfo.settings.afterDecimal)}`
                        }
                    } else {
                        let p;

                        if (record[column.key]) { p = record[column.key] }
                        else if (record.summary?.find((s: any) => s[column.key])?.[column.key]) { p = record.summary.find((s: any) => s[column.key])?.[column.key] }
                        else (p = '')
                        row.getCell(column.key).value = ((p != '' && !isNaN(Number(p)) && Number(p) != undefined && column.properties?.columnType != 'date_day' && column.properties?.columnType != 'date' && column.properties?.columnType != 'date_time') ? Number(p) : p);
                        //row.getCell(column.key).numFmt=`"${companyInfo.settings.currencySymbol}" #,##0.${'0'.repeat(companyInfo.settings.afterDecimal)}`

                    }
                }
            }


            //######################################   groupBy  ######################################
            const reportHasGroupBy = data.columns.findIndex(col => col.properties?.groupBy)



            if (reportHasGroupBy !== -1) { await this.mergeGroupBytest(worksheet, data.columns, firstRowOfData) }


            //######################################   sub Total  ######################################
            const reportHasSubTotal = data.columns.findIndex(col => col.properties?.hasSubTotal)

            if (reportHasSubTotal !== -1) {


                let currentCategory = worksheet.getCell(`B${firstRowOfData}`).value;
                let subTotal = 0;
                let lastRowIndex = firstRowOfData;
                for (let row = firstRowOfData + 1; row <= worksheet.rowCount; row++) {
                    const category = worksheet.getCell(row, 2).value;
                    if (category !== currentCategory) {
                        // Add subtotal for the previous category
                        await this.addSubtotalRow(worksheet, data.columns, String(currentCategory), lastRowIndex, row - 1);
                        currentCategory = category;
                        subTotal = 0;
                        lastRowIndex = row;
                    }
                    subTotal++;
                }

                // Add the final subtotal
                await this.addSubtotalRow(worksheet, data.columns, String(currentCategory), lastRowIndex, worksheet.rowCount);
            }

            //######################################   Grand Total  ######################################

            if (data.columns.find(col => col.properties?.hasTotal)) {
                await this.addGrandTotalRow(worksheet, data.columns, firstRowOfData, worksheet.rowCount + 1);
            }




            //############################### format columns with currency ###############################
            for (let col of data.columns) {
                if (col.properties?.columnType)
                    await this.formatCurrency(worksheet, col.key, currencySymbol, afterDecimal, col.properties.columnType)

                col.childs?.forEach(async (subCol) => {
                    if (subCol.properties?.columnType)
                        await this.formatCurrency(worksheet, col.key + '-' + subCol.key, currencySymbol, afterDecimal, subCol.properties?.columnType)

                }
                )

            }




        } catch (error: any) {
            console.log(error)
            throw new Error(error);
        }
    }

    // public static async exportBalanceSheetToExcel(data: ReportData, company: Company, options?: { fileName: string; }) {
    //     try {
    //         const workbook = new Excel.Workbook();
    //         let worksheet = workbook.addWorksheet('Sheet1');
    //         let fileName = data.fileName ? company.id + data.fileName : company.id + 'Report'



    //         //get companyInfo
    //         let companyInfo = (await CompanyRepo.getCompanyById(company.id)).data
    //         const afterDecimal = companyInfo.settings.afterDecimal ?? 3
    //         const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD"
    //         worksheet.addRow([])


    //         //report Title
    //         worksheet.addRow([])
    //         let title = data.filter.title;
    //         let titleRow = worksheet.addRow(['', title.toUpperCase()]);
    //         titleRow.font = { name: 'Cambria', family: 4, size: 28, color: { argb: 'C00000' } };
    //         //worksheet.mergeCells(`B${titleRow.number}: D${titleRow.number}`)

    //         //Add row with current date
    //         let subTitleRow = worksheet.addRow(["",
    //             "From Date : " + data.filter.fromDate + '     ' +
    //             "To Date : " + data.filter.toDate,
    //         ]);
    //         subTitleRow.font = { name: 'Cambria' };
    //         worksheet.mergeCells(`B${subTitleRow.number}: D${subTitleRow.number}`)
    //         worksheet.addRow([])

    //         //filter
    //         let branches = data.filter.branches ? data.filter.branches : []
    //         let period = data.filter.compareType ? data.filter.compareType : null
    //         let borderStyle: Partial<Borders> = {
    //             bottom: { style: 'medium' },
    //             right: { style: 'medium' },
    //             left: { style: 'medium' },
    //             top: { style: 'medium' },
    //         }

    //         let filterRow = worksheet.addRow(['', 'Applied Filter: '])
    //         filterRow.font = { name: "Cambria", bold: true }
    //         // branch
    //         let branchesName: any[] = []
    //         for (let branchId of branches) {
    //             let name = await BranchesRepo.getBranchName(branchId)
    //             branchesName.push(name)
    //         }
    //         let branchFilter = worksheet.addRow(['', "Branches:", branchesName.length > 0 ? branchesName : 'All']);
    //         worksheet.mergeCells(`C${branchFilter.number}:D${branchFilter.number}`)
    //         branchFilter.font = { name: "Calibri" }
    //         worksheet.getCell(`B${branchFilter.number}`).border = borderStyle
    //         worksheet.getCell(`C${branchFilter.number}`).border = borderStyle

    //         //period
    //         if (period == 'Period') {
    //             let periodFilter = worksheet.addRow(['', `Period :`, ` ${data.filter.period} Qty[${data.filter.periodQty}]`]);
    //             worksheet.mergeCells(`C${periodFilter.number}:D${periodFilter.number}`)
    //             periodFilter.font = { name: "Calibri" }
    //             worksheet.getCell(`B${periodFilter.number}`).border = borderStyle
    //             worksheet.getCell(`C${periodFilter.number}`).border = borderStyle

    //         }

    //         //productName filter for product Movment
    //         if (data.filter.productName) {
    //             let productNameFilter = worksheet.addRow(['', `product Name :`, ` ${data.filter.productName}]`]);
    //             worksheet.mergeCells(`C${productNameFilter.number}:D${productNameFilter.number}`)
    //             productNameFilter.font = { name: "Calibri" }
    //             worksheet.getCell(`B${productNameFilter.number}`).border = borderStyle
    //             worksheet.getCell(`C${productNameFilter.number}`).border = borderStyle

    //         }



    //         worksheet.addRow([])
    //         const headerRowCount = worksheet.rowCount

    //         //###################################### headers/ subheaders ######################################   
    //         await this.setHeaders(worksheet, data.columns)


    //         const headercolumnCount = worksheet.columnCount
    //         worksheet.mergeCells(`B${titleRow.number}: ${worksheet.lastColumn?.letter}${titleRow.number}`)

    //         for (let i = 1; i <= headerRowCount; i++) {
    //             let row = worksheet.getRow(i)
    //             for (let j = 1; j < headercolumnCount + 1; j++) {
    //                 row.getCell(j).fill = {
    //                     type: 'pattern',
    //                     pattern: 'solid',
    //                     fgColor: { argb: 'ffffff' },
    //                     bgColor: { argb: 'ffffff' },
    //                 };
    //             }
    //         }

    //         //######################################         Data        ######################################
    //         worksheet.addRow(['Assets'])
    //         let firstRowOfData = worksheet.rowCount ? worksheet.rowCount + 1 : 1
    //         let tt = 'Assets'
    //         let count = 0
    //         let assetsTotalRow

    //         for (const record of data.records) {

    //             if (record['grandType'] != tt) {

    //                 await this.totalForBalanceSheet(worksheet, data.columns, tt, count, worksheet.rowCount);
    //                 if (tt !== 'Liabilities and Equity') {
    //                     worksheet.addRow(['Liabilities and Equity']);

    //                 }
    //                 count = 0;
    //                 tt = 'Liabilities and Equity';

    //             }
    //             const row = worksheet.addRow([]);
    //             for (const column of data.columns) {


    //                 if (column.childs?.length) {
    //                     for (const child of column.childs) {
    //                         const childData = record.summary?.find((s: any) => s[column.key])?.[column.key]?.[child.key] ?? '';

    //                         row.getCell(column.key + '-' + child.key).value = (!isNaN(Number(childData)) && Number(childData) != undefined && child.properties?.columnType != 'date_day' && child.properties?.columnType != 'date' && child.properties?.columnType != 'date_time') ? Number(childData) : childData;
    //                         //row.getCell(column.key+'-'+child.key).numFmt =`"${companyInfo.settings.currencySymbol}" #,##0.${'0'.repeat(companyInfo.settings.afterDecimal)}`
    //                     }
    //                 } else {
    //                     let p;

    //                     if (record[column.key]) { p = record[column.key] }
    //                     else if (record.summary?.find((s: any) => s[column.key])?.[column.key]) { p = record.summary.find((s: any) => s[column.key])?.[column.key] }
    //                     else (p = '')

    //                     row.getCell(column.key).value = ((p != '' && !isNaN(Number(p)) && Number(p) != undefined && column.properties?.columnType != 'date_day' && column.properties?.columnType != 'date' && column.properties?.columnType != 'date_time') ? Number(p) : p);

    //                     //row.getCell(column.key).numFmt=`"${companyInfo.settings.currencySymbol}" #,##0.${'0'.repeat(companyInfo.settings.afterDecimal)}`

    //                 }

    //             }


    //             count++;


    //         }



    //         //######################################   groupBy  ######################################
    //         const reportHasGroupBy = data.columns.findIndex(col => col.properties?.groupBy)
    //         const reportHasSubTotal = data.columns.findIndex(col => col.properties?.hasSubTotal)

    //         if (reportHasSubTotal !== -1 && reportHasGroupBy == -1) {
    //             data.columns[0].properties = data.columns[0].properties || { 'groupBy': true }
    //             await this.mergeGroupBytest(worksheet, data.columns, firstRowOfData)
    //         } else {
    //             if (reportHasGroupBy !== -1) { await this.mergeGroupBytest(worksheet, data.columns, firstRowOfData) }

    //         }

    //         let LiabilitiesIndex = -1
    //         worksheet.eachRow(async (row) => {
    //             if (row.getCell(1).value == 'Liabilities and Equity') {
    //                 await this.totalForBalanceSheet(worksheet, data.columns, tt, (worksheet.rowCount - row.number), worksheet.rowCount)
    //             }
    //         })





    //         //######################################   Grand Total  ######################################

    //         if (data.columns.find(col => col.properties?.hasTotal)) {
    //             await this.addGrandTotalRow(worksheet, data.columns, firstRowOfData, worksheet.rowCount + 1);
    //         }



    //         //############################### format columns with currency ###############################
    //         for (let col of data.columns) {
    //             if (col.properties?.columnType)
    //                 await this.formatCurrency(worksheet, col.key, currencySymbol, afterDecimal, col.properties.columnType)

    //             col.childs?.forEach(async (subCol) => {
    //                 if (subCol.properties?.columnType)
    //                     await this.formatCurrency(worksheet, col.key + '-' + subCol.key, currencySymbol, afterDecimal, subCol.properties?.columnType)

    //             }
    //             )

    //         }



    //         //############################### Sheet format ###############################   
    //         let lastColumnNumber = worksheet.columnCount + 1
    //         //companyInfo
    //         let companyRow = worksheet.addRow([])
    //         companyRow.font = { name: 'Calibri', color: { argb: 'C00000' } }
    //         companyRow.alignment = { horizontal: 'left' }
    //         companyRow.getCell(lastColumnNumber - 1).value = companyInfo.name

    //         worksheet.getRows(firstRowOfData - 1, worksheet.rowCount)?.forEach((row) => {

    //             if (row.getCell(1).value) {
    //                 for (let i = 1; i < lastColumnNumber; i++) {
    //                     row.getCell(i).fill = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'DBE5F1' }, fgColor: { argb: 'DBE5F1' } }
    //                 }
    //                 row.getCell(2).value = row.getCell(1).value
    //                 row.getCell(1).value = ""

    //             }

    //         }
    //         )

    //         worksheet.getRows(1, worksheet.rowCount + 2)?.forEach((row) => {
    //             row.getCell(1).fill = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'ffffff' }, fgColor: { argb: 'ffffff' } }
    //             row.getCell(lastColumnNumber).fill = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'ffffff' }, fgColor: { argb: 'ffffff' } }
    //             if (row.number >= (worksheet.rowCount - 2)) {
    //                 for (let i = 1; i < lastColumnNumber; i++) {
    //                     row.getCell(i).fill = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'ffffff' }, fgColor: { argb: 'ffffff' } }
    //                 }

    //             }
    //         }
    //         )


    //         worksheet = await this.autoFitColumnWidth(worksheet)


    //         return workbook.xlsx.writeFile(fileName + '.xlsx').then(buffer => {
    //             fileName;
    //             const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;application/json; charset=utf-8; text/csv';
    //             const fileExtension = '.xlsx'

    //             return {
    //                 fileName: `${fileName}${fileExtension}`,
    //                 type,
    //                 buffer
    //             }
    //         });



    //         // return await workbook.xlsx.writeBuffer().then(buffer=>{
    //         //     const blob = new Blob([buffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    //         //     fileName;
    //         //     const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;  charset=utf-8; application/json; ';
    //         //     const fileExtension = '.xlsx'

    //         //     return{
    //         //         fileName : `${fileName}${fileExtension}`,
    //         //         type, 
    //         //         buffer
    //         //     }
    //         // }
    //         // )



    //     } catch (error: any) {
    //         console.log(error)
    //         throw new Error(error);
    //     }
    // }

    public static async exportGroupedDynamicToExcel(
        data: ReportData,
        company: Company
    ) {
        try {
            const workbook = new Excel.Workbook();
            let worksheet = workbook.addWorksheet('Sheet1');

            const fileName = data.fileName ?? `${company.id}-Report`;

            // ===============================
            // Company Info
            // ===============================
            const companyInfo = (await CompanyRepo.getCompanyById(company.id)).data;
            const afterDecimal = companyInfo.settings.afterDecimal ?? 3;
            const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD";

            worksheet.addRow([]);

            // ===============================
            // HEADER (Same As Old Function)
            // ===============================
            let titleRow = this.pageHeader(worksheet, data.filter);

            if (data.showFilter && data.filter) {
                await this.appliedFilter(worksheet, data.filter);
            }

            worksheet.addRow([]);

            const headerRowCount = worksheet.rowCount;

            // ===============================
            // Detect Group Column
            // ===============================
            const groupColumnIndex = data.columns.findIndex(
                col => col.properties?.groupBy
            );

            if (groupColumnIndex === -1) {
                throw new Error("No groupBy column defined.");
            }

            // ===============================
            // TABLE OFFSET (shift right)
            // ===============================
            const tableOffset = 2; // number of empty columns to insert at start
            const groupColumnLetter = worksheet.getColumn(groupColumnIndex + tableOffset + 1).letter;

            // ===============================
            // TABLE HEADERS
            // ===============================
            const headers = data.columns.map(col => col.header ?? col.key);
            const headerRow = worksheet.addRow([
                ...new Array(tableOffset).fill(''), // prepend empty cells
                ...headers
            ]);
            headerRow.font = { bold: true };

            // Adjust title merge if needed
            worksheet.mergeCells(
                `B${titleRow.number}:${worksheet.lastColumn?.letter}${titleRow.number}`
            );

            const firstRowOfData = worksheet.rowCount + 1;

            // ===============================
            // TOTALS INITIALIZATION
            // ===============================
            const totals: Record<string, number> = {};
            data.columns.forEach(col => {
                if (col.properties?.hasTotal) {
                    totals[col.key] = 0;
                }
            });

            // ===============================
            // DATA RENDERING
            // ===============================
            for (const group of data.records) {
                const groupStartRow = worksheet.rowCount + 1;

                // Group label row
                const rowTemplate = new Array(data.columns.length + tableOffset).fill('');
                rowTemplate[groupColumnIndex + tableOffset] = group.label;
                const groupRow = worksheet.addRow(rowTemplate);
                groupRow.font = { bold: true };

                // Child rows
                for (const record of group.agingGroups) {
                    const rowData: any[] = [];

                    data.columns.forEach(col => {
                        if (col.properties?.groupBy) {
                            rowData.push('');
                            return;
                        }

                        let value = record[col.key];

                        if (col.properties?.columnType === 'currency') {
                            value = Number(value ?? 0);
                            if (col.properties?.hasTotal) {
                                totals[col.key] += value;
                            }
                        }

                        if (col.properties?.columnType === 'date' && value) {
                            value = new Date(value);
                        }

                        rowData.push(value ?? '');
                    });

                    // prepend empty cells for offset
                    const finalRowData = [...new Array(tableOffset).fill(''), ...rowData];
                    worksheet.addRow(finalRowData);
                }

                const groupEndRow = worksheet.rowCount;

                // Merge group label if more than one child
                if (group.agingGroups?.length > 1) {
                    worksheet.mergeCells(
                        `${groupColumnLetter}${groupStartRow}:${groupColumnLetter}${groupEndRow}`
                    );
                }

                worksheet.addRow([]);
            }

            // ===============================
            // GRAND TOTAL
            // ===============================
            if (Object.keys(totals).length > 0) {
                const totalRowData = new Array(data.columns.length + tableOffset).fill('');
                totalRowData[tableOffset] = 'Grand Total';

                data.columns.forEach((col, index) => {
                    if (col.properties?.hasTotal) {
                        totalRowData[index + tableOffset] = totals[col.key];
                    }
                });

                const totalRow = worksheet.addRow(totalRowData);
                totalRow.font = { bold: true };
            }

            // ===============================
            // COLUMN FORMATTING
            // ===============================
            const currencyFormat =
                `"${currencySymbol}" #,##0.${'0'.repeat(afterDecimal)};` +
                `("${currencySymbol}" #,##0.${'0'.repeat(afterDecimal)})`;

            data.columns.forEach((col, index) => {
                const colIndexWithOffset = index + tableOffset + 1;

                if (col.properties?.columnType === 'currency') {
                    worksheet.getColumn(colIndexWithOffset).numFmt = currencyFormat;
                }

                if (col.properties?.columnType === 'date') {
                    worksheet.getColumn(colIndexWithOffset).numFmt = 'yyyy-mm-dd';
                }
            });

            // ===============================
            // SHEET FORMAT (Company Name etc)
            // ===============================
            if (!data.filter?.skipCompanyInfo) {
                this.sheetFormat(worksheet, companyInfo.name);
            }

            worksheet = await this.autoFitColumnWidth(worksheet);

            // ===============================
            // RESPONSE
            // ===============================
            return workbook.xlsx.writeFile(fileName + '.xlsx').then(buffer => {
                return {
                    fileName: `${fileName}.xlsx`,
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    buffer
                };
            });

        } catch (error: any) {
            console.log(error);
            throw new Error(error);
        }
    }


    public static async exportDynamicAgingSummaryReport<T extends Record<string, any>>(
        records: Array<T & {
            agingGroups: Array<{ label: string; total: number }>;
        }>,
        ranges: string[],
        filter: any,
        showFilter: boolean,
        company: Company,
        options: {
            idKey: keyof T;      // 'supplierId' | 'customerId'
            nameKey: keyof T;    // 'supplierName' | 'customerName'
            headerLabel: string; // 'Supplier' | 'Customer'
            fileName?: string;
        }
   ) {
    try {

        const workbook = new Excel.Workbook();
        let worksheet = workbook.addWorksheet('Sheet1');

        const fileName = options.fileName ?? `${company.id}-AgingSummary`;

        // ===============================
        // Company Info
        // ===============================
        const companyInfo = (await CompanyRepo.getCompanyById(company.id)).data;
        const afterDecimal = companyInfo.settings.afterDecimal ?? 3;
        const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD";

        worksheet.addRow([]);

        // ===============================
        // PAGE HEADER (like other reports)
        // ===============================
        let titleRow = this.pageHeader(worksheet, filter);

        if (showFilter && filter) {
            await this.appliedFilter(worksheet, filter);
        }

        worksheet.addRow([]);

        // ===============================
        // TABLE OFFSET (shift right 1 column)
        // ===============================
        const tableOffset = 1;

        // ===============================
        // TABLE HEADER
        // ===============================
        const headers = [
            ...new Array(tableOffset).fill(''),
            options.headerLabel,
            ...ranges,
            'Total'
        ];

        const headerRow = worksheet.addRow(headers);
        headerRow.font = { bold: true };

        worksheet.mergeCells(
            `B${titleRow.number}:${worksheet.lastColumn?.letter}${titleRow.number}`
        );

        // ===============================
        // TOTALS INIT
        // ===============================
        const totalsPerRange: Record<string, number> = {};
        ranges.forEach(r => totalsPerRange[r] = 0);
        let grandTotal = 0;

        // ===============================
        // DATA ROWS
        // ===============================
        for (const record of records) {

            const rowData: any[] = new Array(tableOffset).fill('');

            // Supplier / Customer Name
            rowData.push(record[options.nameKey]);

            let rowTotal = 0;

            for (const range of ranges) {
                const aging = record.agingGroups.find(g => g.label === range);
                const value = Number(aging?.total ?? 0);

                rowData.push(value);

                totalsPerRange[range] += value;
                rowTotal += value;
            }

            rowData.push(rowTotal);
            grandTotal += rowTotal;

            worksheet.addRow(rowData);
        }

        // ===============================
        // GRAND TOTAL ROW
        // ===============================
        const totalRowData: any[] = new Array(tableOffset).fill('');
        totalRowData.push('Grand Total');

        for (const range of ranges) {
            totalRowData.push(totalsPerRange[range]);
        }

        totalRowData.push(grandTotal);

        const totalRow = worksheet.addRow(totalRowData);
        totalRow.font = { bold: true };

        // ===============================
        // NUMBER FORMATTING (currency)
        // ===============================
        const currencyFormat =
            `"${currencySymbol}" #,##0.${'0'.repeat(afterDecimal)};` +
            `("${currencySymbol}" #,##0.${'0'.repeat(afterDecimal)})`;

        // Apply to numeric columns (after name column)
        for (let i = tableOffset + 2; i <=ranges.length + tableOffset + 2; i++) {
            worksheet.getColumn(i).numFmt = currencyFormat;
        }

        // ===============================
        // SHEET FORMAT (company name etc)
        // ===============================
        if (!filter?.skipCompanyInfo) {
            this.sheetFormat(worksheet, companyInfo.name);
        }

        worksheet = await this.autoFitColumnWidth(worksheet);

        // ===============================
        // RESPONSE
        // ===============================
        return workbook.xlsx.writeFile(fileName + '.xlsx').then(buffer => ({
            fileName: `${fileName}.xlsx`,
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            buffer
        }));

    } catch (error: any) {
        console.error(error);
        throw new Error(error);
    }
}
}










