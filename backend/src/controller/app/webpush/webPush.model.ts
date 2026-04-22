export interface SubscriptionType {
    endpoint: string;
    keys: { p256dh: string; auth: string };
}

export type PushPayload = {
    title: string;
    body: string;
    icon?: string;
    url?: string;
    tag?: string;
    data?: any;
};
export type DeviceInfo = {
    deviceId: string; // stable from browser localStorage (required)
    deviceName?: string | null;
    platform?: string | null; // web/windows/macos/android/ios/linux
    appVersion?: string | null;
    userAgent?: string | null;
    ipLast?: string | null; // inet text (optional)
};

export type SubscribeInput = {
    employeeId: string;
    companyId: string; // subscribe per-company (recommended)
    device: DeviceInfo;
    subscription: SubscriptionType;
};

export type UnsubscribeInput = {
    employeeId: string;
    companyId: string;
    endpoint: string;
};

export type SendInput = {
    companyId: string;
    payload: PushPayload;
    employeeId?: string | null; // optional: send to one employee
};

