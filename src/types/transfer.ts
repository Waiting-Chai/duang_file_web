// 定义与后端 message.go 匹配的 WebSocket 消息类型

import { Device } from './device';
import { TransferStatus } from './index';

/**
 * 通用的 WebSocket 消息结构
 */
export interface WebSocketMessage {
  type: string;
  payload: any;
}

/**
 * 客户端列表消息的载荷
 */
export interface ClientListPayload {
  clients: Device[];
}

/**
 * 客户端通知服务端开始上传文件
 * @description Corresponds to `StartUploadPayload` in Go backend
 */
export interface StartUploadPayload {
  fileId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  targetIds: string[];
  chunkSize: number;
}

/**
 * 客户端上传文件块
 * @description Corresponds to `UploadChunkPayload` in Go backend
 */
export interface UploadChunkPayload {
  fileId: string;
  chunkId: number;
  data: ArrayBuffer;
}

/**
 * 服务端通知接收方有文件待接收
 * @description Corresponds to `FileTransferRequestPayload` in Go backend
 */
export interface FileTransferRequest {
  fileId: string;
  fileName: string;
  fileSize: number;
  fromId: string;
  totalChunks: number;
  chunkSize: number;
}

/**
 * 接收方响应服务端的文件传输请求
 * @description Corresponds to `FileTransferResponsePayload` in Go backend
 */
export interface FileTransferResponse {
  fileId: string;
  accept: boolean;
  fromId: string;
}

/**
 * 传输控制（暂停/恢复/取消）
 * @description Corresponds to `TransferControlPayload` in Go backend
 */
export interface TransferControl {
  fileId: string;
  action: 'pause' | 'resume' | 'cancel';
}

/**
 * 传输进度
 * @description Corresponds to `TransferProgressPayload` in Go backend
 */
export interface TransferProgress {
  fileId: string;
  progress: number; // 0-100
  speed: string; // e.g. "20kb/s"
  status?: TransferStatus; // 扩展字段，用于前端状态管理
  bytesTransferred?: number; // 已传输的字节数
  totalBytes?: number; // 总字节数
}

/**
 * 错误信息
 */
export interface ErrorPayload {
  message: string;
}