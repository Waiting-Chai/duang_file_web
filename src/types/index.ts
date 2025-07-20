export interface Device {
  id: string;
  username: string;
  ip: string;
  type: string;
  // You can add other device properties received from the backend here
  // e.g., os, browser, type, etc.
}

export type TransferStatus = 'sending' | 'receiving' | 'paused' | 'completed' | 'failed';
export type TransferDirection = 'sent' | 'received';

export interface Transfer {
  id: string | number;
  name: string;
  size: string;
  status: TransferStatus;
  progress: number;
  direction: TransferDirection;
  rate?: number; // in KB/s
  sourceDevice?: string;
  targetDevice?: string;
}