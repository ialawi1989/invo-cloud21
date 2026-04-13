const DEVICE_ID_KEY = 'invo_device_id';

/**
 * Returns a stable UUID for this browser.
 * Generated once, persisted in localStorage forever.
 * This is what the backend stores in EmployeeDevices.device_id.
 */
function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    // crypto.randomUUID() is available in all modern browsers
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export interface DeviceInfo {
  deviceId:         string;  // stable UUID — backend stores this in EmployeeDevices
  deviceName:       string;  // human-readable: "Chrome on Windows"
  userAgent:        string;
  platform:         string;
  language:         string;
  screenResolution: string;
  timezone:         string;
  deviceType:       'mobile' | 'tablet' | 'desktop';
  appVersion:       string;
}

export function getDeviceInfo(): DeviceInfo {
  const ua       = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);

  // Build a readable device name from browser + OS
  const browser = getBrowserName(ua);
  const os      = getOsName(ua);
  const deviceName = `${browser} on ${os}`;

  return {
    deviceId:         getOrCreateDeviceId(),
    deviceName,
    userAgent:        ua,
    platform:         navigator.platform,
    language:         navigator.language,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone:         Intl.DateTimeFormat().resolvedOptions().timeZone,
    deviceType:       isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
    appVersion:       '1.0.0',
  };
}

function getBrowserName(ua: string): string {
  if (ua.includes('Edg/'))     return 'Edge';
  if (ua.includes('OPR/'))     return 'Opera';
  if (ua.includes('Chrome/'))  return 'Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/'))  return 'Safari';
  return 'Browser';
}

function getOsName(ua: string): string {
  if (ua.includes('Windows NT')) return 'Windows';
  if (ua.includes('Mac OS X'))   return 'macOS';
  if (ua.includes('Android'))    return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Linux'))      return 'Linux';
  return 'Unknown OS';
}
