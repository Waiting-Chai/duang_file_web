import { BehaviorSubject } from 'rxjs';
import { p2pService, FileReceiver } from './p2p';
import { socketService } from './socket';
import { FileTransferRequest, FileTransferResponse } from '../types/transfer';
import { Transfer, TransferStatus } from '../types';

const CHUNK_SIZE = 64 * 1024; // 64KB, 提升传输速度


class TransferService {
  private transfers = new BehaviorSubject<Transfer[]>([]);

  constructor() {
    this.listenForP2PFileRequests();
    this.listenForP2PFileResponses();
    this.listenForP2PControlMessages();
  }

  public onFileTransferRequest$ = p2pService.onFileTransferRequest.asObservable();
  public onTransfersUpdate$ = this.transfers.asObservable();

  private listenForP2PFileRequests() {
    p2pService.onFileTransferRequest.subscribe(_ => {
      // This is handled by the UI component now
    });
  }

  private listenForP2PFileResponses() {
    p2pService.onFileTransferResponse.subscribe(response => {
      const { fileId, accept, fromId } = response;
      console.log(`[TransferService] 收到文件传输响应: fileId=${fileId}, accept=${accept}, fromId=${fromId}`);
      
      if (accept) {
        const currentTransfers = this.transfers.getValue();
        const transfer = currentTransfers.find(t => t.id === fileId);
        if (transfer && transfer.file) {
          // 如果是多目标发送，为每个响应的目标单独启动传输
          const targetIds = (transfer.targetId || '').split(',');
          if (targetIds.includes(fromId)) {
            console.log(`[TransferService] 开始为 ${fromId} 传输文件 ${fileId}`);
            this.updateTransferState({ id: fileId, status: 'sending', targetId: fromId });
            this.startChunking(transfer, [fromId]);
          } else {
            console.warn(`[TransferService] 收到未预期的目标响应: ${fromId} 不在目标列表中`);
          }
        }
      } else {
        // Handle rejection: 从目标列表中移除该目标
        console.log(`[TransferService] 文件传输被 ${fromId} 拒绝: ${fileId}`);
        const currentTransfers = this.transfers.getValue();
        const transfer = currentTransfers.find(t => t.id === fileId);
        if (transfer) {
          const targetIds = (transfer.targetId || '').split(',');
          const remainingTargets = targetIds.filter(id => id !== fromId);
          
          if (remainingTargets.length === 0) {
            // 所有目标都拒绝了，移除传输
            this.transfers.next(this.transfers.getValue().filter(t => t.id !== fileId));
          } else {
            // 更新剩余目标
            this.updateTransferState({ id: fileId, targetId: remainingTargets.join(',') });
          }
        }
      }
    });
  }

  private listenForP2PControlMessages() {
    p2pService.onControlMessage.subscribe(({ fromId, payload }) => {
      console.log(`[Service] Received control message from ${fromId}:`, payload);
      const { type, fileId } = payload;
      switch (type) {
        case 'pause_transfer':
          console.log(`[Service] Pausing transfer ${fileId} from ${fromId}`);
          this.updateTransferState({ id: fileId, status: 'paused', isPaused: true });
          break;
        case 'resume_transfer': {
          console.log(`[Service] Resuming transfer ${fileId} from ${fromId}`);
          const transfer = this.transfers.getValue().find(t => String(t.id) === String(fileId));
          if (transfer) {
            if (transfer.direction === 'sent') {
              // Sender resumes chunking
              this.updateTransferState({ id: fileId, status: 'sending', isPaused: false });
              this.startChunking(transfer, (transfer.targetId || '').split(','));
            } else {
              // Receiver just updates state
              this.updateTransferState({ id: fileId, status: 'receiving', isPaused: false });
            }
          } else {
            console.error(`[Service] Could not find transfer to resume: ${fileId}`);
          }
          break;
        }
      }
    });
  }

