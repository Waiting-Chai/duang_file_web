export interface Device {
  id: string;
  deviceInfo: {
    ip: string;
    deviceName: string;
    os: string;
    browser: string;
  };
}