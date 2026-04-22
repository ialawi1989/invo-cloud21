import {createConfiguration,DefaultApi,Notification}from '@onesignal/node-onesignal';
import axios from 'axios';

export class OneSignalPlugin {
    app_key_provider = 'os_v2_app_i5a5vymjujckhp2xa4avvdif6dfdrr5mwe2em7fl64vk3wrsobs75rapvpkgagnl3nk45uxff7j4hquatqguh3kb3s6bw5j443sxdzi'
    ONESIGNAL_APP_ID = '4741dae1-89a2-44a3-bf57-07015a8d05f0'

    included_segments = [];
    excluded_segments = [];
    contents= {
        en: ""
    }

    include_aliases:{external_id:any[]} ={
        external_id:[]
    }
    headings = {
        en: ""
      }
     chrome_web_icon= ""
    getUrl(){
        return 'https://api.onesignal.com/notifications?c=push'
    }
    public async sendNotifcations() {
        try {

            const configuration = createConfiguration({

                restApiKey: this.app_key_provider,
            });

            const client = new DefaultApi(configuration);

            const notification = new Notification();
            notification.app_id = this.ONESIGNAL_APP_ID;
            // Name property may be required in some case, for instance when sending an SMS.
            notification.name = "test_notification_name";
            notification.contents = this.contents
            // required for Huawei

            // This example uses segments, but you can also use filters or target individual users
            // https://documentation.onesignal.com/reference/create-notification
            notification.include_aliases = this.include_aliases
            notification.target_channel = "push"

            const notificationResponse = await client.createNotification(notification);
            console.log(notificationResponse)
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }


    public async sendEcommerceNotifications ()
    {


        let data = {
            app_id:this.ONESIGNAL_APP_ID,
            contents: this.contents,
            include_aliases:this.include_aliases,
            target_channel:"push"
        }

        console.log("sendEcommerceNotificationssendEcommerceNotificationssendEcommerceNotifications",data)
        try {
            let reqConfig = {
                method: 'post',
                url: this.getUrl(),
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.app_key_provider
                }
            }

            let paymentResponse = (await axios(reqConfig)).data
            console.log("sendEcommerceNotificationssendEcommerceNotificationssendEcommerceNotifications",paymentResponse)
        } catch (error) {
            console.log(error)
        }
    }
}