  // 更新传输进度的便捷方法
  public updateTransferProgress(fileId: string, progress: number, rate?: number, status?: TransferStatus) {
    const progressUpdate: Partial<Transfer> = {
      id: fileId,
      progress,
      rate,
      status
    };
    this.updateTransferState(progressUpdate as Partial<Transfer> & { id: string | number });
  }

  private updateTransferState(update: Partial<Transfer> & { id: string | number }) {
    const currentTransfers = this.transfers.getValue();
    const existingTransferIndex = currentTransfers.findIndex(t => t.id === update.id);

    if (existingTransferIndex > -1) {
      const updatedTransfers = [...currentTransfers];
      const existingTransfer = { ...updatedTransfers[existingTransferIndex] };
      
      Object.assign(existingTransfer, update);

      updatedTransfers[existingTransferIndex] = existingTransfer;
      this.transfers.next(updatedTransfers);
    }
  }

  async sendFile(file: File, targetClientIds: string[], targetDeviceNames: string[]) {
    const fileId = `${Date.now()}-${file.name}`;
    
    // 根据文件大小动态调整块大小
    const isSmallFile = file.size < 50 * 1024; // 小于50KB的文件
    const dynamicChunkSize = isSmallFile ? Math.min(file.size, 8192) : CHUNK_SIZE; // 小文件使用8KB或文件大小
    const totalChunks = Math.ceil(file.size / dynamicChunkSize);
    
    console.log(`[TransferService] 发送文件: ${file.name}, 大小: ${file.size}字节`);
    console.log(`[TransferService] 文件类型: ${isSmallFile ? '小文件' : '大文件'}, 块大小: ${dynamicChunkSize}字节, 总块数: ${totalChunks}`);

    const newTransfer: Transfer = {
        id: fileId,
        name: file.name,
        size: file.size,
        status: 'connecting',
        progress: 0,
        direction: 'sent',
        targetDevice: targetDeviceNames.join(', '),
        file: file, // Store file object for later use
        targetId: targetClientIds.join(','), // Store targetId immediately
      };
    this.transfers.next([...this.transfers.getValue(), newTransfer]);

    // 为每个目标单独建立连接和发送请求
    for (const targetId of targetClientIds) {
      p2pService.createOffer(targetId);
    }

    const requestPayload: FileTransferRequest = {
      fileId: fileId,
      fileName: file.name,
      fileSize: file.size,
      totalChunks: totalChunks,
      chunkSize: dynamicChunkSize, // 使用动态块大小
      fromId: socketService.getClientId() || '',
    };

    // 为每个目标单独监听数据通道打开事件
    const channelSubscriptions = new Map<string, any>();
    
    targetClientIds.forEach(targetId => {
      const subscription = p2pService.onDataChannelOpen.subscribe(openTargetId => {
        if (openTargetId === targetId) {
          console.log(`[TransferService] 数据通道已打开，向 ${targetId} 发送文件传输请求`);
          p2pService.sendP2PMessage(targetId, 'file_transfer_request', requestPayload);
          
          // 取消这个目标的订阅
          subscription.unsubscribe();
          channelSubscriptions.delete(targetId);
        }
      });
      channelSubscriptions.set(targetId, subscription);
    });

    // 设置超时，如果某些目标未响应，可以清理订阅
    setTimeout(() => {
      channelSubscriptions.forEach(subscription => subscription.unsubscribe());
      channelSubscriptions.clear();
      
      const currentTransfers = this.transfers.getValue();
      const transfer = currentTransfers.find(t => t.id === fileId);
      if (transfer && transfer.status === 'connecting') {
        console.log(`[TransferService] 部分目标连接超时，继续等待响应`);
        this.updateTransferState({ id: fileId, status: 'waiting_for_approval' });
      }
    }, 10000); // 10秒超时
  }

