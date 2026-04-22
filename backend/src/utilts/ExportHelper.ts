
import { Company } from '@src/models/admin/company';
import { createObjectCsvWriter } from 'csv-writer';
import xlsx from 'xlsx'
import exceljs from 'exceljs'
import Decimal from 'decimal.js'
import { XLSXGenerator } from './xlsxGenerator';

export class exportHelper{
    
    public static async exportCsvAndXlsx(company: Company, type: string = 'xlsx', fileName: string, selectList: {}[], csvHeader?: { id: string, title: string }[]) {
        try {


            const companyId = company.id;
            fileName = companyId + fileName + '.' + type.toLowerCase()

            if (type.toLowerCase() == 'csv') {

                // Create CSV
                const csvWriter = createObjectCsvWriter({ path: fileName, header: csvHeader ?? []});

                // Write the data to the CSV file
                await csvWriter.writeRecords(selectList);

            } else {


                // Create a new workbook
                const workbook = xlsx.utils.book_new()

                // Specify the headers based on your data keys
                const headers = Object.keys(selectList[0]); // Get headers from the first object

                // Convert the array to a worksheet
                const worksheet = xlsx.utils.json_to_sheet(selectList, { header: headers, skipHeader: false });

                // Calculate maximum width for each column based on the content
                const colWidths = headers.map(header => {
                    // Get maximum length of corresponding column values
                    const maxLength = Math.max(
                        ...selectList.map((row: any) => {
                            const value = row[header];
                            return value ? value.toString().length : 15; 
                        })
                    );

                    // Return the width in pixels, ensuring a minimum width
                    return { wpx: Math.max(maxLength * 10, 50) }; // Adjust multiplier as needed
                });

                // Set the column widths
                worksheet['!cols'] = colWidths;

                // Append the worksheet to the workbook
                xlsx.utils.book_append_sheet(workbook, worksheet, 'Data');

                // Generate a binary string for the workbook
                xlsx.writeFile(workbook, fileName);

            }

            return fileName
        } catch (error: any) {

            throw new Error("Error exporting " + fileName + ': ' + error.message); // Include the actual error message
        }
    }

    public static async exportCsvAndXlsx2(company: Company, type: string = 'xlsx', fileName: string, selectList: {}[], dropdownColumns?: {colKey: string , dropdownValues: any[]}[]) {
        try {


            const companyId = company.id;
            fileName = companyId + fileName 

          
                // Create a new workbook
                const workbook = new exceljs.Workbook();
                let worksheet = workbook.addWorksheet('Sheet1');
                
                // Add headers to the worksheet
                const headers = Object.keys(selectList[0]);
                const headerRow = worksheet.addRow(headers);

                headerRow.eachCell((cell, col)=>{
                    if (cell.value){
                       worksheet.getColumn(col).key = String(cell.value) 
                    }
                })
                
                // Add data to the worksheet
                selectList.forEach(rowData => {
                    worksheet.addRow(Object.values(rowData));
                  });

            



                dropdownColumns?.forEach(col=>{
                    for (let row = 2; row <= 9999; row++) {
                        const cell =  worksheet.getCell(row, worksheet.getColumn(col.colKey).number);
                        cell.dataValidation = {
                          type: 'list',
                          allowBlank: true,
                          formulae: [`"${col.dropdownValues.join(',')}"`],
                          showErrorMessage: true,
                          errorStyle: 'error',
                          error: 'The value is not valid',
                        };
                      }

                })

                worksheet = await XLSXGenerator.autoFitColumnWidth(worksheet)

                 
                 
                  if (type.toLowerCase() === 'xlsx') {
                    const buffer = await workbook.xlsx.writeBuffer();
                    return buffer;
                  } else if (type.toLowerCase() === 'csv') {
                    const buffer = await workbook.csv.writeBuffer();
                    return buffer;
                  } else {
                    throw new Error('Invalid format');
                  }

            
        } catch (error: any) {

            throw new Error("Error exporting " + fileName + ': ' + error.message); // Include the actual error message
        }
    }

    
}