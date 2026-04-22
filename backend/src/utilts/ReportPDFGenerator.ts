import fs from 'fs';

import path from "path";
import { Company } from '@src/models/admin/company';

import { Helper } from './helper';

import autoTable, { CellDef, CellInput, HAlignType, RowInput } from 'jspdf-autotable';
import moment, { Moment } from 'moment';
import { CompanyRepo } from '@src/repo/admin/company.repo';
import { jsPDF } from 'jspdf';
import { BranchesRepo } from '@src/repo/admin/branches.repo';
import { DataColumn, ReportData } from './xlsxGenerator';
import { S3Storage } from './S3Storage';
import { DB } from '@src/dbconnection/dbconnection';
import _ from 'lodash';






export class ReportsPDFGenerator {

    public static getDataFormat(value: string | Date | Moment | number, type: string, currencySymbol: string | null, afterDecimal: number) {
        try {

            let format = ''
            let v
            switch (type) {
                case 'qty':
                    v = Number(value)
                    format = `${v ?? 0}`
                    break;
                case 'currency':
                    v = Number(value).toFixed(afterDecimal)
                    format = `${currencySymbol} ${v} `
                    break;
                case 'percentage':
                    v = Helper.roundNum(Number(value), afterDecimal)
                    format = `${v}%`
                    break;
                case 'date':
                    format = value ? moment(value).format('yyyy/MM/DD') : ''
                    break;
                case 'date_day':
                    format = value ? moment(value).format('dddd yyyy/MM/DD') : ''
                    break;
                case 'date_time':
                    format = value ? moment(value).format(`yyyy/MM/DD hh:mm`) : ''
                    break;
                case 'timeInMinutes':
                    let timeInSec = Number.isNaN(value) ? 0 : Number(value)

                    let min = String(Math.floor(timeInSec / 60))
                    let sec = String((timeInSec % 60).toFixed(2))

                    format = `${min}m ${sec}s`
                    break;

                default:
                    format = String(value)
                    break;
            }
            return format



        } catch (error: any) {

            throw new Error(error.message)
        }
    }

    // Function to convert TTF file to base64 (used for arabic font)
    private static convertTtfToBase64(filePath: string): string {
        // Read the file as a buffer
        const buffer = fs.readFileSync(filePath);

        // Convert the buffer to a base64 string
        const base64 = buffer.toString('base64');

        return base64;
    }

