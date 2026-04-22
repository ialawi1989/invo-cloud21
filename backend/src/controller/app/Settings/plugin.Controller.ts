import { ResponseData } from '@src/models/ResponseData';
import { PluginRepo } from '@src/repo/app/accounts/plugin.repo';
import { footfallCamJob } from '@src/controller/app/jobs/FootfallCam';
import { Request, Response, NextFunction } from 'express';
import{PrintableString,Utf8String,Sequence,Set} from 'asn1js';
import { arrayBufferToString, toBase64 } from 'pvutils';

import { AttributeTypeAndValue,CryptoEngine,getAlgorithmParameters,CertificationRequest,getCrypto,Extension,setEngine ,Attribute,Extensions} from 'pkijs';

import weCrypto from '@trust/webcrypto';
import { MOICJob } from '@src/controller/app/jobs/MOIC';
// import { CertificationRequest, CertificationRequestInfo, Name, SubjectPublicKeyInfo, AlgorithmIdentifier } from 'pkijs';

export class PluginController {
  public static async savePlugin(req: Request, res: Response, next: NextFunction) {

    try {
      const data = req.body;
      const company = res.locals.company;

      let resault;
      resault = await PluginRepo.savePlugin(data, company)
      return res.send(resault)
    } catch (error: any) {
        throw error
    }
  }


  public static async getPlugins(req: Request, res: Response, next: NextFunction) {

    try {
      const data = req.body;
      const company = res.locals.company;

      let resault;
      resault = await PluginRepo.getPluginList(data, company)
      return res.send(resault)
    } catch (error: any) {
        throw error
    }
  }

  public static async getPluginById(req: Request, res: Response, next: NextFunction) {

    try {
      const data = req.body;
      const company = res.locals.company;
      const pluginId = req.params.pluginId;


      let resault;
      resault = await PluginRepo.getPluginById(pluginId, company)
      return res.send(resault)
    } catch (error: any) {
        throw error
    }
  }


  //   public static async GenerateCsr(req: Request, res: Response, next: NextFunction) {
  // -----BEGIN CERTIFICATE REQUEST-----
  //   MIIB6jCCAY8CAQAwUTELMAkGA1UEBhMCU0ExEzARBgNVBAsMCjY2Njk5ODg1NDQx
  //   DTALBgNVBAoMBGludm8xHjAcBgNVBAMMFVRTVFpBVENBLUNvZGUtU2lnbmluZzBW
  //   MBAGByqGSM49AgEGBSuBBAAKA0IABICFEzYL8y1vJdKRDn4MKoaHDYB46bffawgU
  //   P1LDMblsYJay4oQA8Z16nycQ1gmAMNvOSFw3m9/KS473yrokN4Sggd4wgdsGCSqG
  //   SIb3DQEJDjGBzTCByjAkBgkrBgEEAYI3FAIEFwwVVFNUWkFUQ0EtQ29kZS1TaWdu
  //   aW5nMIGhBgNVHREEgZkwgZakgZMwgZAxPjA8BgNVBAQMNTEtUG9zTmFtZXwyLUc0
  //   fDMtNjVhYWQyMzItYzVkMi00OGNjLWJhYWItM2ZhOThlNDAwYzU1MR8wHQYKCZIm
  //   iZPyLGQBAQwPMzAwMDAwMDAwMDAwMDAzMQ0wCwYDVQQMDAQxMTAwMQ8wDQYDVQQa
  //   DAZKZWRkYWgxDTALBgNVBA8MBEZvb2QwCgYIKoZIzj0EAwIDSQAwRgIhAKQX4NaP
  //   vKcmeowUIHu5ROvAIK7ArmMV7gwf67rqeIk9AiEA4bb9MxhgSY5nYovp49asFDhY
  //   ZLlpj0/7cYCh3DNt4w8=
  //   -----END CERTIFICATE REQUEST-----

  //     try {

