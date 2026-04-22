

import { ResponseData } from "@src/models/ResponseData";
import { FileStorage } from "@src/utilts/fileStorage";
import relations from "@src/models/account/customizeReports"
import { DB } from "@src/dbconnection/dbconnection";
import { Company } from "@src/models/admin/company";

export class CustomizeReportRepo {


    public static async generateCaseStatements(columns: any) {
        const sqlCaseStatements = columns.map((column: any) => {
            const tableName = column.column.split(".")[0];
            const columnName = column.column.split(".")[1];


            const sqlCaseClause = column.options.map((option: any) => {
                if (option.values) {
                    const valueList = option.values.map((value: any) => `'${value}'`).join(", ");
                    return `WHEN "` + tableName + '"."' + columnName + `" IN(${valueList}) THEN '${option.id}'`;
                } else {
                    return `ELSE '${option.id}'`;
                }
            })
                .join(" ");
            return ` CASE ${sqlCaseClause} END AS "${tableName}.${columnName}"`;
        });
        return sqlCaseStatements.join(", ");
    }

























    public static async generatemod(column: string, opp: string, tablename: string) {
        // const fileStorage = new FileStorage();
        // const dataSource = await fileStorage.getDataSource();
        // const data = dataSource.data["dataSources"];
        // let emailFieldFound = false;
        // let tableName = '';

        // for (let key in data) {

        //     if (data.hasOwnProperty(key)) {
        //         const object = data[key];

        //         // Check if the object has the "email" field
        //         let col = column.substring(column.lastIndexOf('.') + 1)
        //         const Field = object.data.find((item: { id: string; }) => item.id == col);
        //         if (Field) {
        //             emailFieldFound = true;

        //             tableName =  object.id
        //             break; // Exit the loop if the field is found
        //         }
        //     }
        // }
        // if (!emailFieldFound) {
        // }
        const upperCase = opp.toUpperCase();
        const lowerCase = opp.toLowerCase();
        const columnNames = column.substring(column.lastIndexOf('.') + 1)
        const newtableName = column.split(".")[1]; // Use the retrieved table name o
        let columnString
        if (opp == "count") {
            columnString = upperCase + `(*) as \"` + lowerCase + `.\"`;
        } else {
            columnString = upperCase + `( "${newtableName}"."${columnNames}") as "` + lowerCase + `.${newtableName}.${columnNames}"`;
        }
        return columnString;
    }