    private static async setDefualtFontStyle(doc: jsPDF) {
        try {

            let rootDirectory = path.dirname(__dirname)

            const storagePath = process.env.STORAGE_PATH;
            const filePath = path.join(rootDirectory, storagePath + "/fonts/Amiri-Bold.ttf");
            const amiriBoldBase64 = this.convertTtfToBase64(filePath);
            const filePath2 = path.join(rootDirectory, storagePath + '/fonts/Amiri-Regular.ttf');
            const amiriRegularBase64 = this.convertTtfToBase64(filePath2);



            const fontName = 'Amiri';


            doc.addFileToVFS('Amiri-Regular.ttf', amiriRegularBase64);
            doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');

            // Add bold font to jsPDF's Virtual File System (VFS)
            doc.addFileToVFS('Amiri-Bold.ttf', amiriBoldBase64);
            doc.addFont('Amiri-Bold.ttf', 'Amiri', 'bold');

            doc.setFont(fontName)
            doc.setFontSize(11)
            doc.setTextColor(100)
        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    private static calculateSubTotal(data: any[], columns: DataColumn[], currencySymbol: string, afterDecimal: number, color?: string, rowName?: string) {
        try {



            let grandTotal: CellDef[] = [];
            for (const column of columns) {
                if (column.properties?.groupBy === 'horizantal') { continue }

                if (column.childs?.length) {
                    for (const child of column.childs) {
                        if (column?.properties?.hasSubTotal) {
                            const totalData = data?.map((elm) => elm.summary?.find((s: any) => s[column.key])?.[column.key]?.[child.key] ?? 0) ?? []

                            const totalArray = totalData?.map((elm) => (Number.isNaN(elm) ? 0 : Number(elm))) ?? []
                            const total = totalArray.length > 0 ? totalArray?.reduce((acc, curr) => acc + curr) : 0
                            grandTotal.push({ content: this.getDataFormat(total, child.properties?.columnType ?? '', currencySymbol, afterDecimal), styles: { fillColor: color ?? 'CBCBCB' } })
                        }
                        else { grandTotal.push({ content: '', styles: { fillColor: color ?? 'CBCBCB' } }) }
                    }
                } else {
                    if (column?.properties?.hasSubTotal) {



                        const totalData = data?.map((elm) => elm[column.key] ?? elm.summary?.find((s: any) => s[column.key])?.[column.key] ?? 0) ?? []

                        const totalArray = totalData?.map((elm) => (Number.isNaN(elm) ? 0 : Number(elm))) ?? []
                        const total = totalArray.length > 0 ? totalArray?.reduce((acc, curr) => acc + curr) : 0
                        grandTotal.push({ content: this.getDataFormat(total, column.properties?.columnType ?? '', currencySymbol, afterDecimal), styles: { fillColor: color ?? 'CBCBCB' } })
                    }
                    else { grandTotal.push({ content: '', styles: { fillColor: color ?? 'CBCBCB' } }) }

                }
            }

            grandTotal[0] = rowName ? { content: rowName, styles: { fillColor: color ?? 'CBCBCB' } } : { content: 'subTotal' }


            return grandTotal




        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    private static calculateTotal(data: any[], columns: DataColumn[], currencySymbol: string, afterDecimal: number) {
        try {

            let grandTotal: any[] = [];
            for (const column of columns) {
                if (column.properties?.groupBy === 'horizantal') { continue }

                if (column.childs?.length) {
                    for (const child of column.childs) {
                        if (column?.properties?.hasTotal) {
                            const totalData = data.map((elm) => (elm.summary?.find((s: any) => s[column.key])?.[column.key]?.[child.key]) ?? elm[column.key]?.[child.key] ?? 0)
                            const totalArray = totalData.map((elm) => (Number.isNaN(elm) ? 0 : Number(elm)))
                            const total = totalArray.reduce((acc, curr) => acc + curr, 0)
                            grandTotal.push(this.getDataFormat(total, child.properties?.columnType ?? '', currencySymbol, afterDecimal))
                        }
                        else { grandTotal.push('') }
                    }
                } else {
                    if (column?.properties?.hasTotal) {
                        const totalData = data.map((elm) => Number((elm[column.key])) ? Number((elm[column.key])) :
                            (Array.isArray(elm.summary) && elm.summary.length) ?
                                elm.summary.reduce((sum: number, item: any) => {
                                    return sum + (Number(item?.[column.key]) || 0);
                                }, 0) : 0
                        )
                        const totalArray = totalData.map((elm) => (Number.isNaN(elm) ? 0 : Number(elm)))
                        const total = totalArray.reduce((acc, curr) => acc + curr, 0)
                        grandTotal.push(this.getDataFormat(total, column.properties?.columnType ?? '', currencySymbol, afterDecimal))
                    }
                    else { grandTotal.push('') }

                }
            }

            grandTotal[0] = { content: 'Total' }
            if (grandTotal[grandTotal.length - 1]) {

                grandTotal[grandTotal.length - 1] = { content: grandTotal[grandTotal.length - 1], styles: { halign: 'right' } }
            }


            return grandTotal




        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    private static calculateTotalForTaxReport(sectionKey: string, data: any[], columns: DataColumn[], currencySymbol: string, afterDecimal: number) {
        try {

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

            let grandTotal: any[] = [];
            for (const column of columns) {
                if (column.properties?.groupBy === 'horizantal') { continue }

                if (column.childs?.length) {
                    for (const child of column.childs) {
                        if (column?.properties?.hasTotal) {
                            const totalData = data.map((elm) => (elm.summary?.find((s: any) => s[column.key])?.[column.key]?.[child.key]) ?? 0)
                            const totalArray = totalData.map((elm) => (Number.isNaN(elm) ? 0 : Number(elm)))
                            const total = totalArray.reduce((acc, curr) => acc + curr)
                            grandTotal.push(this.getDataFormat(total, child.properties?.columnType ?? '', currencySymbol, afterDecimal))
                        }
                        else { grandTotal.push('') }
                    }
                } else {
                    if (column?.properties?.hasTotal) {
                        const totalData = data.map((elm) => Number((elm[column.key])) ?? 0)
                        const totalArray = totalData.map((elm) => (Number.isNaN(elm) ? 0 : Number(elm)))
                        const total = totalArray.reduce((acc, curr) => acc + curr)
                        grandTotal.push(this.getDataFormat(total, column.properties?.columnType ?? '', currencySymbol, afterDecimal))
                    }
                    else {
                        if (column.key == '#') { grandTotal.push(grandTotalboxNum) }
                        else if (column.key == 'Description') { grandTotal.push(grandTotalDescription) }
                        else { grandTotal.push('') }
                    }

                }
            }

            if (grandTotal[grandTotal.length - 1]) {

                grandTotal[grandTotal.length - 1] = { content: grandTotal[grandTotal.length - 1], styles: { halign: 'right' } }
            }


            return grandTotal




        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    private static pageHeader(doc: jsPDF, companyInfo: Company, filter: any, pagewidth: number) {
        try {
            //if filter.showCompanyInfo is false , then do not show company info and make title left aligned
            if (filter.skipCompanyInfo != null && filter.skipCompanyInfo === true) {
                let title = filter.title ?? 'Report';
                doc.setFontSize(16)
                doc.setTextColor('C00000')
                doc.text(title.toUpperCase(), 14, 22, { align: "left" })
                var y = (doc as any).lastAutoTable.finalY || 22

                //print interval
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
                doc.setFontSize(10)
                doc.setTextColor('000000')
                y = y + 5
                doc.text(dateText, 14, y, { align: "left" })
                return y
            }

            //1. company name
            let companyName = companyInfo.name;
            doc.setFontSize(16)
            doc.text(companyName, 14, 22, { align: "left" })
            var y = (doc as any).lastAutoTable.finalY || 22

            //2. report title + interval
            let title = filter.title ?? 'Report';
            let dateText = ""

            if (filter.fromDate == null && filter.toDate) {

                dateText = ' As of ' + " " + moment(new Date(filter.toDate)).format("YYYY-MM-DD");

            }
            else if (filter.fromDate && filter.toDate) {

                dateText = "From: " + moment(new Date(filter.fromDate)).format("YYYY-MM-DD") + '  ' +
                    "To: " + moment(new Date(filter.toDate)).format("YYYY-MM-DD")

            }
            else if (filter.date) {
                dateText = ' Date:' + "    " + moment(new Date(filter.date)).format("YYYY-MM-DD");

            }



            doc.setFontSize(16)
            doc.setTextColor('C00000')
            doc.text(title.toUpperCase(), pagewidth - 14, 22, { align: "right" })
            var y = (doc as any).lastAutoTable.finalY || 22

            doc.setFontSize(10)
            doc.setTextColor('000000')
            y = y + 5
            doc.text(dateText, pagewidth - 14, y, { align: "right" })

            //3. break line
            doc.setDrawColor('000000')
            y = y + 4
            doc.line(14, y, pagewidth - 14, y)
            y = y + 8


            return y

        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    private static pageFooter(doc: jsPDF, timeOffset: string) {
        try {
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setFontSize(10);

                doc.setPage(i);
                var pageSize = doc.internal.pageSize;
                var pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
                var pagewidth = pageSize.width ? pageSize.width : pageSize.getWidth();
                const footerY = pageHeight - 8; // Position of the footer
                doc.text(`${moment.utc().utcOffset(+timeOffset).format('YYYY-MM-DD HH:mm:ss')}`, 14, footerY, { align: 'left' });
                doc.text('Page ' + String(i) + ' of ' + String(pageCount), pagewidth - 14, footerY, { align: 'right' }); //data.settings.margin.left if you want it on the left
            }

        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    private static async appliedFilter(doc: jsPDF, y: number, filter: any) {
        try {
            await this.setDefualtFontStyle(doc)
            doc.setFont('Amiri', 'bold')
            doc.setFontSize(12)
            doc.text('Applied Filter: ', 14, y)
            let filterwidth = doc.getTextWidth('Applied Filter: ') + 14
            y = y + 2
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


            y = y + 4

            filterRows.forEach(e => {
                let filterType = e[0] + ': '
                let filter = e[1]
                doc.setFont('Amiri', 'bold')
                doc.text(filterType, 14, y)
                let filterwidth = doc.getTextWidth(filterType)
                doc.setFont('Amiri', 'normal')
                doc.text(filter, 14 + filterwidth, y)
                y = y + 5
            }
            )
            y = y + 2
            return y

        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    private static getTableHeaders_SubHeaders(columns: DataColumn[]) {
        try {

            let headers: CellInput[] = [];
            let subheaders: CellInput[] = [];
            let hasSubHeader: boolean = columns.findIndex(col => col.childs?.length) > -1

            for (let index = 0; index < columns.length; index++) {
                const element = columns[index];
                if (element.properties?.groupBy === 'horizantal') { continue }

                element.childs?.forEach((subCol: any, indx: number) => {
                    let _halign: HAlignType | undefined;
                    if (element.childs?.length != undefined && indx == element.childs?.length - 1 && index == columns.length - 1) {
                        _halign = "right";
                    }
                    subheaders.push({ colSpan: 1, styles: { halign: _halign }, content: subCol.header ?? _.startCase(subCol.key) })
                })

                if (element.childs && element.childs.length > 0) {
                    headers.push({ colSpan: element.childs.length ?? 1, content: element.header ?? _.startCase(element.key), styles: { halign: 'center' } })
                }
                else {
                    let _halign: HAlignType | undefined;
                    if (index == columns.length - 1) {
                        _halign = "right";
                    }
                    headers.push({ colSpan: 1, rowSpan: hasSubHeader ? 2 : 0, styles: { halign: _halign }, content: element.header ?? _.startCase(element.key) });

                }

            }

            return [headers, subheaders]

        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    private static getTableData(records: any, columns: DataColumn[], currencySymbol: string, afterDecimal: number) {
        try {
            let rows: any[] = [];
            for (const record of records) {
                const row = []
                for (const column of columns) {

                    if (column.properties?.groupBy === 'horizantal') { continue }


                    if (column.childs?.length) {
                        for (const child of column.childs) {
                            const childData = record.summary?.find((s: any) => s[column.key])
                            const value = childData?.[column.key]?.[child.key] ?? record[column.key]?.[child.key] ?? '';

                            row.push(this.getDataFormat(value, child.properties?.columnType ?? '', currencySymbol, afterDecimal))
                        }
                    } else {
                        let p;

                        if (record[column.key]) { p = record[column.key] }
                        else if (record.summary?.find((s: any) => s[column.key])?.[column.key]) { p = record.summary.find((s: any) => s[column.key])?.[column.key] }
                        else (p = '')

                        if (column.key == 'productName') { p = record['barcode'] ? p + `\n[${record['barcode']}]` : p }
                        if ((_.intersection(['Sales Items', 'Returns Items', 'Total Items', 'Total Order', 'Guests'], row)).length > 0) {
                            row.push(this.getDataFormat(p, '', currencySymbol, afterDecimal))
                        } else (
                            row.push(this.getDataFormat(p, column.properties?.columnType ?? '', currencySymbol, afterDecimal))
                        )

                    }
                }

                rows.push(row)
            }


            return rows

        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    private static getColumnsWidth(rows: any[], maxColumnWidth: number, pagewidth: number) {
        try {

            const averageWidths = rows.reduce((acc, row) => {
                row.forEach((cell: any, index: number) => {
                    const cellWidth = cell ? cell.toLocaleString().length : 0;

                    acc[index] = acc[index] || { totalWidth: 0, count: 0 };
                    acc[index].totalWidth += cellWidth;
                    acc[index].count += 1;
                });
                return acc;
            }, []);

            // 
            const maxWidths = averageWidths.map(({ totalWidth, count }: any) => {
                var averageWidth = totalWidth / count;
                if (averageWidth > maxColumnWidth) { averageWidth = maxColumnWidth }
                else if (averageWidth < 8) { averageWidth = 8 }
                return averageWidth

            });

            let sum = maxWidths.reduce((a: number, b: number) => a + b, 0)

            const columnsWidth = maxWidths.reduce((acc: { cellWidth: number; halign?: HAlignType }[], num: number, index: number) => {

                acc[index] = { cellWidth: num / sum * (pagewidth - 28) };

                if (index == maxWidths.length - 1) { acc[index] = { cellWidth: num / sum * (pagewidth - 28), halign: 'right' } }

                return acc;
            }, {});

            return columnsWidth

        } catch (error: any) {
            throw new Error(error.message)
        }
    }


    public static async exportPdf(data: ReportData, company: Company, options?: { orientation: string | null; }) {
        try {

            //get companyInfo
            let companyInfo = (await CompanyRepo.getCompanyById(company.id)).data
            const afterDecimal = companyInfo.settings.afterDecimal ?? 3
            const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD"


            let companyImage = await this.getCompanyImage(companyInfo.mediaId, company.id) ?? null

            const doc = new jsPDF({ orientation: options && options.orientation == 'landscape' ? 'l' : 'p' })

            var pageSize = doc.internal.pageSize;
            const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
            const pagewidth = pageSize.width ? pageSize.width : pageSize.getWidth();
            let fileName = data.fileName ? data.fileName : company.id + 'Report'

            //######################################   set default font style  ######################################
            await this.setDefualtFontStyle(doc);

            //###################################### Report Header ###################################### 
            let y = this.pageHeader(doc, companyInfo, data.filter, pagewidth) ?? 22

            //###################################### Applied Filter ###################################### 
            if (data.showFilter) {
                y = await this.appliedFilter(doc, y ?? 22, data.filter) ?? 22
            }
            //###################################### remove barcode ###################################### 
            if (data.columns.findIndex(a => a.key == 'barcode') > -1) {
                data.columns.splice(data.columns.findIndex(a => a.key == 'barcode'), 1)
            }

            //###################################### Table Headers  ######################################   
            let headers: CellInput[] = [];
            let subheaders: CellInput[] = [];
            let columns = data.columns

            let h = this.getTableHeaders_SubHeaders(columns)
            headers = h[0] ?? []
            subheaders = h[1] ?? []


            //######################################      Data      ######################################
            let rows: any[] = [];
            rows = this.getTableData(data.records, columns, currencySymbol, afterDecimal)

            //######################################  Column Widths ###################################### 
            // Table column counts
            let numberOfColumns: any = headers.reduce((acc, elem: any) => { return acc + ((elem?.colSpan ?? 0 as number)) }, 0)
            let maxColumnWidth = (pagewidth - 14) / numberOfColumns

            // get columns width 
            const columnsWidth = this.getColumnsWidth(rows, maxColumnWidth, pagewidth)


            //######################################  grand Total  ######################################

            let grandTotal: any[] = [];
            const reportHasTotal = data.columns.findIndex(col => col.properties?.hasTotal)

            if (reportHasTotal > -1) {
                grandTotal = this.calculateTotal(data.records, data.columns, currencySymbol, afterDecimal)
            }

            //######################################    groupBy   ######################################
            const reportHasGroupBy = data.columns.findIndex(col => col.properties?.groupBy)
            const reportHasSubTotal = data.columns.findIndex(col => col.properties?.hasSubTotal)

            if (reportHasSubTotal > -1 || reportHasGroupBy > -1) {
                data.columns[0].properties = data.columns[0].properties || { 'groupBy': true }
                let groubIdx = 0

                for (let totalCol of data.columns) {

                    if (totalCol.key && totalCol.properties?.groupBy) {
                        const column = totalCol.key
                        let index = 0 + groubIdx
                        groubIdx++

                        let sliceData = _.groupBy(data.records, column)

                        Object.keys(sliceData).forEach((k: string) => {


                            const r = sliceData[k]
                            let i = index
                            index += r.length

                            if (totalCol.properties?.groupBy == 'horizantal') {
                                rows.splice((index - r.length), 0, [{ content: k, styles: { fillColor: 'E0E0E0', fontStyle: 'bold' }, colSpan: (headers.length + (headers.length - subheaders.length)), }])
                                index++
                            }

                            if (reportHasSubTotal > -1) {
                                let rr = this.calculateSubTotal(r, data.columns, currencySymbol, afterDecimal)
                                rr[0] = { content: k + ' Total', styles: { fillColor: 'CBCBCB', fontStyle: 'bold' } }
                                rows.splice(index, 0, rr)

                                index++
                            }



                            //rows[i][0]  = {content:rows[i][0] , rowSpan: r.length}

                        })



                    }
                }

            }


            //###################################### create Table ###################################### 
            autoTable(doc, {
                // theme: 'grid',
                startY: y + 2,

                head: subheaders.length > 0 ? [headers, subheaders] : [headers],
                body: rows,
                foot: grandTotal.length > 0 ? [grandTotal] : undefined,
                tableWidth: 'auto',


                headStyles: { fillColor: 'E0E0E0', textColor: 'black', valign: 'middle', halign: 'left' },
                footStyles: { fillColor: 'E0E0E0', textColor: 'black' },
                bodyStyles: { fillColor: 'ffffff', font: 'Amiri' },
                columnStyles: columnsWidth,



            })

            //##############################  Page Footer (page Number)  ############################### 
            this.pageFooter(doc, company.timeOffset)

            //######################################   Response   ######################################
            const pdfBuffer = doc.output('arraybuffer');
            const buffer = Buffer.from(pdfBuffer).toString('base64')
            const type = 'application/pdf';
            const fileExtension = '.pdf'
            doc.save(`${fileName}${fileExtension}`,)
            return {
                fileName: `${fileName}${fileExtension}`,
                type,
                buffer
            }



        } catch (error: any) {
            console.log(error)
            throw new Error(error);
        }
    }

    // for multiTables
    public static async exportPdf2(data: any, company: Company, options?: { orientation?: string | null; vatReport?: boolean | null; }) {
        try {



            //get companyInfo
            let companyInfo = (await CompanyRepo.getCompanyById(company.id)).data
            const afterDecimal = companyInfo.settings.afterDecimal ?? 3
            const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD"


            let companyImage = await this.getCompanyImage(companyInfo.mediaId, company.id) ?? null

            const doc = new jsPDF({ orientation: options && options.orientation == 'landscape' ? 'l' : 'p' })

            var pageSize = doc.internal.pageSize;
            const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
            const pagewidth = pageSize.width ? pageSize.width : pageSize.getWidth();
            let fileName = data.fileName ? data.fileName : company.id + 'Report'



            //###################################### Report Header ###################################### 
            let y = this.pageHeader(doc, companyInfo, data.filter, pagewidth) ?? 22

            //###################################### Applied Filter ###################################### 
            y = await this.appliedFilter(doc, y ?? 22, data.filter) ?? 22

            const dataRecords: any = data.records



            Object.keys(dataRecords).forEach(sectionKey => {
                //autoTable(doc, { startY: y + 4, theme: 'plain', body: [[sectionKey]] });


                if (sectionKey.trim()) {
                    autoTable(doc, { startY: y + 2, theme: 'plain', body: [[{ content: sectionKey, styles: { fontSize: 12, } }]] });
                }
                const sectionData = dataRecords[sectionKey];

                const columns: any[] = Object.entries(sectionData.columns).map(([key, properties]) => ({
                    key,
                    properties
                }));

                const records = sectionData.records


                //###################################### remove barcode ###################################### 
                if (columns.findIndex(a => a.key == 'barcode') > -1) {
                    columns.splice(columns.findIndex(a => a.key == 'barcode'), 1)
                }


                //######################################  Table Headers  ######################################   
                let headers: CellInput[] = [];
                let subheaders: CellInput[] = [];
                let hasSubHeader: boolean = columns.findIndex(col => col.childs?.length) > -1

                let h = this.getTableHeaders_SubHeaders(columns)
                headers = h[0] ?? []
                subheaders = h[1] ?? []

                //######################################       Data      ######################################

                let rows: any[] = [];

                rows = this.getTableData(records, columns, currencySymbol, afterDecimal)


                //######################################   column widths   ######################################
                // Table column counts
                let numberOfColumns: any = headers.reduce((acc, elem: any) => { return acc + ((elem?.colSpan ?? 0 as number)) }, 0)
                let maxColumnWidth = (pagewidth - 14) / numberOfColumns

                const columnsWidth = this.getColumnsWidth(rows, maxColumnWidth, pagewidth)

                //######################################   grand Total   ######################################

                let grandTotal: any[] = [];
                const reportHasTotal = columns.findIndex(col => col.properties?.hasTotal)

                if (reportHasTotal > -1) {
                    if (options && options.vatReport && options.vatReport == true) {
                        grandTotal = this.calculateTotalForTaxReport(sectionKey, records, columns, currencySymbol, afterDecimal)

                    } else {
                        grandTotal = this.calculateTotal(records, columns, currencySymbol, afterDecimal)
                    }

                }

                //######################################       Add Table     ######################################
                autoTable(doc, {
                    // theme: 'grid',
                    startY: (doc as any).lastAutoTable.finalY ?? y + 5,


                    head: subheaders.length > 0 ? [headers, subheaders] : (!Object.keys(sectionData?.records[0] || {}).includes('key')) ? [headers] : undefined,
                    body: rows,
                    foot: grandTotal.length > 0 ? [grandTotal] : undefined,
                    tableWidth: 'auto',


                    headStyles: { fillColor: 'E0E0E0', textColor: 'black', valign: 'middle', halign: 'left' },
                    footStyles: { fillColor: 'E0E0E0', textColor: 'black' },
                    bodyStyles: { fillColor: 'ffffff' },
                    columnStyles: columnsWidth,



                })

                y = (doc as any).lastAutoTable.finalY + 2

            })



            this.pageFooter(doc, company.timeOffset)

            const pdfBuffer = doc.output('arraybuffer');
            const buffer = Buffer.from(pdfBuffer).toString('base64')
            const type = 'application/pdf';
            const fileExtension = '.pdf'
            doc.save(`${fileName}${fileExtension}`,)
            return {
                fileName: `${fileName}${fileExtension}`,
                type,
                buffer
            }



        } catch (error: any) {
            console.log(error)
            throw new Error(error);
        }
    }

    public static async exportBalanceSheetPdf(data: ReportData, company: Company, options?: { orientation: string | null; }) {
        try {

            // var doc:any = new jsPDF()
            //get companyInfo
            let companyInfo = (await CompanyRepo.getCompanyById(company.id)).data
            const afterDecimal = companyInfo.settings.afterDecimal ?? 3
            const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD"


            let companyImage = await this.getCompanyImage(companyInfo.mediaId, company.id) ?? null

            const doc = new jsPDF({ orientation: options && options.orientation == 'landscape' ? 'l' : 'p' })

            var pageSize = doc.internal.pageSize;
            const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
            const pagewidth = pageSize.width ? pageSize.width : pageSize.getWidth();
            let fileName = data.fileName ? data.fileName : company.id + 'Report'

            //###################################### Report Header ###################################### 
            let y = this.pageHeader(doc, companyInfo, data.filter, pagewidth) ?? 22

            //###################################### Applied Filter ###################################### 
            y = await this.appliedFilter(doc, y ?? 22, data.filter) ?? 22

            await this.setDefualtFontStyle(doc);

            //###################################### Table Headers  ######################################   

            let headers: CellInput[] = [];
            let subheaders: CellInput[] = [];
            let columns = data.columns

            let h = this.getTableHeaders_SubHeaders(columns)
            headers = h[0] ?? []
            subheaders = h[1] ?? []



            //######################################         Data        ######################################

            let rows: any[] = [];
            let tt = 'Assets'
            // rows.push([tt])
            let count = 0
            let assetsTotalRow

            for (const record of data.records) {
                const row = []
                for (const column of data.columns) {

                    if (column.properties?.groupBy === 'horizantal') { continue }


                    if (column.childs?.length) {
                        for (const child of column.childs) {
                            const childData = record.summary?.find((s: any) => s[column.key])
                            const value = childData?.[column.key]?.[child.key] ?? '';

                            row.push(this.getDataFormat(value, child.properties?.columnType ?? '', currencySymbol, afterDecimal))
                        }
                    } else {
                        let p;

                        if (record[column.key]) { p = record[column.key] }
                        else if (record.summary?.find((s: any) => s[column.key])?.[column.key]) { p = record.summary.find((s: any) => s[column.key])?.[column.key] }
                        else (p = '')

                        if (column.key == 'productName') { p = record['barcode'] ? p + `\n[${record['barcode']}]` : p }
                        if (column.key == 'account' && record.parentId != record.accountId) { p = '    ' + p }
                        row.push(this.getDataFormat(p, column.properties?.columnType ?? '', currencySymbol, afterDecimal))
                    }
                }
                count++

                rows.push(row)
            }



            //######################################  Column Widths   ###################################### 
            // Table column counts
            let numberOfColumns: any = headers.reduce((acc, elem: any) => { return acc + ((elem?.colSpan ?? 0 as number)) }, 0)
            let maxColumnWidth = (pagewidth - 14) / numberOfColumns

            // get columns width 
            const columnsWidth = this.getColumnsWidth(rows, maxColumnWidth, pagewidth)

            //######################################   groupBy  ######################################
            const reportHasGroupBy = data.columns.findIndex(col => col.properties?.groupBy)
            const reportHasSubTotal = data.columns.findIndex(col => col.properties?.hasSubTotal)


            if (reportHasSubTotal > -1 || reportHasGroupBy > -1) {
                data.columns[0].properties = data.columns[0].properties || { 'groupBy': true }
                let groubIdx = 0

                let a = _.groupBy(data.records, 'grandType')
                let index = 0
                Object.keys(a).forEach((key, i) => {
                    let aa = a[key]
                    rows.splice(index, 0, [{ content: key, styles: { fontStyle: 'bold' }, colSpan: (headers.length + (headers.length - subheaders.length)), }])
                    index++
                    const grandStartRow = index;


                    let b = _.groupBy(aa, 'parentType')
                    Object.keys(b).forEach((key2, j) => {
                        let bb = b[key2]
                        // add parent type header
                        rows.splice(index, 0, [{ content: key2, styles: { fontStyle: 'bold', fillColor: 'C8C8C8' }, colSpan: (headers.length + (headers.length - subheaders.length)), }])
                        index++
                        const parentStartRow = index;


                        let c = _.groupBy(bb, 'type')
                        Object.keys(c).forEach((key3) => {
                            let cc = c[key3]
                            // add  type header
                            if (key2 == 'Current Assets') {
                                rows.splice(index, 0, [{ content: key3, styles: { fillColor: 'C0C0C0' }, colSpan: (headers.length + (headers.length - subheaders.length)), }])
                                index++

                                // add  type subTotal
                                let rr = this.calculateSubTotal(cc, data.columns, currencySymbol, afterDecimal)
                                index += cc.length
                                rr.forEach(s => s.styles = { fontStyle: 'bold' })
                                rr[0] = { content: key3 + ' Total', styles: { fontStyle: 'bold' } }
                                rows.splice(index, 0, rr)
                                index++
                            } else {
                                index += cc.length
                            }


                        })



                        // add parent type subTotal
                        let rr = this.calculateSubTotal(bb, data.columns, currencySymbol, afterDecimal)
                        rr.forEach(c => c.styles = { fontStyle: 'bold' })
                        rr[0] = { content: key2 + ' Total', styles: { fontStyle: 'bold' } }
                        rows.splice(index, 0, rr)
                        index++


                    })

                    // add grand type subTotal
                    let rr = this.calculateSubTotal(aa, data.columns, currencySymbol, afterDecimal)
                    rr.forEach(c => c.styles = { fontStyle: 'bold' })
                    rr[0] = { content: key + ' Total', styles: { fontStyle: 'bold' } }
                    rows.splice(index, 0, rr)
                    index++





                }
                )


            }

            //######################################    create Table    ###################################### 
            autoTable(doc, {
                theme: 'plain',
                startY: y + 2,

                head: subheaders.length > 0 ? [headers, subheaders] : [headers],
                body: rows,

                tableWidth: 'auto',


                headStyles: { fillColor: 'E0E0E0', textColor: 'black', valign: 'middle', halign: 'left' },
                bodyStyles: { fillColor: 'ffffff' },
                columnStyles: columnsWidth,



            })

            //##################################  Page Footer (page Number)  ################################## 
            this.pageFooter(doc, company.timeOffset)

            //#######################################      Response     #######################################
            const pdfBuffer = doc.output('arraybuffer');
            const buffer = Buffer.from(pdfBuffer).toString('base64')
            const type = 'application/pdf';
            const fileExtension = '.pdf'
            doc.save(`${fileName}${fileExtension}`,)
            return {
                fileName: `${fileName}${fileExtension}`,
                type,
                buffer
            }




        } catch (error: any) {
            console.log(error)
            throw new Error(error);
        }
    }

    public static async exportProfitAndLoss(data: ReportData, company: Company, options?: { orientation: string | null; }) {
        try {

            //get companyInfo
            let companyInfo = (await CompanyRepo.getCompanyById(company.id)).data
            const afterDecimal = companyInfo.settings.afterDecimal ?? 3
            const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD"

            const doc = new jsPDF({ orientation: options && options.orientation == 'landscape' ? 'l' : 'p' })

            var pageSize = doc.internal.pageSize;
            const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
            const pagewidth = pageSize.width ? pageSize.width : pageSize.getWidth();
            let fileName = data.fileName ? data.fileName : company.id + 'Report'



            //###################################### Report Header ###################################### 
            let y = this.pageHeader(doc, companyInfo, data.filter, pagewidth) ?? 22

            //###################################### Applied Filter ###################################### 
            y = await this.appliedFilter(doc, y ?? 22, data.filter) ?? 22

            await this.setDefualtFontStyle(doc);

            //###################################### Table Headers  ######################################   

            let headers: CellInput[] = [];
            let subheaders: CellInput[] = [];
            let columns = data.columns

            let h = this.getTableHeaders_SubHeaders(columns)
            headers = h[0] ?? []
            subheaders = h[1] ?? []

            //######################################       Data      ###################################### 

            let rows: any[] = [];
            const balanceColumns = [...data.columns.slice(2).map(obj => obj.key)]
            const grouped: Record<string, Record<string, any[]>> = {};
            data.records.forEach((item: any) => {
                grouped[item.parentType] ??= {};
                grouped[item.parentType][item.type] ??= [];
                grouped[item.parentType][item.type].push(item);
            });


            for (const [parentType, types] of Object.entries(grouped)) {
                // Push parent header row
                rows.push([{ content: ` ${parentType}`, colSpan: (headers.length + (headers.length - subheaders.length)), styles: { fontStyle: 'bold', fillColor: 'C8C8C8' } }]);

                const parentTotals: Record<string, number> = {};
                balanceColumns.forEach(col => parentTotals[col] = 0);

                for (const [type, accounts] of Object.entries(types)) {

                    // Add sub-header if needed
                    if (!((parentType == type) || (accounts.length == 1 && accounts[0].account == type))) {
                        accounts.forEach(acc => acc.account = '   ' + acc.account)
                        rows.push([{ content: `  ${type}`, colSpan: (headers.length + (headers.length - subheaders.length)), styles: { fillColor: 'F2F2F2' } }]);
                    }

                    // Add account rows
                    for (const acc of accounts) {

                        const accountName = acc.parentId != acc.accountId ? `     ${acc.account}` : ` ${acc.account}`;
                        const row: any[] = [accountName, acc.code ?? ''];

                        balanceColumns.forEach(balanceCol => {
                            const d = acc.summary?.find((obj: {}) => Object.keys(obj)[0] === balanceCol);
                            const value = d ? (_.isNumber(Object.values(d)[0]) ? Number(Object.values(d)[0]) : 0) : 0;
                            row.push(this.getDataFormat(value, 'currency', currencySymbol, afterDecimal));

                            parentTotals[balanceCol] += value;
                        });

                        rows.push(row);
                    }

                }

                // Add total row for parentType
                const totalRow: any[] = [{ content: `Total ${parentType}`, styles: { fontStyle: 'bold' } }, ''];
                balanceColumns.forEach(col => {
                    let content = this.getDataFormat(parentTotals[col], 'currency', currencySymbol, afterDecimal)
                    totalRow.push({ content: content, styles: { fontStyle: 'bold' } })

                });
                rows.push(totalRow)
            }

            //######################################  Column Widths   ###################################### 
            // Table column counts
            let numberOfColumns: any = headers.reduce((acc, elem: any) => { return acc + ((elem?.colSpan ?? 0 as number)) }, 0)
            let maxColumnWidth = (pagewidth - 14) / numberOfColumns

            // get columns width 
            const columnsWidth = this.getColumnsWidth(rows, maxColumnWidth, pagewidth)

            //######################################    create Table    ###################################### 
            autoTable(doc, {
                theme: 'plain',
                startY: y + 2,

                head: subheaders.length > 0 ? [headers, subheaders] : [headers],
                body: rows,
                tableWidth: 'auto',

                headStyles: { fillColor: 'E0E0E0', textColor: 'black', valign: 'middle', halign: 'left' },
                footStyles: { fillColor: 'E0E0E0', textColor: 'black' },
                bodyStyles: { fillColor: 'ffffff', font: 'Amiri' },
                columnStyles: columnsWidth,
            })

            //##################################  Page Footer (page Number)  ################################## 
            this.pageFooter(doc, company.timeOffset)


            //######################################      Response     ######################################
            const pdfBuffer = doc.output('arraybuffer');
            const buffer = Buffer.from(pdfBuffer).toString('base64')
            const type = 'application/pdf';
            const fileExtension = '.pdf'
            doc.save(`${fileName}${fileExtension}`,)
            return {
                fileName: `${fileName}${fileExtension}`,
                type,
                buffer
            }



        } catch (error: any) {
            console.log(error)
            throw new Error(error);
        }
    }


    // not used

    public static async exportBalanceSheetPdf2(data: ReportData, company: Company, options?: { orientation: string | null; }) {
        try {

            // var doc:any = new jsPDF()
            //get companyInfo
            let companyInfo = (await CompanyRepo.getCompanyById(company.id)).data
            const afterDecimal = companyInfo.settings.afterDecimal ?? 3
            const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD"


            let companyImage = await this.getCompanyImage(companyInfo.mediaId, company.id) ?? null

            const doc = new jsPDF({ orientation: options && options.orientation == 'landscape' ? 'l' : 'p' })

            var pageSize = doc.internal.pageSize;
            const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
            const pagewidth = pageSize.width ? pageSize.width : pageSize.getWidth();
            let fileName = data.fileName ? data.fileName : company.id + 'Report'



            //###################################### Report Header ###################################### 
            let y = this.pageHeader(doc, companyInfo, data.filter, pagewidth) ?? 22

            //###################################### Applied Filter ###################################### 
            y = await this.appliedFilter(doc, y ?? 22, data.filter) ?? 22


            //###################################### remove barcode ###################################### 
            if (data.columns.findIndex(a => a.key == 'barcode') > -1) {
                data.columns.splice(data.columns.findIndex(a => a.key == 'barcode'), 1)
            }


            //###################################### headers/ subheaders ######################################   
            let headers: CellInput[] = [];
            let subheaders: CellInput[] = [];
            let hasSubHeader: boolean = data.columns.findIndex(col => col.childs?.length) > -1


            for (let index = 0; index < data.columns.length; index++) {
                const element = data.columns[index];
                if (element.properties?.groupBy === 'horizantal') { continue }

                element.childs?.forEach((subCol: any, indx: number) => {
                    let _halign: HAlignType | undefined;
                    if (element.childs?.length != undefined && indx == element.childs?.length - 1) {
                        _halign = "right";
                    }
                    subheaders.push({ colSpan: 1, styles: { halign: _halign }, content: subCol.header ?? _.startCase(subCol.key) })
                })

                if (element.childs && element.childs.length > 0) {
                    headers.push({ colSpan: element.childs.length ?? 1, content: element.header ?? _.startCase(element.key), styles: { halign: 'center' } })
                }
                else {
                    let _halign: HAlignType | undefined;
                    if (index == data.columns.length - 1) {
                        _halign = "right";
                    }
                    headers.push({ colSpan: 1, rowSpan: hasSubHeader ? 2 : 0, styles: { halign: _halign }, content: element.header ?? _.startCase(element.key) });

                }

            }



            //######################################         Data        ######################################

            let rows: any[] = [];
            let tt = 'Assets'
            // rows.push([tt])
            let count = 0
            let assetsTotalRow

            for (const record of data.records) {
                const row = []
                for (const column of data.columns) {
                    if (record['grandType'] != tt) {

                        if (tt !== 'Liabilities and Equity') {
                            rows.splice(count, 0, this.calculateSubTotal(data.records.slice(0, count), data.columns, currencySymbol, afterDecimal, 'F9F9F9', 'Total Assets'));
                        }
                        count = 0;
                        tt = 'Liabilities and Equity';

                    }


                    if (column.properties?.groupBy === 'horizantal') { continue }


                    if (column.childs?.length) {
                        for (const child of column.childs) {
                            const childData = record.summary?.find((s: any) => s[column.key])
                            const value = childData?.[column.key]?.[child.key] ?? '';

                            row.push(this.getDataFormat(value, child.properties?.columnType ?? '', currencySymbol, afterDecimal))
                        }
                    } else {
                        let p;

                        if (record[column.key]) { p = record[column.key] }
                        else if (record.summary?.find((s: any) => s[column.key])?.[column.key]) { p = record.summary.find((s: any) => s[column.key])?.[column.key] }
                        else (p = '')

                        if (column.key == 'productName') { p = record['barcode'] ? p + `\n[${record['barcode']}]` : p }
                        row.push(this.getDataFormat(p, column.properties?.columnType ?? '', currencySymbol, afterDecimal))
                    }
                }
                count++

                rows.push(row)
            }

            rows.push(this.calculateSubTotal(data.records.slice(data.records.length - count, data.records.length), data.columns, currencySymbol, afterDecimal, 'F9F9F9', 'Total Liabilities and Equity'));


            //###################################### calculation for column widths ######################################
            // Table column counts
            let numberOfColumns: any = headers.reduce((acc, elem: any) => { return acc + ((elem?.colSpan ?? 0 as number)) }, 0)
            let maxColumnWidth = (pagewidth - 14) / numberOfColumns

            // Calculate average widths
            const averageWidths = rows.reduce((acc, row) => {
                row.forEach((cell: any, index: number) => {
                    const cellWidth = cell ? cell.toLocaleString().length : 0;

                    acc[index] = acc[index] || { totalWidth: 0, count: 0 };
                    acc[index].totalWidth += cellWidth;
                    acc[index].count += 1;
                });
                return acc;
            }, []);

            // 
            const maxWidths = averageWidths.map(({ totalWidth, count }: any) => {
                var averageWidth = totalWidth / count;
                if (averageWidth > maxColumnWidth) { averageWidth = maxColumnWidth }
                else if (averageWidth < 8) { averageWidth = 8 }
                return averageWidth

            });

            let sum = maxWidths.reduce((a: number, b: number) => a + b, 0)

            const columnsWidth = maxWidths.reduce((acc: { cellWidth: number; halign?: HAlignType }[], num: number, index: number) => {

                acc[index] = { cellWidth: num / sum * (pagewidth - 28) };

                if (index == maxWidths.length - 1) { acc[index] = { cellWidth: num / sum * (pagewidth - 28), halign: 'right' } }

                return acc;
            }, {});





            //######################################         grandTotal        ######################################

            let grandTotal: any[] = [];
            const reportHasTotal = data.columns.findIndex(col => col.properties?.hasTotal)

            if (reportHasTotal > -1) {
                grandTotal = this.calculateTotal(data.records, data.columns, currencySymbol, afterDecimal)
            }



            //######################################   groupBy  ######################################
            const reportHasGroupBy = data.columns.findIndex(col => col.properties?.groupBy)
            const reportHasSubTotal = data.columns.findIndex(col => col.properties?.hasSubTotal)


            if (reportHasSubTotal > -1 || reportHasGroupBy > -1) {
                data.columns[0].properties = data.columns[0].properties || { 'groupBy': true }
                let groubIdx = 0

                for (let totalCol of data.columns) {

                    if (totalCol.key && (totalCol.properties?.groupBy || totalCol.key == 'type')) {
                        const column = totalCol.key
                        let index = 0 + groubIdx
                        groubIdx++



                        let sliceData = _.groupBy(data.records, column)
                        if (column == 'type') {
                            sliceData = _.groupBy(_.filter(data.records, { parentType: 'Current Assets' }), column)
                        }

                        let s = true



                        Object.keys(sliceData).forEach((k: string, idx: number) => {


                            const r = sliceData[k]
                            let i = index
                            index += r.length

                            if (totalCol.properties?.groupBy == 'horizantal') {
                                if (r && r[0].grandType == 'Liabilities and Equity' && s) { index++; s = false }
                                rows.splice((index - r.length), 0, [{ content: k, styles: { fillColor: 'E0E0E0', fontStyle: 'bold' }, colSpan: (headers.length + (headers.length - subheaders.length)), }])
                                index++
                            }

                            if (reportHasSubTotal > -1) {
                                let rr = this.calculateSubTotal(r, data.columns, currencySymbol, afterDecimal)
                                rr[0] = { content: k + ' Total', styles: { fillColor: 'CBCBCB', fontStyle: 'bold' } }
                                rows.splice(index, 0, rr)

                                index++
                            }



                            //rows[i][0]  = {content:rows[i][0] , rowSpan: r.length}

                        })



                    }
                }

            }



            autoTable(doc, {
                // theme: 'grid',
                startY: y + 2,

                head: subheaders.length > 0 ? [headers, subheaders] : [headers],
                body: rows,
                foot: grandTotal.length > 0 ? [grandTotal] : undefined,
                tableWidth: 'auto',


                headStyles: { fillColor: 'E0E0E0', textColor: 'black', valign: 'middle', halign: 'left' },
                footStyles: { fillColor: 'E0E0E0', textColor: 'black' },
                bodyStyles: { fillColor: 'ffffff' },
                columnStyles: columnsWidth,



            })

            this.pageFooter(doc, company.timeOffset)



            const pdfBuffer = doc.output('arraybuffer');
            const buffer = Buffer.from(pdfBuffer).toString('base64')
            const type = 'application/pdf';
            const fileExtension = '.pdf'
            doc.save(`${fileName}${fileExtension}`,)
            return {
                fileName: `${fileName}${fileExtension}`,
                type,
                buffer
            }




        } catch (error: any) {
            console.log(error)
            throw new Error(error);
        }
    }

    public static async getCompanyImage(mediaId: string | null, companyId: string) {
        try {


            let query = `select "Media".url as "mediaUrl",
                                "Media"."size" from  "Media" where "Media".id = $1       
                               
                        `
            const values = [mediaId]
            const companyData = await DB.excu.query(query, values)
            const company = new Company()
            company.id = companyId

            if (companyData.rows && companyData.rows.length > 0) {

                company.ParseJson(companyData.rows[0])

                //console.log(company.mediaUrl && company.mediaUrl.defaultUrl )
                if (company.mediaUrl && company.mediaUrl.defaultUrl) {
                    let logo = 'https://devback.invopos.co/v1/app/Media/getMedia/8413ef08-eda3-486a-ac0c-bd7f1ee5cd8a/d9a1ffb4-a708-407b-9a77-862206201ef0.jpeg'


                    const mediaName = logo.substring(logo.lastIndexOf('/') + 1)
                    const extension = mediaName.split('.')[1]
                    const imageData = await S3Storage.getDefaultImageBase64(mediaName.split('.')[0], company.id, extension);

                    if (imageData) {
                        company.base64Image = imageData.media;
                    }



                }
            }

            //   let logo = 'https://devback.invopos.co/v1/app/Media/getMedia/8413ef08-eda3-486a-ac0c-bd7f1ee5cd8a/d9a1ffb4-a708-407b-9a77-862206201ef0.jpeg'
            let logo = 'http://10.2.2.155:3001/v1/app/getLogo/invoLogo.png'

            const mediaName = logo.substring(logo.lastIndexOf('/') + 1)
            const extension = mediaName.split('.')[1]
            const imageData = await S3Storage.getDefaultImageBase64(mediaName.split('.')[0], company.id, extension);


            if (imageData) {
                company.base64Image = imageData.media;
            }



            return company.base64Image ?? null

        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    public static async getCompanyImage2(mediaId: string | null, companyId: string) {
        try {


            let query = `select "Media".url->>'defaultUrl' as "logo",
                                "Media"."size" from  "Media" where "Media".id = $1       
                               
                        `
            const values = [mediaId]
            const companyData = await DB.excu.query(query, values)
            const company = new Company()
            company.id = companyId
            let logo = ''
            if (companyData.rows && companyData.rows.length > 0) {

                company.ParseJson(companyData.rows[0])
                logo = company.logo
            }

            if (company.logo == "" || company.logo == null) {
                /**Get Invo Logo from storage */
                let baseUrl = process.env.APP_BASE_URL + "/getLogo/invoLogo.png";
                logo = baseUrl;
            }


            // https://devback.invopos.co/v1/app/Media/getMedia/8413ef08-eda3-486a-ac0c-bd7f1ee5cd8a/d9a1ffb4-a708-407b-9a77-862206201ef0.jpeg
            //http://10.2.2.155:3001/v1/app/getLogo/invoLogo.png
            const mediaName = logo.substring(logo.lastIndexOf('/') + 1)
            const extension = mediaName.split('.')[1]
            const imageData = await S3Storage.getDefaultImageBase64(mediaName.split('.')[0], company.id, extension);


            if (imageData) { company.base64Image = imageData.media; }

            return company.base64Image ?? null

        } catch (error: any) {
            throw new Error(error.message)
        }
    }



    public static async exportGroupedDynamicToPdf(
        data: ReportData,
        company: Company,
        options?: { orientation: string | null; }
    ) {
        try {

            const companyInfo = (await CompanyRepo.getCompanyById(company.id)).data;
            const afterDecimal = companyInfo.settings.afterDecimal ?? 3;
            const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD";

            const doc = new jsPDF({ orientation: options && options.orientation == 'landscape' ? 'l' : 'p' })
            await this.setDefualtFontStyle(doc);

            const pageWidth = doc.internal.pageSize.getWidth();
            let y = this.pageHeader(doc, companyInfo, data.filter, pageWidth);

            if (data.showFilter && data.filter) {
                y = await this.appliedFilter(doc, y, data.filter);
            }

            // ===============================
            // HEADERS
            // ===============================
            const headers = data.columns.map(col => col.header ?? col.key);

            const head = [headers];

            // ===============================
            // TOTALS INIT
            // ===============================
            const totals: Record<string, number> = {};
            data.columns.forEach(col => {
                if (col.properties?.hasTotal) {
                    totals[col.key] = 0;
                }
            });

            // ===============================
            // BODY
            // ===============================
            const body: any[] = [];

            for (const group of data.records) {

                // Group Label Row
                body.push([
                    {
                        content: group.label,
                        colSpan: headers.length,
                        styles: { fontStyle: 'bold', fillColor: [230, 230, 230] }
                    }
                ]);

                for (const record of group.agingGroups) {

                    const row: any[] = [];

                    data.columns.forEach(col => {

                        if (col.properties?.groupBy) {
                            row.push('');
                            return;
                        }

                        let value = record[col.key];

                        if (col.properties?.columnType === 'currency') {
                            value = Number(value ?? 0);
                            if (col.properties?.hasTotal) {
                                totals[col.key] += value;
                            }

                            value = `${currencySymbol} ${value.toFixed(afterDecimal)}`;
                        }

                        if (col.properties?.columnType === 'date' && value) {
                            value = moment(value).format('YYYY-MM-DD');
                        }

                        row.push(value ?? '');
                    });

                    body.push(row);
                }

                body.push([{ content: '', colSpan: headers.length }]);
            }

            // ===============================
            // GRAND TOTAL
            // ===============================
            if (Object.keys(totals).length > 0) {

                const totalRow: any[] = [];

                data.columns.forEach((col, index) => {

                    if (index === 0) {
                        totalRow.push({
                            content: 'Grand Total',
                            styles: { fontStyle: 'bold' }
                        });
                        return;
                    }

                    if (col.properties?.hasTotal) {
                        totalRow.push({
                            content: `${currencySymbol} ${totals[col.key].toFixed(afterDecimal)}`,
                            styles: { fontStyle: 'bold' }
                        });
                    } else {
                        totalRow.push('');
                    }
                });

                body.push(totalRow);
            }

            autoTable(doc, {
                startY: y + 5,
                head,
                body,
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                },
                headStyles: {
                    fillColor: [220, 220, 220],
                    textColor: 0,
                    fontStyle: 'bold'
                },
                columnStyles: data.columns.reduce((acc: any, col, i) => {
                    if (col.properties?.columnType === 'currency') {
                        acc[i] = { halign: 'right' };
                    }
                    return acc;
                }, {})
            });

            this.pageFooter(doc, company.timeOffset);


            let fileName = (data.fileName ? data.fileName : company.id + 'Report')
            const pdfBuffer = doc.output('arraybuffer');
            const buffer = Buffer.from(pdfBuffer).toString('base64')
            const fileExtension = '.pdf'
            doc.save(`${fileName}${fileExtension}`,)
            fileName = `${fileName}${fileExtension}`
            return {
                fileName,
                type: 'application/pdf',
                buffer
            };

        } catch (error: any) {
            console.error(error);
            throw new Error(error);
        }
    }


    public static async exportDynamicAgingSummaryReportPdf<T extends Record<string, any>>(
        records: Array<T & {
            agingGroups: Array<{ label: string; total: number }>;
        }>,
        ranges: string[],
        filter: any,
        showFilter: boolean,
        company: Company,
        options: {
            idKey: keyof T;
            nameKey: keyof T;
            headerLabel: string;
            fileName?: string;
        },
        display?: { orientation: string | null; }
    ) {
        try {

            const companyInfo = (await CompanyRepo.getCompanyById(company.id)).data;
            const afterDecimal = companyInfo.settings.afterDecimal ?? 3;
            const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD";

            const doc = new jsPDF({ orientation: display && display.orientation == 'landscape' ? 'l' : 'p' })
            await this.setDefualtFontStyle(doc);

            const pageWidth = doc.internal.pageSize.getWidth();
            let y = this.pageHeader(doc, companyInfo, filter, pageWidth);

            if (showFilter && filter) {
                y = await this.appliedFilter(doc, y, filter);
            }

            // ===============================
            // HEADERS
            // ===============================
            const headers = [
                options.headerLabel,
                ...ranges,
                'Total'
            ];

            const head = [headers];

            // ===============================
            // TOTALS INIT
            // ===============================
            const totalsPerRange: Record<string, number> = {};
            ranges.forEach(r => totalsPerRange[r] = 0);
            let grandTotal = 0;

            const body: any[] = [];

            for (const record of records) {

                const row: any[] = [];

                row.push(record[options.nameKey]);

                let rowTotal = 0;

                for (const range of ranges) {
                    const aging = record.agingGroups.find(g => g.label === range);
                    const value = Number(aging?.total ?? 0);

                    totalsPerRange[range] += value;
                    rowTotal += value;

                    row.push(`${currencySymbol} ${value.toFixed(afterDecimal)}`);
                }

                row.push(`${currencySymbol} ${rowTotal.toFixed(afterDecimal)}`);
                grandTotal += rowTotal;

                body.push(row);
            }

            // ===============================
            // GRAND TOTAL ROW
            // ===============================
            const totalRow = [
                { content: 'Grand Total', styles: { fontStyle: 'bold' } },
                ...ranges.map(r => ({
                    content: `${currencySymbol} ${totalsPerRange[r].toFixed(afterDecimal)}`,
                    styles: { fontStyle: 'bold' }
                })),
                {
                    content: `${currencySymbol} ${grandTotal.toFixed(afterDecimal)}`,
                    styles: { fontStyle: 'bold' }
                }
            ];

            body.push(totalRow);

            autoTable(doc, {
                startY: y + 5,
                head,
                body,
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                    halign: 'center'
                },
                headStyles: {
                    fillColor: [220, 220, 220],
                    textColor: 0,
                    fontStyle: 'bold',
                    halign: 'center',

                },
                columnStyles: headers.reduce((acc: any, _, i) => {
                    if (i > 0) acc[i] = { halign: 'center' };
                    return acc;
                }, {})
            });

            this.pageFooter(doc, company.timeOffset);


            let fileName = options.fileName ? options.fileName : company.id + 'Report'
            const pdfBuffer = doc.output('arraybuffer');
            const buffer = Buffer.from(pdfBuffer).toString('base64')
            const fileExtension = '.pdf'
            doc.save(`${fileName}${fileExtension}`,)
            fileName = `${fileName}${fileExtension}`
            return {
                fileName,
                type: 'application/pdf',
                buffer
            };

        } catch (error: any) {
            console.error(error);
            throw new Error(error);
        }
    }


}