  //       var pem = require('pem')
  //       const csrPem = ``;

  //       // Remove PEM header, footer and newlines
  //       const csrBase64 = csrPem.replace(/-----BEGIN CERTIFICATE REQUEST-----/, '')
  //         .replace(/-----END CERTIFICATE REQUEST-----/, '')
  //         .replace(/\n/g, '');

  //       // Decode from base64 to binary
  //       const csrBuffer = Buffer.from(csrBase64, 'base64');

  //       // Parse the CSR
  //       const csr = pem.readCertificateRequest(csrBuffer);

  //       if (csr) {
  //         console.log(csr.subject); // Example: Outputs the subject information
  //         console.log(csr.attributes); // Example: Outputs any additional attributes
  //       } else {
  //         console.error('Failed to parse CSR');
  //       }
  //       return res.send(new ResponseData(true, "", []))

  //     } catch (error: any) {
  //       console.log(error)
  //         throw error
  //     }

  //   }










  // public static async GenerateCsr(req: Request, res: Response, next: NextFunction) {






  //   // @ts-ignore
  //   try {
  //     const commonName = 'TSTZATCA-Code-Signing';
  //     const countryName = 'SA';
  //     const organizationName = 'invo';
  //     const organizationalUnitName = '6669988544';
  //     const solutionProviderName = 'PosName';
  //     const version = 'G4';
  //     const serialNumber = '65aad232-c5d2-48cc-baab-3fa98e400c55';
  //     const UID = '300000000000003';
  //     const title = '1100';
  //     const registeredAddress = 'Jeddah';
  //     const businessCategory = 'Food';
  //     // let kp = jsrsasign.KEYUTIL.generateKeypair("EC", "secp256r1");
  //     // let pvtKey = jsrsasign.KEYUTIL.getPEM(kp.prvKeyObj, "PKCS8PRV");
  //     // let pubKey = jsrsasign.KEYUTIL.getPEM(kp.pubKeyObj, "PKCS8PRV");

  //     const maxLength = 10240,
  //       reHex = /^\s*(?:[0-9A-Fa-f][0-9A-Fa-f]\s*)+$/;

  //     const cert = `-----BEGIN CERTIFICATE REQUEST-----
  // MIIB6jCCAY8CAQAwUTELMAkGA1UEBhMCU0ExEzARBgNVBAsMCjY2Njk5ODg1NDQx
  // DTALBgNVBAoMBGludm8xHjAcBgNVBAMMFVRTVFpBVENBLUNvZGUtU2lnbmluZzBW
  // MBAGByqGSM49AgEGBSuBBAAKA0IABICFEzYL8y1vJdKRDn4MKoaHDYB46bffawgU
  // P1LDMblsYJay4oQA8Z16nycQ1gmAMNvOSFw3m9/KS473yrokN4Sggd4wgdsGCSqG
  // SIb3DQEJDjGBzTCByjAkBgkrBgEEAYI3FAIEFwwVVFNUWkFUQ0EtQ29kZS1TaWdu
  // aW5nMIGhBgNVHREEgZkwgZakgZMwgZAxPjA8BgNVBAQMNTEtUG9zTmFtZXwyLUc0
  // fDMtNjVhYWQyMzItYzVkMi00OGNjLWJhYWItM2ZhOThlNDAwYzU1MR8wHQYKCZIm
  // iZPyLGQBAQwPMzAwMDAwMDAwMDAwMDAzMQ0wCwYDVQQMDAQxMTAwMQ8wDQYDVQQa
  // DAZKZWRkYWgxDTALBgNVBA8MBEZvb2QwCgYIKoZIzj0EAwIDSQAwRgIhAKQX4NaP
  // vKcmeowUIHu5ROvAIK7ArmMV7gwf67rqeIk9AiEA4bb9MxhgSY5nYovp49asFDhY
  // ZLlpj0/7cYCh3DNt4w8=
  // -----END CERTIFICATE REQUEST-----`;
  //     const haveU8 = typeof Uint8Array == "function";
  //     let decoder: any;
  //     function Hexdecode(a: any) {
  //       let isString = typeof a == "string";
  //       let i;
  //       if (decoder === void 0) {
  //         let hex = "0123456789ABCDEF", ignore = " \f\n\r	 \u2028\u2029";
  //         decoder = [];
  //         for (i = 0; i < 16; ++i)
  //           decoder[hex.charCodeAt(i)] = i;
  //         hex = hex.toLowerCase();
  //         for (i = 10; i < 16; ++i)
  //           decoder[hex.charCodeAt(i)] = i;
  //         for (i = 0; i < ignore.length; ++i)
  //           decoder[ignore.charCodeAt(i)] = -1;
  //       }
  //       let out = haveU8 ? new Uint8Array(a.length >> 1) : [], bits = 0, char_count = 0, len = 0;
  //       for (i = 0; i < a.length; ++i) {
  //         let c = isString ? a.charCodeAt(i) : a[i];
  //         c = decoder[c];
  //         if (c == -1)
  //           continue;
  //         if (c === void 0)
  //           throw "Illegal character at offset " + i;
  //         bits |= c;
  //         if (++char_count >= 2) {
  //           out[len++] = bits;
  //           bits = 0;
  //           char_count = 0;
  //         } else {
  //           bits <<= 4;
  //         }
  //       }
  //       if (char_count)
  //         throw "Hex encoding incomplete: 4 bits missing";
  //       if (haveU8 && out.length > len && out instanceof Uint8Array)
  //         out = out.subarray(0, len);
  //       return out;
  //     }


