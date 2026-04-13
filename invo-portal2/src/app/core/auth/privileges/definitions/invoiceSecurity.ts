import { PrivilegeSetting } from "../models/privilege-setting.model";

export function invoiceSecurity() {
  return new PrivilegeSetting({
    name: "Invoice Security",
    securityType: "common",
    securityGroup: "sales",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add New Invoice",
        securityType: "common",
      }),
      "edit": new PrivilegeSetting({
        name: "Edit Other Employee Invoice",
        securityType: "common",
      }),
      "print": new PrivilegeSetting({
        name: "Print Invoice",
        securityType: "common"
      }),
      "printDeliveryNote": new PrivilegeSetting({
        name: "Print Delivery Note",
        securityType: "common"
      }),
      "openInvoice": new PrivilegeSetting({
        name: "Open Invoice",
        securityType: "common"
      }),
      "pay": new PrivilegeSetting({
        name: "Pay Invoice",
        securityType: "common"
      }),
      "view": new PrivilegeSetting({
        name: "View Invoice",
        securityType: "common"
      }),
      "return": new PrivilegeSetting({
        name: "Return Invoice",
        securityType: "POS",
      }),
      "payOrder": new PrivilegeSetting({
        name: "Pay Order",
        securityType: "POS",
      }),
      "voidTicket": new PrivilegeSetting({
        name: "void Ticket",
        securityType: "common"
      }),

       "voidItem": new PrivilegeSetting({
        name: "Void Invoice Item",
        securityType: "common"
      }),
      "adjPrice": new PrivilegeSetting({
        name: "Adjust Item Price",
        securityType: "POS",
      }),
      "reorder": new PrivilegeSetting({
        name: "Reorder",
        securityType: "POS",
      }),
      "orderReady": new PrivilegeSetting({
        name: "Mark Order As Ready",
        securityType: "POS",
      }),
      "discountOrder": new PrivilegeSetting({
        name: "Apply Discount on Order",
        securityType: "POS",
      }),
      "surchargeOrder": new PrivilegeSetting({
        name: "Apply Surcharge on Order",
        securityType: "POS",
      }),
      "mergeOrders": new PrivilegeSetting({
        name: "Merge Orders",
        securityType: "POS",
      }),
      "splitTicket": new PrivilegeSetting({
        name: "Split Ticket",
        securityType: "POS",
      }),
      "expandedTicket": new PrivilegeSetting({
        name: "Expand Ticket",
        securityType: "POS",
      }),
      "changeServer": new PrivilegeSetting({
        name: "Change Server",
        securityType: "POS",
      }),
      "multiSelection": new PrivilegeSetting({
        name: "Multi Invoice Selections",
        securityType: "POS",
      }),
      "search": new PrivilegeSetting({
        name: "Search Tickets",
        securityType: "POS",
      }),
      "closedOrders": new PrivilegeSetting({
        name: "View Closed Orders",
        securityType: "POS",
      }),

       "pendingOrders": new PrivilegeSetting({
        name: "View Pending Orders",
        securityType: "POS",
      }),
      "writeOff": new PrivilegeSetting({
        name: "Wirte Off Invoices",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Invoices",
        securityType: "cloud",
      }),
      "cashDiscount": new PrivilegeSetting({
        name: "Cash Discount",
        securityType: "POS",
      }),
      "share": new PrivilegeSetting({
        name: "Share Invoice",
        securityType: "cloud",
      }),
      "viewJournals": new PrivilegeSetting({
        name: "View Journals",
        securityType: "cloud",
      }),
    }
  });
}
