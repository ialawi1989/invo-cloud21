import { Timestamp } from "@redis/time-series/dist/commands";
import moment, { Moment } from "moment-timezone";
export class TimeHelper {
    public static async addOneDay(date: Date) {
        try {
            const newDate = new Date(date)
            newDate.setDate(newDate.getDate() + 1);
            return newDate;
        } catch (error: any) {
            throw new Error(error.message)
        }
    }
public static toPgTimestamp(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
        + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
    public static isValidDate(dateString: string) {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
}
    public static setLineDate(supplierCreditDate: any) {
    let tempDate = new Date(supplierCreditDate)
    let createdAt = new Date();
    createdAt.setDate(tempDate.getDate());
    createdAt.setMonth(tempDate.getMonth());
    createdAt.setFullYear(tempDate.getFullYear());
    console.log(createdAt)
    return createdAt;

}
    public static setLineDatetime(supplierCreditDate: any, transactionCreatedAt: any) {
    let tempDate = new Date(supplierCreditDate)
    let createdAt = new Date(transactionCreatedAt);
    createdAt.setDate(tempDate.getDate());
    createdAt.setMonth(tempDate.getMonth());
    createdAt.setFullYear(tempDate.getFullYear());
    console.log(createdAt)
    return createdAt;

}
    public static async resetHours(date: Date) {
    try {

        const newDate = new Date(date)
        newDate.setHours(0, 0, 0, 0);
        return newDate;
    } catch (error: any) {
        throw new Error(error)
    }
}

    public static convertToDate(time: any) {
    const date = new Date();
    date.setTime(time);
    return date;
}

    public static async getPreviousPeriod(from: any, to: any) {
    try {
        const fromDate: any = new Date(from);
        const toDate: any = new Date(to);
        const diffTime = Math.abs(toDate - fromDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const lastFromDate = new Date(fromDate);
        lastFromDate.setDate(lastFromDate.getDate() - diffDays)
        lastFromDate.setDate(1)
        const lasttoDate = new Date(fromDate)
        lasttoDate.setDate(lasttoDate.getDate() - 1)

        return {
            from: lastFromDate,
            to: lasttoDate
        }
    } catch (error: any) {
        throw new Error(error)
    }
}

    public static async getCurrentDateWithTimeZone(timeOffset: string) {
    try {
        let newDate = new Date()
        if (timeOffset && timeOffset != "" && timeOffset.startsWith('+')) {
            let offset = Number(timeOffset.split("+")[1])
            newDate.setTime(new Date().getTime() + (offset * 60 * 60 * 1000));

        } else if (timeOffset && timeOffset != "" && timeOffset.startsWith('-')) {
            let offset = Number(timeOffset.split("-")[1])
            newDate.setTime(new Date().getTime() - (offset * 60 * 60 * 1000));

        }
        return newDate
    } catch (error: any) {
        throw new Error(error)
    }
}


    public static convertTimeZone(date: Date, timeOffset: string) {
    try {
        let newDate = new Date()
        if (timeOffset && timeOffset != "" && timeOffset.startsWith('+')) {
            let offset = Number(timeOffset.split("+")[1])
            date.setTime(date.getTime() + (offset * 60 * 60 * 1000));

        } else if (timeOffset && timeOffset != "" && timeOffset.startsWith('-')) {
            let offset = Number(timeOffset.split("-")[1])
            date.setTime(date.getTime() - (offset * 60 * 60 * 1000));

        }
        return date
    } catch (error: any) {
        throw new Error(error)
    }
}

    public static async getReportTime(fromDate: Moment | null, toDate: Moment, closingTime: string, applyOpeningHour: boolean, timeOffset: string | null) {
    try {
        let fromHour = Number(closingTime.split(":")[0])
        let fromMin = Number(closingTime.split(":")[1])
        let fromSec = Number(closingTime.split(":")[2])

        if (applyOpeningHour == true) {
            const currentDate = timeOffset ? moment.utc().utcOffset(+ timeOffset) : moment()


            if (currentDate.hour() > 0 && currentDate.hour() < fromHour) {
                fromDate = fromDate ? fromDate.clone().subtract(1, 'day') : null
                toDate = toDate.clone().subtract(1, 'day')
            }
        }
        //set opening hour
        console.log(fromDate)
        if (fromDate) { fromDate.set('hour', fromHour).set('minute', fromMin).set('second', fromSec) }

        toDate.add(1, 'day').set('hour', fromHour).set('minute', fromMin).set('second', fromSec)

        //add one day
        // let from :any = fromDate ? fromDate.clone().toDate() :null
        // let to :any  = toDate.clone().toDate()
        console.log(timeOffset)



        let from = timeOffset && fromDate ? moment.utc(fromDate).utcOffset(-timeOffset).format('YYYY-MM-DD HH:mm:ss') : fromDate;
        let to = timeOffset ? moment.utc(toDate).utcOffset(-timeOffset).format('YYYY-MM-DD HH:mm:ss') : toDate;

        console.log(from, to)


        return { from: from, to: to }
    } catch (error: any) {
        throw new Error(error)
    }
}

    public static async getReportTime2(fromDate: Moment | null, toDate: Moment, closingTime: string, applyOpeningHour: boolean, timeOffset ?: string) {
    try {
        let fromHour = Number(closingTime.split(":")[0])
        let fromMin = Number(closingTime.split(":")[1])
        let fromSec = Number(closingTime.split(":")[3])

        if (applyOpeningHour == true) {
            const currentDate = timeOffset ? moment.utc().utcOffset(+ timeOffset) : moment()
            console.log(currentDate)

            if (currentDate.hour() > 0 && currentDate.hour() < fromHour) {
                fromDate = fromDate ? fromDate.clone().subtract(1, 'day') : null
                toDate = toDate.clone().subtract(1, 'day')
            }
        }
        //set opening hour
        if (fromDate) { fromDate.set('hour', fromHour).set('minute', fromMin).set('minute', fromSec) }

        toDate.add(1, 'day').set('hour', fromHour).set('minute', fromMin).set('minute', fromSec)

        //add one day
        let from: any = fromDate ? fromDate.clone().toDate() : null
        let to: any = toDate.clone().toDate()



        from = timeOffset ? moment.utc(from).utcOffset(- timeOffset).format('YYYY-MM-DD HH:mm:ss') : from;
        to = timeOffset ? moment.utc(to).utcOffset(- timeOffset).format('YYYY-MM-DD HH:mm:ss') : to;

        console.log(from, to)


        return { from: from, to: to }
    } catch (error: any) {
        throw new Error(error)
    }
}

    public static setLinesDate(lineDate: Date | number, invoiceDate: Date) {
    try {


        let tempDate = new Date(invoiceDate)
        let createdAt = new Date(lineDate);
        createdAt.setDate(tempDate.getDate());
        createdAt.setMonth(tempDate.getMonth());
        createdAt.setFullYear(tempDate.getFullYear());
        console.log(createdAt)
        return createdAt;

    } catch (error: any) {
        throw new Error(error)
    }
}

    public static getCreatedAt(selectedDate: Date, userOffset: string) {
    // Normalize offset '+3' to '+03:00'
    let offset = userOffset;
    let hours;
    if (!userOffset.includes(':')) {
        const sign = userOffset.startsWith('-') ? '-' : '+';
        hours = userOffset.replace(/[+-]/, '').padStart(2, '0');
        offset = `${sign}${hours}:00`;
    }

    // Get today's date in user's offset timezone
    const todayInUserTZ = moment().utcOffset(offset).format('YYYY-MM-DD');
    // Format selectedDate to YYYY-MM-DD in user's offset timezone
    const selectedDateInUserTZ = moment(selectedDate).utcOffset(offset).format('YYYY-MM-DD');

    if (selectedDateInUserTZ === todayInUserTZ) {
        // Selected date is today (in user's TZ) — use current UTC time
        return moment.utc().toDate();
    }
    let startOfDayLocal;
    const offsetHours = Number(userOffset);
    if (selectedDateInUserTZ < todayInUserTZ) {

        startOfDayLocal = moment(selectedDate).utcOffset(offsetHours * 60).endOf('day');
    }

    if (selectedDateInUserTZ > todayInUserTZ) {
        startOfDayLocal = moment(selectedDate).utcOffset(offsetHours * 60).startOf('day');
    }

    //         // Convert the selected date to a string date only (ignore time)
    //         const dateString = moment(selectedDate).format('YYYY-MM-DD');

    //         // Combine with time "00:00:00" in local time, then convert to UTC
    //      const year = selectedDate.getFullYear();
    //   const month = selectedDate.getMonth(); // zero-based
    //   const day = selectedDate.getDate();

    // Convert to UTC time
    if (startOfDayLocal) {
        const startOfDayUTC = startOfDayLocal.clone().utc().toString()
        const dateObject = new Date(startOfDayUTC);

        return dateObject
    }
    return moment.utc().toDate();

}
}