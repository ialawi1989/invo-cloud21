import { Invoice } from "@src/models/account/Invoice";
import { PoolClient } from "pg";

import { grubtech } from "@src/Integrations/grubtech/grubtech";
export class InvoicEvents{
    public static async onOrderPrepared(client:PoolClient,invoice:Invoice)
    {
        try {
            if(invoice.aggregatorId!=null && invoice.aggregatorId !=''){
                let GrupTech = new grubtech()
                await GrupTech.orderPrepared(client,invoice.id)
            }
   
        } catch (error:any) {
          
            throw new Error(error)
        }
    }
}