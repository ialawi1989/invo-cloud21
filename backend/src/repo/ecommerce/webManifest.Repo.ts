import { DB } from "@src/dbconnection/dbconnection";
import { Company } from "@src/models/admin/company";
import { ResponseData } from "@src/models/ResponseData";
import { WebManifest } from "@src/models/Settings/webManifest";

export class WebManifestRepo{

    public static async getCompanyInfo(companyId:string)
    {
        try {
            const query={
                text:`SELECT "Companies".name, 
                           case when "WebSiteBuilder" ."type" = 'OldThemeSettings' and "WebSiteBuilder" ."template" is not null then   (("template"->>'style')::jsonb)->>'primaryColor' 
                                when "WebSiteBuilder" ."type" = 'ThemeSettings' and "WebSiteBuilder" ."template" is not null then (("template"->>'colors')::jsonb)->>'primaryColor'  end as "theme_color"
                      FROM "Companies" 
                      left join "WebSiteBuilder" on "WebSiteBuilder"."companyId" = "Companies".id and "WebSiteBuilder"."type" in ('ThemeSettings','OldThemeSettings')
                      where  "Companies".id =$1 
                       `,
                values:[companyId]
            }

            let data = await DB.excu.query(query.text,query.values)
            return data.rows[0]
        } catch (error:any) {
            throw new Error(error)
        }
    }
    public static async getWebManifest(company:Company){
        try {

            let companyData:any = await this.getCompanyInfo(company.id)
            if(companyData)
            {
                let webManifest = new WebManifest();
                webManifest.name = companyData.name
                webManifest.short_name = companyData.name
                webManifest.theme_color = companyData.theme_color ??   webManifest.theme_color
                return webManifest
            }
            return new ResponseData (true,"Company Not Found",null)
        } catch (error:any) {
            throw new Error(error)
        }
    }
}