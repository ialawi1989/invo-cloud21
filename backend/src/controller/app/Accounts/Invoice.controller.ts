import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { InvoiceRepo } from '@src/repo/app/accounts/invoice.repo';
import { SocketInvoiceRepo } from '@src/repo/socket/invoice.socket';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { ViewQueue } from '@src/utilts/viewQueue';

import { InvoiceValidation } from '@src/validationSchema/account/invoice.Schema';
import builder from 'xmlbuilder';
import { Request, Response, NextFunction } from 'express';
import { BranchesRepo } from '@src/repo/admin/branches.repo';
import { zatca } from '@src/Integrations/zatca/zatca';
import { CompanyRepo } from '@src/repo/admin/company.repo';

import axios from 'axios';

import { InvoiceLine } from '@src/models/account/InvoiceLine';
import { EGS, EGSUnitInfo } from "@src/Integrations/zatcaLib/zatca/egs";
import { ZATCASimplifiedInvoiceLineItem, ZATCASimplifiedInvoicCancelation, ZATCASimplifiedInvoiceProps, ZATCAInvoiceTypes, ZATCAPaymentMethods } from "@src/Integrations/zatcaLib/zatca/templates/simplified_tax_invoice_template";
import { ZATCASimplifiedTaxInvoice, } from "@src/Integrations/zatcaLib/zatca/ZATCASimplifiedTaxInvoice";
import populate from "@src/Integrations/zatcaLib/zatca/templates/simplified_tax_invoice_template"
import { Invoice } from '@src/models/account/Invoice';
import { PDFGenerator } from '@src/utilts/PDFGenerator';
import { CustomerBalanceQueue } from '@src/repo/triggers/userBalancesQueue';
import { ZatcaInvoiceQueue } from '@src/controller/admin/ZatcaInvoiceQueue';
import { JOFatooraQueue } from '@src/controller/admin/JOFatooraQueue';
import { InvoiceStatuesQueue } from '@src/repo/triggers/queue/workers/invoiceStatus.worker';
import { publishEvent } from '@src/utilts/system-events';
var xmldom = require("xmldom");
var c14n = require("xml-c14n")();


