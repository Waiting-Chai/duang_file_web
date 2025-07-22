export interface DeviceInfo {
  ip: string;
  device: string;
  os: string;
  browser: string;
  timestamp: number;
}

export interface Device {
  id: string;
  deviceInfo: DeviceInfo;
}