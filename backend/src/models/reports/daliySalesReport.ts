// import { OpenCashier } from './models/OpenCashier';
import { TenderDetails } from './TenderDetails';
// import { CashierReport } from './models/custom/cashierReport';
import { PaymentBreakdown } from './PaymentBreakdown';
import {CategoryDetails} from './CategoryDetails';
import { OpenOrders } from './openOrders';
import { SalesDetails } from './salesDetails';
import { ServiceDetails } from './serviceDetails';
import { TenderBreakdown } from './TenderBreakdown';


class DailySalesReport {
  from:any = null;
  to :any =null;
  totalGuests: number = 0;
  totalOrders: number = 0;

  sales:{sales:number, return:number} = {sales:0, return:0};
  discount:{sales:number, return:number} = {sales:0, return:0};
  tax:{sales:number, return:number} = {sales:0, return:0};
  total:{sales:number, return:number} = {sales:0, return:0};
  surcharge:{sales:number, return:number} = {sales:0, return:0};
  surchargeTax:{sales:number, return:number} = {sales:0, return:0};
  deliveryCharge:{sales:number, return:number} = {sales:0, return:0};
  rounding:{sales:number, return:number} = {sales:0, return:0};

  // totalSales: number = 0.0;
  // itemDiscount: number = 0.0;
  // totalTax: number = 0.0;
  // netSales: number = 0.0;
  // surchargeTotal: number = 0.0;
  // surchargeTax: number = 0.0;

 // deliveryCharge: number = 0.0;
  discountTotal: number = 0.0;
  

  // totalAdjustment: number = 0.0;
  // itemDiscountAdjustment: number = 0.0; 
  // taxAdjustment: number = 0.0;
  // netAdjustment: number = 0.0;

  // surchargeAdjustment: number = 0.0;
  // surchargeTaxAdjustment: number = 0.0;
  // roundingAdjustment: number = 0.0;
  
  // roundingTotal: number = 0.0;
  notRecievedPayment: number = 0.0;
  totalRefund: number = 0.0;
  totalVoid: number = 0.0;

  tenderDetails: TenderDetails[] = [];
  totalIncomeByTenders: number = 0.0;

  categoryDetails: CategoryDetails[] = [];
  serviceDetails: ServiceDetails[] = [];
  salesDetails: SalesDetails[] = [];
  paymentBreakdown: PaymentBreakdown[] = [];
  taxBreakdown: {id:string,name:string, invoiceTax:number, creditTax:number }[] = [];

  tenderBreakdown: TenderBreakdown[] = [];
  totalPayment: number = 0.0;

  //openOrders: OpenOrders[] = [];
  totalOrdersAmount: number = 0.0;
  totalHouseAccount: number = 0.0;
 
 // cashierReports: CashierReport[] = [];
  //openCashiers: OpenCashier[] = [];

  constructor() {}

  static fromJson(json: any): DailySalesReport {
    const dailySalesReport = new DailySalesReport();
    dailySalesReport.totalOrders = json.totalOrders;
    // dailySalesReport.totalSales = parseFloat(json.totalSales.toString());
    // dailySalesReport.totalTax = parseFloat(json.totalTax.toString());
    // dailySalesReport.itemDiscount = parseFloat(json.itemDiscount.toString());
    // dailySalesReport.netSales = parseFloat(json.netSales.toString());
    // dailySalesReport.roundingTotal = parseFloat(json.roundingTotal.toString());
    
   // dailySalesReport.deliveryCharge = parseFloat(json.deliveryCharge.toString());
    dailySalesReport.discountTotal = parseFloat(json.discountTotal.toString());
    // dailySalesReport.surchargeTotal = parseFloat(json.surchargeTotal.toString());
    // dailySalesReport.surchargeTax = parseFloat(json.surchargeTax.toString());
    dailySalesReport.totalGuests = json.totalGuests;
   
    
    // dailySalesReport.totalAdjustment  = parseFloat(json.totalAdjustment .toString());
    // dailySalesReport.itemDiscountAdjustment  = parseFloat(json.itemDiscountAdjustment .toString());
    // dailySalesReport.taxAdjustment  = parseFloat(json.taxAdjustment .toString());
    // dailySalesReport.netAdjustment  = parseFloat(json.netAdjustment .toString());
    // dailySalesReport.surchargeAdjustment  = parseFloat(json.surchargeAdjustment .toString());
    // dailySalesReport.surchargeTaxAdjustment  = parseFloat(json.surchargeTaxAdjustment .toString());
    // dailySalesReport.roundingAdjustment  = parseFloat(json.roundingAdjustment .toString());

    dailySalesReport.notRecievedPayment = parseFloat(json.notRecievedPayment.toString());
    dailySalesReport.totalRefund = parseFloat(json.totalRefund.toString());
    dailySalesReport.totalVoid = parseFloat(json.totalVoid.toString());
    dailySalesReport.totalOrdersAmount = parseFloat(json.totalOrdersAmount.toString());
    dailySalesReport.totalHouseAccount = parseFloat(json.totalHouseAccount.toString());
    dailySalesReport.tenderDetails = json.tenderDetails;
    dailySalesReport.salesDetails = json.salesDetails;
    dailySalesReport.totalIncomeByTenders = json.totalIncomeByTenders;
    dailySalesReport.categoryDetails = json.categoryDetails;
    dailySalesReport.serviceDetails = json.serviceDetails;
    dailySalesReport.paymentBreakdown = json.paymentBreakdown;
    dailySalesReport.taxBreakdown = json.taxBreakdown;
    dailySalesReport.tenderBreakdown = json.tenderBreakdown;
    dailySalesReport.totalPayment = parseFloat(json.totalPayment.toString());
    //dailySalesReport.cashierReports = json.cashierReports;
    //dailySalesReport.openOrders = json.openOrders;
    //.openCashiers = json.openCashiers;
    return dailySalesReport;
  }


}

export { DailySalesReport };