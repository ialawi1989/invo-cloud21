import * as admin from 'firebase-admin';
// Load your service account key JSON
var serviceAccount = require("../../invo-watch-firebase-adminsdk.json");

class FCMService {
  private static initialized = false;

  static init(): void {
    if (this.initialized) return;

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });

    this.initialized = true;
    console.log('✅ Firebase Admin initialized');
  }

  static async sendNotification(token: string, title: string, body: string, data: Record<string, string> = {}) {
    this.init();

    const message = {
      token,
      notification: {
        title,
        body,
      }, 
      android: {
        notification: {
          sound: 'default', // ✅ this is where sound should go
          channelId: 'order_alerts', // optional, but recommended for Android 8+
        },
      },
      data,
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('✅ Message sent:', response);
      return response;
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      throw error;
    }
  }

  static async sendMulticastNotification(tokens: string[], title: string|null, body: string, data: Record<string, string> = {}) {
    this.init();

    const message = {
     tokens: tokens,
      notification: title
                  ? { title, body }
                  : { body }, 
      android: {
        notification: {
          sound: 'default', // ✅ this is where sound should go
          channelId: 'order_alerts', // optional, but recommended for Android 8+
        },
      },
      data,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log('✅ Message sent:', response);
      return response;
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      throw error;
    }
  }
}

export default FCMService;