import { InventoryMovment } from "@src/models/account/InventoryMovment";
import { InventoryMovmentLine } from "@src/models/account/InventoryMovmentLine";
import { PoolClient } from "pg";





import { InventoryMovmentRepo } from "./inventoryMovment.repo";
import { Helper } from "@src/utilts/helper";
export class ManualAdjusmentRepo {
  public static async manualAdjustmentMovment(client: PoolClient, employeeId: string, unitCost: number, qty: number, branchId: string, currentOnHand: number, currentCost: number, productId: string, afterDecimal: number, type: string, parentChildId: string | null, batch: string | null,lineId:string|null = null,isInvoice=true) {
    try {

      const inventoryMovment = new InventoryMovment();
      inventoryMovment.branchId = branchId;

      // if(totalCost == 0)
      // {
      //   return
      // }


      qty = Helper.roundDecimal(qty, afterDecimal)
      unitCost = Helper.roundDecimal(unitCost, afterDecimal)
      let totalCost = Helper.multiply(unitCost, qty, afterDecimal);
      if (qty > 0)// Increase 
      {
        inventoryMovment.cost = totalCost * (-1) // Cost of Goods Solds Credit => when Increase in OnHand *(-1)
      } else if (qty < 0) { // Decrease 
        inventoryMovment.cost = totalCost * (-1)// Cost of Goods Solds Debit => when Decreased in OnHand
      }


      inventoryMovment.employeeId = employeeId;
      inventoryMovment.type = type;
   
      if(lineId && isInvoice){
        inventoryMovment.invoiceLineId = lineId;
      }else if (lineId && !isInvoice) (
        inventoryMovment.inventoryTransferLineId = lineId
      )
    
      const insertInventoryMovment = await InventoryMovmentRepo.insertMovment(client, inventoryMovment);
      inventoryMovment.id = insertInventoryMovment.id;
      inventoryMovment.createdAt = new Date();
    
      const inventoryMovmentLine = new InventoryMovmentLine();
      inventoryMovmentLine.inventoryMovmentId = inventoryMovment.id;
      inventoryMovmentLine.productId = productId;
      inventoryMovmentLine.currentOnHand = currentOnHand;
      inventoryMovmentLine.currentCost = currentCost;
      inventoryMovmentLine.parentChildId = parentChildId
      if (batch != null) {
        inventoryMovmentLine.batch = batch;
      }

      if (qty > 0)// Increase 
      {
        inventoryMovmentLine.cost = unitCost // Inventory Debit => when Increase in OnHand
        inventoryMovmentLine.qty = qty
        await InventoryMovmentRepo.insertMovmentLine(client, inventoryMovmentLine)
      } else if (qty < 0) {// Decrease 

        inventoryMovmentLine.cost = unitCost * (-1);
        inventoryMovmentLine.qty = qty;
        await InventoryMovmentRepo.insertMovmentLine(client, inventoryMovmentLine) // Inventory Credit  => when Increase in OnHand *(-1)
      }
      return inventoryMovment.id
      // JournalTriggers.inventoryMovmentJournal(client, inventoryMovment.id, branchId)
    } catch (error: any) {
      console.log(error)
    
      throw new Error(error.message)
    }
  }


  public static async serialAndBatchesKitManualAdjusmnets(client: PoolClient, movment: InventoryMovment, afterDecimal: number) {
    try {

      if (movment.lines.length > 0) {
        movment.calculateTotal(afterDecimal);
        const insertInventoryMovment = await InventoryMovmentRepo.insertMovment(client, movment);
        movment.id = insertInventoryMovment.id;

        for (let index = 0; index < movment.lines.length; index++) {
          const element = movment.lines[index];
          element.inventoryMovmentId = movment.id
          element.qty = Helper.roundNum(element.qty,afterDecimal);
          await InventoryMovmentRepo.insertMovmentLine(client, element)
        }
        return movment.id;
        // JournalTriggers.inventoryMovmentJournal(client, movment.id, movment.branchId)
      }
      return null

    } catch (error: any) {
      console.log(error)
      throw new Error(error)
    }
  }
}