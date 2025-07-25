// 这个Device定义是为了兼容现有代码，实际应该使用types/device.ts中的定义
export interface Device {
  id: string;
  username: string;
  ip: string;
  type?: string;
}

export type TransferStatus = 
  | 'starting'               // 初始化状态
  | 'connecting'             // 连接中
  | 'waiting_for_approval'   // 等待接收方确认
  | 'ready_to_receive_chunks' // 准备接收分片
  | 'sending'                // 发送中
  | 'receiving'              // 接收中
  | 'paused'                 // 已暂停
  | 'resuming'               // 恢复中
  | 'completed'              // 已完成
  | 'failed'                 // 失败
  | 'cancelled';             // 已取消
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
  file?: File; // Add file object for P2P transfer
  filePath?: string; // For completed downloads, the path on the local file system
  blobUrl?: string; // For completed downloads, a temporary URL for the file blob
  isPaused?: boolean; // To control the pause state of the transfer
  sentChunks?: number; // To track the number of chunks sent
  targetId?: string; // The ID of the target client for P2P communication
}