import { Subject } from 'rxjs';
import { socketService } from './socket';
import { FileTransferRequest, FileTransferResponse } from '../types/transfer';

// 定义一个全局接口，用于在 FileReceiver 中访问 transferService
declare global {
  interface Window {
    transferService: any;
  }
}

export class FileReceiver {
  private fileId: string;
  private fileName: string;
  private totalChunks: number;
  private receivedChunks: Map<number, boolean | Uint8Array>; // 文件系统模式存储boolean，内存模式存储实际数据
  private receivedChunksCount: number = 0;
  private lastTimestamp: number = 0;
  private lastReceivedBytes: number = 0;
  private writableStream: WritableStream | null = null;
  private fileHandle: FileSystemFileHandle | null = null;
  private writer: WritableStreamDefaultWriter | null = null;
  private writeQueue: Array<{ chunkIndex: number; data: Uint8Array; resolve: () => void; reject: (error: any) => void }> = [];
  private isWriting: boolean = false;
  private rateHistory: number[] = [];
  private lastProgressUpdate: number = 0;
  private readonly PROGRESS_UPDATE_INTERVAL = 1000; // 1秒更新一次进度
  private readonly RATE_HISTORY_SIZE = 5; // 保留最近5次的速率用于平滑

  constructor(fileId: string, fileName: string, totalChunks: number, expectedFileSize: number = 0) {
    this.fileId = fileId;
    this.fileName = fileName;
    this.totalChunks = totalChunks;
    this.receivedChunks = new Map();
    // 延迟初始化文件系统，等待用户交互
  }

