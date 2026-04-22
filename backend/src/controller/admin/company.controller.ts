/* eslint-disable prefer-const */
import { CompanyRepo } from "@src/repo/admin/company.repo";
import { promises as fs } from 'fs';
import path from "path";

import { Request, Response, NextFunction } from "express";
import { DB } from "@src/dbconnection/dbconnection";

import { ResponseData } from "@src/models/ResponseData";
import { FileStorage } from "@src/utilts/fileStorage";
import { EmployeePrivilegeRepo } from "@src/repo/admin/EmployeePrivilege.repo";
import { ImportJsonData } from "@src/repo/admin/importJsonData.repo";
import { PayOutSocketRepo } from "@src/repo/socket/payout.socket";
import { RedisCaching } from "@src/utilts/redisCaching";
import { companyEmployeeRepo } from "@src/repo/admin/companyEmployees.repo";
import crypto from "crypto";
import { WebSiteBuilderRepo } from "@src/repo/app/settings/webSiteBuilder.repo"; import { test } from "@src/repo/admin/test";
import { CartRepo } from "@src/repo/ecommerce/cart.repo";
import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { features } from "process";
import { Invoice } from "@src/models/account/Invoice";


export class CompanyController {
  public static async AddNewCompany(req: Request, res: Response, next: NextFunction) {
    const client = await DB.excu.client()
    try {
      await client.query("BEGIN")
      const data = req.body;
      let resault: any;

      if (data.id == null || data.id == "") {
        resault = await CompanyRepo.insertCompany(client, data);

      } else {
        resault = await CompanyRepo.editCompany(client, data);

      }
      await client.query("COMMIT")
      return res.send(resault)
    } catch (error: any) {
      console.log(error)
      await client.query("ROLLBACK")

      throw error
    } finally {
      client.release()
    }
  }

  public static async getAllCompanies(req: Request, res: Response, next: NextFunction) {
    try {

      const company = res.locals.company
      const employeeId = res.locals.user;
      //const resault = await CompanyRepo.getAllCompanies(company.id);
      const resault = await companyEmployeeRepo.getCompanyList(employeeId, company)
      return res.send(resault);
    } catch (error: any) {

      throw error
    }
  }


  public static async getAdminCompaniesList(req: Request, res: Response, next: NextFunction) {
    try {

      console.log("in the controller")
      // const companyId = res.locals.company.id
      console.log("1");
      const resault = await CompanyRepo.getAdminCompaniesList();
      console.log("resault");
      console.log(resault);
      console.log("resault");
      return res.send(resault);
    } catch (error: any) {

      throw error
    }
  }









  public static async editCompany(req: Request, res: Response, next: NextFunction) {
    const client = await DB.excu.client()
    try {
      await client.query("BEGIN")
      const data = req.body;
      let resault;


      resault = await CompanyRepo.editCompany(client, data);

      await client.query("COMMIT")
      return res.send(resault)
    } catch (error: any) {
      await client.query("ROLLBACK")

        throw error
    } finally {
      client.release()
    }
  }