  //     const haveU8$1 = typeof Uint8Array == "function";
  //     let decoder$1: any;

  //     function base64decode(a: any) {
  //       let isString = typeof a == "string";
  //       let i;
  //       if (decoder$1 === void 0) {
  //         let b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", ignore = "= \f\n\r	 \u2028\u2029";
  //         decoder$1 = [];
  //         for (i = 0; i < 64; ++i)
  //           decoder$1[b64.charCodeAt(i)] = i;
  //         for (i = 0; i < ignore.length; ++i)
  //           decoder$1[ignore.charCodeAt(i)] = -1;
  //         decoder$1["-".charCodeAt(0)] = decoder$1["+".charCodeAt(0)];
  //         decoder$1["_".charCodeAt(0)] = decoder$1["/".charCodeAt(0)];
  //       }
  //       let out = haveU8$1 ? new Uint8Array(a.length * 3 >> 2) : [];
  //       let bits = 0, char_count = 0, len = 0;
  //       for (i = 0; i < a.length; ++i) {
  //         let c = isString ? a.charCodeAt(i) : a[i];
  //         if (c == 61)
  //           break;
  //         c = decoder$1[c];
  //         if (c == -1)
  //           continue;
  //         if (c === void 0)
  //           throw "Illegal character at offset " + i;
  //         bits |= c;
  //         if (++char_count >= 4) {
  //           out[len++] = bits >> 16;
  //           out[len++] = bits >> 8 & 255;
  //           out[len++] = bits & 255;
  //           bits = 0;
  //           char_count = 0;
  //         } else {
  //           bits <<= 6;
  //         }
  //       }
  //       switch (char_count) {
  //         case 1:
  //           throw "Base64 encoding incomplete: at least 2 bits missing";
  //         case 2:
  //           out[len++] = bits >> 10;
  //           break;
  //         case 3:
  //           out[len++] = bits >> 16;
  //           out[len++] = bits >> 8 & 255;
  //           break;
  //       }
  //       if (haveU8$1 && out.length > len && out instanceof Uint8Array)
  //         out = out.subarray(0, len);
  //       return out;
  //     }


