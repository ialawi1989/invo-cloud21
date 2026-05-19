export class Reservation {

  id = '';
  customerId = "";
  guests = 1
  tableId = "";
  tableName = "";
  note = "";
  status = 'Approved';
  reservationDate :any = new Date();
  createAt :any = new Date();
  branchId = "";
  branchName = "";
  onlineData: any | null = null;
  phone = "";
  name = "";
  customerName = "";
  customerPhone = "";

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
  
}