  public static async getCompanyById(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.params.companyId;

      const company = await CompanyRepo.getCompanyById(companyId);
      return res.send(company);
    } catch (error: any) {

      throw error
    }
  }








  public static async getAdminCompanyById(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.body.company_id;

      const company = await CompanyRepo.getCompanyById(companyId);
      return res.send(company);
    } catch (error: any) {

      throw error
    }
  }


  public static async getCompanySetting(req: Request, res: Response, next: NextFunction) {
    try {
      const company = res.locals.company;
      const companyId = company.id
      /**Get Catched Data */


      let companyCatchedData = await RedisCaching.getCatchingData("getCompanySetting1" + companyId)

      /** When Success ->  return catched data */
      if (companyCatchedData.success) {

        let data = JSON.parse(companyCatchedData.data);
        return res.send(new ResponseData(true, "", data))
      } else {

        const prefrences = await CompanyRepo.getCompanyPrefrences(companyId);
        await RedisCaching.setCatchData("getCompanySetting" + companyId, prefrences.data)
        return res.send(prefrences);
      }


    } catch (error: any) {
        throw error
    }
  }

  public static async getCompanyEcommerceSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const company = res.locals.company;
      const companyId = company.id
      const prefrences = await CompanyRepo.getEcommerceCompanySettings(companyId);

      return res.send(prefrences);
    } catch (error: any) {

        throw error
    }
  }

  public static async setSubDomain(req: Request, res: Response, next: NextFunction) {
    try {
      const slug = req.params.subDomain;


      const company = (await CompanyRepo.getCompanyBySubDomain(slug)).data

      if (company) {

        let branches = await BranchesRepo.hasActiveBranches(company.id);
        if (!branches) {
          return res.status(401).json(new ResponseData(false, "The Company is no longer active", []))
        }
        company.afterDecimal = company.settings.afterDecimal
        company.timeOffset = company.settings.timeOffset
        company.slug = slug
        res.locals.company = company
        next()

      } else {
        return res.send(new ResponseData(false, "COMPANY NOT FOUND", []))

      }


    } catch (error: any) {

        throw error
    }
  }
  public static async GenerateApiToken(req: Request, res: Response, next: NextFunction) {
    try {
      const data = {
        company: res.locals.company,
        createdAt: new Date(),
        rand: Math.random()
      }
      const token = await CompanyRepo.getApiToken(data);
      const saved = await CompanyRepo.setApiToken(token ?? '', res.locals.company.id);
      if (saved) {
        return res.send(new ResponseData(true, "", { token: token }));
      }
    } catch (error: any) {
        throw error
    }
  }


  public static async getCompanyApiToken(req: Request, res: Response, next: NextFunction) {
    try {
      const data = {
        company: res.locals.company
      }
      const token = await CompanyRepo.getsavedApiToken(res.locals.company.id);
      return res.send(token);
    } catch (error: any) {
        throw error
    }
  }



  public static async switchCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.params.companyId;
      const employeeId = res.locals.user;
      const company = await CompanyRepo.getCompanyPrefrences(companyId);

      const employee = (await companyEmployeeRepo.getSwitchEmployeeData(employeeId, companyId)).data

      const afterDecimal = company.data.settings.afterDecimal;
      const timeOffset = company.data.settings.timeOffset;


      const employeeData = {
        companyId: companyId,
        employeeId: employeeId,
        company: {
          id: companyId,
          country: company.data.country,
          features: company.data.features,
          afterDecimal: afterDecimal,
          timeOffset: timeOffset
        }

      }
      const token = await CompanyRepo.getToken(employeeData)
      res.locals.company = employeeData.company;
      const data = {
        company: company.data,
        accessToken: token?.accessToken,
        refreshToken: token?.refreshToken,
        employee: employee ?? null
      }

      return res.send(new ResponseData(true, "", data));
    } catch (error: any) {

      throw error
    }
  }

  public static async saveCompany(req: Request, res: Response, next: NextFunction) {
    const client = await DB.excu.client()
    try {
      await client.query("BEGIN")
      const data = req.body;
      let resault;
      let companyId = res.locals.companyId;

      resault = await CompanyRepo.editCompany(client, data);
      await RedisCaching.deleteCatchedData("getCompanySetting" + companyId)
      await client.query("COMMIT")
      return res.send(resault)
    } catch (error: any) {
      await client.query("ROLLBACK")

        throw error
    } finally {
      client.release()
    }
  }

  public static async getCompanyLogo(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const companyId = req.params.companyId;
        const storage = new FileStorage();
        const image = await storage.getComapnyLogo(companyId)

        if (image) {
          /** image cache for 24h */
          const etag = crypto.createHash('md5').update(image).digest('hex');
          res.setHeader('ETag', etag);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.sendFile(image)
        } else {
          return res.send(new ResponseData(true, "Image Not Found", []))
        }
      } catch (error: any) {

        throw error
      }
    }


  }

  public static async validateName(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const data = req.body
        const company = res.locals.company
        const companyId = company.id;
        const resault = await CompanyRepo.validateName(companyId, data)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }

  public static async setProductOptions(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const data = req.body
        const company = res.locals.company
        const resault = await CompanyRepo.setProductOptions(data, company)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }



  public static async setJofotaraConfig(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const data = req.body
        const company = res.locals.company
        const resault = await CompanyRepo.setJofotaraConfig(data, company)
        return res.send(resault);
      } catch (error: any) {
        throw error
      }
    }


  }

  public static async getProductOptions(req: Request, res: Response, next: NextFunction) {
    {
      try {

        const company = res.locals.company
        const resault = await CompanyRepo.getProductOptions(company)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }


  public static async setBranchOptions(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const data = req.body
        const company = res.locals.company
        const resault = await CompanyRepo.setBranchOptions(data, company)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }

  public static async getBranchOptions(req: Request, res: Response, next: NextFunction) {
    {
      try {

        const company = res.locals.company
        const resault = await CompanyRepo.getBranchOptions(company)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }







  public static async getShippingSetting(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const company = res.locals.company
        const resault = await CompanyRepo.getShippingSetting(company)
        return res.send(resault);
      } catch (error: any) {
          throw error
      }
    }
  }










  public static async setShippingPrice(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const data = req.body
        const company = res.locals.company
        let cart = (await CartRepo.getCart(company, data.cartId)).data;
        const invoice = new Invoice();
        invoice.ParseJson(cart)

        if (!invoice.shippingOptions) {
          return res.send(new ResponseData(false, "You Need To Calculate The Shipping Price First", {}))
        }
        const shippingOption = invoice.shippingOptions.find((option: { id: number }) => option.id == data.id);
        console.log("shippingOption")
        console.log(data.id)
        console.log(shippingOption)
        console.log("shippingOption")
        if (!shippingOption || shippingOption == undefined) {
          return res.send(new ResponseData(false, "Invalid shipping option ID", {}));
        }

        invoice.tempDeliveryCharge = shippingOption.price
        invoice.deliveryCharge = shippingOption.price;
        invoice.calculateTotal(company.afterDecimal)
        await CartRepo.setRedisCart(company.id, data.cartId, invoice);
        return res.send(new ResponseData(true, "", {}));
      } catch (error: any) {
          throw error
      }
    }
  }





  public static async getEcommorceShippingCountries(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const company = res.locals.company
        const resault = await CompanyRepo.getEcommorceShippingCountries(company)
        return res.send(resault);
      } catch (error: any) {
          throw error
      }
    }
  }





  //{"UOM": "Pound", "status": true, "CountriesPrices": [{"PPU": 5, "CountryCode": "SA"}, {"PPU": 4, "CountryCode": "QA"}], "defaultShippingBranch": "369c9cec-4613-4c04-946e-38b3df8989e0"}
  public static async getShippingOptions(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const cartSessionId = req.params.cartId;
        const company = res.locals.company
        const shippingSetting = (await CompanyRepo.getShippingSetting(company)).data;
        let matchedRates: any[] = [];
        let cart = (await CartRepo.getCart(company, cartSessionId)).data;
        let weightInKg = 0;
        cart?.lines.forEach((element: { totalWeight: any; weight: any; qty: any; weightUOM: any; }) => {
          const weight = element.totalWeight;
          const qty = element.qty;
          let weightUOM = element.weightUOM;
          if (weightUOM == null) {
            weightUOM = "KG"
          }
          switch (weightUOM.toUpperCase()) {
            case "KG":
              weightInKg += (weight) * qty;
              break;
            case "OUNCE":
              weightInKg += (weight * 0.02834952) * qty;
              break;
            case "POUND":
              weightInKg += (weight * 0.45359237) * qty;
              break;
            default:
              break;
          }
        });
        const country2 = cart.addressKey; // Example country code
        const total2 = cart.total; // Example cart total

        const region = shippingSetting.find((r: { Countries: string | any[]; }) => r.Countries.includes(country2));
        if (!region) return res.send(new ResponseData(true, "", {}))

        region.rates.forEach((rate: { type: string; from: number; to: string | number | null; }) => {
          if (rate.type === "total" && total2 >= rate.from && (rate.to === "" || rate.to === null || total2 <= Number(rate.to))) {
            matchedRates.push(rate);
          }
          if (rate.type === "weight" && weightInKg >= rate.from && (rate.to === "" || rate.to === null || weightInKg <= Number(rate.to))) {
            matchedRates.push(rate);
          }
        });
        // await CartRepo.setRedisCart(company.id, cartSessionId, cart);
        const extractedData = matchedRates.map(({ name, price, note }, index) => ({
          id: index + 1, // Adds a sequential ID starting from 1
          name,
          price,
          note
        }));

        cart.shippingOptions = extractedData;

        await CartRepo.setRedisCart(company.id, cartSessionId, cart);

        return res.send(new ResponseData(true, "", extractedData));
      } catch (error: any) {
          throw error
      }
    }
  }

  public static async setShippingSetting(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const data = req.body
        const company = res.locals.company
        const resault = await CompanyRepo.setShippingSetting(data, company)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }






  public static async getCoveredAddresses(req: Request, res: Response, next: NextFunction) {
    {
      try {

        const company = res.locals.company
        const resault = await CompanyRepo.getCoveredAddresses(company)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }


















  public static async setCoveredAddresses(req: Request, res: Response, next: NextFunction) {
    {
      try {

        const company = res.locals.company
        const data = req.body
        const resault = await CompanyRepo.setCoveredAddresses(data, company)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }

  // public static async importFromCsvFile(req: Request, res: Response, next: NextFunction) {
  //   {
  //     try {
  //       const data = req.body
  //       const company = res.locals.company
  //       const employeeId =  res.locals.user
  //       const resault = await CompanyRepo.importFromCsvFile(company,employeeId)
  //       return res.send(resault);
  //     } catch (error: any) {

  //       throw error
  //     }
  //   }


  // }

  public static async importCompanyData(req: Request, res: Response, next: NextFunction) {
    {
      try {
        let data = req.body
        const company = res.locals.company
        const companyId = company.id;
        const employeeId = res.locals.user
        const importData = new ImportJsonData();


        const fileData = req.files?.filedata;
        const firstFile = Array.isArray(fileData) ? fileData[0] : fileData;
        const fileContent = firstFile?.data.toString('utf8');

        if (fileContent != null && fileContent != undefined) {

          // const absolutePath = path.join(__dirname, file);
          // const jsonString = await fs.readFile(absolutePath, "utf-8");
          // const jsonObject = JSON.parse(jsonString);

          data = JSON.parse(fileContent);

        }


        const resault = await importData.importData(data, company, employeeId)
        return res.send(resault);
      } catch (error: any) {

          throw error
      }
    }


  }
  public static async getCompanyAddresses(req: Request, res: Response, next: NextFunction) {
    try {
      const company = res.locals.company
      const fileStorage = new FileStorage();
      let addresses = await fileStorage.getDeliveryAddresses(company.country)
      return res.send(new ResponseData(true, "", addresses.addresses))
    } catch (error: any) {

      throw error
    }
  }

  public static async setInvoiceTemplate(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const data = req.body
        const company = res.locals.company
        const resault = await CompanyRepo.setInvoiceTemplate(data, company)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }

  public static async getInvoiceTemplate(req: Request, res: Response, next: NextFunction) {
    {
      try {

        const company = res.locals.company
        const resault = await CompanyRepo.getInvoiceTemplate(company)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }



























  public static async validatePassword(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const data = req.body
        const employeeId = res.locals.user
        const resault = await CompanyRepo.validatePassword(employeeId, data)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }



  public static async checkTransactionsDates(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const branchId = req.body.branchId
        const company = res.locals.company
        const resault = await CompanyRepo.getTransactionDate(branchId, company.id)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }

  public static async convertOldThemeSetting(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const slug = req.params.slug
        const company = res.locals.company
        const resault = await WebSiteBuilderRepo.adjustOldThemeSettings()
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }

  public static async testTheFunction(req: Request, res: Response, next: NextFunction) {
    {
      try {
        // const data = req.body

        // const resault = await test.testTheFunction(data)
        // return res.send(resault);
        if(req.body.error)
        {
          throw new Error("Test Logger")
        }
        const fileStorage = new FileStorage();
        let path = await fileStorage.getLogFile()
        // Send the file as download
        res.download(path, "myapp.log", (err) => {
          if (err) {
            console.error("Error sending log file:", err);
            res.status(500).json({ message: "Failed to download log file" });
          }
        });
      } catch (error: any) {

        throw error
      }
    }


  }

  public static async deleteKeysForCompany(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const data = req.body

        const resault = await test.deleteKeysForCompany(data)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }


  public static async setpickUpMaxDistance(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const data = req.body
        const company = res.locals.company
        const resault = await CompanyRepo.setpickUpMaxDistance(data, company)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }

  public static async getpickUpMaxDistance(req: Request, res: Response, next: NextFunction) {
    {
      try {

        const company = res.locals.company
        const resault = await CompanyRepo.getpickUpMaxDistance(company)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }

  public static async setPrefixSettings(req: Request, res: Response, next: NextFunction) {
    {
      try {

        const company = res.locals.company
        const data = req.body
        const resault = await CompanyRepo.setPerfixSettings(data, company.id)
        return res.send(resault);
      } catch (error: any) {

          throw error
      }
    }


  }

  public static async getPrefixSettings(req: Request, res: Response, next: NextFunction) {
    {
      try {

        const company = res.locals.company
        const data = req.body
        const resault = await CompanyRepo.getPerfixSettings(company.id)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }

  public static async updateThumbnail(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const data = req.body

        const resault = await test.updateThumbnail(data)
        return res.send(resault);
      } catch (error: any) {

        throw error
      }
    }


  }


  public static async getFileByName(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const fileName = req.params.file

        const resault = await CompanyRepo.getFileByName(fileName)
        return res.sendFile(resault);
      } catch (error: any) {

        throw error
      }
    }


  }


  public static async updateFeatures(req: Request, res: Response, next: NextFunction) {
    {
      try {
        const data = req.body

        const resault = await CompanyRepo.setFeature(data)
        return res.send(resault);
      } catch (error: any) {

        return res.send(new ResponseData(false, error, []))
      }
    }


  }


}