  //     let Base64re = /-----BEGIN [^-]+-----([A-Za-z0-9+/=\s]+)-----END [^-]+-----|begin-base64[^\n]+\n([A-Za-z0-9+/=\s]+)====|^([A-Za-z0-9+/=\s]+)$/;

  //     function Base64unarmor(a: any) {
  //       let m = Base64re.exec(a);
  //       if (m) {
  //         if (m[1])
  //           a = m[1];
  //         else if (m[2])
  //           a = m[2];
  //         else if (m[3])
  //           a = m[3];
  //         else
  //           throw "RegExp out of sync";
  //       }
  //       return base64decode(a);
  //     }









  //     let der = reHex.test(cert) ? Hexdecode(cert) : Base64unarmor(cert);
  //     // Your hexadecimal ASN.1 data as a buffer
  //     // const hexData = Buffer.from('308201EA3082018F0201003051310B300906035504061302534131133011060355040B0C0A36363639393838353434130D300B060355040A0C04696E766F311E301C06035504030C155453545A5443412D436F64652D5369676E696E673056301006072A8648CE3D020106052B8104000A03420004808513360BF32D6F25D2910E7E0C2A86870D8078E9B7DF6B08143F52C331B96C6096B2E28400F19D7A9F2710D6098030DBCE485C379BDFCA4B8EF7CABA243784A081DE3081DB06092A864886F70D01090E3181CD3081CA302406092B060104018237140204170C155453545A5443412D436F64652D5369676E696E673081A10603551D11048199308196A48193308190313E303C06035504040C35312D506F734E616D657C322D47347C332D363561616432332D633564322D343863632D626161622D336661393865343030633535311F301D060A090922268993F22C6401010C0F333030303030303030303030303030303033310D300B060355040C0C0431313030310F300D060355041A0C064A6564646168310D300B060355040F0C04666F6F64300A06082A8648CE3D040302030449003046022100A417E0D68FBCA7267A8C14207BB944EBC020AEC0AE6315EE0C1FEBBAEA78893D022100E1B6FD331860498E67628BE9E3D6AC14385864B9698F4FFB7180A1DC336DE30F', 'hex');
  //     const hexData = Buffer.from(der);
  //     const asn1data = fromBER(hexData);

  //     // Convert ASN.1 to JSON
  //     const json = asn1data.result.toJSON();

  //     // Output the decoded JSON representation
  //     console.log(JSON.stringify(json, null, 4));








  //     // // Decode CSR from base64
  //     // const buffer = Buffer.from(base64CSR, 'base64');
  //     // const asn1 = fromBER(buffer.buffer);
  //     // if (asn1.offset === -1) {
  //     //   throw new Error('ASN.1 parsing error');

  //     // }
  //     // console.log(JSON.stringify(asn1.result));
  //     // const csr = new CertificationRequest({ schema: asn1.result });




  //     // // Encode modified CSR back to ASN.1 DER
  //     // const csrBuffer = csr.toSchema().toBER(false);

  //     // // Convert to base64
  //     // const modifiedBase64CSR = Buffer.from(csrBuffer).toString('base64');

  //     // console.log('Modified CSR (base64):');
  //     // console.log(modifiedBase64CSR);








  //     return res.send(new ResponseData(true, "", { "csr": json }));



  //   } catch (error: any) {
  //     console.log(error)
  //     console.log("error")
  //       throw error
  //   }
  // }








  //     public static async GenerateCsr(req: Request, res: Response, next: NextFunction) {
  // // @ts-ignore
  //         try {
  //             const commonName = 'TSTZATCA-Code-Signing';
  //             const countryName = 'SA';
  //             const organizationName = 'invo';
  //             const organizationalUnitName = '6669988544';
  //             const solutionProviderName = 'PosName';
  //             const version = 'G4';
  //             const serialNumber = '65aad232-c5d2-48cc-baab-3fa98e400c55';
  //             const UID = '300000000000003';
  //             const title = '1100';
  //             const registeredAddress = 'Jeddah';
  //             const businessCategory = 'Food';
  //             let kp = jsrsasign.KEYUTIL.generateKeypair("EC", "secp256r1");
  //             let pvtKey = jsrsasign.KEYUTIL.getPEM(kp.prvKeyObj, "PKCS8PRV");
  //             let pubKey = jsrsasign.KEYUTIL.getPEM(kp.pubKeyObj, "PKCS8PRV");


