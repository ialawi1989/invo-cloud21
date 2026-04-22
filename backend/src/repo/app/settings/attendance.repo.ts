import { DB } from "@src/dbconnection/dbconnection";
import { Company } from "@src/models/admin/company";
import { ResponseData } from "@src/models/ResponseData";
import { Attendance } from "@src/models/Settings/attendance";
import { ValidationException } from "@src/utilts/Exception";
import { ReportData } from "@src/utilts/xlsxGenerator";

export class AttendanceRepo {


    public static async editAttendance(data: any, company: Company, employeeId: string) {
        try {
            const attendence = new Attendance();
            attendence.ParseJson(data);
            attendence.updatedAt = new Date()

            const query = {
                text: `UPDATE "Attendances" SET "adjClockedIn" = case when "adjClockedIn" <> $1 or  "adjClockedIn" is null   then $1 else "adjClockedIn"end ,
                                                "adjClockedOut" = case when "adjClockedOut" <> $2 or  "adjClockedOut" is null   then $2 else "adjClockedOut"end ,
                                                "adjClockedInBy" = case when "adjClockedIn" <>  $1 or  "adjClockedIn" is null  then $3 else "adjClockedInBy"end ,
                                                "adjClockedOutBy" = case when "adjClockedOut" <> $2 or  "adjClockedOut" is null   then $4 else "adjClockedOutBy"end ,
                                                "updatedAt" = $5
                           where id=$6`,
                values: [attendence.adjClockedIn, attendence.adjClockedOut, employeeId, employeeId, attendence.updatedAt, attendence.id]
            }


            await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getAttendance(id: string, company: Company) {
        try {


            const query = {
                text: `
                         select "Attendances".*,
                               "Branches"."name" "branchName",
                               "Employees"."name" "employeeName",
                               "adjClockedOutByEmployee"."name" "adjClockedOutByEmployee",
                               "adjClockedInByEmployee"."name" "adjClockedInByEmployee"
                      from "Attendances"
                      inner join "Branches" on "Branches".id = "Attendances"."branchId"
                      inner join "Employees" on "Attendances"."employeeId" = "Employees" .id
                      left join "Employees" "adjClockedInByEmployee" on "Attendances"."adjClockedInBy" = "adjClockedInByEmployee" .id
                      left join "Employees" "adjClockedOutByEmployee" on "Attendances"."adjClockedOutBy" = "adjClockedOutByEmployee" .id
                      where "Attendances".id =$1
                    and "Branches"."companyId" = $2
                      `,
                values: [id, company.id]
            }


            let attendanceData = await DB.excu.query(query.text, query.values)
            let attendence: Attendance | null = new Attendance();
            if (attendanceData.rows[0]) {


                attendence.ParseJson(attendanceData.rows[0]);
            } else {
                attendence = null;
            }

            return new ResponseData(true, "", attendence)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getAttendanceList(data: any, company: Company, branchList: any[]) {
        try {

            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;
            let sort = data.sortBy;
            let sortValue = !sort ? '   "Attendances"."clockedIn" ' : '"' + sort.sortValue + '"';
            let searchValue = data.searchTerm ? data.searchTerm.toLowerCase().trim() : null;
            let sortDirection = !sort ? "DESC" : sort.sortDirection;

            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by` + sortTerm
            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            let page = data.page ?? 1
            offset = (limit * (page - 1))
            const employeeId = data.filter && data.filter.employeeId ? data.filter.employeeId : null
            const fromDate = data.filter && data.filter.fromDate ? data.filter.fromDate : null
            const toDate = data.filter && data.filter.toDate ? data.filter.toDate : null
            const notClosed = data.filter && data.filter.notClosed ? data.filter.notClosed : null

            let sql: string = `select count( "Attendances".id) over(),
                             "Attendances".id,
					          "Branches".name as "branchName",
							  "Employees".name as "employeeName",
							  "clockedIn",
							  "clockedOut",
                              "adjClockedIn",
                              "adjClockedOut",
							  "clockedInMediaUrl",
							  "clockedOutMediaUrl",
                              "adjClockedInByEmployee"."name" as "adjClockedInByEmployee",
                              "adjClockedOutByEmployee"."name" as "adjClockedOutByEmployee"
					  from "Attendances"
					  inner join "Branches" on "Branches".id = "Attendances"."branchId" 
					  inner join "Employees" on "Employees".id = "Attendances"."employeeId"
                      left join "Employees" "adjClockedInByEmployee" on "Attendances"."adjClockedInBy" = "adjClockedInByEmployee" .id
                      left join "Employees" "adjClockedOutByEmployee" on "Attendances"."adjClockedOutBy" = "adjClockedOutByEmployee" .id
					  where "Branches"."companyId" =$1`;

            let queryValues: any[] = [company.id];

            if (branches.length > 0) {
                sql += ` AND ("Branches".id=any($2::uuid[]))`;
                queryValues.push(branches);
            }

            if (searchValue) {
                sql += ` and(lower("Branches"."name") ~ lower($3) or lower("Employees"."name") ~ lower($3))`;
                queryValues.push(searchValue);
            }

            if (fromDate) {
                sql += ` and (COALESCE("adjClockedIn","clockedIn")>= $4)`;
                queryValues.push(fromDate);
            }

            if (toDate) {
                sql += ` and (COALESCE("adjClockedOut","clockedOut")<= $5)`;
                queryValues.push(toDate);
            }

            if (employeeId) {
                sql += ` and ("Attendances"."employeeId"= $6)`;
                queryValues.push(employeeId);
            }

            if (notClosed) {
                sql += ` and ( COALESCE("adjClockedOut","clockedOut") is null )`;
                queryValues.push(notClosed);
            }

            sql += orderByQuery + ` limit ${limit}  offset ${offset}`;

            console.log(sql, queryValues)
            const selectList = await DB.excu.query(sql, queryValues)

            let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: selectList.rows,
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


    public static async attendanceReport(data: any, company: Company, brancheList: any[]) {
        try {



            const limit = ((data.filter.limit == null) ? 15 : data.filter.limit);
            let page = data.filter.page ?? 1
            let offset = (limit * (page - 1))
            let timeOffset = company.timeOffset ?? '+3'
            const hours = parseInt(timeOffset, 10);
            const intervalString = `'${hours} hours'`;
            const employeeId = data.filter && data.filter.employeeId ? data.filter.employeeId : null
            const fromDate = data.filter && data.filter.fromDate ? data.filter.fromDate : null
            const toDate = data.filter && data.filter.toDate ? data.filter.toDate : null
            const branchId = data.filter && data.filter.branchId ? data.filter.branchId : null
            const filter = data.filter
            let branches = filter && filter.branches ? filter.branches : brancheList;
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };
            // if (branchId == null) {
            //     throw new ValidationException("Please Select a Branch")
            // }
            let limitQuery = ` limit $6
                                offset $7`
            let values = [branchId, employeeId, fromDate, toDate, company.id, limit, offset]
            if (filter.export) {
                limitQuery = ``
                values = [branchId, employeeId, fromDate, toDate, company.id]
            }


            const query = {
                text: `WITH "employeesAttendance" AS (
                            SELECT 
                                "Attendances".*, 
                                "Branches"."name" AS "branchName"
                            FROM "Attendances"
                            INNER JOIN "Branches" 
                                ON "Branches"."companyId" = $5 
                                AND "Branches".id = "Attendances"."branchId"
                            WHERE "Branches"."companyId" = $5
                                AND ($1::uuid IS NULL OR "Attendances"."branchId" = $1)
                                AND ($3::timestamp IS NULL OR "clockedIn" >= $3)
                                AND ($4::timestamp IS NULL OR "clockedIn" <= $4)
                                AND ($2::uuid IS NULL OR "Attendances"."employeeId" = $2)
                            ORDER BY COALESCE("Attendances"."adjClockedIn","Attendances"."clockedIn") ASC
                        ),

                        "attendances" AS (
                            SELECT 
                                COUNT(*) OVER() AS count,
                                ea."employeeId",
                                e."name" AS "employeeName",
                                ea."branchName",

                                JSON_AGG(
                                    JSON_BUILD_OBJECT(
                                        'clockedIn', DATE_TRUNC('minute', COALESCE(ea."adjClockedIn", ea."clockedIn")) + ${intervalString}::interval,
                                        'clockedOut', DATE_TRUNC('minute', COALESCE(ea."adjClockedOut", ea."clockedOut")) + ${intervalString}::interval,
                                        'clockedInMediaUrl', ea."clockedInMediaUrl",
                                        'clockedOutMediaUrl', ea."clockedOutMediaUrl",
                                        'clockOutReason', ea."clockOutReason"
                                    )
                                    ORDER BY ea."clockedIn" ASC
                                ) AS "attendance",

                                -- ✅ FIXED total hours (NO syntax issues)
                                (
                                    FLOOR(
                                        SUM(EXTRACT(EPOCH FROM (
                                            DATE_TRUNC('minute', COALESCE(ea."adjClockedOut", ea."clockedOut"))
                                            -
                                            DATE_TRUNC('minute', COALESCE(ea."adjClockedIn", ea."clockedIn"))
                                        ))) / 3600
                                    )::int
                                )
                                || 'h:' ||
                                LPAD(
                                    (
                                        FLOOR(
                                            SUM(EXTRACT(EPOCH FROM (
                                                DATE_TRUNC('minute', COALESCE(ea."adjClockedOut", ea."clockedOut"))
                                                -
                                                DATE_TRUNC('minute', COALESCE(ea."adjClockedIn", ea."clockedIn"))
                                            ))) / 60
                                        ) % 60
                                    )::int::text,
                                2, '0'
                                ) || 'm' AS "totalHours",

                                ea."clockedIn"::date AS "date"

                            FROM "employeesAttendance" ea
                            INNER JOIN "Employees" e 
                                ON e."id" = ea."employeeId"

                            -- ✅ IMPORTANT: avoid fake +1 hour bugs
                            WHERE COALESCE(ea."adjClockedOut", ea."clockedOut") IS NOT NULL

                            GROUP BY 
                                ea."employeeId",
                                ea."clockedIn"::date,
                                e."name",
                                ea."branchName"

                            ${limitQuery}
                        )

                                        
                               
                      `,
                values: values
            }

            if (filter.export) {
                query.text += `    SELECT
                "date",
                "employeeName",
                   "branchName",
                   (("attendance"->0 )::jsonb)->>'clockedIn' AS "clockedIn1",
                   (("attendance"->0 )::jsonb)->>'clockedOut' AS "clockeOut1",
                     (("attendance"->1 )::jsonb)->>'clockedIn' AS "clockedIn2",
                   (("attendance"->1 )::jsonb)->>'clockedOut' AS "clockeOut2",
                      (("attendance"->2 )::jsonb)->>'clockedIn' AS "clockedIn3",
                   (("attendance"->2 )::jsonb)->>'clockedOut' AS "clockeOut3",
                   "totalHours"
                from "attendances"`
            } else {
                query.text += `select * from "attendances"`

            }

            console.log("Attendance Query: ", query.text, query.values)
            // console.log("Attendance Query: ", query.text, query.values)
            const selectList = await DB.excu.query(query.text, query.values)
            let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
            let pageCount = Math.ceil(count / limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            if (filter.export) {

                let employeeName = employeeId ? (<any>selectList.rows[0]).employeeName : ''
                let branchName = (<any>selectList.rows[0]).branchName

                let report = new ReportData()
                report.filter = {
                    title: "Employees Attendence log",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches,

                }
                report.records = selectList.rows
                if (employeeId && !branchId) {
                    report.filter.title = `Attendence log for: ${employeeName}`
                    report.columns = [
                        { key: 'branchName' },
                        { key: 'clockedIn1', properties: { columnType: 'date_time' } },
                        { key: 'clockeOut1', properties: { columnType: 'date_time' } },
                        { key: 'clockedIn2', properties: { columnType: 'date_time' } },
                        { key: 'clockeOut2', properties: { columnType: 'date_time' } },
                        { key: 'clockedIn3', properties: { columnType: 'date_time' } },
                        { key: 'clockeOut3', properties: { columnType: 'date_time' } },
                        { key: 'totalHours' },

                    ]
                } else if (branchId && !employeeId) {
                    report.filter.title = `Attendence log for Employees In ${branchName} Branch`
                    report.columns = [
                        { key: 'employeeName' },
                        { key: 'clockedIn1', properties: { columnType: 'date_time' } },
                        { key: 'clockeOut1', properties: { columnType: 'date_time' } },
                        { key: 'clockedIn2', properties: { columnType: 'date_time' } },
                        { key: 'clockeOut2', properties: { columnType: 'date_time' } },
                        { key: 'clockedIn3', properties: { columnType: 'date_time' } },
                        { key: 'clockeOut3', properties: { columnType: 'date_time' } },
                        { key: 'totalHours' },

                    ]
                } else if (branchId && employeeId) {
                    report.filter.title = ` Attendence log for: ${employeeName} in ${branchName}`
                    report.columns = [

                        { key: 'clockedIn1', properties: { columnType: 'date_time' } },
                        { key: 'clockeOut1', properties: { columnType: 'date_time' } },
                        { key: 'clockedIn2', properties: { columnType: 'date_time' } },
                        { key: 'clockeOut2', properties: { columnType: 'date_time' } },
                        { key: 'clockedIn3', properties: { columnType: 'date_time' } },
                        { key: 'clockeOut3', properties: { columnType: 'date_time' } },
                        { key: 'totalHours' },

                    ]
                } else {
                    report.columns = [
                        { key: 'employeeName' },
                        { key: 'branchName' },
                        { key: 'clockedIn1', properties: { columnType: 'date_time' } },
                        { key: 'clockeOut1', properties: { columnType: 'date_time' } },
                        { key: 'clockedIn2', properties: { columnType: 'date_time' } },
                        { key: 'clockeOut2', properties: { columnType: 'date_time' } },
                        { key: 'clockedIn3', properties: { columnType: 'date_time' } },
                        { key: 'clockeOut3', properties: { columnType: 'date_time' } },
                        { key: 'totalHours' },

                    ]
                }
                console.log("hereeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", report)
                report.fileName = `${employeeName}Attendencelog`
                return new ResponseData(true, "", report)

            }
            const resData = {
                list: selectList.rows,
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

    public static async adjustClocked(data: any, compnay: Company, employeeId: string) {
        try {
            const updatedAt = new Date()
            if (data.id == "" || data.id == null) {
                throw new ValidationException("Attendance Id is Required")

            }

            if (data.type == 'adjClockedIn' && data.adjClockedIn == null) {
                throw new ValidationException("Adjust Clocked In Date/Time is Required")
            }

            if (data.type == 'adjClockedOut' && data.adjClockedOut == null) {
                throw new ValidationException("Adjust Clocked In Date/Time is Required")
            }
            const query = {
                text: `UPDATE "Attendances" SET "adjClockedIn" = case when "adjClockedIn" <> $1 or  "adjClockedIn" is null   then $1 else "adjClockedIn"end ,
                                               "adjClockedInBy" = case when "adjClockedIn" <>  $1 or  "adjClockedIn" is null  then $2 else "adjClockedInBy"end,
                                               "updatedAt" = $3
                                where id = $4
                                 `,
                values: [data.adjClockedIn, employeeId, updatedAt, data.id]
            }

            if (data.type == 'adjClockedOut') {
                query.text = `UPDATE "Attendances" SET "adjClockedOut" = case when "adjClockedOut" <> $1 or  "adjClockedOut" is null   then $1 else "adjClockedOut"end ,
                                               "adjClockedOutBy" = case when "adjClockedOut" <>  $1 or  "adjClockedOut" is null  then $2 else "adjClockedOutBy"end,
                                                  "updatedAt" = $3
                                where id = $4`
                query.values = [data.adjClockedOut, employeeId, updatedAt, data.id]
            }

            await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }
}