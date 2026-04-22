import { Customer } from "../account/Customer"

export class Reservation{
    id = ''
    customerId:string|null=null
    guests=1
    tableId=""
    note=""
    status = 'Approved'
    reservationDate  = new Date()
    createAt= new Date()
   branchId = ""
   onlineData:any|null = null

   
   phone= ""
   name = ""
   customer:Customer|null;
   constructor()
   {
    this.customer = null
   }
    ParseJson(json:any): void{
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}