  //             // let pem = jsrsasign.KJUR.asn1.csr.CSRUtil.newCSRPEM({
  //             //     subject: { "str": `/C=${countryName}/OU=${organizationalUnitName}/O=${organizationName}/CN=${commonName}` },
  //             //     ext: [
  //             //         { subjectAltName: { array: [{ dns: `DirName:SN = 1-${solutionProviderName}|2-${version}|3-${serialNumber}` }] } },
  //             //         { subjectAltName: { array: [{ dns: `UID = ${UID}` }] } },
  //             //         { subjectAltName: { array: [{ dns: `title = ${title}` }] } },
  //             //         { subjectAltName: { array: [{ dns: `registeredAddress = ${registeredAddress}` }] } },
  //             //         { subjectAltName: { array: [{ dns: `businessCategory = ${businessCategory}` }] } },

  //             //     ],
  //             //     sbjpubkey: kp.pubKeyObj,
  //             //     sigalg: "SHA256withECDSA",
  //             //     sbjprvkey: kp.prvKeyObj,

  //             // });







  //             // let csr = new jsrsasign.KJUR.asn1.csr.CertificationRequestInfo (
  //             //     {
  //             //         subject: { "str": `/C=${countryName}/O=${organizationName}/OU=${organizationalUnitName}/CN=${commonName}` },
  //             //         extreq: [{
  //             //             extname: "subjectAltName", array: [
  //             //                 { dns: `cccccc` }
  //             //                 // { DirName: `DirName:SN=1-${solutionProviderName}|2-${version}|3-${serialNumber}` },
  //             //                 // { dns: `UID = ${UID}` },
  //             //                 // { dns: `title = ${title}` },
  //             //                 // { dns: `registeredAddress = ${registeredAddress}` },
  //             //                 // { dns: `businessCategory = ${businessCategory}` }
  //             //             ]
  //             //         }],
  //             //         sbjpubkey: pubKey,
  //             //         sigalg: "SHA256withECDSA",
  //             //         sbjprvkey: pvtKey,
  //             // // @ts-ignore
  //             //     attrs: [
  //             //         {attr: "challengePassword", password: "secret"},
  //             //         {attr: "unstructuredName", names: [{utf8str:"aaa"},{ia5str:"bbb"}]},
  //             //         {attr: "extensionRequest", ext: [
  //             //           {extname: "basicConstraints", cA: true},
  //             //           {extname: "subjectKeyIdentifier", kid: "1a2b..."}
  //             //         ]}
  //             //       ]
  //             //     });



  //             let csrInfo = new jsrsasign.KJUR.asn1.csr.CertificationRequest({
  //                 subject: {
  //                     str: `/C=${countryName}/O=${organizationName}/OU=${organizationalUnitName}/CN=${commonName}`
  //                 },
  //                 sbjpubkey: pubKey,
  //                     // @ts-ignore
  //                 attrs: [
  //                     {attr: "challengePassword", password: "secret"},
  //                     {attr: "unstructuredName", names: [{utf8str:"aaa"},{ia5str:"bbb"}]},
  //                     {attr: "extensionRequest", ext: [
  //                       {extname: "basicConstraints", cA: true},
  //                       {extname: "subjectKeyIdentifier", kid: "1a2b..."}
  //                     ]}
  //                   ]
  //             });