    public static async hasBucket(bucket: any, columns: any[]) {
        for (const c of columns) {
            if (c === bucket.BucketColumn) {
                return true;
            }
        }
        "sum.tableName.col"
        "tableName.col"
        return false;
    }
    public static async toArray(input: string) {
        try {
  
            const arr = input.replace('[', '');
            const arr2 = arr.replace(']', '');


            if (arr2 == '[]' || input == "") {
                return [];
            }

            return arr2.split(',');
        } catch (error: any) {
          

        }




    }
    public static async generateSQL(tablename: string, query: any, columns: any[], joins: any, limit: [], sort: any, group: any, buckets: [], company: Company) {
        try {
            let sql = 'SELECT ';

            // Columns


            if (columns.length > 0) {
                //   const Firstpart = columns.map(column => column.split('.')[0]);
                let columnString;
                let Firstpart;

                //enterd 

                for (let index = 0; index < columns.length; index++) {
                    const element = columns[index];
                    const columnName = element.split('.')[1];

                    const isBucket = buckets.length > 0 && buckets.find((f: any) => { if (f.column.split(".")[1] == columnName) return true; return false })

                    if (isBucket) continue;
                    Firstpart = element.split('.')[0];
                    switch (Firstpart) {
                        case 'sum':
                            if (sql != 'SELECT ') {
                                sql += " , ";
                            }
                            sql += await this.generatemod(element, 'sum', tablename);

                            break;
                        case 'max':
                            if (sql != 'SELECT ') {
                                sql += " , ";
                            }
                            sql += await this.generatemod(element, 'max', tablename);
                            break;
                        case 'min':
                            if (sql != 'SELECT ') {
                                sql += " , ";
                            }
                            sql += await this.generatemod(element, 'min', tablename);
                            break;
                        case 'avg':
                            if (sql != 'SELECT ') {
                                sql += " , ";
                            }
                            sql += await this.generatemod(element, 'avg', tablename);
                            break;
                        case 'count':
                            if (sql != 'SELECT ') {
                                sql += " , ";
                            }
                            sql += await this.generatemod(element, 'count', tablename);
                            break;

                        case 'day':
                            if (sql != 'SELECT ') {
                                sql += " , ";
                            }
                            // sql += 'EXTRACT('+ element.split('.')[0] +' FROM "'+ element.split('.')[1] +'"."'+ element.split('.')[2] +'")  as "'+ element.split('.')[0] +'.'+ element.split('.')[1] +'.'+ element.split('.')[2] +'"' 
                            sql += `TO_CHAR("` + element.split('.')[1] + `"."` + element.split('.')[2] + `", 'DD') AS "` + element.split('.')[0] + `.` + element.split('.')[1] + `.` + element.split('.')[2] + `"`;
                            break;
                        case 'month':
                            if (sql != 'SELECT ') {
                                sql += " , ";
                            }
                            // sql += 'EXTRACT('+ element.split('.')[0] +' FROM "'+ element.split('.')[1] +'"."'+ element.split('.')[2] +'")  as "'+ element.split('.')[0] +'.'+ element.split('.')[1] +'.'+ element.split('.')[2] +'"' 
                            sql += `TO_CHAR("` + element.split('.')[1] + `"."` + element.split('.')[2] + `", 'MM') AS "` + element.split('.')[0] + `.` + element.split('.')[1] + `.` + element.split('.')[2] + `"`;
                            break;
                        case 'year':
                            if (sql != 'SELECT ') {
                                sql += " , ";
                            }
                            // sql += 'EXTRACT('+ element.split('.')[0] +' FROM "'+ element.split('.')[1] +'"."'+ element.split('.')[2] +'")  as "'+ element.split('.')[0] +'.'+ element.split('.')[1] +'.'+ element.split('.')[2] +'"' 
                            sql += `TO_CHAR("` + element.split('.')[1] + `"."` + element.split('.')[2] + `", 'YYYY') AS "` + element.split('.')[0] + `.` + element.split('.')[1] + `.` + element.split('.')[2] + `"`;
                            break;
                        case 'yearmonth':
                            if (sql != 'SELECT ') {
                                sql += " , ";
                            }
                            // sql += 'EXTRACT('+ element.split('.')[0] +' FROM "'+ element.split('.')[1] +'"."'+ element.split('.')[2] +'")  as "'+ element.split('.')[0] +'.'+ element.split('.')[1] +'.'+ element.split('.')[2] +'"' 
                            sql += `TO_CHAR("` + element.split('.')[1] + `"."` + element.split('.')[2] + `", 'YYYY-MM') AS "` + element.split('.')[0] + `.` + element.split('.')[1] + `.` + element.split('.')[2] + `"`;
                            break;
                        case 'yearmonthday':
                            if (sql != 'SELECT ') {
                                sql += " , ";
                            }
                            // sql += 'EXTRACT('+ element.split('.')[0] +' FROM "'+ element.split('.')[1] +'"."'+ element.split('.')[2] +'")  as "'+ element.split('.')[0] +'.'+ element.split('.')[1] +'.'+ element.split('.')[2] +'"' 
                            sql += `TO_CHAR("` + element.split('.')[1] + `"."` + element.split('.')[2] + `", 'YYYY-MM-DD') AS "` + element.split('.')[0] + `.` + element.split('.')[1] + `.` + element.split('.')[2] + `"`;
                            break;






                        default:
                            if (sql != 'SELECT ') {
                                sql += " , ";
                            }
                            const columnNames = '"' + element.split('.')[0] + '"' + "." + '"' + element.split('.')[1] + '" as "' + element.split('.')[0] + "." + element.split('.')[1] + '"';
                            //columnString = columnNames.map(column => `${columnNames}`).join(', ');
                            sql += columnNames;
                    }
                }

            } else {
                sql += '*';
            }

            if (buckets) {

                sql += columns.length > 0 && buckets.length > 0 ? ", " : ""
                if (buckets.length > 0) {
                    sql += await this.generateCaseStatements(buckets);
                }
            }
            // From
            sql += ` FROM "${tablename}"`;
            //where

            let filter = ` WHERE `;
            let join = ``;
            if (relations[tablename]["branchId"]) {
                join = ` INNER JOIN "Branches" on "Branches".id = ` + '"' + tablename + '"' + '."branchId"'
                filter += ` "Branches"."companyId"=$1`
            } else {
                filter += ` "` + tablename + `"."companyId"=$1`
            }

            sql += join

            if (JSON.parse(joins).length > 0) {
                for (let index = 0; index < JSON.parse(joins).length; index++) {
                    const element = JSON.parse(joins)[index];

                    if (relations[tablename]["branchId"] && (element.sid == "Branches" || element.tid == "Branches")) {
                        continue;
                    }

                    sql += `  JOIN  "${element.tid}" ON "${element.sid}"."${element.sf ? element.sf : 'id'}" = "${element.tid}"."${element.tf ? element.tf : 'id'}"`

                }

            }
            sql += filter
            if (query.length > 0) {
                query = JSON.parse(query);
                const rules = query.rules
                if (query.rules && rules.length > 0) {
                    sql += " AND"
                    const whereClauses = [];
                    let currentTable = "";
                    let hasMultipleTables = false;
                    const glue = query.glue;
                    for (let i = 0; i < rules.length; i++) {
                        const rule = rules[i];
                        let likeClauses = [];
                        const field = rule.field.split(".");
                        const table = field[0];
                        const column = field[1];
                        const type = rule.type;
                        const condition = rule.condition.type;
                        let filter = rule.condition.filter;
                        const includes = rule.includes;
                        const operators: any = {
                            contains: { operator: "LIKE", start: "%", end: "%", type: "text" },
                            notContains: { operator: "NOT LIKE", start: "%", end: "%", type: "text" },
                            equal: { operator: "=", start: "", end: "", type: "text" },
                            notEqual: { operator: "!=", start: "", end: "", type: "text" },
                            beginsWith: { operator: "LIKE", start: "", end: "%", type: "text" },
                            notBeginsWith: { operator: "NOT LIKE", start: "", end: "%", type: "text" },
                            endsWith: { operator: "LIKE", start: "%", end: "", type: "text" },
                            notEndsWith: { operator: "NOT LIKE", start: "%", end: "", type: "text" },
                            lessOrEqual: { operator: "<=", start: "", end: "", type: "integer" },
                            greaterOrEqual: { operator: ">=", start: "", end: "", type: "integer" },
                            greater: { operator: ">", start: "", end: "", type: "integer" },
                            less: { operator: "<", start: "", end: "", type: "integer" },
                        };
                        if (currentTable !== "" && currentTable !== table) {
                            hasMultipleTables = false;
                        }

                        if (includes.length > 0) {


                            if (condition != 'between') {

                                likeClauses = includes.map((value: any) => {

                                    const parsedDate = new Date(value);
                                    parsedDate.setDate(parsedDate.getDate() + 1);
                                    // let isDate = false;
                                    const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
                                    let isDate = regex.test(value);



                                    if (condition == 'greater' || condition == 'less' || condition == 'greaterOrEqual' || condition == 'lessOrEqual') {

                                        let numberValue;
                                        if (isDate) {
                                            numberValue = `'${parsedDate.toISOString().split('T')[0]}'`;
                                        } else {
                                            numberValue = Number(value); // Convert the value to a string
                                        }
                                        // const numberValue = Number(value); // Convert the value to a string

                                        return `"${table}"."${column}" ${operators[condition].operator} ${operators[condition].start}${numberValue}${operators[condition].end}`;


                                    } else {



                                        let stringValue;
                                        if (isDate) {
                                            stringValue = `${parsedDate.toISOString().split('T')[0]}`;
                                            return `"${table}"."${column}"::date  ${operators[condition].operator}  '${operators[condition].start}${stringValue.replace(/'/g, "\''")}${operators[condition].end}'`;
                                        } else {

                                            stringValue = String(value); // Convert the value to a string
                                            // stringValue = stringValue.replace(/'/g, "''"); 
                                            return `"${table}"."${column}"::text  ${operators[condition].operator}  '${operators[condition].start}${stringValue.replace(/'/g, "''")}${operators[condition].end}'`;
                                            // return    likeClauses.push(`"${table}"."${column}"::${operators[condition].type}  ${operators[condition].operator}  '${operators[condition].start}${stringValue.replace(/'/g, "\''")}${operators[condition].end}'`);
                                        }




                                        // const stringValue = String(value); // Convert the value to a string
                                        // return `"${table}"."${column}"::text ${operators[condition].operator} '${operators[condition].start}${stringValue.replace(/'/g, "\\'")}${operators[condition].end}'`;
                                    }

                                });
                            }

                        }
                        if (filter !== ":" && filter !== "") {

                            const parsedDate = new Date(filter);
                            parsedDate.setDate(parsedDate.getDate() + 1);
                            // let isDate = false;
                            const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
                            let isDate = regex.test(filter);
                            // Check if the parsed date is valid
                            // if (!isNaN(parsedDate.getTime())) {
                            //     isDate = true;
                            //     console.log('The filter is a valid date string:', parsedDate.toISOString().split('T')[0]);
                            // } else {
                            //     isDate = false;
                            //     console.log('The filter is a string but not a valid date.');
                            // }

                            if (condition == 'greater' || condition == 'less' || condition == 'greaterOrEqual' || condition == 'lessOrEqual') {

                                let numberValue;
                                if (isDate) {
                                    numberValue = `'${parsedDate.toISOString().split('T')[0]}'`;
                                } else {

                                    numberValue = Number(filter); // Convert the value to a string

                                }

                                likeClauses.push(`"${table}"."${column}" ${operators[condition].operator}  ${operators[condition].start}${numberValue}${operators[condition].end}`);

                            } else if (condition == 'between') {

                                if(filter.start != null && filter.end != null){
                                let firstDate = new Date(filter.start);
                                let firstDateString = `'${firstDate.toISOString().split('T')[0]}'`;
                                let secondDate = new Date(filter.end);
                                let secondDateString = `'${secondDate.toISOString().split('T')[0]}'`;
                                likeClauses.push(`"${table}"."${column}"  BETWEEN ${firstDateString} AND ${secondDateString}`);
                            }
                            } else {


                                let stringValue;
                                if (isDate) {
                                    stringValue = `${parsedDate.toISOString().split('T')[0]}`;
                                    likeClauses.push(`"${table}"."${column}"::date  ${operators[condition].operator}  '${operators[condition].start}${stringValue.replace(/'/g, "\''")}${operators[condition].end}'`);
                                } else {
                                    stringValue = String(filter); // Convert the value to a string
                                    // stringValue = stringValue.replace(/'/g, "''"); 
                                    likeClauses.push(`"${table}"."${column}"::${operators[condition].type}  ${operators[condition].operator}  '${operators[condition].start}${stringValue.replace(/'/g, "''")}${operators[condition].end}'`);
                                }

                            }

                        }
                        whereClauses.push(" (" + likeClauses.join(" OR ") + ")");
                        currentTable = table;
                    }

                    if (whereClauses.length > 0) {

                        sql += whereClauses.join(glue);

                    }
                }
            }
            if (group && group.length > 0 && group[0] != '') {




                // const transformedGroup = group.map((item: { replace: (arg0: RegExp, arg1: string) => { (): any; new(): any; split: { (arg0: string): [any, any]; new(): any; }; }; }) => {
                //     // Remove the surrounding double quotes and split the string by '.'

                //     let itemArray = item.replace(/"/g, '').split('.');

                //     if (itemArray[0] == 'year') {

                //         return `"${itemArray[0]}"."${itemArray[1]}"."${itemArray[2]}"`;

                //     } else {

                //         const [table, column] = item.replace(/"/g, '').split('.');
                //         // Format the string to `"table"."column"`
                //         return `"${table}"."${column}"`;

                //     }



                // });


                const transformedGroup = group.map((item: string) => {
                    // Remove the surrounding double quotes and split the string by '.'
                    const itemArray = item.replace(/"/g, '').split('.');

                    if (itemArray[0] == 'day' || itemArray[0] == 'month' || itemArray[0] == 'year' || itemArray[0] == 'yearmonth' || itemArray[0] == 'yearmonthday') {
                        return `"${itemArray[0]}.${itemArray[1]}.${itemArray[2]}"`;
                    } else {
                        const [table, column] = itemArray; // Using itemArray directly
                        // Format the string to `"table"."column"`
                        return `"${table}"."${column}"`;
                    }
                });



                sql += ` GROUP BY ${transformedGroup.join(', ')}`;


                // sql += ` GROUP BY ${group.join(', ')}`;
            }

            // Sort
            if (sort && sort.length > 0) {
                const elements = JSON.parse(sort);
                const sortElement = elements.map((j: any) => j.id.split("."));

                const formattedColumnNames = sortElement.map(([tableName, columnName]: any) => `"${tableName}"."${columnName}"`);

                const sortDirections = elements.reduce((acc: any, { id, mod }: any) => {
                    acc[`"${id}"`] = mod;
                    return acc;
                }, {});

                const orderByClause = Object.entries(sortDirections)
                    .map(([columnName, direction]) => `${columnName} ${direction}`)
                    .join(', ');

                sql += ` ORDER BY ${orderByClause}`;
            }

            const resault = (await DB.excu.query(sql, [company.id])).rows
            return new ResponseData(true, "", { dataSources: resault })
        } catch (error: any) {
            console.log(error);
          
            throw new Error(error)
        }



    }
    public static async getDataSource() {
        try {

            const fileStorage = new FileStorage();
            return await fileStorage.getDataSource()

        } catch (error: any) {
          

            throw new Error(error)
        }
    }
}