  private async startChunking(transfer: Transfer, targetClientIds: string[]) {
    const { file, id: fileId } = transfer;
    if (!file) return;

    // 检查断点续传
    const resumeInfo = this.loadResumeInfo(String(fileId));
    let startChunk = resumeInfo?.lastChunk || 0;
    
    this.updateTransferState({ id: fileId, isPaused: false, sentChunks: startChunk });
    
    // 根据文件大小动态调整块大小
    const isSmallFile = file.size < 50 * 1024; // 小于50KB的文件
    const dynamicChunkSize = isSmallFile ? Math.min(file.size, 8192) : CHUNK_SIZE; // 小文件使用8KB或文件大小
    const totalChunks = Math.ceil(file.size / dynamicChunkSize);
    console.log(`[TransferService] 开始分块传输: 文件大小=${file.size}, 块大小=${dynamicChunkSize}, 总块数=${totalChunks}`);

    const sendNextChunk = async (chunkIndex: number, data: Uint8Array) => {
      try {
        console.log(`[TransferService] 准备发送块 ${chunkIndex}, 实际大小: ${data.length} 字节`);
        await this.sendChunkWithRetry(String(fileId), chunkIndex, data, targetClientIds);
        this.saveResumeInfo(String(fileId), chunkIndex);
        this.updateTransferProgress(String(fileId), (chunkIndex + 1) / totalChunks, undefined, 'sending');
      } catch (error) {
        console.error(`发送块 ${chunkIndex} 失败:`, error);
        this.updateTransferState({ id: fileId, status: 'failed' });
        throw error;
      }
    };

    // 使用 File.slice() 方法精确按照动态块大小分块
    let consecutiveErrors = 0;
    for (let chunkIndex = startChunk; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * dynamicChunkSize;
      const end = Math.min(start + dynamicChunkSize, file.size);
      const chunk = file.slice(start, end);
      
      // 将 Blob 转换为 ArrayBuffer，再转换为 Uint8Array
      const arrayBuffer = await chunk.arrayBuffer();
      const chunkData = new Uint8Array(arrayBuffer);
      
      try {
        await sendNextChunk(chunkIndex, chunkData);
        consecutiveErrors = 0; // 重置错误计数
        
        // 智能流控：根据文件大小和传输进度动态调整延迟
        const progressRatio = (chunkIndex + 1) / totalChunks;
        let baseDelay = isSmallFile ? 1 : 5; // 小文件1ms，大文件5ms基础延迟
        
        // 大文件在传输后期适当增加延迟，避免缓冲区溢出
        if (!isSmallFile && progressRatio > 0.8) {
          baseDelay = 10;
        }
        
        await new Promise(resolve => setTimeout(resolve, baseDelay));
        
        // 每50块增加适当延迟，让接收方有时间处理
        if ((chunkIndex + 1) % 50 === 0) {
          const batchDelay = isSmallFile ? 20 : 100;
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      } catch (error) {
        consecutiveErrors++;
        console.error(`发送块 ${chunkIndex} 失败 (连续错误: ${consecutiveErrors}):`, error);
        
        // 连续错误时增加延迟，避免雪崩
        if (consecutiveErrors > 3) {
          const errorDelay = Math.min(1000, 100 * consecutiveErrors);
          console.log(`连续错误过多，延迟 ${errorDelay}ms 后继续`);
          await new Promise(resolve => setTimeout(resolve, errorDelay));
        }
        
        throw error;
      }
    }

    this.updateTransferState({ id: fileId, status: 'completed', progress: 1 });
    this.clearResumeInfo(String(fileId));
  }

  private async sendChunkWithRetry(fileId: string, chunkIndex: number, data: Uint8Array, targetClientIds: string[], retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // 串行发送给每个目标，避免并发
        for (const targetId of targetClientIds) {
          await this.sendSingleChunk(targetId, fileId, chunkIndex, data);
          // 进一步减少多目标发送延迟
          if (targetClientIds.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 10)); // 从50ms减少到10ms
          }
        }
        return;
      } catch (error) {
        if (attempt === retries) throw error;
        // 进一步减少重试间隔以提高传输速度
        console.warn(`发送块 ${chunkIndex} 失败，第 ${attempt + 1} 次重试...`);
        await new Promise(resolve => setTimeout(resolve, 200 * Math.pow(2, attempt))); // 从500ms减少到200ms
      }
    }
  }

  private async sendSingleChunk(targetId: string, fileId: string, chunkIndex: number, data: Uint8Array) {
    try {
      // The p2pService.sendFileChunk will handle the chunking logic, no need to combine chunks here.
      await p2pService.sendFileChunk(targetId, data.buffer, fileId, chunkIndex);
    } catch (error) {
      console.error(`发送文件块失败，目标: ${targetId}, 文件: ${fileId}, 块: ${chunkIndex}`, error);
      throw error;
    }
  }

  private saveResumeInfo(fileId: string, lastChunk: number) {
    localStorage.setItem(`resume_${fileId}`, JSON.stringify({ lastChunk, timestamp: Date.now() }));
  }

  private loadResumeInfo(fileId: string): { lastChunk: number; timestamp: number } | null {
    const data = localStorage.getItem(`resume_${fileId}`);
    return data ? JSON.parse(data) : null;
  }

  private clearResumeInfo(fileId: string) {
    localStorage.removeItem(`resume_${fileId}`);
  }

  public updateTransferWithDownload(fileId: string, blobUrl: string) {
    const currentTransfers = this.transfers.getValue();
    const existingTransferIndex = currentTransfers.findIndex(t => t.id === fileId);

    if (existingTransferIndex > -1) {
      const updatedTransfers = [...currentTransfers];
      const existingTransfer = { ...updatedTransfers[existingTransferIndex] };
      
      existingTransfer.status = 'completed';
      existingTransfer.progress = 1;
      existingTransfer.blobUrl = blobUrl;

      updatedTransfers[existingTransferIndex] = existingTransfer;
      this.transfers.next(updatedTransfers);
    }
  }

  async acceptTransfer(request: FileTransferRequest) {
    console.log(`[TransferService] 接受来自 ${request.fromId} 的文件传输请求: ${request.fileName}`);
    console.log('[TransferService] 文件大小:', request.fileSize, '字节，总块数:', request.totalChunks);
    
    const newTransfer: Transfer = {
      id: request.fileId,
      name: request.fileName,
      size: request.fileSize,
      status: 'receiving',
      progress: 0,
      direction: 'received',
      sourceDevice: request.fromId,
    };
    this.transfers.next([...this.transfers.getValue(), newTransfer]);

    // 创建 FileReceiver 实例，但延迟初始化文件系统
    const receiver = new FileReceiver(request.fileId, request.fileName, request.totalChunks);
    
    // 根据文件大小决定是否初始化文件系统
    const isSmallFile = request.fileSize < 50 * 1024; // 小于50KB的文件
    console.log('[TransferService] 文件类型判断:', isSmallFile ? '小文件' : '大文件');
    
    if (!isSmallFile) {
      // 大文件：立即尝试初始化文件系统
      try {
        await receiver.initFileSystem();
        console.log(`[TransferService] 大文件文件系统初始化成功，开始接收文件: ${request.fileName}`);
      } catch (error) {
        console.warn('[TransferService] 大文件文件系统初始化失败，使用内存模式:', error);
      }
    } else {
      // 小文件：直接使用内存模式，避免弹窗延迟
      console.log('[TransferService] 小文件使用内存模式，跳过文件系统初始化');
    }
    
    // 确保在发送响应前创建 FileReceiver 实例
    p2pService.fileReceivers.set(request.fileId, receiver);
    
    // 通知发送方我们已准备好接收文件
    p2pService.sendP2PMessage(request.fromId, 'file_info', {
      fileId: request.fileId,
      fileName: request.fileName,
      totalChunks: request.totalChunks
    });

    const response: FileTransferResponse = {
      fileId: request.fileId,
      accept: true,
      fromId: socketService.getClientId() || ''
    };
    
    // 确保数据通道已打开再发送响应
    const dataChannel = p2pService.getDataChannel(request.fromId);
    if (dataChannel && dataChannel.readyState === 'open') {
      p2pService.sendP2PMessage(request.fromId, 'file_transfer_response', response);
      console.log(`[TransferService] 已发送确认响应给 ${request.fromId}，开始接收文件 ${request.fileName}`);
    } else {
      console.warn(`[TransferService] 数据通道未就绪，延迟发送响应给 ${request.fromId}`);
      // 等待数据通道打开
      const subscription = p2pService.onDataChannelOpen.subscribe(openTargetId => {
        if (openTargetId === request.fromId) {
          p2pService.sendP2PMessage(request.fromId, 'file_transfer_response', response);
          console.log(`[TransferService] 延迟发送确认响应给 ${request.fromId}`);
          subscription.unsubscribe();
        }
      });
    }
  }

  rejectTransfer(request: FileTransferRequest) {
    const response: FileTransferResponse = {
      fileId: request.fileId,
      accept: false,
      fromId: socketService.getClientId() || ''
    };
    p2pService.sendP2PMessage(request.fromId, 'file_transfer_response', response);
    this.transfers.next(this.transfers.getValue().filter(t => t.id !== request.fileId));
  }

  // Pause, Resume, Cancel are more complex in P2P and require more signaling.
  // For now, we will remove them to simplify.
  pauseTransfer(id: string | number) {
    console.log(`[Service] pauseTransfer called for transfer: ${id}`);
    console.log('[Service] Current transfers:', this.transfers.getValue());
    const transfer = this.transfers.getValue().find(t => String(t.id) === String(id));

    if (!transfer) {
      console.error(`[Service] Could not find transfer for pausing: ${id}`);
      return;
    }

    const peerId = transfer.direction === 'sent' ? transfer.targetId : transfer.sourceDevice;

    if (peerId) {
      console.log(`[Service] Sending pause message to ${peerId}`);
      this.updateTransferState({ id, status: 'paused', isPaused: true });
      const targetIds = peerId.split(',');
      for (const targetId of targetIds) {
        p2pService.sendP2PMessage(targetId, 'control_message', {
          type: 'pause_transfer',
          fileId: id
        });
      }
    } else {
      console.error(`[Service] Could not find peerId (targetId or sourceDevice) for pausing: ${id}`);
    }
  }

  resumeTransfer(id: string | number) {
    console.log(`[Service] resumeTransfer called for transfer: ${id}`);
    const transfer = this.transfers.getValue().find(t => String(t.id) === String(id));
    if (!transfer) {
      console.error(`[Service] Could not find transfer for resuming: ${id}`);
      return;
    }

    const peerId = transfer.direction === 'sent' ? transfer.targetId : transfer.sourceDevice;

    if (peerId) {
      console.log(`[Service] Sending resume message to ${peerId}`);
      const newStatus = transfer.direction === 'sent' ? 'sending' : 'receiving';
      this.updateTransferState({ id, isPaused: false, status: newStatus });
      const targetIds = peerId.split(',');
      for (const targetId of targetIds) {
        p2pService.sendP2PMessage(targetId, 'control_message', {
          type: 'resume_transfer',
          fileId: id
        });
      }

      // Only the sender should resume chunking
      if (transfer.direction === 'sent') {
        this.startChunking(transfer, targetIds);
      }
    } else {
      console.error(`[Service] Could not find peerId (targetId or sourceDevice) for resuming: ${id}`);
    }
  }

  cancelTransfer(id: string) {
    console.log(`取消功能暂未在P2P模式下实现: ${id}`);
    // To implement: send a 'cancel' message and close the data channel/peer connection
    this.transfers.next(this.transfers.getValue().filter(t => t.id !== id));
  }
}

export const transferService = new TransferService();

// 在 window 对象上注册 transferService，以便在 FileReceiver 中使用
window.transferService = transferService;