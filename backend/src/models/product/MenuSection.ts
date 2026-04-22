import { MenuSectionProduct } from "./MenuSectionProduct";

export class MenuSection{
    id="";
    name="";
    translation={};
    properties={};
    image="";
    index=0;
    menuId="";
    products:MenuSectionProduct[]=[];
    updatedDate=new Date();
    
    ParseJson(json:any): void{
        for (const key in json) {
            if(key =='products')
            {
                const productsTemp:MenuSectionProduct[]=[];
                let sectionProduct:MenuSectionProduct;
                json[key].forEach((product:any) => {
                    sectionProduct = new MenuSectionProduct();
                    sectionProduct.ParseJson(product);
                    productsTemp.push(sectionProduct)
                });
                this.products = productsTemp;
            }else{
                this[key as keyof typeof this] = json[key];
            }
        }
    }

}