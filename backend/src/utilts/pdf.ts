import { BufferOptions, Content, TDocumentDefinitions } from "pdfmake/interfaces";
import path from "path";
import * as fs from 'fs';
import PdfPrinter from "pdfmake";
import { DocumentTemplate } from "@src/models/account/Builder";
import { isArray } from "lodash";
// import { rtlText } from "./rtl";

let rootDirectory = path.dirname(__dirname);

if (process.env.NODE_ENV == 'local') {
  rootDirectory = "src";
}
const storagePath = process.env.STORAGE_PATH || "";

function loadFontAsBase64Sync(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString('base64');
}


const [regularFont, boldFont, italicFont, boldItalicFont] = [
  'Amiri-Regular.ttf',
  'Amiri-Bold.ttf',
  'Amiri-Italic.ttf',
  'Amiri-BoldItalic.ttf',
].map(fileName =>
  loadFontAsBase64Sync(path.join(rootDirectory, storagePath, 'fonts', fileName)),
);

//TODO: consider using Lazy<> for the fonts
const fonts = {
  Amiri: {
    normal: Buffer.from(regularFont, 'base64'),
    bold: Buffer.from(boldFont, 'base64'),
    italics: Buffer.from(italicFont, 'base64'),
    bolditalics: Buffer.from(boldItalicFont, 'base64'),
  }
};

export function getPdfDucument(library: "pdfmake" = "pdfmake"): IPdfDocument {
  switch (library) {
    //case "jspdf":
    //return new jsPdfDocument(new jsPDF({ unit: 'mm', compress: true }));
    case "pdfmake":
    default:
      return new PdfMakeDocument(new PdfPrinter(fonts));
  }
}

// Page dimensions in points
const pageSizes: Record<string, { width: number; height: number }> = {
  'A4': { width: 595.28, height: 841.89 },
  'A3': { width: 841.89, height: 1190.55 },
  'A5': { width: 419.53, height: 595.28 },
  'LETTER': { width: 612, height: 792 },
  'LEGAL': { width: 612, height: 1008 }
};

export class PdfMakeDocument implements IPdfDocument {

  private docDefinition: TDocumentDefinitions;
  private currentPageContent: Content[];

  constructor(private printer: PdfPrinter) {
    this.docDefinition = {
      pageSize: 'A4',
      pageMargins: [20, 20, 20, 20],
      content: [],
    };

    this.currentPageContent = this.docDefinition.content as Content[];
  }

  private data?: any;
  setData(data?: any): void {
    this.data = data;
  };

  private template!: DocumentTemplate;
  setTemplate(template: DocumentTemplate): void {
    this.template = template;
  }

  private cmToPoint(cm: any): number {
    return cm * (72 / 2.54);
  }

  private pxToPoint(px: any): number {
    return px * 0.75;
  }

