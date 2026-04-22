import { PoolClient } from "pg";
import { SQL } from "../promotions/common/sql";

export class NotificationRepository {

    private client: PoolClient;
    constructor(client: PoolClient) {
        this.client = client;
    }

    public async getCompanyInfo(companyId: string) {
        const query: SQL = {
            text: `--sql
                   SELECT "Companies"."name" as "companyName", "Companies"."slug" as "compnaySlug", "Companies"."country"
                   FROM "Companies"
                   WHERE id=$1`,
            values: [companyId]
        }
        const rows = (await this.client.query(query.text, query.values)).rows;
        if (rows && rows.length > 0) return rows[0];
        return undefined;
    }

    public async getNotificationTemplate(companyId: string, notificationType: string): Promise<string | null> {
        switch (notificationType) {
            case "reservationAccepted":
                return `Your Reservation has been {{reservation.status}}.
Date: {{date(reservation.createAt)}} - Time: {{time(reservation.createAt)}}`;
            case "reservationRejected":
                return `Your Reservation has been {{reservation.status}}.
Date: {{date(reservation.createAt)}} - Time: {{time(reservation.createAt)}}`;
            case "invoiceAccepted":
                return `Your Order has been {{onlineStatus}}.
Date: {{date(createdAt)}} - Time: {{time(createdAt)}}
Total: {{currencySymbol}} {{total}}`;
            case "invoiceRejected":
                return `Your Order has been {{onlineStatus}}.
Date: {{date(createdAt)}} - Time: {{time(createdAt)}}
Total: {{currencySymbol}} {{total}} `;
            case "cashierOut":
                return `Branch: {{branchName}}
Cashier {{employeeName}} signed out. Date: {{cashierOut}}.
Closing Balance: {{currencySymbol}} {{endAmount}}`;
            case "invoiceDeleted":
                return `Branch: {{branchName}}
Invoice #{{invoiceNumber}} has been deleted.
Total Amount: {{currencySymbol}} {{total}}`;
            case "creditNoteIssued":
                return `Branch: {{branchName}}
Credit Note #{{creditNoteNumber}} has been issued.
Total Amount: {{currencySymbol}} {{total}}`;
            case "InvoiceWriteOff":
                return `Branch: {{branchName}}
A balance of {{currencySymbol}} {{total}} was written off for Invoice #{{invoiceNumber}}.`;
            case "ItemVoided":
              return `Branch {{branchInfo.name}}
Invoice #{{invoiceNumber}} • {{totalVoidedLines}} line(s) voided
Voided Qty: {{totalVoidedQty}}
Voided Amount: {{totalVoidedAmount}} {{currencySymbol}}`
            case "invoiceItemsDiscountChanged":
              return `Branch: {{branchInfo.name}}
Invoice #{{invoiceNumber}} • {{totalDiscountedItems}} line(s) discounted
Total Discount Amount: {{totalDiscountedAmount}} {{currencySymbol}}`
            default:
                return null;
        }
    }
    public async getEmailTemplate(companyId: string, emailType: string): Promise<string | null> {
        switch (emailType) {
            case "reservationRejected":
                return `
<head>
  <title>Reservation Rejected</title>

  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:30px 10px;">

        <table role="presentation" class="email-wrapper" border="0" cellpadding="0" cellspacing="0" width="600"
          style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <tr>
            <td style="background-color:#32acc1;padding:32px 40px;text-align:center;">
            <h2 style="margin:0 0 4px;color:#cdf0f5;font-size:15px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">
                {{companyName}}
              </h2>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">
                Reservation Rejected
              </h1>
              <p style="margin:8px 0 0;color:#cdf0f5;font-size:14px;">We're sorry to inform you about your reservation.</p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#fef2f2;padding:16px 40px;text-align:center;border-bottom:1px solid #fecaca;">
              <p style="margin:0;font-size:15px;color:#444444;">
                This email is to inform you that your reservation has been
                <strong style="color:#d93025;">{{reservation.status}}</strong>.
              </p>
            </td>
          </tr>

          <tr>
            <td class="email-content" style="padding:32px 40px;">

              <p style="margin:0 0 24px;font-size:15px;color:#444444;line-height:1.6;">
                Dear <strong style="color:#32acc1;">{{customerName}}</strong>,<br>
                Unfortunately, we were unable to accommodate your booking at <strong>{{companyName}}</strong>. Here are the details of your request:
              </p>

              <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.8px;">
                Booking Details
              </p>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;margin-bottom:28px;">
                <tr style="background-color:#ffffff;">
                  <td style="border:1px solid #e0e0e0;padding:12px 16px;font-size:14px;color:#666666;width:45%;">📅 &nbsp;Date</td>
                  <td style="border:1px solid #e0e0e0;padding:12px 16px;font-size:14px;font-weight:700;color:#1a1a1a;text-align:right;">{{date(reservation.createAt)}}</td>
                </tr>
                <tr style="background-color:#fafafa;">
                  <td style="border:1px solid #e0e0e0;padding:12px 16px;font-size:14px;color:#666666;">🕐 &nbsp;Time</td>
                  <td style="border:1px solid #e0e0e0;padding:12px 16px;font-size:14px;font-weight:700;color:#1a1a1a;text-align:right;">{{time(reservation.createAt)}}</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="border:1px solid #e0e0e0;padding:12px 16px;font-size:14px;color:#666666;">👥 &nbsp;Number of Guests</td>
                  <td style="border:1px solid #e0e0e0;padding:12px 16px;font-size:14px;font-weight:700;color:#1a1a1a;text-align:right;">{{reservation.guests}}</td>
                </tr>
                <tr style="background-color:#fafafa;">
                  <td style="border:1px solid #e0e0e0;padding:12px 16px;font-size:14px;color:#666666;">🔖 &nbsp;Status</td>
                  <td style="border:1px solid #e0e0e0;padding:12px 16px;font-size:14px;font-weight:700;color:#d93025;text-align:right;">{{reservation.status}}</td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr><td style="border-top:1px solid #eeeeee;padding-bottom:24px;"></td></tr>
              </table>

              <p style="margin:0;font-size:13px;color:#888888;line-height:1.6;text-align:center;">
                If you have any questions about your reservation, please contact us using the information below.
              </p>

            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:24px 40px;text-align:center;border-top:1px solid #eeeeee;">
              <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">{{companyName}}</p>
              <p style="margin:0 0 6px;font-size:13px;color:#666666;">{{branchInfo.address}}</p>
              <p style="margin:0 0 14px;font-size:13px;color:#666666;">
                📞 {{branchInfo.phoneNumber}}
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:14px">
                <tr><td style="border-top:1px solid #eeeeee;"></td></tr>
              </table>
              <p style="margin:0;font-size:11px;color:#aaaaaa;font-style:italic;">— Powered by INVOPOS —</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>

</body>
`

            case "reservationAccepted":
                return `
<head>
  <title>Reservation Accepted</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:30px 10px;">

        <table role="presentation" class="email-wrapper" border="0" cellpadding="0" cellspacing="0" width="600"
          style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <tr>
            <td style="background-color:#32acc1;padding:32px 40px;text-align:center;">
           <h2 style="margin:0 0 4px;color:#cdf0f5;font-size:15px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">
                {{companyName}}
              </h2>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">
                Reservation Confirmation
              </h1>
              <p style="margin:8px 0 0;color:#cdf0f5;font-size:14px;">We look forward to welcoming you!</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#e6f7f9;padding:16px 40px;text-align:center;border-bottom:1px solid #b2e4ec;">
              <p style="margin:0;font-size:15px;color:#444444;">
                This email is to inform you that your reservation has been
                <strong style="color:#32acc1;">{{reservation.status}}</strong>.
              </p>
            </td>
          </tr>

          <tr>
            <td class="email-content" style="padding:32px 40px;">

              <p style="margin:0 0 24px;font-size:15px;color:#444444;line-height:1.6;">
                Dear <strong style="color:#32acc1;">{{customerName}}</strong>,<br>
                Here are the details of your booking at <strong>{{companyName}}</strong>:
              </p>

              <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.8px;">
                Booking Details
              </p>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;margin-bottom:28px;">
                <tr style="background-color:#ffffff;">
                  <td style="border:1px solid #e0e0e0;padding:12px 16px;font-size:14px;color:#666666;width:45%;">📅 &nbsp;Date</td>
                  <td style="border:1px solid #e0e0e0;padding:12px 16px;font-size:14px;font-weight:700;color:#1a1a1a;text-align:right;">{{date(reservation.createAt)}}</td>
                </tr>
                <tr style="background-color:#fafafa;">
                  <td style="border:1px solid #e0e0e0;padding:12px 16px;font-size:14px;color:#666666;">🕐 &nbsp;Time</td>
                  <td style="border:1px solid #e0e0e0;padding:12px 16px;font-size:14px;font-weight:700;color:#1a1a1a;text-align:right;">{{time(reservation.createAt)}}</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="border:1px solid #e0e0e0;padding:12px 16px;font-size:14px;color:#666666;">👥 &nbsp;Number of Guests</td>
                  <td style="border:1px solid #e0e0e0;padding:12px 16px;font-size:14px;font-weight:700;color:#32acc1;text-align:right;">{{reservation.guests}}</td>
                </tr>
                <tr style="background-color:#fafafa;">
                  <td style="border:1px solid #e0e0e0;padding:12px 16px;font-size:14px;color:#666666;">🔖 &nbsp;Status</td>
                  <td style="border:1px solid #e0e0e0;padding:12px 16px;font-size:14px;font-weight:700;color:#32acc1;text-align:right;">{{reservation.status}}</td>
                </tr>
              </table>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr><td style="border-top:1px solid #eeeeee;padding-bottom:24px;"></td></tr>
              </table>

              <p style="margin:0;font-size:13px;color:#888888;line-height:1.6;text-align:center;">
                If you have any questions about your reservation, please contact us using the information below.
              </p>

            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:24px 40px;text-align:center;border-top:1px solid #eeeeee;">
              <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">{{companyName}}</p>
              <p style="margin:0 0 6px;font-size:13px;color:#666666;">{{branchInfo.address}}</p>
              <p style="margin:0 0 14px;font-size:13px;color:#666666;">
                📞 {{branchInfo.phoneNumber}}
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:14px">
                <tr><td style="border-top:1px solid #eeeeee;"></td></tr>
              </table>
              <p style="margin:0;font-size:11px;color:#aaaaaa;font-style:italic;">— Powered by INVOPOS —</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
`

            case "invoiceAccepted":
                return `<head>
                  <title>Invoice Accepted</title>

  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:30px 10px;">
        <table role="presentation" class="email-wrapper" border="0" cellpadding="0" cellspacing="0" width="600"
          style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <tr>
            <td style="background-color:#32acc1;padding:32px 40px;text-align:center;">
           <h2 style="margin:0 0 4px;color:#cdf0f5;font-size:15px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">{{companyName}}</h2>
           <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">
                Invoice Accepted
              </h1>
              <p style="margin:8px 0 0;color:#cdf0f5;font-size:14px;">Thank you for your order!</p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#e6f7f9;padding:16px 40px;text-align:center;border-bottom:1px solid #b2e4ec;">
              <p style="margin:0;font-size:15px;color:#444444;">
                Dear <strong style="color:#32acc1;">{{customer.name}}</strong>, please find attached your
                <strong style="color:#32acc1;">Invoice {{invoiceNumber}}</strong> from {{companyName}}.
              </p>
            </td>
          </tr>

          <tr>
            <td class="email-content" style="padding:32px 40px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
                <tr>
                  <td class="meta-left" width="50%" style="padding:0 0 12px;">
                    <p style="margin:0;font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.8px;">Invoice Number</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;font-weight:700;">{{invoiceNumber}}</p>
                  </td>
                  <td class="meta-right" width="50%" style="padding:0 0 12px;text-align:right;">
                    <p style="margin:0;font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.8px;">Date &amp; Time</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;font-weight:700;">{{date(createdAt)}}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#666666;">{{time(createdAt)}}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr><td style="border-top:1px solid #eeeeee;padding-bottom:24px;"></td></tr>
              </table>

              <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.8px;">Invoice Details</p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;margin-bottom:28px;">
                <tr style="background-color:#ffffff;">
                  <td style="border:1px solid #e0e0e0;padding:10px 16px;font-size:14px;color:#666666;width:45%;">Customer:</td>
                  <td style="border:1px solid #e0e0e0;padding:10px 16px;font-size:14px;font-weight:700;text-align:right;color:#1a1a1a;">{{customer.name}}</td>
                </tr>
                <tr style="background-color:#fafafa;">
                  <td style="border:1px solid #e0e0e0;padding:10px 16px;font-size:14px;color:#666666;">Amount:</td>
                  <td style="border:1px solid #e0e0e0;padding:10px 16px;font-size:14px;font-weight:700;text-align:right;color:#32acc1;">{{currencySymbol}} {{total}}</td>
                </tr>
                <tr style="background-color:#fafafa;">
                  <td style="border:1px solid #e0e0e0;padding:10px 16px;font-size:14px;color:#666666;">Status:</td>
                  <td style="border:1px solid #e0e0e0;padding:10px 16px;font-size:14px;font-weight:700;text-align:right;color:#d93025;">{{onlineStatus}}</td>
                </tr>
              </table>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr><td style="border-top:1px solid #eeeeee;padding-bottom:24px;"></td></tr>
              </table>

              <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.8px;">Order Summary</p>
              <table role="presentation" class="order-table" border="0" cellpadding="0" cellspacing="0" width="100%"
                style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;">
                <thead>
                  <tr style="background-color:#f8f9fa;">
                    <th style="border:1px solid #e0e0e0;padding:10px 12px;text-align:left;font-size:12px;font-weight:700;color:#555555;text-transform:uppercase;letter-spacing:0.5px;" width="5%">#</th>
                    <th style="border:1px solid #e0e0e0;padding:10px 12px;text-align:left;font-size:12px;font-weight:700;color:#555555;text-transform:uppercase;letter-spacing:0.5px;">Product Name</th>
                    <th style="border:1px solid #e0e0e0;padding:10px 12px;text-align:center;font-size:12px;font-weight:700;color:#555555;text-transform:uppercase;letter-spacing:0.5px;" width="10%">Qty</th>
                    <th style="border:1px solid #e0e0e0;padding:10px 12px;text-align:right;font-size:12px;font-weight:700;color:#555555;text-transform:uppercase;letter-spacing:0.5px;" width="15%">Price</th>
                    <th style="border:1px solid #e0e0e0;padding:10px 12px;text-align:right;font-size:12px;font-weight:700;color:#555555;text-transform:uppercase;letter-spacing:0.5px;" width="15%">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {{lines.map((inv, i) =>
                  <tr style="background-color:#ffffff;">
                    <td style="border:1px solid #e0e0e0;padding:10px 12px;font-size:14px;color:#444444;text-align:left;">{{i + 1}}</td>
                    <td style="border:1px solid #e0e0e0;padding:10px 12px;font-size:14px;color:#1a1a1a;font-weight:500;">{{inv.productName ? inv.productName : inv.product?.name}}</td>
                    <td style="border:1px solid #e0e0e0;padding:10px 12px;font-size:14px;color:#444444;text-align:center;">{{inv.qty}}</td>
                    <td style="border:1px solid #e0e0e0;padding:10px 12px;font-size:14px;color:#444444;text-align:right;">{{inv.price}}</td>
                    <td style="border:1px solid #e0e0e0;padding:10px 12px;font-size:14px;color:#444444;text-align:right;">{{inv.total}}</td>
                  </tr>
                  )}}
                </tbody>
              </table>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:16px;">
                <tr>
                  <td align="right">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background-color:#32acc1;border-radius:6px;">
                      <tr>
                        <td style="padding:12px 24px;">
                          <span style="font-size:13px;color:#cdf0f5;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Grand Total &nbsp;&nbsp;</span>
                          <span style="font-size:18px;color:#ffffff;font-weight:700;">{{currencySymbol}} {{total}}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <br>

              <p style="margin:0;font-size:13px;color:#888888;line-height:1.6;text-align:center;">
                If you have any questions about this invoice, please contact us using the information below.
              </p>

            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:24px 40px;text-align:center;border-top:1px solid #eeeeee;">
              <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">{{companyName}}</p>
              <p style="margin:0 0 6px;font-size:13px;color:#666666;">{{branchInfo.address}}</p>
              <p style="margin:0 0 14px;font-size:13px;color:#666666;">
                📞 {{branchInfo.phoneNumber}}
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:14px">
                <tr><td style="border-top:1px solid #eeeeee;"></td></tr>
              </table>
              <p style="margin:0;font-size:11px;color:#aaaaaa;font-style:italic;">— Powered by INVOPOS —</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
`

            case "invoiceRejected":
                return `<head>
                  <title>Invoice Rejected</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  </style>
</head>

<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:30px 10px;">
        <table role="presentation" class="email-wrapper" border="0" cellpadding="0" cellspacing="0" width="600"
          style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <tr>
            <td style="background-color:#32acc1;padding:32px 40px;text-align:center;">
              <h2 style="margin:0 0 4px;color:#cdf0f5;font-size:15px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">{{companyName}}</h2>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">Invoice Rejected</h1>
              <p style="margin:8px 0 0;color:#cdf0f5;font-size:14px;">We're sorry to inform you about your order.</p>
            </td>
          </tr>

            <tr>
            <td style="background-color:#fef2f2;padding:16px 40px;text-align:center;border-bottom:1px solid #fecaca;">
              <p style="margin:0;font-size:15px;color:#444444;">
                This email is to inform you that your invoice has been
                <strong style="color:#d93025;">Cancelled</strong>.
              </p>
            </td>
          </tr>

              <tr>
            <td class="email-content" style="padding:32px 40px;">

              <p style="margin:0 0 24px;font-size:15px;color:#444444;line-height:1.6;">
                Dear <strong style="color:#32acc1;">{{customer.name}}</strong>,<br>
                Unfortunately, your order with <strong>{{companyName}}</strong> has been cancelled. Here are the details:
              </p>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
                <tr>
                  <td width="50%" style="padding:0 0 12px;">
                    <p style="margin:0;font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.8px;">Invoice Number</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;font-weight:700;">{{invoiceNumber}}</p>
                  </td>
                  <td width="50%" style="padding:0 0 12px;text-align:right;">
                    <p style="margin:0;font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.8px;">Date &amp; Time</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;font-weight:700;">{{date(createdAt)}}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#666666;">{{time(createdAt)}}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr><td style="border-top:1px solid #eeeeee;padding-bottom:24px;"></td></tr>
              </table>

              <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.8px;">Invoice Details</p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;margin-bottom:28px;">
                <tr style="background-color:#ffffff;">
                  <td style="border:1px solid #e0e0e0;padding:10px 16px;font-size:14px;color:#666666;width:45%;">Customer:</td>
                  <td style="border:1px solid #e0e0e0;padding:10px 16px;font-size:14px;font-weight:700;text-align:right;color:#1a1a1a;">{{customer.name}}</td>
                </tr>
                <tr style="background-color:#fafafa;">
                  <td style="border:1px solid #e0e0e0;padding:10px 16px;font-size:14px;color:#666666;">Amount:</td>
                  <td style="border:1px solid #e0e0e0;padding:10px 16px;font-size:14px;font-weight:700;text-align:right;color:#32acc1;">{{currencySymbol}} {{total}}</td>
                </tr>
                <tr style="background-color:#fafafa;">
                  <td style="border:1px solid #e0e0e0;padding:10px 16px;font-size:14px;color:#666666;">Status:</td>
                  <td style="border:1px solid #e0e0e0;padding:10px 16px;font-size:14px;font-weight:700;text-align:right;color:#d93025;">{{onlineStatus}}</td>
                </tr>
              </table>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr><td style="border-top:1px solid #eeeeee;padding-bottom:24px;"></td></tr>
              </table>

              <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.8px;">Order Summary</p>
              <table role="presentation" class="order-table" border="0" cellpadding="0" cellspacing="0" width="100%"
                style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;">
                <thead>
                  <tr style="background-color:#f8f9fa;">
                    <th style="border:1px solid #e0e0e0;padding:10px 12px;text-align:left;font-size:12px;font-weight:700;color:#555555;text-transform:uppercase;letter-spacing:0.5px;" width="5%">#</th>
                    <th style="border:1px solid #e0e0e0;padding:10px 12px;text-align:left;font-size:12px;font-weight:700;color:#555555;text-transform:uppercase;letter-spacing:0.5px;">Product Name</th>
                    <th style="border:1px solid #e0e0e0;padding:10px 12px;text-align:center;font-size:12px;font-weight:700;color:#555555;text-transform:uppercase;letter-spacing:0.5px;" width="10%">Qty</th>
                    <th style="border:1px solid #e0e0e0;padding:10px 12px;text-align:right;font-size:12px;font-weight:700;color:#555555;text-transform:uppercase;letter-spacing:0.5px;" width="15%">Price</th>
                    <th style="border:1px solid #e0e0e0;padding:10px 12px;text-align:right;font-size:12px;font-weight:700;color:#555555;text-transform:uppercase;letter-spacing:0.5px;" width="15%">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {{lines.map((inv,i) => 
                  <tr style="background-color:#ffffff;">
                    <td style="border:1px solid #e0e0e0;padding:10px 12px;font-size:14px;color:#444444;">{{i + 1}}</td>
                    <td style="border:1px solid #e0e0e0;padding:10px 12px;font-size:14px;color:#888888;font-weight:500;text-decoration:line-through;">{{inv.productName ? inv.productName : inv.product?.name}}</td>
                    <td style="border:1px solid #e0e0e0;padding:10px 12px;font-size:14px;color:#888888;text-align:center;">{{inv.qty}}</td>
                    <td style="border:1px solid #e0e0e0;padding:10px 12px;font-size:14px;color:#888888;text-align:right;">{{inv.price}}</td>
                    <td style="border:1px solid #e0e0e0;padding:10px 12px;font-size:14px;color:#888888;text-align:right;">{{inv.total}}</td>
                  </tr>  
                  )}}      
                </tbody>
              </table>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:16px;">
                <tr>
                  <td align="right">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background-color:#e0e0e0;border-radius:6px;">
                      <tr>
                        <td style="padding:12px 24px;">
                          <span style="font-size:13px;color:#999999;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Grand Total &nbsp;&nbsp;</span>
                          <span style="font-size:18px;color:#999999;font-weight:700;text-decoration:line-through;">{{currencySymbol}} {{total}}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;margin-bottom:28px;">
                <tr>
                  <td style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#d93025;text-transform:uppercase;letter-spacing:0.5px;">
                      ⚠️ &nbsp;Reason for Cancellation
                    </p>
                    <p style="margin:6px 0 0;font-size:14px;color:#444444;line-height:1.6;">
                      {{rejectReason}}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#888888;line-height:1.6;text-align:center;">
                If you have any questions about this cancellation, please contact us using the information below.
              </p>

            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:24px 40px;text-align:center;border-top:1px solid #eeeeee;">
              <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">{{companyName}}</p>
              <p style="margin:0 0 6px;font-size:13px;color:#666666;">{{branchInfo.address}}</p>
              <p style="margin:0 0 14px;font-size:13px;color:#666666;">
                📞 {{branchInfo.phoneNumber}}
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:14px">
                <tr><td style="border-top:1px solid #eeeeee;"></td></tr>
              </table>
              <p style="margin:0;font-size:11px;color:#aaaaaa;font-style:italic;">— Powered by INVOPOS —</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>`


case "customerFeedback":
return `<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New Order Rating Received</title>

<style>
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}
body{margin:0!important;padding:0!important;width:100%!important;font-family:Arial,Helvetica,sans-serif;background:#f4f4f4}
@media only screen and (max-width:600px){
.email-wrapper{width:100%!important}
.email-content{padding:20px 16px!important}
.header-container{padding:24px 18px!important}
.footer-container{padding:20px 16px!important}
.stack-column,
.stack-column td{
display:block!important;
width:100%!important;
padding:0!important;
}
.mobile-space{height:12px!important}
.rating-stars{font-size:32px!important}
}
</style>
</head>

<body>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background:#f4f4f4;">
<tr>
<td align="center" style="padding:30px 10px;">

<table role="presentation" width="600" border="0" cellpadding="0" cellspacing="0" class="email-wrapper" style="max-width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

<tr>
<td class="header-container" style="background:#32acc1;padding:32px 40px;text-align:center;">
<h2 style="margin:0 0 4px;color:#cdf0f5;font-size:15px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">{{companyName}}</h2>
<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">New Order Rating</h1>
<p style="margin:8px 0 0;color:#cdf0f5;font-size:14px;">A customer has rated their order</p>
</td>
</tr>

<tr>
<td class="email-content" style="padding:32px 40px;">

{{
(orderNumber != null && orderNumber !== '')
? \`

<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr class="stack-column">

<td width="48%" valign="top" style="padding-right:2%;">
<div style="background:#f8f9fa;border-radius:8px;padding:18px;">
<p style="margin:0 0 8px;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Order Number</p>
<p style="margin:0;font-size:18px;color:#32acc1;font-weight:700;">\${orderNumber}</p>
</div>
</td>

<td width="48%" valign="top">
<div style="background:#f8f9fa;border-radius:8px;padding:18px;">
<p style="margin:0 0 8px;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Rated On</p>
<p style="margin:0;font-size:18px;color:#32acc1;font-weight:700;">\${date(createdAt)}</p>
</div>
</td>

</tr>

<tr><td colspan="2" height="14" class="mobile-space"></td></tr>

<tr class="stack-column">

<td width="48%" valign="top" style="padding-right:2%;">
<div style="background:#f8f9fa;border-radius:8px;padding:18px;">
<p style="margin:0 0 8px;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Location</p>
<p style="margin:0;font-size:16px;color:#1a1a1a;font-weight:700;">\${branchInfo.name}</p>
</div>
</td>

<td width="48%" valign="top">
<div style="background:#f8f9fa;border-radius:8px;padding:18px;">
<p style="margin:0 0 8px;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Contact</p>
<p style="margin:0;font-size:16px;color:#1a1a1a;font-weight:700;">\${branchInfo.branchContact}</p>
</div>
</td>

</tr>
</table>

\`
: \`

<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr class="stack-column">

<td width="32%" valign="top" style="padding-right:2%;">
<div style="background:#f8f9fa;border-radius:8px;padding:18px;">
<p style="margin:0 0 8px;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Rated On</p>
<p style="margin:0;font-size:18px;color:#32acc1;font-weight:700;">\${date(createdAt)}</p>
</div>
</td>

<td width="32%" valign="top" style="padding-right:2%;">
<div style="background:#f8f9fa;border-radius:8px;padding:18px;">
<p style="margin:0 0 8px;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Location</p>
<p style="margin:0;font-size:16px;color:#1a1a1a;font-weight:700;">\${branchInfo.name}</p>
</div>
</td>

<td width="32%" valign="top">
<div style="background:#f8f9fa;border-radius:8px;padding:18px;">
<p style="margin:0 0 8px;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Contact</p>
<p style="margin:0;font-size:16px;color:#1a1a1a;font-weight:700;">\${branchInfo.branchContact}</p>
</div>
</td>

</tr>
</table>

\`
}}

<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr>
<td style="background:#ffffff;border:1px solid #e0e0e0;border-radius:8px;padding:28px 24px;text-align:center;">
<p style="margin:0 0 14px;font-size:12px;color:#888;text-transform:uppercase;font-weight:600;">Customer</p>
<p style="margin:0 0 10px;font-size:16px;color:#1a1a1a;font-weight:700;">{{customer.name}}</p>
<p style="margin:0;font-size:14px;color:#666;">{{customer.customerContact}}</p>
</td>
</tr>
</table>

<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr>
<td style="background:#f0fafb;border:1px solid #a7e8f0;border-radius:8px;padding:32px 24px;text-align:center;">

<p style="margin:0 0 14px;font-size:12px;color:#0c7a8b;text-transform:uppercase;font-weight:600;">Customer Rating</p>

<p class="rating-stars" style="margin:0 0 12px;font-size:44px;line-height:1;">
{{
rating === 5 ? '<span style="color:#059669">★★★★★</span>' :
rating === 4 ? '<span style="color:#059669">★★★★☆</span>' :
rating === 3 ? '<span style="color:#b45309">★★★☆☆</span>' :
rating === 2 ? '<span style="color:#f97316">★★☆☆☆</span>' :
rating === 1 ? '<span style="color:#ef4444">★☆☆☆☆</span>' :
''
}}
</p>

<p style="margin:0 0 4px;font-size:18px;color:#32acc1;font-weight:700;">{{rating}} out of 5 stars</p>

<p style="margin:0;font-size:13px;color:#0c7a8b;">
{{
rating === 5 ? 'Excellent experience' :
rating === 4 ? 'Very satisfied' :
rating === 3 ? 'Satisfied' :
rating === 2 ? 'Could be better' :
rating === 1 ? 'Needs improvement' :
''
}}
</p>

</td>
</tr>
</table>

<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr>
<td style="background:#ffffff;border:1px solid #e0e0e0;border-radius:8px;padding:28px 24px;">
<p style="margin:0 0 14px;font-size:12px;color:#888;text-transform:uppercase;font-weight:600;text-align:center;">Customer Feedback</p>
<p style="margin:0;font-size:14px;color:#444;line-height:1.8;text-align:center;font-style:italic;">{{comment}}</p>
</td>
</tr>
</table>

<p style="margin:0;font-size:13px;color:#888;line-height:1.6;text-align:center;">
Review this feedback and respond to improve customer satisfaction.
<br><br>
<a href="{{dashboardUrl}}" style="display:inline-block;padding:12px 28px;background:#32acc1;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;"> View Feedbacks </a>
</p>

</td>
</tr>

<tr>
<td class="footer-container" style="padding:24px 40px;text-align:center;border-top:1px solid #eeeeee;">
<p style="margin:0;font-size:11px;color:#aaaaaa;font-style:italic;">— Powered by INVOPOS —</p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>`;
            default:
                return null;
        }
    }

}