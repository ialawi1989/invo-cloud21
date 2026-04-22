import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION, Session } from '@shopify/shopify-api';
const { Logger } = require('aws-cloudwatch-log')
import { ResponseData } from "@src/models/ResponseData";
//Client ID
//f2eea2d0429db8420838ad2c5721ae99
//Client secret
//164fe85a08f335c7bc3d72410ae9c564
//Token
//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
export class ShopifyService {

    static shopify = shopifyApi({
        apiKey: process.env.SHOPIFY_API_KEY || 'f2eea2d0429db8420838ad2c5721ae99',
        apiSecretKey: process.env.SHOPIFY_API_SECRET || '164fe85a08f335c7bc3d72410ae9c564',
        adminApiAccessToken: process.env.SHOPIFY_ACCESS_TOKEN || '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',
        scopes: []
        , // Ensure your app has the correct permissions
        hostName: process.env.SHOPIFY_SHOP || '3ruveh-na.myshopify.com',
        apiVersion: LATEST_API_VERSION,
        isEmbeddedApp: false
    });

    static client = new ShopifyService.shopify.clients.Graphql({
        session: new Session({
            id: `offline_${process.env.SHOPIFY_SHOP || '3ruveh-na.myshopify.com'}`,
            shop: process.env.SHOPIFY_SHOP || '3ruveh-na.myshopify.com',
            state: 'test_state',
            isOnline: false,
            accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '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',
        })
    });


    static async testQuiry() {
        try {

            const query = `
        {
          shop {
            name
          }
         products(first: 10) {
    nodes {
      title
      priceRangeV2 {
        maxVariantPrice {
          amount
        }
      }
    }
  }
        }`;
            const response = await this.client.request(query);
            return (new ResponseData(true, '', response.data))
        } catch (error: any) {
            return (new ResponseData(false, error.message, error));
        }

    }

    static async AddProduct(title: string) {
        try {

            title = "not balbool test"
            let price = 300.005
            let mutation = `mutation {
  productCreate(input: {title: "${title}" }) {
    product {
      id
      title
  }
  }}`;

            const productCreateResponse = await this.client.request(mutation);
            let productId = productCreateResponse.data.productCreate.product.id;

            mutation = `mutation {
                productVariantsBulkCreate(productId: "${productId}" ,variants: [{ price: "29.99"}]) {
    productVariants {
      id
      title
    }
    userErrors {
      field
      message
    }
  }}`;

            const productVariantCreateResponse = await this.client.request(mutation);

            return (new ResponseData(true, '', productVariantCreateResponse));
        } catch (error: any) {
            return (new ResponseData(false, error.message, error));
        }
    }






}

