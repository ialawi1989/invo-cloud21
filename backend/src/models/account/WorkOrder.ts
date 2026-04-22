export class WorkOrder {
     id = "";
     status = "Open";
     workOrderNumber = "";
     invoiceId = "";
     note = "";
     expectedStartDate= new Date();
     expectedEndDate= new Date();
     priorty = 0;
     employeeId = "";
     employeeName = "";
     tasks:WorkOrderTask[]=[];
     createdAt = new Date();
     additionalEmployees = [];

     updatedDate = new Date()

     ParseJson(json: any): void {
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
    
  }

  export class WorkOrderTask{
     type = "";
     title = "";
     value = "";
  
     scaleFrom = 1;
     scaleTo = 5;
  
     scaleFromLabel = "";
     scaleToLabel = "";
  
     options:WorkOrderTaskOption[] = [];

  }


  export class WorkOrderTaskOption{
     title = "";
     value = false;
 }