  //             let csr = new jsrsasign.KJUR.asn1.csr.CertificationRequest({
  //                 // @ts-ignore
  //                 csrinfo: csrInfo,
  //                 sigalg: "SHA256withECDSA",
  //                 sbjprvkey: pvtKey
  //             });



  //             let csrPem = csr.getPEM();
  //             console.log(csrPem);

  //             csrPem
  //             console.log(csrPem);
  //             // Return CSR as response (example with Express)
  //             res.send({ csrPem });
  //         } catch (error: any) {
  //             console.log(error)
  //             console.log("error")
  //               throw error
  //         }
  //     }





  public static async GenerateCsr(req: Request, res: Response, next: NextFunction) {
    try {
      function formatPEM(pemString: any) {
        // Replace both Unix-style and Windows-style line endings with Unix-style (\n)
        return pemString.replace(/(?:\r\n|\r|\n)/g, '\n').replace(/(.{64})/g, '$1\n');
      }
      const commonName = 'TSTZATCA-Code-Signing'; //input
      const countryName = 'SA';
      const organizationName = 'invo'; //input
      const organizationalUnitName = '6669988544';  //input
      const solutionProviderName = 'PosName';
      const version = 'G4';
      const serialNumber = '65aad232-c5d2-48cc-baab-3fa98e400c55';  //input invo provider id
      const UID = '300000000000003'; //input Vat Registration Number
      const title = '1100'; // type (1100 Food) input type combobox
      const registeredAddress = 'Jeddah'; //input
      const businessCategory = 'Food'; //input combobox
      const hashAlg = 'SHA-256'
      const signAlg = 'ECDSA'
      setEngine("newEngine", new CryptoEngine({
        name: "test",
        crypto: weCrypto,
        subtle: weCrypto.subtle
      }));
      const crypto = getCrypto(); 
      const algorithm = getAlgorithmParameters(signAlg, "generateKey");
      let newAlgorithm = algorithm.algorithm as any;
      if ('hash' in newAlgorithm)
        newAlgorithm.hash.name = hashAlg
      const keys: CryptoKeyPair = await crypto?.generateKey(newAlgorithm, true, algorithm.usages) as CryptoKeyPair;
      const pkcs10 = new CertificationRequest();
      pkcs10.subject.typesAndValues.push(new AttributeTypeAndValue({
        type: '2.5.4.6',//countryNam
        value: new PrintableString({ value: countryName })
      }))
      pkcs10.subject.typesAndValues.push(new AttributeTypeAndValue({
        type: '2.5.4.10', //organizationName
        value: new Utf8String({ value: organizationName })
      }))
      pkcs10.subject.typesAndValues.push(new AttributeTypeAndValue({
        type: '2.5.4.11', //organizationUnitName
        value: new Utf8String({ value: organizationalUnitName })
      }))
      pkcs10.subject.typesAndValues.push(new AttributeTypeAndValue({
        type: '2.5.4.3', //commonName
        value: new Utf8String({ value: commonName })
      }))
      await pkcs10.subjectPublicKeyInfo.importKey(keys.publicKey)
      //TODO add comment
      const OIDs = {
        surname: "2.5.4.4",
        id_userid: "0.9.2342.19200300.100.1.1",
        title: "2.5.4.12",
        registeredAddress: "2.5.4.26",
        businessCategory: "2.5.4.15"
      };
      function createAttributeTypeAndValue(oid: any, value: any) {
        const attrValue = new Utf8String({ value });
        return new AttributeTypeAndValue({
          type: oid,
          value: attrValue
        });
      }
      async function createAltNames() {
        //TODO fix input from variables
        // Create each AttributeTypeAndValue
        const surname = createAttributeTypeAndValue(OIDs.surname, '1-PosName|2-G4|3-65aad232-c5d2-48cc-baab-3fa98e400c55');
        const id_userid = createAttributeTypeAndValue(OIDs.id_userid, '300000000000003');
        const title = createAttributeTypeAndValue(OIDs.title, '1100');
        const registeredAddress = createAttributeTypeAndValue(OIDs.registeredAddress, 'Jeddah');
        const businessCategory = createAttributeTypeAndValue(OIDs.businessCategory, 'Food');

        // Create SETs
        const set1 = new Set({ value: [surname.toSchema()] });
        const set2 = new Set({ value: [id_userid.toSchema()] });
        const set3 = new Set({ value: [title.toSchema()] });
        const set4 = new Set({ value: [registeredAddress.toSchema()] });
        const set5 = new Set({ value: [businessCategory.toSchema()] });

        // Create SEQUENCE
        const altNameSequence = new Sequence({
          value: [set1, set2, set3, set4, set5]
        });
        // Create AltNames SEQUENCE
        const altNamesSequence = new Sequence({
          value: [altNameSequence]
        });
        const altNamesSequence2 = new Sequence({
          value: [altNamesSequence]
        });

        return altNamesSequence2;
      }


      let schema = await createAltNames();

      (schema.valueBlock.value[0] as any).blockName = "CONSTRUCTED";
      (schema.valueBlock.value[0] as any).idBlock.tagClass = 3;
      (schema.valueBlock.value[0] as any).idBlock.tagNumber = 4;



      pkcs10.attributes = [
        new Attribute({
          type: "1.2.840.113549.1.9.14", // pkcs-9-at-extensionRequest
          values: [(
            new Extensions({
              extensions: [
                new Extension({
                  extnID: "1.3.6.1.4.1.311.20.2", // id-ce-subjectAltName
                  critical: false,
                  extnValue: new PrintableString({ value: 'TSTZATCA-Code-Signing' }).toBER(false)
                }),
                new Extension({
                  extnID: "2.5.29.17", // id-ce-subjectAltName
                  critical: false,
                  extnValue: schema.toBER(false)
                })
              ]
            })).toSchema()
          ]
        })];
      await pkcs10.sign(keys.privateKey, "SHA-256");
      const pkcs10Raw = pkcs10.toSchema().toBER(false);
      const csrBase64 = toBase64(arrayBufferToString(pkcs10Raw));
      const csr = `-----BEGIN CERTIFICATE REQUEST-----\n${csrBase64}\n-----END CERTIFICATE REQUEST-----`;
      const formattedCSR = formatPEM(csr);

      return res.send(new ResponseData(true, "", { "csr": csrBase64 }
      ))
    } catch (error: any) {
      console.log(error)
      console.log("error")
        throw error
    }
  }


