import { Customer } from "../account/Customer"

export class WaitingList {
    id =""
    ticketNo =""
    name =""
    phone =""
    customerId:string|null = null
    guests =1
    createdAt = new Date()
    queueId =""
    dineInSection =""
    seated =0
    updateTime = new Date()
    branchId= ""
    customer:Customer= new Customer()
    ParseJson(json:any): void{
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}