// 这个Device定义是为了兼容现有代码，实际应该使用types/device.ts中的定义
export interface Device {
  id: string;
  username: string;
  ip: string;
  type?: string;
}

export type TransferStatus = 'starting' | 'sending' | 'receiving' | 'paused' | 'completed' | 'failed' | 'ready_to_receive_chunks';
export type TransferDirection = 'sent' | 'received';

export interface Transfer {
  id: string | number;
  name: string;
  size: string | number;
  status: TransferStatus;
  progress: number;
  direction: TransferDirection;
  rate?: number; // in KB/s
  sourceDevice?: string;
  targetDevice?: string;
}