  public async initFileSystem() {
    try {
      // 检查是否支持文件系统API
      if ('showDirectoryPicker' in window) {
        console.log('检测到文件系统API支持，请求用户选择保存目录...');
        // 请求文件系统权限 - 需要用户手势触发
        const root = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'downloads'
        });
        this.fileHandle = await root.getFileHandle(this.fileName, { create: true });
        
        if (this.fileHandle) {
          this.writableStream = await this.fileHandle.createWritable();
          this.writer = this.writableStream.getWriter();
          console.log(`文件系统初始化成功: ${this.fileName}`);
          return true;
        }
      } else {
        console.warn('文件系统API不可用，将使用内存模式');
      }
    } catch (error) {
      console.warn('文件系统API初始化失败，将使用内存模式:', error);
      // 如果用户取消了目录选择，也会进入这里
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('用户取消了目录选择，使用内存模式');
      }
    }
    
    // 回退到内存模式
    this.receivedChunks = new Map();
    return false;
  }

  // 获取已接收的块数，用于生成块索引
  getReceivedChunksCount(): number {
    return this.receivedChunksCount;
  }

  // 队列化写入方法，避免并发冲突
  private async processWriteQueue() {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }

    this.isWriting = true;
    
    while (this.writeQueue.length > 0) {
      const { chunkIndex, data, resolve, reject } = this.writeQueue.shift()!;
      
      try {
        if (this.writer) {
          await this.writer.write(data);
          console.log(`成功写入块 ${chunkIndex}，大小: ${data.byteLength}字节`);
          resolve();
        } else {
          reject(new Error('Writer not available'));
        }
      } catch (error) {
        console.error(`写入块 ${chunkIndex} 失败:`, error);
        reject(error);
      }
    }
    
    this.isWriting = false;
  }

  // 添加写入任务到队列
  private async queueWrite(chunkIndex: number, data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      this.writeQueue.push({ chunkIndex, data, resolve, reject });
      this.processWriteQueue();
    });
  }

  // 计算平滑速率
  private calculateSmoothedRate(currentRate: number): number {
    // 添加当前速率到历史记录
    this.rateHistory.push(currentRate);
    
    // 保持历史记录大小
    if (this.rateHistory.length > this.RATE_HISTORY_SIZE) {
      this.rateHistory.shift();
    }
    
    // 计算平均速率
    const sum = this.rateHistory.reduce((acc, rate) => acc + rate, 0);
    return Math.round(sum / this.rateHistory.length);
  }

  async addChunk(chunkIndex: number, chunk: ArrayBuffer) {
    try {
      console.log(`接收文件 ${this.fileName} 的块 ${chunkIndex}，大小: ${chunk.byteLength}字节`);
      
      if (chunkIndex < 0 || chunkIndex >= this.totalChunks) {
        console.error(`无效的块索引: ${chunkIndex}`);
        return;
      }
      
      if (!chunk || chunk.byteLength === 0) {
        console.error(`文件 ${this.fileName} 的块 ${chunkIndex} 数据无效`);
        return;
      }

      // 避免重复接收 - 检查是否已经接收过这个块
      if (this.receivedChunks.has(chunkIndex)) {
        const existingChunk = this.receivedChunks.get(chunkIndex);
        // 如果已经存储了实际数据或标记为已接收，则跳过
        if (existingChunk === true || existingChunk instanceof Uint8Array) {
          console.log(`文件 ${this.fileName} 的块 ${chunkIndex} 已存在，跳过`);
          return;
        }
      }

      // 使用队列化写入避免并发冲突
      if (this.writer) {
        await this.queueWrite(chunkIndex, new Uint8Array(chunk));
        this.receivedChunks.set(chunkIndex, true);
      } else {
        // 内存模式：存储实际数据
        this.receivedChunks.set(chunkIndex, new Uint8Array(chunk));
      }

      this.receivedChunksCount++;

      // 计算传输速度 - 动态计算实际接收字节数
      const now = Date.now();
      let currentReceivedBytes = 0;
      // 计算实际接收的字节数
      this.receivedChunks.forEach((value, key) => {
        if (value instanceof Uint8Array) {
          currentReceivedBytes += value.byteLength;
        } else if (value === true) {
          // 文件系统模式，估算为64KB
          currentReceivedBytes += 65536;
        }
      });
      let currentRate = 0;
      if (this.lastTimestamp > 0) {
        const timeDiff = (now - this.lastTimestamp) / 1000;
        const bytesDiff = currentReceivedBytes - this.lastReceivedBytes;
        if (timeDiff > 0) {
          currentRate = bytesDiff / timeDiff / 1024; // KB/s
        }
      }
      this.lastTimestamp = now;
      this.lastReceivedBytes = currentReceivedBytes;

      // 限制进度更新频率，避免界面跳动过快
      const shouldUpdateProgress = (now - this.lastProgressUpdate) >= this.PROGRESS_UPDATE_INTERVAL;
      
      if (shouldUpdateProgress || this.receivedChunksCount === this.totalChunks) {
        // 计算平滑速率
        const smoothedRate = this.calculateSmoothedRate(currentRate);
        
        // 更新进度
        const progress = this.receivedChunksCount / this.totalChunks;
        if (window.transferService) {
          window.transferService.updateTransferProgress(this.fileId, progress, smoothedRate, 'receiving');
        }
        
        this.lastProgressUpdate = now;
      }

      if (this.receivedChunksCount === this.totalChunks) {
        console.log(`文件 ${this.fileName} 接收完成，共 ${this.totalChunks} 块`);
        
        // 对于小文件，添加短暂延迟确保所有状态更新完成
        if (this.totalChunks <= 3) {
          console.log(`检测到小文件（${this.totalChunks}块），添加延迟确保状态同步`);
          setTimeout(async () => {
            await this.finalizeDownload();
          }, 100);
        } else {
          await this.finalizeDownload();
        }
      }
    } catch (error: unknown) {
      console.error(`接收文件 ${this.fileName} 的块 ${chunkIndex} 时出错:`, error);
      if (window.transferService) {
        window.transferService.updateTransferProgress(this.fileId, 0, undefined, 'failed');
      }
    }
  }

  private async finalizeDownload() {
    try {
      if (this.writableStream) {
        await this.writableStream.close();
        
        if (this.fileHandle) {
          // 获取最终文件用于下载
          const file = await this.fileHandle.getFile();
          const url = URL.createObjectURL(file);
          
          if (window.transferService) {
            window.transferService.updateTransferWithDownload(this.fileId, url);
          }
          console.log(`文件 ${this.fileName} 已保存到磁盘，大小: ${file.size}字节`);
        }
      } else {
        // 内存模式：组装所有块
        console.log('使用内存模式组装文件数据...');
        const chunks: Uint8Array[] = [];
        
        // 按顺序组装所有块
        for (let i = 0; i < this.totalChunks; i++) {
          const chunkData = this.receivedChunks.get(i);
          if (chunkData instanceof Uint8Array) {
            chunks.push(chunkData);
          } else {
            console.error(`缺少块 ${i}，文件可能不完整`);
            throw new Error(`缺少块 ${i}`);
          }
        }
        
        // 创建完整文件的Blob
        const blob = new Blob(chunks, { type: this.getMimeType(this.fileName) });
        const url = URL.createObjectURL(blob);
        
        console.log(`内存模式文件组装完成，总大小: ${blob.size}字节`);
        
        if (window.transferService) {
          window.transferService.updateTransferWithDownload(this.fileId, url);
        }
        
        // 触发下载
        const a = document.createElement('a');
        a.href = url;
        a.download = this.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        console.log(`已触发文件下载: ${this.fileName}`);
      }
      
      // 清理状态
      await this.cleanup();
      
      // 通知P2PService清理fileReceiver
      if ((window as any).p2pService) {
        (window as any).p2pService.removeFileReceiver(this.fileId);
        console.log(`已从P2PService中移除文件接收器: ${this.fileId}`);
      }
    } catch (error: unknown) {
      console.error(`完成文件 ${this.fileName} 下载时出错:`, error);
      if (window.transferService) {
        window.transferService.updateTransferProgress(this.fileId, 0, undefined, 'failed');
      }
      // 即使出错也要清理fileReceiver
      if ((window as any).p2pService) {
        (window as any).p2pService.removeFileReceiver(this.fileId);
      }
    }
  }

  private async cleanup() {
    this.receivedChunks.clear();
    this.receivedChunksCount = 0;
    
    // 清理写入队列
    this.writeQueue = [];
    this.isWriting = false;
    
    // 清理速率相关属性
    this.rateHistory = [];
    this.lastProgressUpdate = 0;
    this.lastTimestamp = 0;
    this.lastReceivedBytes = 0;
    
    // 释放 writer
    if (this.writer) {
      try {
        await this.writer.close();
      } catch (error) {
        console.warn('关闭 writer 时出错:', error);
      }
      this.writer = null;
    }
    
    if (this.writableStream) {
      this.writableStream = null;
    }
    if (this.fileHandle) {
      this.fileHandle = null;
    }
  }
  
  // 根据文件名获取MIME类型
  private getMimeType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      'txt': 'text/plain',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'text/javascript',
      'json': 'application/json',
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'mp3': 'audio/mpeg',
      'mp4': 'video/mp4',
      'wav': 'audio/wav',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }
}

