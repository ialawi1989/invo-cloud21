// generate-invoice.js
// Usage: node generate-invoice.js [path/to/invoice.json]
// Requires: npm i xmlbuilder2@^3

import { Invoice } from '@src/models/account/Invoice';
import { InvoiceLine } from '@src/models/account/InvoiceLine';
import { Company } from '@src/models/admin/company';
import { InvoiceRepo } from '@src/repo/app/accounts/invoice.repo';
import fs from 'fs'
import path from 'path'
import { lineAnnotation } from 'pdfkit';
import { create } from 'xmlbuilder2'


export async function generateXML(invoiceId: any, company: Company) {
  if (invoiceId) {
    console.log(company);
  } else {
    return false;
  }



  //jofatora dummie
  let jofatora = { "activityNumber": "18028462", "taxNumber": "40273377", "taxName": "مطعم نسمات الكوفية السياحي", "clientId": "47c1718f-06a7-4c68-b78d-a7ebc0a87be1", "secretKey": "Gj5nS9wyYHRadaVffz5VKB4v4wlVWyPhcJvrTD4NHtP9+KWZ+J5/dRksRlN6etoIoEc5vOBkFHSs6S/8iw0Mo0pQaI7u7xa1f1e3xRcx+LfKj/HDfDYXiHwMBFigMcDj0ON08UfEcE7Zeb1A+kc0IhtiFkrd9b2Hs+gR02HqkmSrI+tuGyc5A38OLucl9SU0cTqOElb3fazhHkEhWIX1sCr5bhWeCROsCGFYWWElptyFFROKujRmUNbphvjKoqcpf/mrFxXvqnvCHOlaSvs24w==" }

  const invoiceData: Invoice = (await InvoiceRepo.getInvoiceById(invoiceId, company)).data;
  let data = {
    profileID: "reporting:1.0",
    id: invoiceData?.invoiceNumber || "2K", //رقم الفاتورة *
    uuid: invoiceData?.id || "0043e15e-740b-4e1b-889d-8504afdb1d1d",  //*
    issueDate: invoiceData?.createdAt ? new Date(invoiceData.createdAt).toISOString().split("T")[0] : (new Date()).toISOString().split("T")[0],
    invoiceTypeCode: { code: "388", name: "012" }, // طريقة الدفع ثابت غالبا لانها نقدية **
    note: invoiceData.note || "", // ملاحظة عادية    optional
    documentCurrencyCode: "JOD",
    taxCurrencyCode: "JOD",
    additionalDocuments: [{ id: "ICV", uuid: (Math.floor(Date.now() / 1000)).toString() }], // سيكوانس
    supplier: {
      countryCode: "JO", // لا تغيره
      taxCompanyID: company.jofotara.taxNumber, // الرقم الضريبي للبائع
      registrationName: company.jofotara.taxName // اسم البائع
    },
    customer: {
      partyIdentification: { schemeID: "TN", id: "" }, //optional 
      postalZone: "33554", //optional 
      countrySubentityCode: "JO-AZ", //optional 
      countryCode: "JO",
      taxCompanyID: "1", //optional 
      registrationName: invoiceData.customerName || "invo", //optional 
      accountingContact: { telephone: "324323434" } //optional 
    },
    sellerSupplierParty: { partyIdentificationID: "18028462" }, //not sure furthat investegation needed
    allowanceCharge: {
      chargeIndicator: false, // لا تغيره
      reason: "discount",
      amount: { currencyID: "JO", value: (invoiceData.lines.reduce((sum, line) => sum + (line.discountTotal || 0), 0) || 0).toFixed(3).toString() } //قيمة الخصم من مجموع اللاينز الخصم العام ممنوع
    },
    taxTotal: { taxAmount: { currencyID: "JO", value: (invoiceData.lines.reduce((sum, line) => sum + (line.taxTotal || 0), 0) || 0).toFixed(3).toString() } }, // مجموع الضريبة
    legalMonetaryTotal: {
      taxExclusiveAmount: { currencyID: "JO", value: (invoiceData.isInclusiveTax ? invoiceData.total - invoiceData.invoiceTaxTotal : invoiceData.itemSubTotal).toFixed(3).toString() }, // مجموع )السعر * الكمية(ة
      taxInclusiveAmount: { currencyID: "JO", value: invoiceData.total.toFixed(3).toString() }, //)اجمالي الفاتورة قبل الخصم – مجموع قيمة الخصم + مجموع قيمة الضريبة العامة(
      allowanceTotalAmount: { currencyID: "JO", value: (invoiceData.lines.reduce((sum, line) => sum + (line.discountTotal || 0), 0) || 0).toFixed(3).toString() }, //مجموع قيمة الخصم للسلع و الخدمات
      payableAmount: { currencyID: "JO", value: invoiceData.total.toFixed(3).toString() } // جمالي الفاتورة قبل الخصم – مجموع قيمة الخصم + مجموع قيمة الضريبة العامة
    },


    lines: [] as any[]
  };




  let i = 1;
  invoiceData.lines.forEach((item: InvoiceLine) => {



    let line = {
      id: i, // array index
      invoicedQuantity: { unitCode: "PCE", value: item.qty.toFixed(3).toString() }, // item quantiti
      lineExtensionAmount: { currencyID: "JO", value: (invoiceData.isInclusiveTax ? ((item.price * item.qty) - item.discountTotal - item.taxTotal) : ((item.price * item.qty) - item.discountTotal)).toFixed(3).toString() }, //سعر الوحدة * الكمية – خصم السلعة أو الخدمة
      taxTotal: {
        taxAmount: { currencyID: "JO", value: item.taxTotal.toFixed(3).toString() }, //   الظريبة
        roundingAmount: { currencyID: "JO", value: item.total.toFixed(3).toString() }, // مبلغ السلعة شامل الظريبة
        subtotal: {
          taxAmount: { currencyID: "JO", value: item.taxTotal.toFixed(3).toString() },//   الظريبة
          category: {
            id: { schemeAgencyID: "6", schemeID: "UN/ECE 5305", value: item.taxPercentage > 0 ? "S" : item.taxPercentage === 0 ? "O" : "Z" }, //  غير الفاليو فقط
            percent: item.taxPercentage?.toFixed(3).toString() || "0", // نسبة الظيبة
            scheme: { id: { schemeAgencyID: "6", schemeID: "UN/ECE 5153", value: "VAT" } }
          }
        }
      },
      item: { name: item.productName || item.note }, // اسم الايتم
      price: {
        priceAmount: { currencyID: "JO", value: (invoiceData.isInclusiveTax ? (((item.total + item.discountTotal) - item.taxTotal) / item.qty) : item.price).toFixed(3).toString() }, // سعر الايتم الواحد قبل الظريبة
        allowanceCharge: {
          chargeIndicator: false,
          reason: "DISCOUNT",
          amount: { currencyID: "JO", value: item.discountTotal.toFixed(3).toString() || "0" } // قيمة الخصم
        }
      }
    }
    data.lines.push(line);
    i++;
  });




  // --- 2) Build XML using xmlbuilder2 with proper namespaces and order ---
  const nsInv = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
  const nsCac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
  const nsCbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
  const nsExt = "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2";

  const doc = create({ version: "1.0", encoding: "UTF-8" });
  const inv = doc.ele("Invoice")
    .att("xmlns", nsInv)
    .att("xmlns:cac", nsCac)
    .att("xmlns:cbc", nsCbc)
    .att("xmlns:ext", nsExt);

  // Header
  inv.ele("cbc:ProfileID").txt(data.profileID).up()
    .ele("cbc:ID").txt(data.id).up()
    .ele("cbc:UUID").txt(data.uuid).up()
    .ele("cbc:IssueDate").txt(data.issueDate).up();

  if (data.invoiceTypeCode) {
    inv.ele("cbc:InvoiceTypeCode")
      .att("name", data.invoiceTypeCode.name)
      .txt(data.invoiceTypeCode.code)
      .up();
  }
  if (data.note) inv.ele("cbc:Note").txt(data.note).up();
  if (data.documentCurrencyCode) inv.ele("cbc:DocumentCurrencyCode").txt(data.documentCurrencyCode).up();
  if (data.taxCurrencyCode) inv.ele("cbc:TaxCurrencyCode").txt(data.taxCurrencyCode).up();

  // AdditionalDocumentReference
  if (Array.isArray(data.additionalDocuments)) {
    for (const ad of data.additionalDocuments) {
      const ref = inv.ele("cac:AdditionalDocumentReference");
      ref.ele("cbc:ID").txt(ad.id).up();
      if (ad.uuid) ref.ele("cbc:UUID").txt(ad.uuid).up();
      ref.up();
    }
  }

  // Supplier
  if (data.supplier) {
    const asp = inv.ele("cac:AccountingSupplierParty").ele("cac:Party");
    // PostalAddress -> Country
    const pa = asp.ele("cac:PostalAddress");
    const country = pa.ele("cac:Country");
    country.ele("cbc:IdentificationCode").txt(data.supplier.countryCode).up();
    country.up(); pa.up();

    // PartyTaxScheme
    const pts = asp.ele("cac:PartyTaxScheme");
    pts.ele("cbc:CompanyID").txt(data.supplier.taxCompanyID).up();
    const taxScheme = pts.ele("cac:TaxScheme");
    taxScheme.ele("cbc:ID").txt("VAT").up();
    taxScheme.up(); pts.up();

    // PartyLegalEntity
    const ple = asp.ele("cac:PartyLegalEntity");
    ple.ele("cbc:RegistrationName").txt(data.supplier.registrationName).up();
    ple.up();

    asp.up().up();
  }

  // Customer
  if (data.customer) {
    const acp = inv.ele("cac:AccountingCustomerParty");
    const party = acp.ele("cac:Party");

    if (data.customer.partyIdentification) {
      const pid = party.ele("cac:PartyIdentification");
      pid.ele("cbc:ID")
        .att("schemeID", data.customer.partyIdentification.schemeID)
        .txt(data.customer.partyIdentification.id).up();
      pid.up();
    }

    const paddr = party.ele("cac:PostalAddress");
    // if (data.customer.postalZone) paddr.ele("cbc:PostalZone").txt(data.customer.postalZone).up();
    // if (data.customer.countrySubentityCode) paddr.ele("cbc:CountrySubentityCode").txt(data.customer.countrySubentityCode).up();
    const cc = paddr.ele("cac:Country");
    cc.ele("cbc:IdentificationCode").txt(data.customer.countryCode).up();
    cc.up(); paddr.up();

    const cpts = party.ele("cac:PartyTaxScheme");
    cpts.ele("cbc:CompanyID").txt(data.customer.taxCompanyID).up();
    const cts = cpts.ele("cac:TaxScheme");
    cts.ele("cbc:ID").txt("VAT").up();
    cts.up(); cpts.up();

    const cple = party.ele("cac:PartyLegalEntity");
    cple.ele("cbc:RegistrationName").txt(data.customer.registrationName).up();
    cple.up();

    party.up();

    if (data.customer.accountingContact?.telephone) {
      const acct = acp.ele("cac:AccountingContact");
      // acct.ele("cbc:Telephone").txt(data.customer.accountingContact.telephone).up();
      acct.up();
    }

    acp.up();
  }

  // SellerSupplierParty
  if (data.sellerSupplierParty?.partyIdentificationID) {
    const ssp = inv.ele("cac:SellerSupplierParty").ele("cac:Party");
    const pid = ssp.ele("cac:PartyIdentification");
    pid.ele("cbc:ID").txt(data.sellerSupplierParty.partyIdentificationID).up();
    pid.up(); ssp.up().up();
  }

  // AllowanceCharge (document level)
  if (data.allowanceCharge) {
    const ac = inv.ele("cac:AllowanceCharge");
    ac.ele("cbc:ChargeIndicator").txt(String(!!data.allowanceCharge.chargeIndicator)).up();
    ac.ele("cbc:AllowanceChargeReason").txt(data.allowanceCharge.reason).up();
    ac.ele("cbc:Amount")
      .att("currencyID", data.allowanceCharge.amount.currencyID)
      .txt(data.allowanceCharge.amount.value).up();
    ac.up();
  }

  // TaxTotal (document level)
  if (data.taxTotal) {
    const tt = inv.ele("cac:TaxTotal");
    tt.ele("cbc:TaxAmount")
      .att("currencyID", data.taxTotal.taxAmount.currencyID)
      .txt(data.taxTotal.taxAmount.value).up();
    tt.up();
  }

  // LegalMonetaryTotal
  if (data.legalMonetaryTotal) {
    const lmt = inv.ele("cac:LegalMonetaryTotal");
    lmt.ele("cbc:TaxExclusiveAmount")
      .att("currencyID", data.legalMonetaryTotal.taxExclusiveAmount.currencyID)
      .txt(data.legalMonetaryTotal.taxExclusiveAmount.value).up();
    lmt.ele("cbc:TaxInclusiveAmount")
      .att("currencyID", data.legalMonetaryTotal.taxInclusiveAmount.currencyID)
      .txt(data.legalMonetaryTotal.taxInclusiveAmount.value).up();
    lmt.ele("cbc:AllowanceTotalAmount")
      .att("currencyID", data.legalMonetaryTotal.allowanceTotalAmount.currencyID)
      .txt(data.legalMonetaryTotal.allowanceTotalAmount.value).up();
    lmt.ele("cbc:PayableAmount")
      .att("currencyID", data.legalMonetaryTotal.payableAmount.currencyID)
      .txt(data.legalMonetaryTotal.payableAmount.value).up();
    lmt.up();
  }

  // Invoice Lines
  if (Array.isArray(data.lines)) {
    for (const line of data.lines) {
      const il = inv.ele("cac:InvoiceLine");
      il.ele("cbc:ID").txt(line.id).up();
      il.ele("cbc:InvoicedQuantity")
        .att("unitCode", line.invoicedQuantity.unitCode)
        .txt(line.invoicedQuantity.value).up();
      il.ele("cbc:LineExtensionAmount")
        .att("currencyID", line.lineExtensionAmount.currencyID)
        .txt(line.lineExtensionAmount.value).up();

      if (line.taxTotal) {
        const ltt = il.ele("cac:TaxTotal");
        ltt.ele("cbc:TaxAmount")
          .att("currencyID", line.taxTotal.taxAmount.currencyID)
          .txt(line.taxTotal.taxAmount.value).up();
        if (line.taxTotal.roundingAmount) {
          ltt.ele("cbc:RoundingAmount")
            .att("currencyID", line.taxTotal.roundingAmount.currencyID)
            .txt(line.taxTotal.roundingAmount.value).up();
        }
        if (line.taxTotal.subtotal) {
          const ts = ltt.ele("cac:TaxSubtotal");
          ts.ele("cbc:TaxAmount")
            .att("currencyID", line.taxTotal.subtotal.taxAmount.currencyID)
            .txt(line.taxTotal.subtotal.taxAmount.value).up();
          const cat = ts.ele("cac:TaxCategory");
          cat.ele("cbc:ID")
            .att("schemeAgencyID", line.taxTotal.subtotal.category.id.schemeAgencyID)
            .att("schemeID", line.taxTotal.subtotal.category.id.schemeID)
            .txt(line.taxTotal.subtotal.category.id.value).up();
          cat.ele("cbc:Percent").txt(line.taxTotal.subtotal.category.percent).up();
          const scheme = cat.ele("cac:TaxScheme");
          scheme.ele("cbc:ID")
            .att("schemeAgencyID", line.taxTotal.subtotal.category.scheme.id.schemeAgencyID)
            .att("schemeID", line.taxTotal.subtotal.category.scheme.id.schemeID)
            .txt(line.taxTotal.subtotal.category.scheme.id.value).up();
          scheme.up(); cat.up(); ts.up();
        }
        ltt.up();
      }

      if (line.item) {
        const item = il.ele("cac:Item");
        item.ele("cbc:Name").txt(line.item.name).up();
        item.up();
      }

      if (line.price) {
        const price = il.ele("cac:Price");
        price.ele("cbc:PriceAmount")
          .att("currencyID", line.price.priceAmount.currencyID)
          .txt(line.price.priceAmount.value).up();
        if (line.price.allowanceCharge) {
          const pac = price.ele("cac:AllowanceCharge");
          pac.ele("cbc:ChargeIndicator").txt(String(!!line.price.allowanceCharge.chargeIndicator)).up();
          pac.ele("cbc:AllowanceChargeReason").txt(line.price.allowanceCharge.reason).up();
          pac.ele("cbc:Amount")
            .att("currencyID", line.price.allowanceCharge.amount.currencyID)
            .txt(line.price.allowanceCharge.amount.value).up();
          pac.up();
        }
        price.up();
      }

      il.up();
    }
  }

  // --- 3) Serialize & write file ---
  const xml = doc.end({ prettyPrint: true, newline: "\n" });
  const invoiceBase64 = Buffer.from(xml, 'utf8').toString('base64');
  // const outPath = path.resolve(process.cwd(), "invoice98.xml");
  // fs.writeFileSync(outPath, xml, "utf8");

  const res = await (await fetch('https://backend.jofotara.gov.jo/core/invoices/', {
    method: 'POST',
    headers: {
      'Client-id': company.jofotara.clientId,
      'Secret-Key': company.jofotara.secretKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ invoice: invoiceBase64 })
  })).json();



  console.log(res);

  if (res.EINV_STATUS == "SUBMITTED") {
    return res;
  } else {
    throw (JSON.stringify(res))
  }




}
