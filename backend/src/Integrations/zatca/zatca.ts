import QRCode from 'qrcode';
import builder from 'xmlbuilder';

import * as crypto from 'crypto';
var xmldom = require("xmldom");
import { createHash,X509Certificate } from "crypto";
var c14n = require("xml-c14n")();
const elliptic = require('elliptic');

import{Certificate}from 'pkijs';
import {fromBER} from 'asn1js';
import { XmlCanonicalizer } from "xmldsigjs";
import { XMLDocument } from '@src/Integrations/zatca/xmlDoc';
export class zatca {













    public static async pemToDer(pem: any) {
        const lines = pem.split('\n');
        let pemContents = '';
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].indexOf('-----BEGIN') === -1 && lines[i].indexOf('-----END') === -1) {
                pemContents += lines[i].trim();
            }
        }
        return Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    }

    public static async getCertifcatePem(certifcate: any) {
        // Convert private key to PEM format
        const binaryKey = Buffer.from(certifcate, 'base64').toString('binary');
        const keyArray = new Uint8Array(binaryKey.length);
        for (let i = 0; i < binaryKey.length; i++) {
            keyArray[i] = binaryKey.charCodeAt(i);
        }
        const base64Key = Buffer.from(keyArray).toString('base64');
        const lines = base64Key.match(/.{1,64}/g);
        const certifcatePem = `-----BEGIN CERTIFICATE-----\n${lines?.join('\n')}\n-----END CERTIFICATE-----`;
        return certifcatePem;
    };

    public static async getTLVForValue(tagNum: any, tagValue: any) {
        try {
            // Ensure tagNum is a string, if not convert it
            let tagBuf = Buffer.alloc(1);
            tagBuf.writeUInt8(tagNum, 0);
            // Convert tagValue length to a single byte buffer (assuming length is less than 256)
            let tagValueLenBuf = Buffer.alloc(1);  // Allocate 1 byte for length
            tagValueLenBuf.writeUInt8(tagValue.length, 0);
            // Convert tagValue to a buffer
            let tagValueBuf = Buffer.from(tagValue, 'utf8');
            // Concatenate all buffers
            let bufsArray = Buffer.concat([tagBuf, tagValueLenBuf, tagValueBuf]);
            return bufsArray;
        } catch (e) {
            console.error(e);
        }
    }

    public static async getCertefcateSignatureValue(certifcation: any) {
        try {
            const pem = await this.getCertifcatePem(certifcation);
            const x509 = new X509Certificate(pem);


            const derCertificate = await this.pemToDer(pem);
            const ber = new Uint8Array(derCertificate).buffer
            const asn1 = fromBER(ber)
            let certt = new Certificate({ schema: asn1.result });
            let test = JSON.parse(JSON.stringify(certt.signatureValue.valueBlock.value[0] as any)).valueBeforeDecode;
            var base64String = Buffer.from(test, 'hex').toString('base64')
       
            return base64String;
            // console.log('Signature Algorithm:', cert);
        } catch (error) {
            console.error('Error parsing certificate:', error);
        }
    }

    public static async getQrCode(SellerNameBuf: any, VatNumber: any, Time: any, Total: any, Vat: any, hash: any, sig: any, pubKey: any, cert: any) {
        try {
       
            let sellerNameBuf = await this.getTLVForValue("01", SellerNameBuf);
            let vatNumber = await this.getTLVForValue("02", VatNumber);
            let time = await this.getTLVForValue("03", Time);
            let total = await this.getTLVForValue("04", Total);
            let VAT = await this.getTLVForValue("05", Vat);
            let Hash = await this.getTLVForValue("06", hash);
            let Sig = await this.getTLVForValue("07", sig);
            let PubKey = await this.getTLVForValue("08", atob(pubKey));
            let test9 = await this.getTLVForValue("09", atob(cert));
            console.log(4);
            let tagsBufsArray = [sellerNameBuf, vatNumber, time, total, VAT, Hash, Sig, PubKey, test9].filter((buf): buf is Buffer => buf !== undefined);
            let qrCodeBuf = Buffer.concat(tagsBufsArray);
            const qrCodeBase64 = qrCodeBuf.toString('base64');
            let qrCodeImage = await QRCode.toDataURL(qrCodeBase64);
            // let QR = `<img src="${qrCodeImage}" alt="QR Code"/>`
            return ({ "qrCodeBase64": qrCodeBase64, "qrCodeImage": qrCodeImage })
        } catch (e) {
            console.error(e);
        }
    }


    public static async signData(data: string, privateKey: string) {
        const sign = crypto.createSign('SHA256');
        sign.update(data);
        sign.end();
        return sign.sign(privateKey, 'base64');
    };

    public static async canonicalizeXml(document: Document): Promise<string> {
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


    public static async hashXML(xml: any) {
        const hash = crypto.createHash('sha256');
        hash.update(xml);
        return hash.digest('base64');
    };
    public static async getPrivateKeyPem(prvKey: any) {
        // Convert private key to PEM format
        const binaryKey = Buffer.from(prvKey, 'base64').toString('binary');
        const keyArray = new Uint8Array(binaryKey.length);
        for (let i = 0; i < binaryKey.length; i++) {
            keyArray[i] = binaryKey.charCodeAt(i);
        }
        const base64Key = Buffer.from(keyArray).toString('base64');
        const lines = base64Key.match(/.{1,64}/g);
        const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${lines?.join('\n')}\n-----END PRIVATE KEY-----`;
        return privateKeyPem;
    };

    public static async getInvoiceHash(data: any): Promise<string | undefined> {
        try {
            // Clone and modify the invoice data
            let invoiceData = JSON.parse(JSON.stringify(data));
            delete invoiceData.Invoice['ext:UBLExtensions'];
            delete invoiceData.Invoice['cac:Signature'];
            // Remove document with cbc:ID === 'QR'
            const docRef = invoiceData.Invoice['cac:AdditionalDocumentReference'] || [];
            const index = docRef.findIndex((doc: { [key: string]: string; }) => doc['cbc:ID'] === 'QR');
            if (index !== -1) {
                docRef.splice(index, 1);
            }


            // Convert invoice data to XML
            const xml = builder.create(invoiceData, { encoding: 'UTF-8' }).end({ pretty: true });
            const xml2 = xml.replace(/<\?xml version="1.0" encoding="UTF-8"\?>/, '');
            const document = (new xmldom.DOMParser()).parseFromString(xml2);




            let canonicalizer = new XmlCanonicalizer(false, false);
            // const canonicalizedXml = await this.canonicalizeXml(document);
            // const invoice256Hash = crypto.createHash('sha256').update(canonicalizedXml).digest('base64');
            let pure_invoice_string: string = canonicalizer.Canonicalize(document);
            pure_invoice_string = pure_invoice_string.replace("<cbc:ProfileID>", "\n    <cbc:ProfileID>");
            pure_invoice_string = pure_invoice_string.replace("<cac:AccountingSupplierParty>", "\n    \n    <cac:AccountingSupplierParty>");
            return createHash("sha256").update(pure_invoice_string).digest('base64');
            // const invoice256Hash = await this.hashXML(canonicalizedXml);
            // return invoice256Hash

        } catch (e) {
            console.error(e);
        }
    }

    public static async getInvoiceSignature(invoiceHash: any, prvKey: any): Promise<string | undefined> {
        try {

            // Convert invoice data to XML

            const Signature = await this.signData(invoiceHash, prvKey);
            console.log('Signature:', Signature);
            return Signature
        } catch (e) {
            console.error(e);
        }
    }








    public static async pemToHex(pem: any) {
        // Remove PEM headers
        const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, '');
        // Decode base64
        const buffer = Buffer.from(b64, 'base64');
        // Convert buffer to hex string
        return buffer.toString('hex');
    }

    public static async getSignedInvoicePublicKey(privateKey: any) {
        try {
            const EC = elliptic.ec;
            const ec = new EC('secp256k1');
            console.log("test")
            const privateKeyHex = this.pemToHex(privateKey);
            console.log("test2")
            const key = ec.keyFromPrivate(privateKeyHex);
            console.log("test3")
            const publicKey = key.getPublic('hex');
            console.log('Public Key (Compressed):', publicKey);
            const publicKeyUncompressed = key.getPublic('hex', false);
            console.log('Public Key (Uncompressed):', publicKeyUncompressed);
            return publicKeyUncompressed;
        } catch (e) {
            console.error('Error exporting public key:', e);
        }
    }




    public static async getAllinvoiceData(data: any, privateKey: any, publicKey: any) {
        try {
            const privateKeyPem = await this.getPrivateKeyPem(privateKey);
            let InvoiceHash = await this.someTest(data);
            let invoiceSignature = await this.getInvoiceSignature(InvoiceHash, privateKeyPem)
            // let publicKey = await this.getSignedInvoicePublicKey(privateKeyPem);
            let publicKey = 'publicKey';

            console.log("publicKey", publicKey)
            console.log("privateKeyPem", privateKeyPem)

            return { 'InvoiceHash': InvoiceHash, 'invoiceSignature': invoiceSignature, 'publicKey': publicKey };


        } catch (e) {
            console.error(e);
        }
    }






    public static async someTest(inv: string) {
        try {

            const xml = builder.create(inv, { encoding: 'UTF-8' }).end({ pretty: true });
            const invoice_copy: XMLDocument = new XMLDocument(xml);




            invoice_copy.delete("Invoice/ext:UBLExtensions");
            invoice_copy.delete("Invoice/cac:Signature");
            invoice_copy.delete("Invoice/cac:AdditionalDocumentReference", { "cbc:ID": "QR" });
            //remove xml version
            const invoice_xml_dom = (new xmldom.DOMParser()).parseFromString(
                invoice_copy.toString({ no_header: false })
            );


            var canonicalizer = new XmlCanonicalizer(false, false);
            let pure_invoice_string: string = canonicalizer.Canonicalize(invoice_xml_dom);
            // pure_invoice_string = pure_invoice_string.replace("<cbc:ProfileID>", "\n    <cbc:ProfileID>");
            // pure_invoice_string = pure_invoice_string.replace("<cac:AccountingSupplierParty>", "\n    \n    <cac:AccountingSupplierParty>");

            pure_invoice_string = `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
    <cbc:ID>SME00010</cbc:ID>
    <cbc:UUID>41ab2361-8812-43e4-9be3-8bcb12ce6fa7</cbc:UUID>
    <cbc:IssueDate>2024-08-08</cbc:IssueDate>
    <cbc:IssueTime>07:33:46</cbc:IssueTime>
    <cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
    <cac:AdditionalDocumentReference>
        <cbc:ID>ICV</cbc:ID>
        <cbc:UUID>10</cbc:UUID>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>PIH</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="CRN">1010010000</cbc:ID>
            </cac:PartyIdentification>
            <cac:PostalAddress>
                <cbc:StreetName>  | Prince Sultan</cbc:StreetName>
                <cbc:BuildingNumber>2322</cbc:BuildingNumber>
                <cbc:CitySubdivisionName> | Al-Murabba</cbc:CitySubdivisionName>
                <cbc:CityName> | Riyadh</cbc:CityName>
                <cbc:PostalZone>23333</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>SA</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>399999999800003</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>SHussain</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PostalAddress>
                <cbc:StreetName>  | Salah Al-Din</cbc:StreetName>
                <cbc:BuildingNumber>1111</cbc:BuildingNumber>
                <cbc:CitySubdivisionName> | Al-Murooj</cbc:CitySubdivisionName>
                <cbc:CityName> | Riyadh</cbc:CityName>
                <cbc:PostalZone>12222</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>SA</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>399999999900003</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>SHussain</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>
    <cac:PaymentMeans>
        <cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>
    </cac:PaymentMeans>
    <cac:AllowanceCharge>
        <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
        <cbc:AllowanceChargeReason>discount</cbc:AllowanceChargeReason>
        <cbc:Amount currencyID="SAR">0</cbc:Amount>
        <cac:TaxCategory>
            <cbc:ID schemeAgencyID="6" schemeID="UN/ECE 5305">S</cbc:ID>
            <cbc:Percent>15.00</cbc:Percent>
            <cac:TaxScheme>
                <cbc:ID schemeAgencyID="6" schemeID="UN/ECE 5153">VAT</cbc:ID>
            </cac:TaxScheme>
        </cac:TaxCategory>
    </cac:AllowanceCharge>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">13.5</cbc:TaxAmount>
    </cac:TaxTotal>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">13.5</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="SAR">90</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="SAR">13.50</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID schemeAgencyID="6" schemeID="UN/ECE 5305">S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID schemeAgencyID="6" schemeID="UN/ECE 5153">VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="SAR">90</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="SAR">90</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="SAR">103.5</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="SAR">0.00</cbc:AllowanceTotalAmount>
        <cbc:PrepaidAmount currencyID="SAR">0.00</cbc:PrepaidAmount>
        <cbc:PayableAmount currencyID="SAR">103.5</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
    <cac:InvoiceLine>
        <cbc:ID>1</cbc:ID>
        <cbc:InvoicedQuantity unitCode="PCE">1.000000</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="SAR">25</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="SAR">3.75</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="SAR">28.75</cbc:RoundingAmount>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>aattt tyuyty</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="SAR">25</cbc:PriceAmount>
            <cac:AllowanceCharge>
                <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
                <cbc:AllowanceChargeReason>discount</cbc:AllowanceChargeReason>
                <cbc:Amount currencyID="SAR">0</cbc:Amount>
            </cac:AllowanceCharge>
        </cac:Price>
    </cac:InvoiceLine>
    <cac:InvoiceLine>
        <cbc:ID>2</cbc:ID>
        <cbc:InvoicedQuantity unitCode="PCE">1.000000</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="SAR">20</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="SAR">3</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="SAR">23</cbc:RoundingAmount>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>test recipe  changes</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="SAR">20</cbc:PriceAmount>
            <cac:AllowanceCharge>
                <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
                <cbc:AllowanceChargeReason>discount</cbc:AllowanceChargeReason>
                <cbc:Amount currencyID="SAR">0</cbc:Amount>
            </cac:AllowanceCharge>
        </cac:Price>
    </cac:InvoiceLine>
    <cac:InvoiceLine>
        <cbc:ID>3</cbc:ID>
        <cbc:InvoicedQuantity unitCode="PCE">1.000000</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="SAR">45</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="SAR">6.75</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="SAR">51.75</cbc:RoundingAmount>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>test test  AAA SSSS</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="SAR">45</cbc:PriceAmount>
            <cac:AllowanceCharge>
                <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
                <cbc:AllowanceChargeReason>discount</cbc:AllowanceChargeReason>
                <cbc:Amount currencyID="SAR">0</cbc:Amount>
            </cac:AllowanceCharge>
        </cac:Price>
    </cac:InvoiceLine>
</Invoice>`
            let hash = createHash("sha256").update(pure_invoice_string).digest('base64');

            return hash;

            return invoice_copy;

        } catch (e) {
            console.error(e);
        }
    }







}