export class P2PService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  public fileReceivers: Map<string, FileReceiver> = new Map();
  public onDataChannelOpen = new Subject<string>();
  public onFileTransferRequest = new Subject<FileTransferRequest>();
  public onFileTransferResponse = new Subject<FileTransferResponse>();
  public onControlMessage = new Subject<{ fromId: string; payload: any }>();

  constructor() {
    this.listenForWebRTCSignals();
    this.monitorConnections();
  }

  private monitorConnections() {
    setInterval(() => {
      this.peerConnections.forEach((pc, targetId) => {
        const dataChannel = this.dataChannels.get(targetId);
        
        // 检查连接状态 - 只在明确失败时重连
        if (pc.connectionState === 'failed') {
          console.warn(`Connection with ${targetId} is ${pc.connectionState}, attempting reconnect...`);
          this.reconnectDataChannel(targetId);
        }
        
        // 检查数据通道状态 - 只在连接正常但数据通道关闭时重建
        if (dataChannel && dataChannel.readyState === 'closed' && pc.connectionState === 'connected') {
          console.warn(`Data channel with ${targetId} is closed, attempting to recreate...`);
          this.createNewDataChannel(targetId, pc);
        }
      });
    }, 5000); // 每5秒检查一次
  }

  createReceiver(fileId: string, fileName: string, totalChunks: number, expectedFileSize: number = 0): FileReceiver {
    const receiver = new FileReceiver(fileId, fileName, totalChunks, expectedFileSize);
    this.fileReceivers.set(fileId, receiver);
    return receiver;
  }

  removeFileReceiver(fileId: string): void {
    if (this.fileReceivers.has(fileId)) {
      this.fileReceivers.delete(fileId);
      console.log(`已清理文件接收器: ${fileId}`);
    }
  }

  private listenForWebRTCSignals() {
    // 记录已处理的信令消息ID，避免重复处理
    const processedSignals = new Set<string>();
    
    socketService.onMessage$<any>('webrtc_signal').subscribe(payload => {
      const { fromId, signal } = payload;
      
      // 检查信号是否来自自己
      if (fromId === this.getCurrentUserId()) {
        console.warn(`忽略来自自己的信令`);
        return;
      }
      
      // 生成消息ID用于去重
      const signalId = `${fromId}_${signal.type}_${JSON.stringify(signal).length}`;
      if (processedSignals.has(signalId)) {
        console.log(`跳过重复的信令消息: ${signal.type} from ${fromId}`);
        return;
      }
      processedSignals.add(signalId);
      
      // 清理旧的信号记录，避免内存泄漏
        if (processedSignals.size > 100) {
          const iterator = processedSignals.values();
          for (let i = 0; i < 50; i++) {
            const value = iterator.next().value;
            if (value) {
              processedSignals.delete(value);
            }
          }
        }
      
      const pc = this.getPeerConnection(fromId);

      if (signal.type === 'offer') {
        console.log(`收到offer from ${fromId}, 当前信令状态: ${pc.signalingState}`);
        
        // 只有在stable状态下才处理offer，避免重复
        if (pc.signalingState === 'stable') {
          pc.setRemoteDescription(new RTCSessionDescription(signal))
            .then(() => {
              console.log(`设置远程offer成功: ${fromId}`);
              return pc.createAnswer();
            })
            .then(answer => {
              return pc.setLocalDescription(answer);
            })
            .then(() => {
              console.log(`发送answer to ${fromId}`);
              this.sendSignal(fromId, pc.localDescription);
            })
            .catch(error => {
              console.error(`处理offer失败:`, error);
            });
        } else {
          console.warn(`忽略offer，当前信令状态: ${pc.signalingState}`);
        }
      } else if (signal.type === 'answer') {
        console.log(`收到answer from ${fromId}, 当前信令状态: ${pc.signalingState}`);
        
        // 增加额外检查，避免重复处理已设置的answer
        if (pc.signalingState === 'have-local-offer' && !pc.remoteDescription) {
          pc.setRemoteDescription(new RTCSessionDescription(signal))
            .then(() => {
              console.log(`设置远程answer成功: ${fromId}`);
            })
            .catch(error => {
              console.error(`设置answer失败:`, error);
            });
        } else {
          console.warn(`忽略answer，当前信令状态: ${pc.signalingState}, 远程描述已设置: ${!!pc.remoteDescription}`);
        }
      } else if (signal.candidate) {
        console.log(`收到ICE候选 from ${fromId}`);
        
        // 确保有远程描述后再添加ICE候选
        if (pc.remoteDescription && pc.signalingState !== 'closed') {
          pc.addIceCandidate(new RTCIceCandidate(signal))
            .then(() => {
              console.log(`添加ICE候选成功: ${fromId}`);
            })
            .catch(error => {
              console.error(`添加ICE候选失败:`, error);
            });
        } else {
          console.warn(`忽略ICE候选，远程描述未设置或连接已关闭`);
        }
      }
    });
  }

  private reconnectDataChannel(targetId: string) {
    console.log(`Attempting to reconnect data channel with ${targetId}`);
    
    const existingConnection = this.peerConnections.get(targetId);
    if (existingConnection && existingConnection.connectionState === 'connected') {
      // 如果连接还存在，只需重新创建数据通道
      this.createNewDataChannel(targetId, existingConnection);
    } else {
      // 清理旧的连接状态并重新建立连接
      this.cleanupConnection(targetId);
      this.createOffer(targetId);
    }
  }

  private cleanupConnection(targetId: string) {
    const pc = this.peerConnections.get(targetId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(targetId);
    }
    
    const dataChannel = this.dataChannels.get(targetId);
    if (dataChannel) {
      dataChannel.close();
      this.dataChannels.delete(targetId);
    }
    
    console.log(`已清理连接状态: ${targetId}`);
  }

  private createNewDataChannel(targetId: string, pc: RTCPeerConnection) {
    try {
      const newDataChannel = pc.createDataChannel('fileTransfer', {
        ordered: true,
        maxRetransmits: 3,
        protocol: 'file-transfer-v2'
      });
      
      this.dataChannels.set(targetId, newDataChannel);
      this.setupDataChannelEvents(targetId, newDataChannel);
      
      console.log(`New data channel created for ${targetId}`);
    } catch (error) {
      console.error(`Failed to create new data channel for ${targetId}:`, error);
    }
  }

  private getPeerConnection(targetId: string): RTCPeerConnection {
    if (!this.peerConnections.has(targetId)) {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      });

      // 等待ICE候选收集完成
      let iceCandidateTimeout: NodeJS.Timeout;
      pc.onicecandidate = event => {
        if (event.candidate) {
          this.sendSignal(targetId, event.candidate);
        } else {
          // ICE候选收集完成
          clearTimeout(iceCandidateTimeout);
        }
      };

      // 设置ICE候选超时处理
      iceCandidateTimeout = setTimeout(() => {
        console.log(`ICE候选收集超时: ${targetId}`);
      }, 5000);

      pc.ondatachannel = event => {
        const dataChannel = event.channel;
        this.dataChannels.set(targetId, dataChannel);
        this.setupDataChannelEvents(targetId, dataChannel);
      };

      // 监听连接状态变化
      pc.onconnectionstatechange = () => {
        console.log(`连接状态变化: ${targetId} -> ${pc.connectionState}`);
      };

      this.peerConnections.set(targetId, pc);
    }
    return this.peerConnections.get(targetId)!;
  }

  public createOffer(targetId: string) {
    const pc = this.getPeerConnection(targetId);
    
    // 检查是否已存在活跃的数据通道
    const existingDataChannel = this.dataChannels.get(targetId);
    if (existingDataChannel && existingDataChannel.readyState === 'open') {
      console.log(`数据通道已存在且活跃: ${targetId}`);
      return;
    }
    
    // 检查信令状态，避免重复创建offer
    if (pc.signalingState !== 'stable') {
      console.warn(`信令状态不是stable，跳过创建offer: ${pc.signalingState}, targetId: ${targetId}`);
      return;
    }

    // 检查是否已有未完成的offer
    if (pc.localDescription && pc.localDescription.type === 'offer') {
      console.log(`已存在未完成的offer，跳过创建: ${targetId}`);
      return;
    }

    const dataChannel = pc.createDataChannel('fileTransfer', {
      ordered: true,
      maxRetransmits: 3,
      protocol: 'file-transfer-v2'
    });
    this.dataChannels.set(targetId, dataChannel);
    this.setupDataChannelEvents(targetId, dataChannel);

    pc.createOffer().then(offer => {
      return pc.setLocalDescription(offer);
    }).then(() => {
      console.log(`创建offer成功，发送给: ${targetId}`);
      this.sendSignal(targetId, pc.localDescription);
    }).catch(error => {
      console.error(`创建offer失败:`, error);
    });
  }

  private getCurrentUserId(): string {
    // 从socketService获取当前用户ID
    return (socketService as any).userId || '';
  }

  public sendSignal(targetId: string, signal: any) {
    if (targetId === this.getCurrentUserId()) {
      console.warn(`不能向自己发送信令`);
      return;
    }
    
    socketService.sendMessage('webrtc_signal', {
      toId: targetId,
      signal: signal,
    });
  }

  private setupDataChannelEvents(targetId: string, dataChannel: RTCDataChannel) {
    let heartbeatInterval: NodeJS.Timeout | null = null;
    
    dataChannel.onopen = () => {
      console.log(`Data channel with ${targetId} is open.`);
      this.onDataChannelOpen.next(targetId);
      
      // 启动心跳机制
      heartbeatInterval = setInterval(() => {
        if (dataChannel.readyState === 'open') {
          try {
            dataChannel.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
          } catch (error) {
            console.warn(`发送心跳失败: ${error}`);
            if (heartbeatInterval) clearInterval(heartbeatInterval);
          }
        } else {
          if (heartbeatInterval) clearInterval(heartbeatInterval);
        }
      }, 30000); // 每30秒发送一次心跳
    };

    dataChannel.onclose = () => {
      console.log(`Data channel with ${targetId} is closed.`);
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      
      // 自动重连机制
      setTimeout(() => {
        this.reconnectDataChannel(targetId);
      }, 1000);
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel error with ${targetId}:`, error);
    };

    dataChannel.onmessage = event => {
      if (typeof event.data === 'string') {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'file_transfer_request':
            console.log(`[P2P] 收到文件传输请求 from ${targetId}:`, message.payload);
            // 提前创建文件接收器
            this.fileReceivers.set(
              message.payload.fileId,
              new FileReceiver(message.payload.fileId, message.payload.fileName, message.payload.totalChunks)
            );
            console.log(`已创建文件接收器: ${message.payload.fileId}`);
            this.onFileTransferRequest.next({ ...message.payload, fromId: targetId });
            console.log(`[P2P] 已触发文件传输请求事件`);
            break;
          case 'file_transfer_response':
            this.onFileTransferResponse.next(message.payload);
            break;
          case 'control_message':
            this.onControlMessage.next({ fromId: targetId, payload: message.payload });
            break;
          case 'file_info': // Keep for backward compatibility or other uses
            this.fileReceivers.set(
              message.payload.fileId,
              new FileReceiver(message.payload.fileId, message.payload.fileName, message.payload.totalChunks)
            );
            break;
        }
      } else {
        try {
          // 简化二进制消息解析 - 统一格式：[fileIdLength(4字节)][chunkIndex(4字节)][fileId][chunkData]
          console.log(`接收到二进制数据，总长度: ${event.data.byteLength}字节`);
          
          if (!event.data || event.data.byteLength < 12) { // 至少需要8字节头 + 最小fileId(1字节) + 最小数据(3字节)
            console.error(`接收到无效的二进制数据：数据长度不足 (${event.data ? event.data.byteLength : 0}字节)`);
            return;
          }

          const dataView = new DataView(event.data);
          const fileIdLength = dataView.getUint32(0, true);
          const chunkIndex = dataView.getUint32(4, true);
          
          // 验证fileIdLength合理性
          if (fileIdLength <= 0 || fileIdLength > 256 || fileIdLength + 8 > event.data.byteLength) {
            console.error(`接收到无效的fileIdLength: ${fileIdLength}`);
            return;
          }
          
          // 解析fileId
          const fileId = new TextDecoder().decode(event.data.slice(8, 8 + fileIdLength));
          if (!fileId || fileId.trim() === '') {
            console.error(`解析出的fileId无效`);
            return;
          }
          
          // 获取chunk数据
          const chunk = event.data.slice(8 + fileIdLength);
          if (!chunk || chunk.byteLength === 0) {
            console.error(`文件 ${fileId} 的块 ${chunkIndex} 数据无效或为空`);
            return;
          }
          
          console.log(`接收到文件 ${fileId} 的块 ${chunkIndex}, 块大小: ${chunk.byteLength}字节`);
          
          // 验证chunk数据
          if (!chunk || chunk.byteLength === 0) {
            console.error(`文件 ${fileId} 的块 ${chunkIndex} 数据无效或为空`);
            return;
          }
          
          const receiver = this.fileReceivers.get(fileId);
          if (receiver) {
            receiver.addChunk(chunkIndex, chunk);
          } else {
            console.error(`未找到文件 ${fileId} 的接收器，可能是接收器未正确创建或已被删除`);
          }
        } catch (error: unknown) {
          console.error(`处理二进制消息时出错: ${error instanceof Error ? error.message : '未知错误'}`, error);
          console.error('原始数据长度:', event.data.byteLength);
          // 尝试打印前100个字节的十六进制表示，帮助调试
          try {
            const firstBytes = new Uint8Array(event.data.slice(0, Math.min(100, event.data.byteLength)));
            console.error('数据前100字节:', Array.from(firstBytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
          } catch (e) {
            console.error('无法打印数据前缀');
          }
        }
      }
    };
  }

  public sendP2PMessage(targetId: string, type: string, payload: any) {
    console.log(`[P2P] Attempting to send message to ${targetId}:`, { type, payload });
    const dataChannel = this.dataChannels.get(targetId);
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify({ type, payload }));
      console.log(`[P2P] Message sent to ${targetId}`);
    } else {
      console.error(`[P2P] Data channel with ${targetId} is not open. Cannot send message. State: ${dataChannel?.readyState}`);
    }
  }

  public getDataChannel(targetId: string): RTCDataChannel | undefined {
    return this.dataChannels.get(targetId);
  }

  public sendFileChunk(targetId: string, chunk: ArrayBuffer, fileId: string, chunkIndex: number, retryCount = 0): Promise<void> {
    const dataChannel = this.dataChannels.get(targetId);
    
    if (!dataChannel) {
      console.error(`Data channel with ${targetId} not found.`);
      return Promise.reject(new Error('Data channel not found'));
    }
    
    if (dataChannel.readyState !== 'open') {
      if (retryCount < 5) {
        console.log(`Data channel with ${targetId} is not open, retrying in ${Math.pow(2, retryCount)}s...`);
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            this.sendFileChunk(targetId, chunk, fileId, chunkIndex, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, Math.pow(2, retryCount) * 1000);
        });
      } else {
        console.error(`Data channel with ${targetId} is not open after ${retryCount} retries.`);
        return Promise.reject(new Error('Data channel not open'));
      }
    }

    return new Promise((resolve, reject) => {
      try {
        const fileIdBytes = new TextEncoder().encode(fileId);
        const fileIdLength = fileIdBytes.length;
        const chunkBytes = new Uint8Array(chunk);

        // 构造二进制消息格式 [fileIdLength(4字节)][chunkIndex(4字节)][fileId][chunkData]
        const fullMessage = new Uint8Array(8 + fileIdLength + chunkBytes.byteLength);
        const view = new DataView(fullMessage.buffer);

        view.setUint32(0, fileIdLength, true); // true for little-endian
        view.setUint32(4, chunkIndex, true);
        fullMessage.set(fileIdBytes, 8);
        fullMessage.set(chunkBytes, 8 + fileIdLength);

        // 优化缓冲区管理策略 - 降低基础限制，避免超出WebRTC实际限制
        const maxBufferedAmount = 256 * 1024; // 降低到256KB，避免超出1MB限制
        const maxRetries = 15; // 增加重试次数
        let attemptCount = 0;

        const attemptSend = () => {
          attemptCount++;
          
          if (dataChannel.readyState !== 'open') {
            reject(new Error('Data channel closed during send'));
            return;
          }

          // 严格的缓冲区检查 - 确保不超出WebRTC限制
          const currentBuffered = dataChannel.bufferedAmount;
          
          if (currentBuffered > maxBufferedAmount) {
            if (attemptCount < maxRetries) {
              // 根据缓冲区使用率动态调整等待时间
              const bufferUsageRatio = currentBuffered / maxBufferedAmount;
              const waitTime = Math.min(300, 100 + bufferUsageRatio * 200); // 100-300ms动态等待
              console.log(`Buffer full (${currentBuffered}/${maxBufferedAmount}), waiting ${waitTime}ms... (attempt ${attemptCount}/${maxRetries})`);
              setTimeout(attemptSend, waitTime);
              return;
            } else {
              reject(new Error('Send buffer full after max retries'));
              return;
            }
          }

          try {
            console.log(`Sending chunk ${chunkIndex} to ${targetId}, size: ${fullMessage.byteLength}, buffered: ${dataChannel.bufferedAmount}`);
            dataChannel.send(fullMessage);
            
            // 智能确认机制 - 根据缓冲区状态调整确认时间
            const confirmDelay = currentBuffered > maxBufferedAmount * 0.5 ? 50 : 20; // 缓冲区使用率高时延长确认时间
            setTimeout(() => {
              if (dataChannel.readyState === 'open') {
                console.log(`Chunk ${chunkIndex} sent successfully to ${targetId}`);
                resolve();
              } else {
                reject(new Error('Data channel closed after send'));
              }
            }, confirmDelay);
          } catch (error) {
            console.error(`发送文件块失败 (attempt ${attemptCount}):`, error);
            
            if (attemptCount < maxRetries) {
              // 指数退避策略
              const retryDelay = Math.min(1000, 50 * Math.pow(1.5, attemptCount));
              setTimeout(attemptSend, retryDelay);
            } else {
              reject(error);
            }
          }
        };

        // 进一步减少初始延迟以提高传输速度
        setTimeout(attemptSend, 1); // 从10ms减少到1ms
      } catch (error) {
        console.error(`发送文件块失败:`, error);
        reject(error);
      }
    });
  }
}

export const p2pService = new P2PService();

// 在 window 对象上注册 p2pService，以便在 FileReceiver 中使用
window.p2pService = p2pService;