export class InvoiceController {
    public static async addInvoice(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body;
            await client.query("BEGIN")
            let resault;
            console.log("add Invoice")
            data.employeeId = data.id != "" && data.id != null ? data.employeeId : employeeId
            const validate = await InvoiceValidation.invoiceValidation(data);
            await CompanyRepo.validateTransactionDate(client, data.invoiceDate, data.branchId, company.id)
            if (!validate.valid) {
                throw new Error(validate.error);
            }
            if (data.id == null || data.id == "") {

                resault = await InvoiceRepo.addInvoice(client, data, company);
            } else {
                resault = await InvoiceRepo.editInvoice(client, data, company, employeeId);
            }
            await client.query("COMMIT")

            const queue = ViewQueue.getQueue();
            queue.pushJob()
            console.log("geeeeeeeeeeeee", resault)
            if (resault.success) {
                if (data.status != 'Draft') {
                    console.log("geeeeeeeeeeeee", "push")
                    let queueInstance = TriggerQueue.getInstance();

                    InvoiceStatuesQueue.get().createJob({
                        id: resault.data.invoice.id
                    } as any);

                    queueInstance.createJob({ journalType: "Movment", type: "invoice", id: [resault.data.invoice.id] })
                    queueInstance.createJob({ journalType: "Movment", type: "parentChildMovment", ids: [resault.data.invoice.id] })
                    queueInstance.createJob({ type: "Invoices", id: [resault.data.invoice.id], companyId: company.id })

                    if (data.customerId) {
                        let userBalancesQueue = CustomerBalanceQueue.getInstance();
                        userBalancesQueue.createJob({ userId: data.customerId, dbTable: 'Invoices' })

                    }

                }

            }



            return res.send(resault)
        } catch (error: any) {

            await client.query("ROLLBACK")

                throw error
        } finally {
            client.release()
        }
    }

    public static async saveOpenInvoice(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            const company = res.locals.company;
            const invoiceId = req.params.invoiceId;
            const user = res.locals.user;
            await client.query("BEGIN")
            let resault = await InvoiceRepo.saveOpenInvoice(client, invoiceId, company, user);
            await client.query("COMMIT")
            // const queue = ViewQueue.getQueue();
            // queue.pushJob()


            if (resault.success) {
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "Invoices", id: [resault.data.invoice.id], companyId: company.id })
                // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [invoiceId] })
                InvoiceStatuesQueue.get().createJob({
                    id: invoiceId
                } as any);
                queueInstance.createJob({ journalType: "Movment", type: "invoice", id: [resault.data.invoice.id] })
                queueInstance.createJob({ journalType: "Movment", type: "parentChildMovment", ids: [resault.data.invoice.id] })

                let userBalancesQueue = CustomerBalanceQueue.getInstance();
                userBalancesQueue.createJob({ transactionId: invoiceId, dbTable: 'Invoices' })

            }

            return res.send(resault)
        } catch (error: any) {
            await client.query("ROLLBACK")

                throw error
        } finally {
            client.release()
        }
    }

    public static async getEcommercePlacedOrders(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            const data = res.locals.company;
            const branchId = req.params.branchId;
            let client: any;

            await client.query("BEGIN")

            let resault = await SocketInvoiceRepo.getEcommercePlacedOrders(client, data, branchId, client);

            const queue = ViewQueue.getQueue();
            queue.pushJob()
            await client.query("COMMIT")

            return res.send(resault)
        } catch (error: any) {
            await client.query("ROLLBACK")

                throw error
        } finally {
            client.release()
        }
    }



    public static async getXmlInvoices(req: Request, res: Response, next: NextFunction) {


        try {
            const invoiceId = req.params.invoiceId;
            let company = res.locals.company;
            const Invoice = (await InvoiceRepo.getInvoiceById(invoiceId, company)).data;
            company = (await CompanyRepo.getCompanyById(company.id)).data;
            const branch = await BranchesRepo.getBranchById(Invoice.branchId, company);

            //change this to get it from database
            let binarySecurityToken = "TUlJQ0tqQ0NBZENnQXdJQkFnSUdBWkV4Qng4ck1Bb0dDQ3FHU000OUJBTUNNQlV4RXpBUkJnTlZCQU1NQ21WSmJuWnZhV05wYm1jd0hoY05NalF3T0RBNE1EZ3dOekV4V2hjTk1qa3dPREEzTWpFd01EQXdXakJyTVdrd0NRWURWUVFHRXdKVFFUQVdCZ05WQkFzTUR6TTVPVGs1T1RrNU9UZ3dNREF3TXpBaEJnTlZCQU1NR3RpejJZcllyeURZcmRpejJZclpoaUI4SUZOSWRYTnpZV2x1TUNFR0ExVUVDZ3dhMkxQWml0aXZJTml0MkxQWml0bUdJSHdnVTBoMWMzTmhhVzR3V1RBVEJnY3Foa2pPUFFJQkJnZ3Foa2pPUFFNQkJ3TkNBQVIrOHcvcWEwNTB1NWFKQU5JaFQxRzJ5ZW1UR1lwMlZQSnVlQ0kyeEJrZVZYeFJVdmlucjROYVIreW5vMHlNeU5xMmlUZTI4ZTBGNkNWOG1mUVdqVzl2bzRHMU1JR3lNQXdHQTFVZEV3RUIvd1FDTUFBd2dhRUdBMVVkRVFTQm1UQ0JscVNCa3pDQmtERStNRHdHQTFVRUJBdzFNUzFRYjNOT1lXMWxmREl0UnpSOE15MDJOV0ZoWkRJek1pMWpOV1F5TFRRNFkyTXRZbUZoWWkwelptRTVPR1UwTURCak5UVXhIekFkQmdvSmtpYUprL0lzWkFFQkRBOHpNREF3TURBd01EQXdNREF3TURNeERUQUxCZ05WQkF3TUJERXhNREF4RHpBTkJnTlZCQm9NQmtwbFpHUmhhREVOTUFzR0ExVUVEd3dFUm05dlpEQUtCZ2dxaGtqT1BRUURBZ05JQURCRkFpQks5SmJZazhlUkltT3FMRDNXUXdwUnYvb0JYS1g0SXFEVFQvdm90UmlkWHdJaEFOL3pJWWR4STBKYS9oRHdQK1gzRWZvTWJJMHhWeDFleFpuZHpTZ1hoSlox"
            let certifcate = atob(binarySecurityToken);
            let secret = "jWbqulG127I3B807/PQjHKOClr/MWMhYN6LZq/oXZ38=";
            let requistID = "1234567890123"
            let PrivateKey = "MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgRlFWxvPwtpBop+ZpgDvVOsQjEC9tbsZKHDNC0G4I/zugCgYIKoZIzj0DAQehRANCAAR+8w/qa050u5aJANIhT1G2yemTGYp2VPJueCI2xBkeVXxRUvinr4NaR+yno0yMyNq2iTe28e0F6CV8mfQWjW9v"
            let PublicKey = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEfvMP6mtOdLuWiQDSIU9RtsnpkxmKdlTybngiNsQZHlV8UVL4p6+DWkfsp6NMjMjatok3tvHtBeglfJn0Fo1vbw=="
            //   const invoices = await InvoiceRepo.getInvoicesList(data, company);
            let discountTotal = 0;
            let invoiceLines: any[] = [];
            let LineId = 0;
            Invoice.lines.forEach((line: InvoiceLine) => {
                LineId++;
                let jsonline = {
                    'cbc:ID': LineId,
                    'cbc:InvoicedQuantity': {
                        '@unitCode': 'PCE',
                        '#text': line.qty + '.000000'
                    },
                    'cbc:LineExtensionAmount': {
                        '@currencyID': 'SAR',
                        '#text': line.subTotal
                    },
                    'cac:TaxTotal': {
                        'cbc:TaxAmount': {
                            '@currencyID': 'SAR',
                            '#text': line.taxTotal
                        },
                        'cbc:RoundingAmount': {
                            '@currencyID': 'SAR',
                            '#text': line.total
                        }
                    },
                    'cac:Item': {
                        'cbc:Name': line.selectedItem.name,
                        'cac:ClassifiedTaxCategory': {
                            'cbc:ID': 'S',
                            'cbc:Percent': '15.00', //TODO get percentage from the line
                            'cac:TaxScheme': {
                                'cbc:ID': 'VAT'
                            }
                        }
                    },

                    'cac:Price': {
                        'cbc:PriceAmount': {
                            '@currencyID': 'SAR',
                            '#text': line.price
                        },
                        'cac:AllowanceCharge': {
                            'cbc:ChargeIndicator': 'true',
                            'cbc:AllowanceChargeReason': 'discount',
                            'cbc:Amount': {
                                '@currencyID': 'SAR',
                                '#text': line.discountAmount

                            }
                        }
                    }
                }
                invoiceLines.push(jsonline);
            }
            )

            company.vatNumber = '399999999800003'
            const invoiceData = {
                Invoice: {
                    '@xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
                    '@xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
                    '@xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
                    '@xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
                    'ext:UBLExtensions': {
                        'ext:UBLExtension': {
                            'ext:ExtensionURI': 'urn:oasis:names:specification:ubl:dsig:enveloped:xades',
                            'ext:ExtensionContent': {
                                'sig:UBLDocumentSignatures': {
                                    '@xmlns:sig': 'urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2',
                                    '@xmlns:sac': 'urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2',
                                    '@xmlns:sbc': 'urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2',
                                    'sac:SignatureInformation': {
                                        'cbc:ID': 'urn:oasis:names:specification:ubl:signature:1',
                                        'sbc:ReferencedSignatureID': 'urn:oasis:names:specification:ubl:signature:Invoice',
                                        'ds:Signature': {
                                            '@xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
                                            '@Id': 'signature',
                                            'ds:SignedInfo': {
                                                'ds:CanonicalizationMethod': {
                                                    '@Algorithm': 'http://www.w3.org/2006/12/xml-c14n11'
                                                },
                                                'ds:SignatureMethod': {
                                                    '@Algorithm': 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256'
                                                },
                                                'ds:Reference': [
                                                    {
                                                        '@Id': 'invoiceSignedData',
                                                        '@URI': '',
                                                        'ds:Transforms': {
                                                            'ds:Transform': [
                                                                {
                                                                    '@Algorithm': 'http://www.w3.org/TR/1999/REC-xpath-19991116',
                                                                    'ds:XPath': 'not(//ancestor-or-self::ext:UBLExtensions)'
                                                                },
                                                                {
                                                                    '@Algorithm': 'http://www.w3.org/TR/1999/REC-xpath-19991116',
                                                                    'ds:XPath': 'not(//ancestor-or-self::cac:Signature)'
                                                                },
                                                                {
                                                                    '@Algorithm': 'http://www.w3.org/TR/1999/REC-xpath-19991116',
                                                                    'ds:XPath': `not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])`
                                                                },
                                                                {
                                                                    '@Algorithm': 'http://www.w3.org/2006/12/xml-c14n11'
                                                                }
                                                            ]
                                                        },
                                                        'ds:DigestMethod': {
                                                            '@Algorithm': 'http://www.w3.org/2001/04/xmlenc#sha256'
                                                        },
                                                        'ds:DigestValue': 'f+0WCqnPkInI+eL9G3LAry12fTPf+toC9UX07F4fI+s='
                                                    },
                                                    {
                                                        '@Type': 'http://www.w3.org/2000/09/xmldsig#SignatureProperties',
                                                        '@URI': '#xadesSignedProperties',
                                                        'ds:DigestMethod': {
                                                            '@Algorithm': 'http://www.w3.org/2001/04/xmlenc#sha256'
                                                        },
                                                        'ds:DigestValue': 'ODQwNTg1NTBhMjMzM2YxY2ZkZjVkYzdlNTZiZjY0ODJjMjNkYWI4MTUzNjdmNDVjMjAwZTBjODc2YTNhMWQ1Ng=='
                                                    }
                                                ]
                                            },
                                            'ds:SignatureValue': secret,
                                            'ds:KeyInfo': {
                                                'ds:X509Data': {
                                                    'ds:X509Certificate': certifcate
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    'cbc:ProfileID': 'reporting:1.0',
                    'cbc:ID': 'SME00023',
                    'cbc:UUID': Invoice.id,
                    'cbc:IssueDate': new Date(Invoice.createdAt).toISOString().split('T')[0],
                    'cbc:IssueTime': new Date(Invoice.createdAt).toTimeString().split(' ')[0].substring(0, 8),
                    'cbc:InvoiceTypeCode': {
                        '@name': '0200000',
                        '#text': '388'
                    },
                    'cbc:DocumentCurrencyCode': 'SAR',
                    'cbc:TaxCurrencyCode': 'SAR',
                    'cac:AdditionalDocumentReference': [{
                        'cbc:ID': 'ICV',
                        'cbc:UUID': '10'
                    }, {
                        'cbc:ID': 'PIH',
                        'cac:Attachment': {
                            'cbc:EmbeddedDocumentBinaryObject': {
                                '@mimeCode': 'text/plain',
                                '#text': 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ=='
                            }
                        }
                    }, {
                        'cbc:ID': 'QR',
                        'cac:Attachment': {
                            'cbc:EmbeddedDocumentBinaryObject': {
                                '@mimeCode': 'text/plain',
                                '#text': ""
                            }
                        }

                    }],
                    'cac:Signature': {
                        'cbc:ID': 'urn:oasis:names:specification:ubl:signature:Invoice',
                        'cbc:SignatureMethod': 'urn:oasis:names:specification:ubl:dsig:enveloped:xades'
                    },
                    'cac:AccountingSupplierParty': {
                        'cac:Party': {
                            'cac:PartyIdentification': {
                                'cbc:ID': {
                                    '@schemeID': 'CRN',
                                    '#text': '1010010000'

                                }


                            },

                            'cac:PostalAddress': {
                                //TODO input
                                'cbc:StreetName': 'الامير سلطان | Prince Sultan',
                                'cbc:BuildingNumber': '2322',
                                'cbc:CitySubdivisionName': 'المربع | Al-Murabba',
                                'cbc:CityName': 'الرياض | Riyadh',
                                'cbc:PostalZone': '23333',
                                'cac:Country': {
                                    'cbc:IdentificationCode': 'SA'
                                }

                            },

                            'cac:PartyTaxScheme': {
                                'cbc:CompanyID': '300000000000003',
                                'cac:TaxScheme': {
                                    'cbc:ID': 'VAT'
                                }
                            },

                            'cac:PartyLegalEntity': {
                                'cbc:RegistrationName': 'invo'//company.name
                            },
                        }



                    },
                    'cac:AccountingCustomerParty': {

                        //input for stamped invoce 
                        'cac:Party': {
                            'cac:PostalAddress': {
                                'cbc:StreetName': 'صلاح الدين | Salah Al-Din',
                                'cbc:BuildingNumber': '1111',
                                'cbc:CitySubdivisionName': 'المروج | Al-Murooj',
                                'cbc:CityName': 'الرياض | Riyadh',
                                'cbc:PostalZone': '12222',
                                'cac:Country': {
                                    'cbc:IdentificationCode': 'SA'
                                }


                            },
                            'cac:PartyTaxScheme': {
                                'cbc:CompanyID': '399999999900003',
                                'cac:TaxScheme': {
                                    'cbc:ID': 'VAT'
                                }
                            },

                            'cac:PartyLegalEntity': {
                                'cbc:RegistrationName': company.name
                            }
                        }




                    },
                    'cac:PaymentMeans': {

                        'cbc:PaymentMeansCode': '10'
                    },
                    'cac:AllowanceCharge': {
                        'cbc:ChargeIndicator': 'false',
                        'cbc:AllowanceChargeReason': 'discount',
                        'cbc:Amount': {
                            '@currencyID': 'SAR',
                            '#text': discountTotal
                        },
                        'cac:TaxCategory': {
                            'cbc:ID': {
                                '@schemeID': 'UN/ECE 5305',
                                '@schemeAgencyID': '6',
                                '#text': 'S'
                            },
                            'cbc:Percent': '15.00',
                            'cac:TaxScheme': {
                                'cbc:ID': {
                                    '@schemeID': 'UN/ECE 5153',
                                    '@schemeAgencyID': '6',
                                    '#text': 'VAT'
                                }
                            }

                        }

                    },
                    'cac:TaxTotal': [
                        {
                            'cbc:TaxAmount': {
                                '@currencyID': 'SAR',
                                '#text': Invoice.invoiceTaxTotal.toString()
                            }
                        },
                        {
                            'cbc:TaxAmount': {
                                '@currencyID': 'SAR',
                                '#text': Invoice.invoiceTaxTotal.toString()
                            },


                            'cac:TaxSubtotal': {
                                'cbc:TaxableAmount': {
                                    '@currencyID': 'SAR',
                                    '#text': ((Invoice.itemSubTotal) - discountTotal).toString()
                                },

                                'cbc:TaxAmount': {
                                    '@currencyID': 'SAR',
                                    '#text': (Invoice.itemSubTotal * (15.00 / 100)).toFixed(2).toString()
                                },
                                'cac:TaxCategory': {
                                    'cbc:ID': {
                                        '@schemeID': 'UN/ECE 5305',
                                        '@schemeAgencyID': '6',
                                        '#text': 'S'
                                    },
                                    'cbc:Percent': '15.00',
                                    'cac:TaxScheme': {
                                        'cbc:ID': {
                                            '@schemeID': 'UN/ECE 5153',
                                            '@schemeAgencyID': '6',
                                            '#text': 'VAT'
                                        }
                                    }

                                }
                            }
                        }

                    ],
                    'cac:LegalMonetaryTotal': {

                        'cbc:LineExtensionAmount': {
                            '@currencyID': 'SAR',
                            '#text': Invoice.itemSubTotal
                        },
                        'cbc:TaxExclusiveAmount': {
                            '@currencyID': 'SAR',
                            '#text': Invoice.itemSubTotal.toString()
                        },
                        'cbc:TaxInclusiveAmount': {
                            '@currencyID': 'SAR',
                            '#text': Invoice.total.toString()
                        },
                        'cbc:AllowanceTotalAmount': {
                            '@currencyID': 'SAR',
                            '#text': '0.00'
                        },
                        'cbc:PrepaidAmount': {
                            '@currencyID': 'SAR',
                            '#text': '0.00'
                        },
                        'cbc:PayableAmount': {
                            '@currencyID': 'SAR',
                            '#text': Invoice.total.toString()
                        }

                    },
                    'cac:InvoiceLine': invoiceLines
                }
            }
            const date = new Date(Invoice.createdAt.replace(' ', 'T') + 'Z');
            const isoDateString = date.toISOString();
            const allInvoiceData = await zatca.getAllinvoiceData(invoiceData, PrivateKey, PublicKey);
            const certDet = await zatca.getCertefcateSignatureValue(certifcate);
            const invoiceHash = allInvoiceData?.InvoiceHash;
            const signature: string = allInvoiceData?.invoiceSignature ?? '';
            const invoicePublicKey = allInvoiceData?.publicKey;
            // const Base64Qr = (await zatca.getQrCode(company.name, company.vatNumber, Invoice.createdAt, Invoice.total.toString(), Invoice.invoiceTaxTotal.toString(),invoiceHash,PrivateKey,PublicKey))?.qrCodeBase64;

            const Base64Qr = (await zatca.getQrCode(company.name, company.vatNumber, isoDateString, Invoice.total.toString(), Invoice.invoiceTaxTotal.toFixed(2).toString(), invoiceHash, signature, PublicKey, certDet))?.qrCodeBase64;


            //  invoiceData.Invoice['cac:AdditionalDocumentReference'][2]?.['cac:Attachment']?.['cbc:EmbeddedDocumentBinaryObject']?.['#text'] = Base64Qr as string;
            const additionalDocRef = invoiceData.Invoice['cac:AdditionalDocumentReference'];
            if (additionalDocRef && additionalDocRef[2] && additionalDocRef[2]['cac:Attachment'] && additionalDocRef[2]['cac:Attachment']['cbc:EmbeddedDocumentBinaryObject']) {
                additionalDocRef[2]['cac:Attachment']['cbc:EmbeddedDocumentBinaryObject']['#text'] = Base64Qr || '';
            } else {
                console.error('Failed to find the correct path in invoiceData to update Base64Qr');
            }
            invoiceData.Invoice['ext:UBLExtensions']['ext:UBLExtension']['ext:ExtensionContent']['sig:UBLDocumentSignatures']['sac:SignatureInformation']['ds:Signature']['ds:SignatureValue'] = signature;

            console.log("ds:SignatureValue", invoiceData.Invoice['ext:UBLExtensions']['ext:UBLExtension']['ext:ExtensionContent']['sig:UBLDocumentSignatures']['sac:SignatureInformation']['ds:Signature']['ds:SignatureValue']);
            invoiceData.Invoice['ext:UBLExtensions']['ext:UBLExtension']['ext:ExtensionContent']['sig:UBLDocumentSignatures']['sac:SignatureInformation']['ds:Signature']['ds:SignedInfo']['ds:Reference'][0]['ds:DigestValue'] = invoiceHash as any;
            const xml = builder.create(invoiceData, { encoding: 'UTF-8' }).end({ pretty: true });


            const canonicalizeXml = (document: Document): Promise<string> => {
                return new Promise((resolve, reject) => {
                    const canonicaliser = c14n.createCanonicaliser("http://www.w3.org/2001/10/xml-exc-c14n#WithComments");
                    canonicaliser.canonicalise(document.documentElement, (err: any, res: any) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };
            // const canonicalizedXml = canonicalizer(xml2);
            let document = (new xmldom.DOMParser()).parseFromString(xml);
            console.log(xml);
            const base64Invoice = btoa(unescape(encodeURIComponent(xml)));

            const config = {
                method: 'post',
                url: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance/invoices',
                headers: {
                    'Accept-Language': 'en',
                    'Accept-Version': 'V2',
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic VFVsSlEwdHFRME5CWkVOblFYZEpRa0ZuU1VkQldrVjRRbmc0Y2sxQmIwZERRM0ZIVTAwME9VSkJUVU5OUWxWNFJYcEJVa0puVGxaQ1FVMU5RMjFXU21KdVduWmhWMDV3WW0xamQwaG9ZMDVOYWxGM1QwUkJORTFFWjNkT2VrVjRWMmhqVGsxcWEzZFBSRUV6VFdwRmQwMUVRWGRYYWtKeVRWZHJkME5SV1VSV1VWRkhSWGRLVkZGVVFWZENaMDVXUWtGelRVUjZUVFZQVkdzMVQxUnJOVTlVWjNkTlJFRjNUWHBCYUVKblRsWkNRVTFOUjNScGVqSlpjbGx5ZVVSWmNtUnBlakpaY2xwb2FVSTRTVVpPU1dSWVRucFpWMngxVFVORlIwRXhWVVZEWjNkaE1reFFXbWwwYVhaSlRtbDBNa3hRV21sMGJVZEpTSGRuVlRCb01XTXpUbWhoVnpSM1YxUkJWRUpuWTNGb2EycFBVRkZKUWtKblozRm9hMnBQVUZGTlFrSjNUa05CUVZJck9IY3ZjV0V3TlRCMU5XRktRVTVKYUZReFJ6SjVaVzFVUjFsd01sWlFTblZsUTBreWVFSnJaVlpZZUZKVmRtbHVjalJPWVZJcmVXNXZNSGxOZVU1eE1tbFVaVEk0WlRCR05rTldPRzFtVVZkcVZ6bDJielJITVUxSlIzbE5RWGRIUVRGVlpFVjNSVUl2ZDFGRFRVRkJkMmRoUlVkQk1WVmtSVkZUUW0xVVEwSnNjVk5DYTNwRFFtdEVSU3ROUkhkSFFURlZSVUpCZHpGTlV6RlJZak5PVDFsWE1XeG1SRWwwVW5wU09FMTVNREpPVjBab1drUkplazFwTVdwT1YxRjVURlJSTkZreVRYUlpiVVpvV1drd2VscHRSVFZQUjFVd1RVUkNhazVVVlhoSWVrRmtRbWR2U210cFlVcHJMMGx6V2tGRlFrUkJPSHBOUkVGM1RVUkJkMDFFUVhkTlJFRjNUVVJOZUVSVVFVeENaMDVXUWtGM1RVSkVSWGhOUkVGNFJIcEJUa0puVGxaQ1FtOU5RbXR3YkZwSFVtaGhSRVZPVFVGelIwRXhWVVZFZDNkRlVtMDVkbHBFUVV0Q1oyZHhhR3RxVDFCUlVVUkJaMDVKUVVSQ1JrRnBRa3M1U21KWmF6aGxVa2x0VDNGTVJETlhVWGR3VW5ZdmIwSllTMWcwU1hGRVZGUXZkbTkwVW1sa1dIZEphRUZPTDNwSldXUjRTVEJLWVM5b1JIZFFLMWd6UldadlRXSkpNSGhXZURGbGVGcHVaSHBUWjFob1Nsb3g6aldicXVsRzEyN0kzQjgwNy9QUWpIS09DbHIvTVdNaFlONkxacS9vWFozOD0='
                },
                data: {
                    invoiceHash: invoiceHash as any,
                    uuid: Invoice.id,
                    invoice: base64Invoice
                }
            };

            try {
                const response = await axios(config);
                console.log('Success:', response.data);
                return res.send(response.data);
            } catch (error: any) {
                if (error.response) {

                    // console.error('Response error:', JSON.stringify(error.response.data));
                    // console.error('Status code:', JSON.stringify(error.response.status));
                    // console.error('Headers:', JSON.stringify(error.response.headers));
                    return res.send(error.response.data);
                } else {
                    console.error('Error:', error.message);
                }
            }
            // return res.send(qrBase64);
        } catch (error: any) {
            console.log(error)
              throw error
        }
    }

    public static async IssueZatcaCertefcate(req: Request, res: Response, next: NextFunction) {
        try {
            let company = res.locals.company;
            const data = req.body;
            company = (await CompanyRepo.getCompanyById(company.id)).data;
            const egsunit: EGSUnitInfo = data.zatcaInfo
            const egs = new EGS(egsunit);
            // New Keys & CSR for the EGS
            await egs.generateNewKeysAndCSR(true, "INVO");
            // Issue a new compliance cert for the EGS
            let ComplincerequistId = await egs.issueComplianceCertificate(data.OTP);
            let reportingComplince = await InvoiceRepo.zatcaComplinceInvoice(egs);
            let Pcidr = await egs.issueProductionCertificate(ComplincerequistId);
            let info = egs.get();

            let zatcaInfo = {
                ComplincerequistId: ComplincerequistId,
                ProdrequistId: Pcidr,
                zatca: info
            }
            let response = BranchesRepo.setBranchZatca(zatcaInfo, data.uuid);
            return res.send(new ResponseData(true, "", response))

        } catch (e: any) {
            console.log(e);
              throw e
        }
    }


    public static async zatcaSamplifedInvoice(req: Request, res: Response, next: NextFunction) {

        try {
            const invoiceId = req.params.invoiceId;
            let company = res.locals.company;
            const client = await DB.excu.client();
            let queueInstance = ZatcaInvoiceQueue.getInstance();
            await queueInstance.createJob(invoiceId);
            await DB.excu.query(
                `UPDATE "Invoices" SET "zatca_status" = 'QUEUED' WHERE id = $1`,
                [invoiceId]
            );

            return res.send(true);
        } catch (error: any) {
              throw error
        }
    }





    public static async JOFatooreInvoice(req: Request, res: Response, next: NextFunction) {

        try {
            const invoiceId = req.params.invoiceId;
            let company = res.locals.company;
            const client = await DB.excu.client();
            let queueInstance = JOFatooraQueue.getInstance();
            await queueInstance.createJob(invoiceId);
            await DB.excu.query(
                `UPDATE "Invoices" SET "jofotara_status" = 'QUEUED' WHERE id = $1`,
                [invoiceId]
            );

            return res.send(true);
        } catch (error: any) {
             throw error
        }
    }











    public static async getInvoices(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body
            const branches = res.locals.branches;
            const invoices = await InvoiceRepo.getInvoicesList(data, company, branches);
            return res.send(invoices)
        } catch (error: any) {

                throw error
        }
    }



    public static async getZatcaInvoices(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body
            const branches = res.locals.branches;
            const invoices = await InvoiceRepo.getZatcaInvoicesList(data, company, branches);
            return res.send(invoices)
        } catch (error: any) {

                throw error
        }
    }


    public static async getJofotaraInvoices(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body
            const branches = res.locals.branches;
            const invoices = await InvoiceRepo.getJofotaraInvoicesList(data, company, branches);
            return res.send(invoices)
        } catch (error: any) {

                throw error
        }
    }









    public static async getOnlineInvoices(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const branches = res.locals.branches;
            const data = req.body
            const invoices = await InvoiceRepo.getOnlineInvoicesList(data, company, branches);
            return res.send(invoices)
        } catch (error: any) {

                throw error
        }
    }

    public static async updateInvoiceStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body

            data.invoiceId
            const invoice = await InvoiceRepo.updateInvoiceStatus(data, company, employeeId);
            if (invoice.success && invoice.data.invoice && invoice.data.invoice.status != 'Draft' && invoice.data.addJournal) {
                // if(data.status != 'Draft'){
                let queueInstance = TriggerQueue.getInstance();
                // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [data.invoiceId] })

                queueInstance.createJob({ journalType: "Movment", type: "invoice", id: [data.invoiceId] })
                queueInstance.createJob({ journalType: "Movment", type: "parentChildMovment", ids: [data.invoiceId] })
                queueInstance.createJob({ type: "Invoices", id: [data.invoiceId], companyId: company.id })
                queueInstance.createJob({ type: "pushNotifictios", invoiceIds: [{ id: data.invoiceId, status: data.status }] })
                // }
                await publishEvent("OrderOnlineStatusChanged", { invoiceId: data.invoiceId, status: data.status, companyId: company.id })

            }
            InvoiceStatuesQueue.get().createJob({
                id: data.invoiceId
            } as any);
            return res.send(invoice)
        } catch (error: any) {

                throw error
        }
    }
    public static async getInvoiceById(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const invoiceId = req.params['invoiceId']
            const invoice = await InvoiceRepo.getInvoiceById(invoiceId, company);
            return res.send(invoice)
        } catch (error: any) {

                throw error
        }
    }


    public static async writeOffInvoice(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const invoiceId = req.body.invoiceId
            const invoice = await InvoiceRepo.writeOffInvoice(invoiceId, company.id);
            const queue = ViewQueue.getQueue();
            queue.pushJob()

            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "WriteOffInvoice", id: invoiceId, companyId: company.id })
            return res.send(invoice)
        } catch (error: any) {

                throw error
        }
    }
    public static async getCustomerInvoices(req: Request, res: Response, next: NextFunction) {
        try {
            const customerId = req.params.customerId;
            const company = res.locals.company;
            const branchId = req.params.branchId;

            let invoice: ResponseData

            if (branchId) { invoice = await InvoiceRepo.getCustomerInvoices(customerId, branchId) }
            else { invoice = await InvoiceRepo.getCustomerInvoicesForAllBranches(customerId, company.id) }

            return res.send(invoice)

        } catch (error: any) {

                throw error
        }
    }
    public static async getInvoiceNumber(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const branchId = req.params.branchId;
            const company = res.locals.company;
            const invoice = await InvoiceRepo.getInvoiceNumber(client, branchId, company)
            await client.query("COMMIT")
            return res.send(invoice)

        } catch (error: any) {
            await client.query("ROLLBACK")
                throw error
        } finally {
            client.release()
        }
    }
    public static async getBranchProductsList(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body
            const company = res.locals.company;
            const products = await InvoiceRepo.getBranchProductList3(data, company)
            return res.send(products)
        } catch (error: any) {

                throw error
        }
    }

    public static async getBranchProductByBarcode(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body
            const company = res.locals.company;
            const products = await InvoiceRepo.getBranchProductByBarcode(data, company)
            return res.send(products)
        } catch (error: any) {

                throw error
        }
    }
    public static async getInvoiceJournal(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params.invoiceId;
            const company = res.locals.company;
            const products = await InvoiceRepo.getInvoiceJournal(branchId, company)
            return res.send(products)
        } catch (error: any) {

                throw error
        }
    }

    public static async deleteInvoice(req: Request, res: Response, next: NextFunction) {
        try {
            const invoiceId = req.params.invoiceId;
            const company = res.locals.company;
            const employeeId = res.locals.user
            const products = await InvoiceRepo.deleteInvoice(invoiceId, company, employeeId)
            const queue = ViewQueue.getQueue();
            queue.pushJob()
            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "DeleteJournal", referenceId: invoiceId })
            queueInstance.createJob({ journalType: "Movment", type: "Delete", ids: products.data.ids })
            let userBalancesQueue = CustomerBalanceQueue.getInstance();
            userBalancesQueue.createJob({ userId: products.data.customerId, dbTable: 'Invoices' })

            return res.send(new ResponseData(true, "", []))

        } catch (error: any) {

                throw error
        }
    }

    public static async sendInvoiceEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const pdfBuffer = await InvoiceRepo.sendEmail(data, company)


            // Send the PDF buffer as the response
            return res.send(pdfBuffer);

            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                throw error
        }
    }



    public static async sendInvoiceWhatsapp(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const response = await InvoiceRepo.sendWhatsapp(data, company)
            return res.send(response);
        } catch (error: any) {
            console.log(error);
                throw error
        }
    }









    public static async viewInvoicePdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                invoiceId: req.params.invoiceId
            }
            const company = res.locals.company;

            const pdfBuffer = await InvoiceRepo.getPdf(data)


            // Send the PDF buffer as the response
            return res.send(new ResponseData(true, "", pdfBuffer));

            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                throw error
        }
    }



    public static async getInvoicePdf(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            const pdfBuffer = await PDFGenerator.InvoicePdfGenerator(req.params.invoiceId)
            // res.send(pdfBuffer);
            // Send the PDF buffer as the response
            // return res.send(new ResponseData(true, "", pdfBuffer));
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename=invoice_${req.params.invoiceId}.pdf`);
            res.send(pdfBuffer); // Not res.json
            // res.send (pdfBuffer)
            // let chunks: Buffer[] = [];
            // pdfDoc.on("data", (chunk) => {
            //     chunks.push(chunk);
            // });

            // pdfDoc.on("end", () => {
            //     const result = Buffer.concat(chunks);

            //     res.setHeader("Content-Type", "application/pdf");
            //     res.setHeader("Content-Disposition", "inline; filename=example.pdf");

            //     res.send(result);
            // });

            // pdfDoc.end();


        } catch (error: any) {
            console.log(error);
                throw error
        }
    }


    public static async InvoicePdf(req: Request, res: Response, next: NextFunction) {
        try {

            const data = {
                invoiceId: req.params.invoiceId
            }
            const company = res.locals.company;

            const pdfBuffer = await InvoiceRepo.getPdf(data)
            const buffer = Buffer.from(pdfBuffer as any, 'base64');
            // Send the PDF buffer as the response
            // res.send(new ResponseData(true,"",pdfBuffer));
            res.setHeader('Content-Type', 'application/pdf');
            return res.send(buffer)


        } catch (error: any) {
            console.log(error);
                throw error
        }
    }


    public static async getReceivableAccounts(req: Request, res: Response, next: NextFunction) {
        try {

            const data = {
                invoiceId: req.params.invoiceId
            }
            const company = res.locals.company;

            const accounts = await InvoiceRepo.getReceivableAccounts(company)

            return res.send(accounts)

        } catch (error: any) {
            console.log(error);
                throw error
        }
    }


    public static async getMisiingInvoices(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.body.branchId;
            const creditNoteIds = req.body.creditNoteIds;
            const refund = await SocketInvoiceRepo.getMissingInvoices(req.body)
            return res.send(refund)
        } catch (error: any) {

                throw error
        }
    }

    public static async sendInvoiceForSignature(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const resData = await InvoiceRepo.sendInvoiceForSignature(data, company)

            // Send the PDF buffer as the response
            return res.send(resData);

            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                throw error
        }
    }

    public static async createInvoiceLink(req: Request, res: Response, next: NextFunction) {
        try {
            const invoiceId = req.body.invoiceId;
            const company = res.locals.company;
            const resData = await InvoiceRepo.createInvoiceLink(invoiceId, company.id);

            return res.send(resData);
        } catch (error: any) {
            console.log(error);
                throw error
        }
    }


   public static async getInvoiceProductMovementDetails(req: Request, res: Response, next: NextFunction) {
        try {
            const invoiceId = req.params.invoiceId;
            const company = res.locals.company;
            const resData = await InvoiceRepo.getInvoiceProductMovementDetails(invoiceId, company.id)

            return res.send(resData);

       


        } catch (error: any) {
            console.log(error);
                throw error
        }
    }
}