  private static colorToHex(color: string, cssVariables?: Record<string, string>): string {
    const cleaned = color.trim().toLowerCase();

    if (cleaned === "#fff") return "#ffffff";
    if (cleaned === "#000") return "#000000";

    // 0️⃣ Named colors
    const namedColors: Record<string, string> = {
      white: "#ffffff",
      black: "#000000",
      red: "#ff0000",
      blue: "#0000ff",
      green: "#00ff00",
      yellow: "#ffff00",
      cyan: "#00ffff",
      magenta: "#ff00ff",
      gray: "#808080",
      grey: "#808080"
    };
    if (namedColors[cleaned]) return namedColors[cleaned];

    // 1️⃣ Already HEX
    const hexRegex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
    if (hexRegex.test(cleaned)) return cleaned;

    // 🆕 CSS Variable format: rgba(var(--variable), ...)
    if (cleaned.includes("var(--")) {
      // Default Bootstrap CSS variables
      const defaultCssVars: Record<string, string> = {
        "--bs-primary-rgb": "13, 110, 253",
        "--bs-secondary-rgb": "108, 117, 125",
        "--bs-success-rgb": "25, 135, 84",
        "--bs-info-rgb": "13, 202, 240",
        "--bs-warning-rgb": "255, 193, 7",
        "--bs-danger-rgb": "220, 53, 69",
        "--bs-light-rgb": "248, 249, 250",
        "--bs-dark-rgb": "33, 37, 41",
        "--bs-text-opacity": "1",
        "--bs-bg-opacity": "1"
      };

      // Merge provided variables with defaults (provided variables take priority)
      const cssVars = { ...defaultCssVars, ...cssVariables };

      // Extract all CSS variable names
      const varMatches = cleaned.matchAll(/var\((--[^)]+)\)/g);
      let resolvedColor = cleaned;

      for (const match of varMatches) {
        const cssVarName = match[1];
        const cssValue = cssVars[cssVarName];

        if (cssValue === undefined) {
          throw new Error(`CSS variable ${cssVarName} not found. Available variables: ${Object.keys(cssVars).join(", ")}`);
        }

        resolvedColor = resolvedColor.replace(match[0], cssValue);
      }

      // Now parse the resolved color
      // Handle rgba(R, G, B, opacity) format
      if (resolvedColor.startsWith("rgba")) {
        let rgb = resolvedColor.replace(/rgba?/g, "").replace(/[()]/g, "").trim();
        const parts = rgb.split(/[\s,]+/);

        if (parts.length < 3) throw new Error("Invalid RGB value");

        const [r, g, b] = parts.slice(0, 3).map(n => Math.min(255, Math.max(0, parseFloat(n))));
        return "#" + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, "0")).join("");
      }

      // Recursively convert the resolved color
      return this.colorToHex(resolvedColor, cssVariables);
    }

    // 2️⃣ RGB formats
    if (cleaned.startsWith("rgb")) {
      let rgb = cleaned.replace(/rgba?/g, "").replace(/[()]/g, "").trim();
      const parts = rgb.split(/[\s,]+/);

      if (parts.length < 3) throw new Error("Invalid RGB value");

      const [r, g, b] = parts.slice(0, 3).map(n => Math.min(255, Math.max(0, parseInt(n))));
      return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
    }

    // 3️⃣ HSL format (hsl(H, S%, L%))
    if (cleaned.startsWith("hsl")) {
      let hsl = cleaned.replace(/hsla?/g, "").replace(/[()]/g, "").trim();
      const [h, s, l] = hsl.split(/[\s,]+/).map(v => parseFloat(v.replace("%", "")));

      const S = s / 100;
      const L = l / 100;
      const C = (1 - Math.abs(2 * L - 1)) * S;
      const X = C * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = L - C / 2;

      let r = 0, g = 0, b = 0;
      if (h < 60) [r, g, b] = [C, X, 0];
      else if (h < 120) [r, g, b] = [X, C, 0];
      else if (h < 180) [r, g, b] = [0, C, X];
      else if (h < 240) [r, g, b] = [0, X, C];
      else if (h < 300) [r, g, b] = [X, 0, C];
      else[r, g, b] = [C, 0, X];

      const to255 = (v: number) => Math.round((v + m) * 255);
      return "#" + [to255(r), to255(g), to255(b)].map(v => v.toString(16).padStart(2, "0")).join("");
    }

    // 4️⃣ CMYK format (cmyk(C, M, Y, K))
    if (cleaned.startsWith("cmyk")) {
      let cmyk = cleaned.replace(/cmyk/g, "").replace(/[()]/g, "").trim();
      const [c, m, y, k] = cmyk.split(/[\s,]+/).map(n => parseFloat(n) / 100);

      const r = 255 * (1 - c) * (1 - k);
      const g = 255 * (1 - m) * (1 - k);
      const b = 255 * (1 - y) * (1 - k);

      return "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
    }

    throw new Error("Unsupported color format");
  }

  private findInvoiceCustomField(fileds: any[], itemName: string, itemId: string) {
    let field =
      fileds.find(
        (field) => itemName in field || itemId in field
      );

    if (field) {
      return field[Object.keys(field)[0]];
    }
  }

  private setWidths(array: any[]) {
    try {

      if (array.length === 1) {
        array = array.map(m => {
          m.width = '100%'
          return m
        })
      } else {
        const hasDesc = array.find(c => c.key.toLowerCase() === "description");
        const total = 100;
        const descWeight = 50;


        let remaining = total;


        if (hasDesc) {
          let index = array.indexOf(hasDesc);
          array[index].width = `${descWeight}%`
          remaining -= descWeight;
        }

        const others = array.filter((c: any) => c.key.toLowerCase() !== "description");
        const each = remaining / others.length;

        array = array.map(m => {
          if (m.key.toLowerCase() !== "description") {
            m.width = `${each}%`
          }
          return m
        })
      }
      return array
    } catch (error: any) {
      throw new Error(error)
    }
  }

  private formatDateToYMD(input: string | Date): string {
    const date = new Date(input);


    if (isNaN(date.getTime())) {
      console.log("date", date);

      throw new Error('Invalid date');
    }

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // months are 0-based
    const day = date.getUTCDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private static reverseWords(text: string) {
    return text.split(' ').reverse().join(' ');
  }

  private static isArabic(text: string) {
    return /[\u0600-\u06FF]/.test(text);
  }

  private static isArabicText(text: string) {
    return this.isArabic(text) ? this.reverseWords(text) : text;
  }


  async generatePdfBase64(): Promise<string> {
    // use the template and data to fill and configer pdfmake object 
    // let options: BufferOptions | undefined = undefined;

    const builder = this.template;
    const data = this.data;

    //page size
    const pageSize = pageSizes[builder.selectedPaperSize] || pageSizes['A4'];

    const margins = {
      left: this.cmToPoint(Number(builder.margins?.left) || 1.4),
      top: this.cmToPoint(Number(builder.margins?.top) || 1.4),
      right: this.cmToPoint(Number(builder.margins?.right) || 1.4),
      bottom: this.cmToPoint(Number(builder.margins?.bottom) || 2.8)
    };

    let transactionTitle = null
    //transactionData Tax
    transactionTitle = {
      text: data?.isTaxed > 0 ? `Tax ${(data?.data.type).replace(/\b\w/g, (char: string) => char.toUpperCase())}` : (data?.data.type).replace(/\b\w/g, (char: string) => char.toUpperCase()),
      fontSize: builder.headerCustomization.title.size,
      bold: builder.headerCustomization.title.bold,
      alignment: 'right',
      marginBottom: 10,
      color: PdfMakeDocument.colorToHex(builder.headerCustomization.title.color),
      italics: builder.headerCustomization.title.italic,
      decoration: builder.headerCustomization.title.underline ? 'underline' : '',
      lineHeight: 0.6
    }

    //branch custom field
    let branchCustomFieldDefault: any[] = []
    if (data?.transactionData && data?.branchCustomField && data?.transactionData.branchCustomFields) {
      data?.branchCustomField.forEach((b: any) => {
        if (b.isDeleted) {
          return
        }
        let bValue;
        let bField;
        if (isArray(data?.transactionData.branchCustomFields) && data?.transactionData.branchCustomFields.length > 0) {
          const field = data?.transactionData.branchCustomFields.find((f: any) => f.id == b.id)
          bValue = field ? field.value : null
        }
        else {
          bValue = data?.transactionData.branchCustomFields[b.id]
        }
        bField = { title: b.name, value: bValue, size: 12, color: PdfMakeDocument.colorToHex("rgb(73, 80, 87)"), labelColor: PdfMakeDocument.colorToHex("rgb(73, 80, 87)"), show: true, bold: false, italics: false, decoration: '' }
        if (builder.headerCustomization.customFields) {
          const temp = this.findInvoiceCustomField(builder.headerCustomization.customFields, b.name, b.id)
          if (temp) {
            bField.color = PdfMakeDocument.colorToHex(temp.color);
            //bField.labelColor = this.colorToHex(temp.labelColor);
            bField.size = temp.size
            bField.show = temp.show
            bField.bold = temp.bold
            bField.italics = temp.italic
            bField.decoration = temp.underline ? 'underline' : ''
          }
          if (bField.show && bValue) {
            branchCustomFieldDefault.push(bField);
          }
        }
        else {
          if (bValue) {
            branchCustomFieldDefault.push(bField);
          }
        }
      })
    }

    let bCustomField = branchCustomFieldDefault.map((m: any) => {
      return {
        text: [
          { text: m.title + ': ', fontSize: m.size, color: m.labelColor, bold: true, italics: m.italic, decoration: m.decoration },
          { text: m.value, fontSize: m.size, color: m.color, bold: m.bold, italics: m.italic, decoration: m.decoration }
        ],
        alignment: 'right'
      };
    })


    //custom fields
    let defaultCustomField: any[] = []
    if (data?.transactionData) {
      if (data?.customFields && data?.transactionData.customFields) {
        data?.customFields.forEach((c: any) => {
          if (c.isDeleted) {
            return
          }
          let value;
          let cField;

          if (isArray(data?.transactionData.customFields) && data?.transactionData.customFields.length > 0) {
            const field = data?.transactionData.customFields.find((f: any) => f.id == c.id)
            value = field && field.value
          }
          else {
            value = data?.transactionData.customFields[c.id] ? data?.transactionData.customFields[c.id] : c.defaultValue
          }
          cField = { title: c.name, value: value, size: 12, color: PdfMakeDocument.colorToHex("rgb(73, 80, 87)"), labelColor: PdfMakeDocument.colorToHex("rgb(73, 80, 87)"), show: true, position: "firstColumn", bold: false, decoration: '', italic: false }
          if (builder.transactionalDetailsCustomization.customFields) {
            const temp = this.findInvoiceCustomField(builder.transactionalDetailsCustomization.customFields, c.name, c.id);
            if (temp) {
              cField.color = PdfMakeDocument.colorToHex(temp.color)
              //cField.labelColor = this.colorToHex(temp.labelColor)
              cField.size = temp.size
              cField.show = temp.show
              cField.position = temp.position
              cField.bold = temp.bold
              cField.italic = temp.italic
              cField.decoration = temp.underline ? 'underline' : ''
            }

            if (cField.show && value) {
              defaultCustomField.push(cField);
            }
          }
          else {
            if (value) {
              defaultCustomField.push(cField);
            }
          }
        })
      }
    }


    let firstCustomField = defaultCustomField.filter((f: any) => f.position === 'firstColumn').map((m: any) => {
      return {
        text: [
          { text: m.title + ': ', fontSize: m.size, color: m.color, bold: true, italics: m.italic, decoration: m.decoration, lineHeight: 0.6 },
          { text: PdfMakeDocument.isArabicText(m.value), fontSize: m.size, color: m.color, bold: m.bold, italics: m.italic, decoration: m.decoration, lineHeight: 0.6 }
        ],
        margin: [0, 0, 0, 3]
      };
    });

    let secondCustomField = defaultCustomField.filter((f: any) => f.position == 'secondColumn').map((m: any) => {
      return {
        text: [
          { text: m.title + ': ', fontSize: m.size, color: m.color, bold: true, italics: m.italic, decoration: m.decoration, lineHeight: 0.6 },
          { text: PdfMakeDocument.isArabicText(m.value), fontSize: m.size, color: m.color, bold: m.bold, italics: m.italic, decoration: m.decoration, lineHeight: 0.6 }
        ],
        alignment: 'right',
        margin: [0, 0, 0, 3]
      };
    })


    let showedColumns: any[] = [];
    for (let key in builder.tableCustomization) {
      let obj: any = builder.tableCustomization[key];
      if (obj.show && data?.data.tableColumns.find((v: any) => v.value.toLowerCase() == key.toLowerCase())) {
        const clm = data?.data.tableColumns.find((v: any) => v.value.toLowerCase() == key.toLowerCase())
        obj.key = key
        //obj.label = obj.label ? obj.label : clm.name
        obj.label = obj.label ?? clm.name;
        showedColumns.push(obj)
      }
    }


    //table header
    let pdfColumns: any[] = [];
    const widthCol = ['4%', '31%', '8%', '12%', '10%', '10%', '12%', '13%'];
    data?.data.tableColumns.forEach((ele: { value: string, name: string }, index: number) => {
      if (builder && builder.tableCustomization) {
        if (ele.value) {
          const key = ele.value.toLowerCase();
          const columnSettings = showedColumns.find((f: any) => f.key.toLowerCase() == key)
          const indexOfColumn = showedColumns.indexOf(columnSettings);
          const widthValue = widthCol[index]
          let alignment = indexOfColumn == 1 ? 'left' : indexOfColumn == showedColumns.length - 1 ? 'right' : 'center'

          if (columnSettings && columnSettings.show) {
            pdfColumns.push({
              key: key,
              text: columnSettings.label,
              bold: true,
              fillColor: builder.transactionalDetailsCustomization.getTableHeader(data?.data.type).backgroundColor != '' ? PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getTableHeader(data?.data.type).backgroundColor) : '#3c3d3a',
              color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getTableHeader(data?.data.type).color),
              alignment: alignment,
              width: widthValue,
              fontSize: builder.transactionalDetailsCustomization.getTableHeader(data?.data.type).size
            })
          }
        }
      } else {
        const widthValue = widthCol[index]
        let alignment = index == 0 ? 'left' : index == data?.data.tableColumns.length - 1 ? 'right' : 'center'
        pdfColumns.push({ key: ele.value, text: ele.name, bold: true, fillColor: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getTableHeader(data?.data.type).backgroundColor), color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getTableHeader(data?.data.type).color), alignment: alignment, width: widthValue, fontSize: Number(builder.transactionalDetailsCustomization.getTableHeader(data?.data.type).size) })
      }
    })

    let invoiceLines: {
      invoiceId: string | null,
      value: string | null,
      text: string | null,
      code: string | null,
      lineNote: string | null,
      options: any[] | null,
      fontSize: number,
      alignment: string | null,
      margin: any[] | null,
      color: string | null,
      fillColor: string | null,
      isVoided: boolean
    }[] | any[] = [];


    let linesIds: any = new Set();
    data?.transactionData.lines.forEach((d: any, index: number) => {
      linesIds.add(d.id);
      if (data?.transactionData && data?.transactionData.lines && data?.transactionData.lines.length > 0 && builder.transactionalDetailsCustomization.getTableLines(data?.data.type).show) {
        const columnKeys = data?.data.tableColumns.map((val: any) => val.value);
        columnKeys.forEach((el: any) => {

          let dataType: any;
          let textValue: any;
          let keyValue: any;
          switch (el) {
            case 'description':
              if (d.productName) {
                keyValue = "productName"
                dataType = "text"
              }
              else if (d.note) {
                keyValue = "note"
                dataType = "text"
              }
              else {
                keyValue = "name"
                dataType = "product"
              }
              break;
            case 'product':
              keyValue = "name"
              dataType = "product"
              break;
            case 'taxPercantage':
              keyValue = "taxPercentage";
              dataType = "%"
              break;
            case 'tax':
              keyValue = "taxTotal";
              dataType = "number"
              break;
            case 'discount':
              keyValue = "discountAmount"
              dataType = "number"
              break;
            case 'qty':
              keyValue = "qty";
              dataType = "qty"
              break;
            case 'price':
              if (d.price || d.price == 0) {
                keyValue = "price";
              }
              else {
                keyValue = "unitCost";
              }
              dataType = "number"
              break;
            case 'uom':
              keyValue = "UOM"
              dataType = "text"
              break;
            case 'unitCost':
              keyValue = "unitCost";
              dataType = "number"
              break;
            case 'total':
              keyValue = "total";
              dataType = "number"
              break;
            case 'amount':
              keyValue = "total";
              dataType = "number"
              break;
            case 'expense':
              keyValue = "accountName";
              dataType = "text"
              break;
            case 'invoiceNumber':
              keyValue = "invoiceNumber";
              dataType = "text"
              break;
            case 'paidOn':
              keyValue = "createdAt";
              dataType = "date"
              break;
            case 'invoiceAmount':
              keyValue = "total";
              dataType = "number"
              break;
            case 'paymentAmount':
              keyValue = "amount";
              dataType = "number"
              break;
            case 'issueDate':
              keyValue = "billingDate";
              dataType = "date"
              break;
            case 'billingNumber':
              keyValue = "billingNumber";
              dataType = "text"
              break;
            case 'reference':
              keyValue = "reference";
              dataType = "text"
              break;
            case 'assessambleValue':
              keyValue = "unitCost";
              dataType = "assessambleValue"
              break;
            case 'customDutyAdditionalCharges':
              keyValue = "customDuty";
              dataType = "number"
              break;
            case 'taxableAmount':
              keyValue = "taxableAmount";
              dataType = "number"
              break;
            case 'order':
              keyValue = Number(index + 1)
              dataType = "order"
              break;
            default:
              textValue = el;
              dataType = "number"
              break;
          }

          if (dataType == "number") {
            textValue = Number(d[keyValue]).toFixed(data?.company.afterDecimal)
          }
          else if (dataType == "%") {
            textValue = d[keyValue] + `%`
          }
          else if (dataType == "product") {
            textValue = d.selectedItem[keyValue]
          }
          else if (dataType == 'date') {
            textValue = d[keyValue] ? this.formatDateToYMD(d[keyValue]) : ''
          }
          else if (dataType == 'assessambleValue') {
            textValue = ((d['unitCost'] * d.qty) - (d['billDiscount'] + d['discountTotal']));
          }
          else if (dataType == 'order') {
            textValue = keyValue
          }
          else {
            textValue = d[keyValue]
          }

          invoiceLines.push({
            invoiceId: d.id,
            value: el,
            text: textValue,
            code: builder.transactionalDetailsCustomization.barcode.show && d.selectedItem && d.selectedItem.barcode ? d.selectedItem.barcode : builder.transactionalDetailsCustomization.barcode.show && d.barcode ? d.barcode : null,
            options: d.options || [],
            lineNote: d.note ? d.note : null,
            alignment: 'center',
            margin: [0, 5, 0, 0],
            fontSize: Number(builder.transactionalDetailsCustomization.getTableLines(data?.data.type).size),
            color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getTableLines(data?.data.type).color),
            fillColor: builder.transactionalDetailsCustomization.getTableLines(data?.data.type).backgroundColor != '' ? PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getTableLines(data?.data.type).backgroundColor) : '',
            isVoided: false
          })

          if (d.isVoided && builder.transactionalDetailsCustomization.invoicVoidedLines.show) {
            d.voidedItems.forEach((v: any) => {

              if (dataType == "number") {
                textValue = v[keyValue].toFixed(data?.company.afterDecimal)
              }
              else if (dataType == "%") {
                textValue = v[keyValue] + `%`
              }
              else if (dataType == 'order') {
                textValue = keyValue
              }
              else {
                textValue = v[keyValue]
              }

              invoiceLines.push({
                invoiceId: v.id,
                value: el,
                text: textValue,
                code: builder.transactionalDetailsCustomization.barcode.show ? d.selectedItem.barcode : null,
                options: d.options || [],
                lineNote: null,
                alignment: 'center',
                margin: [0, 5, 0, 0],
                fontSize: Number(builder.transactionalDetailsCustomization.invoicVoidedLines.size),
                color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.invoicVoidedLines.color),
                fillColor: builder.transactionalDetailsCustomization.invoicVoidedLines.backgroundColor != '' ? PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.invoicVoidedLines.backgroundColor) : '',
                isVoided: true
              })
              linesIds.add(v.id);
            })
          }
        })
      }
    })


    //table lines
    let keysToKeep = pdfColumns.map((col: any) => col.key.toLowerCase());

    let filterColumn = invoiceLines.filter((c: any) => keysToKeep?.includes(c.value.toLowerCase()) || (c.value.selectedItem && c.value.selectedItem.barcode)).map((line: any) => {
      const temp = pdfColumns.find((f: any) => f.key.toLowerCase() == line.value.toLowerCase())
      if (temp) {
        line.alignment = temp.alignment
        return line
      }
    });


    if (pdfColumns.length != widthCol.length) {
      pdfColumns = this.setWidths(pdfColumns)
    }

    //table lines + voided lines
    let stackItems: any[];

    linesIds = [...linesIds]
    const dataRows = linesIds.map((id: any) => {
      const temp = filterColumn.filter((p: any) => p.invoiceId == id);
      return temp.map((col: any) => {
        const barcode = col.code;
        const options = col.options || [];
        const lineNote = col.lineNote
        if ((col.value.toLowerCase() !== 'description' && col.value.toLowerCase() !== 'product') || (col.isVoided)) {
          return {
            fillColor: col.isVoided ? (col.fillColor == col.color ? '#eff2f7' : col.fillColor) : (col.fillColor == col.color ? '#ffffff' : col.fillColor),
            text: PdfMakeDocument.isArabicText(col.text),
            fontSize: col.fontSize,
            alignment: col.alignment || 'left',
            color: col.color,
            margin: [0, 5, 0, 0],
          }
        }

        stackItems = [
          {
            text: PdfMakeDocument.isArabicText(col.text),
            fontSize: col.fontSize,
            color: col.color,
            lineHeight: 0.8,
            margin: [0, 5, 0, 0],
            fillColor: col.fillColor == col.color ? '#ffffff' : col.fillColor
          }
        ];

        if (barcode && !col.isVoided) {

          stackItems.push({
            table: {
              widths: ['auto'],
              body: [
                [
                  {
                    text: PdfMakeDocument.isArabicText(col.code),
                    fontSize: builder.transactionalDetailsCustomization.barcode.size,
                    color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.barcode.color) ===
                      (
                        builder.transactionalDetailsCustomization.barcode.backgroundColor !== ''
                          ? PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.barcode.backgroundColor)
                          : PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.barcode.color)
                      )
                      ? '#000000ff'
                      : PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.barcode.color),
                    bold: builder.transactionalDetailsCustomization.barcode.bold,
                    italics: builder.transactionalDetailsCustomization.barcode.italic,
                    decoration: builder.transactionalDetailsCustomization.barcode.underline ? 'underline' : '',
                    fillColor: builder.transactionalDetailsCustomization.barcode.backgroundColor != '' ? PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.barcode.backgroundColor) : '#ffffff',
                    border: [false, false, false, false],
                    margin: [5, -5, 5, -5],
                  }
                ]
              ]
            },
            layout: 'noBorders',
            margin: [0, 2, 0, 0],
          })
        }

        if (options && options.length > 0 && !col.isVoided) {
          options.forEach((opt: any) => {
            const priceText = opt.price && opt.price !== 0 ? ` (${opt.price.toFixed(data?.company.afterDecimal)})` : '';
            const optionText = `${PdfMakeDocument.isArabicText(opt.optionName ?? opt.note)}${priceText}`;

            stackItems.push({
              table: {
                widths: ['auto'],
                body: [
                  [
                    {
                      text: optionText,
                      fontSize: Number(builder.transactionalDetailsCustomization.options.size) - 2,
                      color: '#fff',
                      fillColor: '#50a5f1',
                      border: [false, false, false, false],
                      margin: [5, -3, 5, -3],
                    }
                  ]
                ]
              },
              layout: 'noBorders',
              margin: [0, 2, 0, 0],
            });
          });
        }

        if (lineNote && !col.isVoided) {


          stackItems.push({

            text: PdfMakeDocument.isArabicText(col.lineNote),
            fontSize: col.fontSize - 3,
            color: col.color,
            border: [false, false, false, false],
            margin: [5, 0, 5, -5],
            lineHeight: 0.7,
            noWrap: false,


          });
        }

        return { stack: stackItems, fillColor: col.fillColor == col.color ? '#ffffff' : col.fillColor };
      });
    });


    let visibleItemstotal = [
      {
        label: 'Products Total',
        text: data?.total.itemTotal,
        color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.itemTotal.color),
        fontSize: builder.totalSectionCustomization.totalTable.itemTotal.size,
        labelColor: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.itemTotal.labelColor),
        bold: builder.totalSectionCustomization.totalTable.itemTotal.bold,
        italics: builder.totalSectionCustomization.totalTable.itemTotal.italic,
        decoration: builder.totalSectionCustomization.totalTable.itemTotal.underline ? 'underline' : ''
      },
      { label: 'Tax Total', text: data?.total.taxTotal, color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.taxTotal.color), fontSize: builder.totalSectionCustomization.totalTable.taxTotal.size, labelColor: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.taxTotal.labelColor), bold: builder.totalSectionCustomization.totalTable.taxTotal.bold, italics: builder.totalSectionCustomization.totalTable.taxTotal.italic, decoration: builder.totalSectionCustomization.totalTable.taxTotal.underline ? 'underline' : '' },
      { label: 'Duty + Additional Charges', text: data?.total.customDutyTotal, color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.customDutyTotal.color), fontSize: builder.totalSectionCustomization.totalTable.customDutyTotal.size, labelColor: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.customDutyTotal.labelColor), bold: builder.totalSectionCustomization.totalTable.customDutyTotal.bold, italics: builder.totalSectionCustomization.totalTable.customDutyTotal.italic, decoration: builder.totalSectionCustomization.totalTable.customDutyTotal.underline ? 'underline' : '' },
      { label: 'Sub Total', text: data?.total.subTotal, color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.subTotal.color), fontSize: Number(builder.totalSectionCustomization.totalTable.subTotal.size), labelColor: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.subTotal.labelColor), bold: builder.totalSectionCustomization.totalTable.subTotal.bold, italics: builder.totalSectionCustomization.totalTable.subTotal.italic, decoration: builder.totalSectionCustomization.totalTable.subTotal.underline ? 'underline' : '' },
      { label: 'Discount', text: data?.total.discount, color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.discount.color), fontSize: builder.totalSectionCustomization.totalTable.discount.size, labelColor: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.discount.labelColor), bold: builder.totalSectionCustomization.totalTable.discount.bold, italics: builder.totalSectionCustomization.totalTable.discount.bold, decoration: builder.totalSectionCustomization.totalTable.discount.underline ? 'underline' : '' },
      { label: 'Charge', text: data?.total.charge, color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.charge.color), fontSize: builder.totalSectionCustomization.totalTable.charge.size, labelColor: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.charge.labelColor), bold: builder.totalSectionCustomization.totalTable.charge.bold, italics: builder.totalSectionCustomization.totalTable.charge.italic, decoration: builder.totalSectionCustomization.totalTable.charge.underline ? 'underline' : '' },
      { label: 'Delivery charge', text: data?.total.delivery, color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.delevary.color), fontSize: builder.totalSectionCustomization.totalTable.delevary.size, labelColor: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.delevary.labelColor), bold: builder.totalSectionCustomization.totalTable.delevary.bold, italics: builder.totalSectionCustomization.totalTable.delevary.italic, decoration: builder.totalSectionCustomization.totalTable.delevary.underline ? 'underline' : '' },
      { label: 'Rounding', text: data?.total.rounding, color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.roundingTotal.color), fontSize: Number(builder.totalSectionCustomization.totalTable.roundingTotal.size), labelColor: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.roundingTotal.labelColor), bold: builder.totalSectionCustomization.totalTable.roundingTotal.bold, italics: builder.totalSectionCustomization.totalTable.roundingTotal.italic, decoration: builder.totalSectionCustomization.totalTable.roundingTotal.underline ? 'underline' : '' },
      { label: 'Bank Charge', text: data?.total.bankCharge, color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.bankCharge.color), fontSize: Number(builder.totalSectionCustomization.totalTable.bankCharge.size), labelColor: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.bankCharge.labelColor), bold: builder.totalSectionCustomization.totalTable.bankCharge.bold, italics: builder.totalSectionCustomization.totalTable.bankCharge.italic, decoration: builder.totalSectionCustomization.totalTable.bankCharge.underline ? 'underline' : '' },
      { label: 'Change Amount', text: data?.total.changeAmount, color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.changeAmount.color), fontSize: Number(builder.totalSectionCustomization.totalTable.changeAmount.size), labelColor: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.changeAmount.labelColor), bold: builder.totalSectionCustomization.totalTable.changeAmount.bold, italics: builder.totalSectionCustomization.totalTable.changeAmount.italic, decoration: builder.totalSectionCustomization.totalTable.changeAmount.underline ? 'underline' : '' },
      { label: 'Total', text: data?.total.total, color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.Total.color), fontSize: Number(builder.totalSectionCustomization.totalTable.Total.size), labelColor: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.totalTable.Total.labelColor), bold: builder.totalSectionCustomization.totalTable.Total.bold, italics: builder.totalSectionCustomization.totalTable.Total.italic, decoration: builder.totalSectionCustomization.totalTable.Total.underline ? 'underline' : '' }
    ].filter(item => item.text !== null && item.text !== '');


    //payment section
    let paymentSection: any;
    let paymentMethodsLabels: any[] = [];
    let paymentMethodsNames: any;

    if (builder.totalSectionCustomization.paymentTable.show) {

      //payment details 
      let paymentType: any;
      let paydetails: any[] = []

      if (builder.totalSectionCustomization.paymentTable.paymentMethods.show && data?.transactionData.invoicePayments) {
        data?.transactionData.invoicePayments.forEach((p: any) => {
          paymentType = { title: p.paymentMethodName, value: p.amount.toFixed(data?.company.afterDecimal), refNum: p.referenceNumber, size: 10, color: PdfMakeDocument.colorToHex("rgb(73, 80, 87)"), labelColor: PdfMakeDocument.colorToHex("rgb(73, 80, 87)"), show: true, bold: false, underline: '', italics: false }
          //payment.paymentDetails.label = p.paymentMethodName ? p.paymentMethodName : null

          paymentType.size = builder.totalSectionCustomization.paymentTable.paymentMethods.size
          paymentType.color = PdfMakeDocument.colorToHex(builder.totalSectionCustomization.paymentTable.paymentMethods.color)
          paymentType.labelColor = PdfMakeDocument.colorToHex(builder.totalSectionCustomization.paymentTable.paymentMethods.labelColor)
          paymentType.show = builder.totalSectionCustomization.paymentTable.paymentMethods.show
          paymentType.bold = builder.totalSectionCustomization.paymentTable.paymentMethods.bold
          paymentType.italics = builder.totalSectionCustomization.paymentTable.paymentMethods.italic
          paymentType.underline = builder.totalSectionCustomization.paymentTable.paymentMethods.underline

          paydetails.push(paymentType)

        })

        paymentMethodsLabels = paydetails.map((m: any) => {
          return (
            {
              text: [
                { text: m.title, fontSize: m.size, color: m.labelColor, bold: m.bold, italics: m.italics, underline: m.underline },
                { text: 'Ref#' + m.refNum, fontSize: (m.size - 2), color: m.labelColor },
              ], size: m.size
            }
          )
        })

        paymentMethodsNames = paydetails.map((m: any) => {
          return ({ text: data?.company.currencySymbol + ' ' + m.value, fontSize: m.size, color: m.color, bold: m.bold, italics: m.italics, underline: m.underline, alignment: 'right', margin: [0, 0, 16, 4] })
        })

      }

      const paymentTableBody = [
        // Payment Made
        data?.payment.paymentMade && builder.totalSectionCustomization.paymentTable.payments.show
          ? [
            {
              text: 'Payment Made',
              fontSize: builder.totalSectionCustomization.paymentTable.payments.size,
              color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.paymentTable.payments.labelColor),
              bold: builder.totalSectionCustomization.paymentTable.payments.bold,
              italics: builder.totalSectionCustomization.paymentTable.payments.italic,
              decoration: builder.totalSectionCustomization.paymentTable.payments.underline
                ? "underline"
                : "",
              fillColor: null,
              //margin: [0, 0, 0, 3],
              lineHeight: 0.3,
            },
            {
              text: data?.payment.paymentMade,
              fontSize: builder.totalSectionCustomization.paymentTable.payments.size,
              color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.paymentTable.payments.color),
              bold: builder.totalSectionCustomization.paymentTable.payments.bold,
              italics: builder.totalSectionCustomization.paymentTable.payments.italic,
              decoration: builder.totalSectionCustomization.paymentTable.payments.underline
                ? "underline"
                : "",
              alignment: "right",
              fillColor: null,
              lineHeight: 0.3,
              //margin: [0, 0, 0, 3],
            },
          ]
          : null,
        // refundDue
        data?.payment.refundDue && builder.totalSectionCustomization.paymentTable.refundDue.show
          ? [
            {
              text: 'refund Due',
              fontSize: builder.totalSectionCustomization.paymentTable.refundDue.size,
              color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.paymentTable.refundDue.labelColor),
              bold: builder.totalSectionCustomization.paymentTable.refundDue.bold,
              italics: builder.totalSectionCustomization.paymentTable.refundDue.italic,
              decoration: builder.totalSectionCustomization.paymentTable.refundDue.underline
                ? "underline"
                : "",
              fillColor: null,
              //margin: [0, 0, 0, 3],
              lineHeight: 0.3,
            },
            {
              text: data?.payment.refundDue,
              fontSize: builder.totalSectionCustomization.paymentTable.refundDue.size,
              color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.paymentTable.refundDue.color),
              bold: builder.totalSectionCustomization.paymentTable.refundDue.bold,
              italics: builder.totalSectionCustomization.paymentTable.refundDue.italic,
              decoration: builder.totalSectionCustomization.paymentTable.refundDue.underline
                ? "underline"
                : "",
              alignment: "right",
              fillColor: null,
              lineHeight: 0.3,
              //margin: [0, 0, 0, 3],
            },
          ]
          : null,

        // Credit row
        data?.payment.credit && builder.totalSectionCustomization.paymentTable.credit.show
          ? [
            {
              text: 'Credit Applied',
              fontSize: builder.totalSectionCustomization.paymentTable.credit.size,
              color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.paymentTable.credit.labelColor),
              bold: builder.totalSectionCustomization.paymentTable.credit.bold,
              italics: builder.totalSectionCustomization.paymentTable.credit.italic,
              decoration: builder.totalSectionCustomization.paymentTable.credit.underline
                ? "underline"
                : "",
              fillColor: null,
              lineHeight: 0.3,
              //margin: [0, 0, 0, 3],
            },
            {
              text: data?.payment.credit,
              fontSize: builder.totalSectionCustomization.paymentTable.credit.size,
              color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.paymentTable.credit.color),
              bold: builder.totalSectionCustomization.paymentTable.credit.bold,
              italics: builder.totalSectionCustomization.paymentTable.credit.italic,
              decoration: builder.totalSectionCustomization.paymentTable.credit.underline
                ? "underline"
                : "",
              alignment: "right",
              fillColor: null,
              lineHeight: 0.3,
              //margin: [0, 0, 0, 3],
            },
          ]
          : null,

        // Dynamic Payment Methods
        ...(paymentMethodsLabels && paymentMethodsLabels.length && paymentMethodsLabels.length > 0
          ? paymentMethodsLabels.map((p: any, idx: any) => {
            if (!paymentMethodsNames[idx]) return null;
            const labelText = p.text[0].text;
            const refText = p.text[1].text;
            const value = paymentMethodsNames[idx].text;

            return [
              {
                stack: [
                  {
                    text: labelText,
                    fontSize: p.text[0].fontSize,
                    color: p.text[0].color,
                    bold: p.text[0].bold,
                    italics: p.text[0].italics,
                    lineHeight: 0.4,
                    margin: [0, 0, 0, 3],
                  },
                  {
                    text: refText,
                    fontSize: p.text[1].fontSize,
                    color: p.text[1].color,
                    lineHeight: 0.5,
                    bold: p.text[0].bold,
                  },
                ],
                fillColor: null,
              },
              {
                text: value,
                fontSize: paymentMethodsNames[idx].fontSize,
                color: paymentMethodsNames[idx].color,
                bold: paymentMethodsNames[idx].bold,
                italics: paymentMethodsNames[idx].italics,
                alignment: "right",
                lineHeight: 0.3,
                fillColor: null,
                //margin: [0, 0, 0, 3]
              },
            ];
          })
          : []),

        // Balance row
        data?.payment.balance && builder.totalSectionCustomization.paymentTable.balance.show
          ? [
            {
              text: 'Balance',
              fontSize: builder.totalSectionCustomization.paymentTable.balance.size,
              color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.paymentTable.balance.labelColor),
              bold: builder.totalSectionCustomization.paymentTable.balance.bold,
              italics: builder.totalSectionCustomization.paymentTable.balance.italic,
              lineHeight: 0.3,
              decoration: builder.totalSectionCustomization.paymentTable.balance.underline
                ? "underline"
                : "",
              fillColor: null,
              //margin: [0, 0, 0, 3]
            },
            {
              text: data?.payment.balance,
              fontSize: builder.totalSectionCustomization.paymentTable.balance.size,
              color: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.paymentTable.balance.color),
              bold: builder.totalSectionCustomization.paymentTable.balance.bold,
              italics: builder.totalSectionCustomization.paymentTable.balance.italic,
              decoration: builder.totalSectionCustomization.paymentTable.balance.underline
                ? "underline"
                : "",
              alignment: "right",
              lineHeight: 0.3,
              fillColor: null,
              //margin: [0, 0, 0, 3]
            },
          ]
          : null,
      ].filter((row) => row !== null && row !== undefined);

      paymentSection =
        builder.totalSectionCustomization.paymentTable.show && paymentTableBody.length > 0
          ? {
            columns: [
              { width: "50%", text: "" },
              {
                width: "50%",
                table: {
                  widths: ["50%", "50%"],
                  body: paymentTableBody,
                },
                layout: {
                  hLineWidth: (i: any, node: any) => {
                    return (i === 0 || i === node.table.body.length) ? 1 : 0;
                  },
                  vLineWidth: (i: any, node: any) => {
                    return (i === 0 || i === node.table.widths?.length) ? 1 : 0;
                  },
                  vLineColor: () => '#eff2f7',
                  hLineColor: () => '#eff2f7',
                  fillColor: PdfMakeDocument.colorToHex(builder.totalSectionCustomization.paymentTable.backgroundColor),
                  paddingLeft: () => 13,
                  paddingRight: () => 13,
                  paddingTop: () => 6,
                  paddingBottom: (rowIndex: any, node: any) => {
                    const isLastRow = rowIndex === node.table.body.length - 1;
                    return isLastRow ? 15 : 6;
                  },

                },
              },
            ],
            margin: [0, 0, 0, 15],
            unbreakable: true,
          }
          : null;

    }


    //customer note section
    let noteSection =
      data?.transactionData.note && data?.transactionData.note != ''
        ? {
          columns: [
            {
              width: "100%",
              table: {
                widths: ["100%"],
                body: [
                  [
                    {
                      text: data?.transactionData.note,//rtlText(noteText),
                      fontSize: Number(builder.footerCustomization.customerNote.size),
                      color: PdfMakeDocument.colorToHex(builder.footerCustomization.customerNote.color),
                      alignment: builder.footerCustomization.customerNote.alignment,
                      bold: builder.footerCustomization.customerNote.bold,
                      italics: builder.footerCustomization.customerNote.italic,
                      lineHeight: 0.8,
                      decoration: builder.footerCustomization.customerNote.underline ? "underline" : "",
                    }
                  ]
                ]
              },

              layout: {
                hLineWidth: (i: any, node: any) => (i === 0 || i === node.table.body.length) ? 1 : 0,
                vLineWidth: (i: any, node: any) => (i === 0 || i === node.table.widths.length) ? 1 : 0,
                hLineColor: () => "#D0E8F0",
                vLineColor: () => "#D0E8F0",
                fillColor: () => "#E8F4F8",
                paddingLeft: () => 16,
                paddingRight: () => 16,
                paddingTop: () => 8,
                paddingBottom: () => 8,
              },
            }
          ],
          margin: [0, 15, 0, 25],
          unbreakable: true
        }
        : null;


    if (builder.footerCustomization.visibility.visible && builder.footerCustomization.term.show) {
      margins.bottom = 9 * Number(builder.footerCustomization.term.size)
      if (data?.footer.term == '') {
        margins.bottom = Number(builder.footerCustomization.term.size) * 4
      }
    }

    if (!builder.footerCustomization.visibility.visible) {
      margins.bottom = this.pxToPoint(builder.footerCustomization.visibility.height)
    }

    const companyLogo = data.logo ? data.logo : null;
    const docDefinition: TDocumentDefinitions = {
      pageSize: builder.selectedPaperSize == 'A4' ? 'A4' : builder.selectedPaperSize == 'A5' ? 'A5' : 'LETTER',
      pageMargins: [margins.left, margins.top, margins.right, margins.bottom],
      pageOrientation: builder.selectedPaperOrientation == 'portrait' ? 'portrait' : 'landscape',
      defaultStyle: { font: 'Amiri' },
      background: function (currentPage: any, pageSize: any) {
        return {
          canvas: [
            {
              type: 'rect',
              x: 0,
              y: 0,
              w: pageSize.width, // full width of page
              h: pageSize.height, // full height of page
              color: PdfMakeDocument.colorToHex(builder.BackgroundColor)
            }
          ]
        };
      },
      content: [
        // Header Section
        {
          columns: [
            // Left side - Logo
            builder.headerCustomization.visibility.visible ? {
              width: '40%',
              stack: [
                builder.headerCustomization.logo.show && data?.logo ?
                  {
                    image: companyLogo ?? '',
                    width: this.pxToPoint(builder.headerCustomization.logo.width),
                    height: this.pxToPoint(builder.headerCustomization.logo.height),
                    margin: [0, 0, 0, 10]
                  } : null,

                builder.headerCustomization.companyName.show && data?.companyName ?
                  {
                    text: PdfMakeDocument.isArabicText(data?.companyName),
                    fontSize: builder.headerCustomization.companyName.size,
                    color: PdfMakeDocument.colorToHex(builder.headerCustomization.companyName.color),
                    bold: builder.headerCustomization.companyName.bold,
                    italics: builder.headerCustomization.companyName.italic,
                    lineHeight: 0.8,
                    decoration: builder.headerCustomization.companyName.underline ? 'underline' : ''
                  } : null,

                {
                  text: [
                    {
                      text: 'Vat Number: ',
                      fontSize: builder.headerCustomization.vatNumber.size,
                      color: PdfMakeDocument.colorToHex(builder.headerCustomization.vatNumber.labelColor),
                      bold: true,
                      alignment: 'left',
                      italics: builder.headerCustomization.vatNumber.italic,
                      lineHeight: 0.8,
                      decoration: builder.headerCustomization.vatNumber.underline ? 'underline' : ''
                    },
                    {
                      text: data?.company.vatNumber,
                      fontSize: builder.headerCustomization.vatNumber.size,
                      color: PdfMakeDocument.colorToHex(builder.headerCustomization.vatNumber.color),
                      alignment: 'left',
                      bold: builder.headerCustomization.vatNumber.bold,
                      italics: builder.headerCustomization.vatNumber.italic,
                      lineHeight: 0.8,
                      decoration: builder.headerCustomization.vatNumber.underline ? 'underline' : ''
                    }
                  ],
                }
              ].filter(item => item !== null && item !== undefined)
            } : null,
            // Middle - empty space
            builder.headerCustomization.visibility.visible ? {
              width: '30%',
              text: ''
            } : null,
            // Right side - Tax Invoice Title + Branch information
            builder.headerCustomization.visibility.visible ? {
              width: '30%',
              stack: [
                { ...transactionTitle, text: transactionTitle.text },

                builder.headerCustomization.name.show && data?.transactionData.branchName ?
                  {
                    text:
                      [
                        { text: 'Branch: ', fontSize: builder.headerCustomization.name.size, lineHeight: 0.6, color: PdfMakeDocument.colorToHex(builder.headerCustomization.name.labelColor), bold: true, italics: builder.headerCustomization.name.italic, decoration: builder.headerCustomization.name.underline ? 'underline' : '' },
                        { text: PdfMakeDocument.isArabicText(data?.transactionData.branchName), fontSize: builder.headerCustomization.name.size, lineHeight: 0.6, color: PdfMakeDocument.colorToHex(builder.headerCustomization.name.color), bold: builder.headerCustomization.name.bold, italics: builder.headerCustomization.name.italic, decoration: builder.headerCustomization.name.underline ? 'underline' : '' }

                      ],
                    alignment: 'right',
                    margin: [0, 0, 0, 3]
                  } : null,

                builder.headerCustomization.address.show && data?.transactionData.branchAddress ?
                  {
                    text: [
                      { text: 'Branch Address: ', fontSize: builder.headerCustomization.address.size, lineHeight: 0.6, color: PdfMakeDocument.colorToHex(builder.headerCustomization.address.labelColor), bold: true, italics: builder.headerCustomization.address.italic, decoration: builder.headerCustomization.address.underline ? 'underline' : '' },
                      { text: PdfMakeDocument.isArabicText(data?.transactionData.branchAddress), fontSize: builder.headerCustomization.address.size, lineHeight: 0.6, color: PdfMakeDocument.colorToHex(builder.headerCustomization.address.color), bold: builder.headerCustomization.address.bold, italics: builder.headerCustomization.address.italic, decoration: builder.headerCustomization.address.underline ? 'underline' : '' }
                    ],
                    alignment: 'right',
                    margin: [0, 0, 0, 3]
                  } : null,

                builder.headerCustomization.phone.show && data?.transactionData.branchPhone ?
                  {
                    text: [
                      { text: 'Phone: ', fontSize: builder.headerCustomization.phone.size, lineHeight: 0.6, color: PdfMakeDocument.colorToHex(builder.headerCustomization.phone.labelColor), bold: true, italics: builder.headerCustomization.phone.italic, decoration: builder.headerCustomization.phone.underline ? 'underline' : '' },
                      { text: data?.transactionData.branchPhone, fontSize: builder.headerCustomization.phone.size, lineHeight: 0.6, color: PdfMakeDocument.colorToHex(builder.headerCustomization.phone.color), bold: builder.headerCustomization.phone.bold, italics: builder.headerCustomization.phone.italic, decoration: builder.headerCustomization.phone.underline ? 'underline' : '' }
                    ],
                    alignment: 'right',
                    margin: [0, 0, 0, 3]
                  } : null,

                ...bCustomField
              ].filter(Boolean)
            } : null
          ],
          margin: builder.headerCustomization.visibility.visible ? [0, 0, 0, 20] : [0, 0, 0, this.pxToPoint(builder.headerCustomization.visibility.height)]
        },

        //  Details Section
        {
          columns: [
            // Left column
            {
              width: '50%',
              stack: [
                builder.transactionalDetailsCustomization.getTransactionNumber(data?.data.type).show && data?.number.name ?
                  {
                    text: [
                      { text: data?.number.label, lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.getTransactionNumber(data?.data.type).size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getTransactionNumber(data?.data.type).labelColor), bold: true, italics: builder.transactionalDetailsCustomization.getTransactionNumber(data?.data.type).italic, decoration: builder.transactionalDetailsCustomization.getTransactionNumber(data?.data.type).underline ? 'underline' : '' },
                      { text: PdfMakeDocument.isArabicText(data?.number.name), lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.getTransactionNumber(data?.data.type).size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getTransactionNumber(data?.data.type).color), bold: builder.transactionalDetailsCustomization.getTransactionNumber(data?.data.type).bold, italics: builder.transactionalDetailsCustomization.getTransactionNumber(data?.data.type).italic, decoration: builder.transactionalDetailsCustomization.getTransactionNumber(data?.data.type).underline ? 'underline' : '' }
                    ],
                    margin: [0, 0, 0, 3]
                  } : null,

                (data?.data.type == 'invoicePayment' || data?.data.type == 'billPayment') && builder.transactionalDetailsCustomization.refrence.show && data?.refrenceNumber && data?.refrenceNumber != '' ?
                  {
                    text: [
                      { text: 'Refrence# ', lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.refrence.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.refrence.labelColor), bold: true, italics: builder.transactionalDetailsCustomization.refrence.italic, decoration: builder.transactionalDetailsCustomization.refrence.underline ? 'underline' : '' },
                      { text: data?.refrenceNumber, lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.refrence.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.refrence.color), bold: builder.transactionalDetailsCustomization.refrence.bold, italics: builder.transactionalDetailsCustomization.refrence.italic, decoration: builder.transactionalDetailsCustomization.refrence.underline ? 'underline' : '' }
                    ],
                    margin: [0, 0, 0, 3]
                  } : null,


                (data?.data.type == 'invoicePayment' || data?.data.type == 'billPayment') && builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).show && data?.date.invDate.name ?
                  {
                    text: [
                      { text: data?.date.invDate.label, lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).labelColor), bold: true, italics: builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).italic, decoration: builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).underline ? 'underline' : '' },
                      { text: this.formatDateToYMD(data?.date.invDate.name), lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).color), bold: builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).bold, italics: builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).italic, decoration: builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).underline ? 'underline' : '' }
                    ],
                    margin: [0, 0, 0, 3]
                  } : null,


                builder.transactionalDetailsCustomization.originalBill.show && data?.billingNumber && data?.billingNumber != '' ?
                  {
                    text: [
                      { text: 'Billing Number:', lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.originalBill.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.originalBill.labelColor), bold: true, italics: builder.transactionalDetailsCustomization.originalBill.italic, decoration: builder.transactionalDetailsCustomization.originalBill.underline ? 'underline' : '' },
                      { text: PdfMakeDocument.isArabicText(data?.billingNumber), lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.originalBill.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.originalBill.color), bold: builder.transactionalDetailsCustomization.originalBill.bold, italics: builder.transactionalDetailsCustomization.originalBill.italic, decoration: builder.transactionalDetailsCustomization.originalBill.underline ? 'underline' : '' }
                    ],
                    margin: [0, 0, 0, 3]
                  } : null,

                builder.transactionalDetailsCustomization.getUser(data?.data.type).show && data?.user.name.value ?
                  {
                    text: [
                      { text: data?.user.name.label, lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.getUser(data?.data.type).size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getUser(data?.data.type).labelColor), bold: true, italics: builder.transactionalDetailsCustomization.getUser(data?.data.type).italic, decoration: builder.transactionalDetailsCustomization.getUser(data?.data.type).underline ? 'underline' : '' },
                      { text: PdfMakeDocument.isArabicText(data?.user.name.value), lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.getUser(data?.data.type).size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getUser(data?.data.type).color), bold: builder.transactionalDetailsCustomization.getUser(data?.data.type).bold, italics: builder.transactionalDetailsCustomization.getUser(data?.data.type).italic, decoration: builder.transactionalDetailsCustomization.getUser(data?.data.type).underline ? 'underline' : '' }
                    ],
                    margin: [0, 0, 0, 3]
                  } : null,
                builder.transactionalDetailsCustomization.customerName.show && data?.user.customer.value ?
                  {
                    text: [
                      { text: data?.user.customer.label, lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.customerName.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.customerName.labelColor), bold: true, italics: builder.transactionalDetailsCustomization.customerName.italic, decoration: builder.transactionalDetailsCustomization.customerName.underline ? 'underline' : '' },
                      { text: PdfMakeDocument.isArabicText(data?.user.customer.value), lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.customerName.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.customerName.color), bold: builder.transactionalDetailsCustomization.customerName.bold, italics: builder.transactionalDetailsCustomization.customerName.italic, decoration: builder.transactionalDetailsCustomization.customerName.underline ? 'underline' : '' }
                    ],
                    margin: [0, 0, 0, 3]
                  } : null,
                builder.transactionalDetailsCustomization.employeeName.show && data?.user.employeeName.value ?
                  {
                    text: [
                      { text: data?.user.employeeName.label, lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.employeeName.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.employeeName.labelColor), bold: true, italics: builder.transactionalDetailsCustomization.employeeName.italic, decoration: builder.transactionalDetailsCustomization.employeeName.underline ? 'underline' : '' },
                      { text: PdfMakeDocument.isArabicText(data?.user.employeeName.value), lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.employeeName.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.employeeName.color), bold: builder.transactionalDetailsCustomization.employeeName.bold, italics: builder.transactionalDetailsCustomization.employeeName.italic, decoration: builder.transactionalDetailsCustomization.employeeName.underline ? 'underline' : '' }
                    ],
                    margin: [0, 0, 0, 3]
                  } : null,
                builder.transactionalDetailsCustomization.getUserPhone(data?.data.type).show && data?.user.phone.value ?
                  {
                    text: [
                      { text: data?.user.phone.label, lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.getUserPhone(data?.data.type).size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getUserPhone(data?.data.type).labelColor), bold: true, italics: builder.transactionalDetailsCustomization.getUserPhone(data?.data.type).italic, decoration: builder.transactionalDetailsCustomization.getUserPhone(data?.data.type).underline ? 'underline' : '' },
                      { text: data?.user.phone.value, lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.getUserPhone(data?.data.type).size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getUserPhone(data?.data.type).color), bold: builder.transactionalDetailsCustomization.getUserPhone(data?.data.type).bold, italics: builder.transactionalDetailsCustomization.getUserPhone(data?.data.type).italic, decoration: builder.transactionalDetailsCustomization.getUserPhone(data?.data.type).underline ? 'underline' : '' }
                    ],
                    margin: [0, 0, 0, 3]
                  } : null,

                builder.transactionalDetailsCustomization.getUserAddress(data?.data.type).show && data?.user.address.value ?
                  {
                    text: [
                      { text: data?.user.address.label, lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.getUserAddress(data?.data.type).size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getUserAddress(data?.data.type).labelColor), bold: true, italics: builder.transactionalDetailsCustomization.getUserAddress(data?.data.type).italic, decoration: builder.transactionalDetailsCustomization.getUserAddress(data?.data.type).underline ? 'underline' : '' },
                      { text: data?.user.address.value, lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.getUserAddress(data?.data.type).size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getUserAddress(data?.data.type).color), bold: builder.transactionalDetailsCustomization.getUserAddress(data?.data.type).bold, italics: builder.transactionalDetailsCustomization.getUserAddress(data?.data.type).italic, decoration: builder.transactionalDetailsCustomization.getUserAddress(data?.data.type).underline ? 'underline' : '' }
                    ],
                    margin: [0, 0, 0, 3]
                  } : null,

                builder.transactionalDetailsCustomization.getUserVatNumber(data?.data.type).show && data?.user.vatnumber.value ?
                  {
                    text: [
                      { text: data?.user.vatnumber.label, lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.getUserVatNumber(data?.data.type).size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getUserVatNumber(data?.data.type).labelColor), bold: true, italics: builder.transactionalDetailsCustomization.getUserVatNumber(data?.data.type).italic, decoration: builder.transactionalDetailsCustomization.getUserVatNumber(data?.data.type).underline ? 'underline' : '' },
                      { text: data?.user.vatnumber.value.trim(), lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.getUserVatNumber(data?.data.type).size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getUserVatNumber(data?.data.type).color), bold: builder.transactionalDetailsCustomization.getUserVatNumber(data?.data.type).bold, italics: builder.transactionalDetailsCustomization.getUserVatNumber(data?.data.type).italic, decoration: builder.transactionalDetailsCustomization.getUserVatNumber(data?.data.type).underline ? 'underline' : '' }
                    ],
                    noWrap: true,   // 👈 THIS is the key

                    margin: [0, 0, 0, 3]
                  } : null,

                builder.transactionalDetailsCustomization.salesPerson.show && data?.user.salesPerson.value ?
                  {
                    text: [
                      { text: data?.user.salesPerson.label, lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.salesPerson.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.salesPerson.labelColor), bold: true, italics: builder.transactionalDetailsCustomization.salesPerson.italic, decoration: builder.transactionalDetailsCustomization.salesPerson.underline ? 'underline' : '' },
                      { text: PdfMakeDocument.isArabicText(data?.user.salesPerson.value), lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.salesPerson.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.salesPerson.color), bold: builder.transactionalDetailsCustomization.salesPerson.bold, italics: builder.transactionalDetailsCustomization.salesPerson.italic, decoration: builder.transactionalDetailsCustomization.salesPerson.underline ? 'underline' : '' }
                    ],
                    margin: [0, 0, 0, 3]
                  } : null,
                builder.transactionalDetailsCustomization.paymentMethodName.show && data?.paymentMethodName ?
                  {
                    text: [
                      { text: 'Payment Method: ', lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.paymentMethodName.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.paymentMethodName.labelColor), bold: true, italics: builder.transactionalDetailsCustomization.paymentMethodName.italic, decoration: builder.transactionalDetailsCustomization.paymentMethodName.underline ? 'underline' : '' },
                      { text: PdfMakeDocument.isArabicText(data?.paymentMethodName), lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.paymentMethodName.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.paymentMethodName.color), bold: builder.transactionalDetailsCustomization.paymentMethodName.bold, italics: builder.transactionalDetailsCustomization.paymentMethodName.italic, decoration: builder.transactionalDetailsCustomization.paymentMethodName.underline ? 'underline' : '' }
                    ],
                    margin: [0, 0, 0, 3]
                  } : null,

                builder.transactionalDetailsCustomization.service.show && data?.serviceName ? 
                {
                  text: [
                    {
                      text: `Service: ${data?.serviceName}${data?.tableGroupName
                          ? ` | Section: ${data.tableGroupName} | Table: ${data.tableName}`
                          : ''
                        }`,
                      lineHeight: 0.6,
                      fontSize: builder.transactionalDetailsCustomization.service.size,
                      color: PdfMakeDocument.colorToHex(
                        builder.transactionalDetailsCustomization.service.labelColor
                      ),
                      bold: builder.transactionalDetailsCustomization.service.bold,
                      italics: builder.transactionalDetailsCustomization.paymentMethodName.italic,
                      decoration: builder.transactionalDetailsCustomization.paymentMethodName.underline
                        ? 'underline'
                        : '',
                    },
                  ],
                  margin: [0, 0, 0, 3],
                } : null,

                ...firstCustomField
              ].filter(Boolean)
            },
            // Right column
            (data?.data.type != 'invoicePayment' && data?.data.type != 'billPayment') ?
              {
                width: '50%',
                stack: [
                  (data?.data.type != 'invoicePayment' || data?.data.type != 'billPayment') && builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).show && data?.date.invDate.name ?
                    {
                      text: [
                        { text: data?.date.invDate.label, lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).labelColor), bold: true, italics: builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).italic, decoration: builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).underline ? 'underline' : '' },
                        { text: this.formatDateToYMD(data?.date.invDate.name), lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).color), bold: builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).bold, italics: builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).italic, decoration: builder.transactionalDetailsCustomization.getTransactionDate(data?.data.type).underline ? 'underline' : '' }
                      ],
                      alignment: 'right',
                      margin: [0, 0, 0, 3]
                    } : null,

                  builder.transactionalDetailsCustomization.getTransactionDueDate(data?.data.type) && builder.transactionalDetailsCustomization.getTransactionDueDate(data?.data.type).show && data?.date.dueDate.name ?
                    {
                      text: [
                        { text: data?.date.dueDate.label, lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.getTransactionDueDate(data?.data.type).size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getTransactionDueDate(data?.data.type).labelColor), bold: true, italics: builder.transactionalDetailsCustomization.getTransactionDueDate(data?.data.type).italic, decoration: builder.transactionalDetailsCustomization.getTransactionDueDate(data?.data.type).underline ? 'underline' : '' },
                        { text: this.formatDateToYMD(data?.date.dueDate.name), lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.getTransactionDueDate(data?.data.type).size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.getTransactionDueDate(data?.data.type).color), bold: builder.transactionalDetailsCustomization.getTransactionDueDate(data?.data.type).bold, italics: builder.transactionalDetailsCustomization.getTransactionDueDate(data?.data.type).italic, decoration: builder.transactionalDetailsCustomization.getTransactionDueDate(data?.data.type).underline ? 'underline' : '' }
                      ],
                      alignment: 'right',
                      margin: [0, 0, 0, 3]
                    } : null,

                  builder.transactionalDetailsCustomization.createdDate.show && data?.date.createdDate.name ?
                    {
                      text: [
                        { text: 'Created Date: ', lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.createdDate.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.createdDate.labelColor), bold: true, italics: builder.transactionalDetailsCustomization.createdDate.italic, decoration: builder.transactionalDetailsCustomization.createdDate.underline ? 'underline' : '' },
                        { text: this.formatDateToYMD(data?.date.createdDate.name), lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.createdDate.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.createdDate.color), bold: builder.transactionalDetailsCustomization.createdDate.bold, italics: builder.transactionalDetailsCustomization.createdDate.italic, decoration: builder.transactionalDetailsCustomization.createdDate.underline ? 'underline' : '' }
                      ],
                      alignment: 'right',
                      margin: [0, 0, 0, 3]
                    } : null,

                  builder.transactionalDetailsCustomization.originalInvoice.show && data?.invoiceNumber && data?.invoiceNumber != '' ?
                    {
                      text: [
                        { text: 'Invoice Number: ', lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.originalInvoice.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.originalInvoice.labelColor), bold: true, italics: builder.transactionalDetailsCustomization.originalInvoice.italic, decoration: builder.transactionalDetailsCustomization.originalInvoice.underline ? 'underline' : '' },
                        { text: PdfMakeDocument.isArabicText(data?.invoiceNumber), lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.originalInvoice.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.originalInvoice.color), bold: builder.transactionalDetailsCustomization.originalInvoice.bold, italics: builder.transactionalDetailsCustomization.originalInvoice.italic, decoration: builder.transactionalDetailsCustomization.originalInvoice.underline ? 'underline' : '' }
                      ],
                      alignment: 'right',
                      margin: [0, 0, 0, 3]
                    } : null,

                  (data?.data.type != 'invoicePayment' || data?.data.type != 'billPayment') && builder.transactionalDetailsCustomization.refrence.show && data?.refrenceNumber != '' ?
                    {
                      text: [
                        { text: 'Refrence# ', lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.refrence.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.refrence.labelColor), bold: true, italics: builder.transactionalDetailsCustomization.refrence.italic, decoration: builder.transactionalDetailsCustomization.refrence.underline ? 'underline' : '' },
                        { text: data?.refrenceNumber, lineHeight: 0.6, fontSize: builder.transactionalDetailsCustomization.refrence.size, color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.refrence.color), bold: builder.transactionalDetailsCustomization.refrence.bold, italics: builder.transactionalDetailsCustomization.refrence.italic, decoration: builder.transactionalDetailsCustomization.refrence.underline ? 'underline' : '' }
                      ],
                      alignment: 'right',
                      margin: [0, 0, 0, 3]
                    } : null,

                  ...secondCustomField
                ].filter(Boolean)
              } :
              {
                columns: [
                  { width: '50%', text: '' }, // 50% empty space on left
                  {
                    width: '50%',
                    stack: [
                      {
                        table: {
                          widths: ['*'],
                          body: [[
                            {
                              text:

                                [
                                  { text: (data?.data.type == 'invoicePayment' ? 'Amount Received' : 'Amount Paid') },
                                  { text: '\n' },
                                  { text: data?.company.currencySymbol + ' ' + data?.amountReceived }
                                ],

                              fontSize: builder.transactionalDetailsCustomization.amountReceived.size,
                              color: '#FFFFFF',
                              bold: true,
                              alignment: 'center',
                              lineHeight: 0.8,
                            }
                          ]]
                        },
                        layout: {
                          hLineWidth: () => 0,
                          vLineWidth: () => 0,
                          fillColor: () => '#4CAF50',
                          paddingLeft: () => 15,
                          paddingRight: () => 15,
                          paddingTop: () => 8,
                          paddingBottom: () => 8,
                        },
                        margin: [0, 0, 0, 10], // Space between badge and table
                      },
                    ],
                    margin: [15, 0, 15, 0],
                  }
                ],
                margin: [0, 0, 0, 0],
                unbreakable: true
              }

          ],
          margin: [0, 0, 0, 0]
        },

        // Order Summary Header
        {
          columns: [
            {
              width: '70%',
              text: data?.data.type == 'invoicePayment' ? 'Payment For' : 'Order summary',
              fontSize: builder.transactionalDetailsCustomization.tableTitle.size,
              color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.tableTitle.color),
              bold: builder.transactionalDetailsCustomization.tableTitle.bold,
              italics: builder.transactionalDetailsCustomization.tableTitle.italic,
              lineHeight: 0.6,
              decoration: builder.transactionalDetailsCustomization.tableTitle.underline ? 'underline' : ''
            },
            {
              width: '30%',
              text: data?.data.type != 'invoicePayment' ? (data?.transactionData.isInclusiveTax ? 'Inclusive Tax' : 'Exclusive Tax') : null,
              fontSize: builder.transactionalDetailsCustomization.taxType.size,
              alignment: 'right',
              color: PdfMakeDocument.colorToHex(builder.transactionalDetailsCustomization.taxType.color),
              bold: builder.transactionalDetailsCustomization.taxType.bold,
              italics: builder.transactionalDetailsCustomization.taxType.italic,
              lineHeight: 0.6,
              decoration: builder.transactionalDetailsCustomization.taxType.underline ? 'underline' : ''

            }
          ],
          margin: [0, 10, 0, 10]
        },

        // Order Items Table
        {
          table: {
            headerRows: 1,
            widths: pdfColumns.map((item: any) => item.width),
            heights: "auto",
            body: [
              // Header row
              pdfColumns.map((ph: any) => ({
                text: ph.text == '' ? PdfMakeDocument.isArabicText(ph.key) : PdfMakeDocument.isArabicText(ph.text),
                alignment: ph.alignment,
                fillColor: ph.fillColor,
                color: ph.color == ph.fillColor ? '#ffffff' : ph.color,
                fontSize: ph.fontSize,
                bold: true,
                valign: 'center',
              })),
              ...dataRows
            ]
          },
          layout: {
            hLineWidth: (i: any, node: any) => 1,
            hLineColor: () => '#eff2f7',
            vLineWidth: () => 0,
            paddingLeft: () => 5,
            paddingRight: () => 5,
            paddingTop: (i: any) => i === 0 ? 4 : 3,
            paddingBottom: (i: any) => i === 0 ? 4 : 8
          },
          margin: [0, 0, 0, 20]
        },

        // Totals Section
        builder.totalSectionCustomization.totalTable.show ? {
          columns: [
            { width: '50%', text: '' }, // 50% empty space on left
            {
              width: '50%', // 0.5 of content width
              table: {
                widths: ['50%', '50%'],
                body: visibleItemstotal.filter(item => item.text !== null).map((item: any, index: any) => [
                  {
                    text: item.label,
                    fontSize: item.fontSize,
                    color: item.labelColor,
                    bold: item.bold,
                    italics: item.italics,
                    decoration: item.decoration ? 'underline' : '',
                    lineHeight: 0.5,
                  },
                  {
                    text: item.text,
                    fontSize: item.fontSize,
                    color: item.color,
                    bold: item.bold,
                    italics: item.italics,
                    decoration: item.decoration ? 'underline' : '',
                    alignment: 'right',
                    lineHeight: 0.5,
                  }
                ]),
              },
              layout: {
                hLineWidth: (i, node) => {
                  return (i === 0 || i === node.table.body.length) ? 1 : 0;
                },
                vLineWidth: (i, node) => {
                  return (i === 0 || i === node.table.widths?.length) ? 1 : 0;
                },
                hLineColor: () => '#eff2f7',
                vLineColor: () => '#eff2f7',
                fillColor: () => builder.totalSectionCustomization.totalTable.backgroundColor,
                paddingLeft: () => 13,
                paddingRight: () => 13,
                paddingTop: () => 6,
                paddingBottom: (rowIndex, node) => {
                  const isLastRow = rowIndex === node.table.body.length - 1;
                  return isLastRow ? 15 : 4;
                },

              },

            }
          ],
          margin: [0, 0, 0, 20],
          unbreakable: true
        } : null,

        // Payment Section 
        paymentSection,

        //customer note 
        noteSection,

        data?.footer.note && data?.footer.note != '' ?
          {

            columns: [
              // Left column
              {
                stack: [
                  {
                    text: [
                      {
                        text: 'Note: ',
                        fontSize: builder.footerCustomization.note.size,
                        color: PdfMakeDocument.colorToHex(builder.footerCustomization.note.labelColor),
                        bold: builder.footerCustomization.note.bold,
                        italics: builder.footerCustomization.note.italic,
                        decoration: builder.footerCustomization.note.underline ? 'underline' : '',
                        alignment: builder.footerCustomization.note.alignment,
                      },
                      {
                        text: PdfMakeDocument.isArabicText(data?.footer.note),
                        fontSize: builder.footerCustomization.note.size,
                        color: PdfMakeDocument.colorToHex(builder.footerCustomization.note.color),
                        bold: builder.footerCustomization.note.bold,
                        italics: builder.footerCustomization.note.italic,
                        decoration: builder.footerCustomization.note.underline ? 'underline' : '',
                        alignment: builder.footerCustomization.note.alignment,
                      }
                    ],
                    margin: [0, 5, 0, 3]
                  },
                ]
              },

            ],
          } : null
      ],
      // Footer with Terms & Conditions
      footer: function (currentPage: any, pageCount: any): any {
        return {
          columns: [

            builder.footerCustomization.visibility.visible && builder.footerCustomization.term.show && data?.footer.term != '' ?
              {
                width: '100%',
                stack: [
                  {
                    text: 'Terms & Conditions',
                    fontSize: builder.footerCustomization.term.size,
                    bold: builder.footerCustomization.term.bold,
                    italics: builder.footerCustomization.term.italic,
                    decoration: builder.footerCustomization.term.underline ? 'underline' : '',
                    alignment: builder.footerCustomization.term.alignment,
                    lineHeight: 0.6,
                    color: PdfMakeDocument.colorToHex(builder.footerCustomization.term.labelColor),
                    margin: [40, 10, 40, 5]
                  },
                  {
                    text: PdfMakeDocument.isArabicText(data?.footer.term),
                    fontSize: builder.footerCustomization.term.size,
                    alignment: builder.footerCustomization.term.alignment,
                    color: PdfMakeDocument.colorToHex(builder.footerCustomization.term.color),
                    bold: builder.footerCustomization.term.bold,
                    italics: builder.footerCustomization.term.italic,
                    lineHeight: 0.6,
                    decoration: builder.footerCustomization.term.underline ? 'underline' : '',
                    margin: [40, 0, 40, 10]
                  }
                ],

              } : null
          ]
        };
      },
    }

    // return base64 of the pdfmakeobject 
    // this.createPdfKitDocument(docDefinition, options);

    return await this.createPdfBase64(docDefinition);
  }


  private createPdfBase64(docDefinition: TDocumentDefinitions): Promise<string> {
    return new Promise((resolve, reject) => {
      const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];
      pdfDoc.on("data", (chunk: any) => chunks.push(chunk));
      pdfDoc.on("end", () => {
        const result = Buffer.concat(chunks).toString("base64");
        resolve(result);
      });
      pdfDoc.on("error", reject);
      pdfDoc.end();
    });
  }

}

export interface IPdfDocument {
  generatePdfBase64(): Promise<string>;

  setData(data?: any): void;

  setTemplate(template?: DocumentTemplate): void;
}