  public static async footFallLogin(req: Request, res: Response, next: NextFunction) {

    try {
      const data = req.body;
      const company = res.locals.company;


      let resault;
      resault = await footfallCamJob.login(data, company)
      return res.send(resault)
    } catch (error: any) {
        throw error
    }
  }

    public static async saveFootCamPlugin(req: Request, res: Response, next: NextFunction) {

    try {

      const company = res.locals.company;
      let data = req.body;

            let resault;
             resault = await footfallCamJob.saveFootCamPlugin(data,company)
            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }

  public static async getFootFallCamPlugin(req: Request, res: Response, next: NextFunction) {

    try {

      const company = res.locals.company;


            let resault;
             resault = await footfallCamJob.getPluginSettings(company)
            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }


    public static async syncTransactions(req: Request, res: Response, next: NextFunction) {

        try {
     
            const company =res.locals.company;
            const date =req.body.date;
            let resault;
             resault = await footfallCamJob.syncData(company.id,date)
            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }


    public static async MOICManualUpload(req: Request, res: Response, next: NextFunction) {

      try {
          const company =res.locals.company;
          const date = req.body.date;
          const branchId = req.body.branchId?? null ;
          let resault = await MOICJob.manualUpload(company.id,date,branchId);
  
             return res.send(resault);
      } catch (error: any) {
        console.log("here");
          throw error
      }
  }
}