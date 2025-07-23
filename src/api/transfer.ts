import { BehaviorSubject } from 'rxjs';
import { p2pService, FileReceiver } from './p2p';
import { socketService } from './socket';
import { FileTransferRequest, FileTransferResponse, TransferProgress } from '../types/transfer';
import { Transfer, TransferStatus } from '../types';

const CHUNK_SIZE = 1024 * 32; // 32KB

class TransferService {
  private transfers = new BehaviorSubject<Transfer[]>([]);

  constructor() {
    this.listenForP2PFileRequests();
    this.listenForP2PFileResponses();
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
      if (accept) {
        const currentTransfers = this.transfers.getValue();
        const transfer = currentTransfers.find(t => t.id === fileId);
        if (transfer && transfer.file) {
          this.updateTransferState({ fileId, status: 'sending' });
          this.startChunking(transfer.file, fileId, [fromId]);
        }
      } else {
        // Handle rejection: remove transfer from UI
        this.transfers.next(this.transfers.getValue().filter(t => t.id !== fileId));
      }
    });
  }

  // 更新传输进度的便捷方法
  public updateTransferProgress(fileId: string, progress: number, speed?: string, status?: TransferStatus) {
    const progressUpdate: TransferProgress = {
      fileId,
      progress,
      speed: speed || '0 kb/s',
      status: status
    };
    this.updateTransferState(progressUpdate);
  }

  private updateTransferState(progress: Partial<TransferProgress> & { fileId: string }) {
    const currentTransfers = this.transfers.getValue();
    const existingTransferIndex = currentTransfers.findIndex(t => t.id === progress.fileId);

    if (existingTransferIndex > -1) {
      const updatedTransfers = [...currentTransfers];
      const existingTransfer = { ...updatedTransfers[existingTransferIndex] };
      
      if (progress.progress !== undefined) existingTransfer.progress = progress.progress;
      if (progress.status) existingTransfer.status = progress.status;
      if (progress.speed) {
        const speedMatch = progress.speed.match(/(\d+(\.\d+)?)/);
        if (speedMatch) existingTransfer.rate = parseFloat(speedMatch[1]);
      }

      updatedTransfers[existingTransferIndex] = existingTransfer;
      this.transfers.next(updatedTransfers);
    }
  }

  async sendFile(file: File, targetClientIds: string[], targetDeviceNames: string[]) {
    const fileId = `${Date.now()}-${file.name}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    const newTransfer: Transfer = {
      id: fileId,
      name: file.name,
      size: file.size,
      status: 'connecting',
      progress: 0,
      direction: 'sent',
      targetDevice: targetDeviceNames.join(', '),
      file: file, // Store file object for later use
    };
    this.transfers.next([...this.transfers.getValue(), newTransfer]);

    for (const targetId of targetClientIds) {
      p2pService.createOffer(targetId);
    }

    const openChannels = new Set<string>();
    const channelSubscription = p2pService.onDataChannelOpen.subscribe(openTargetId => {
      if (targetClientIds.includes(openTargetId)) {
        openChannels.add(openTargetId);

        if (openChannels.size === targetClientIds.length) {
          channelSubscription.unsubscribe();

          const requestPayload: FileTransferRequest = {
            fileId: fileId,
            fileName: file.name,
            fileSize: file.size,
            totalChunks: totalChunks,
            chunkSize: CHUNK_SIZE,
            fromId: '', // fromId will be set by p2p service
          };

          for (const targetId of targetClientIds) {
            p2pService.sendP2PMessage(targetId, 'file_transfer_request', requestPayload);
          }
          this.updateTransferState({ fileId, status: 'waiting_for_approval' });
        }
      }
    });
  }

  private async startChunking(file: File, fileId: string, targetClientIds: string[]) {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const arrayBuffer = await chunk.arrayBuffer();

      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay

      try {
        for (const targetId of targetClientIds) {
          // 添加块索引信息到文件块中
          const fileIdBytes = new TextEncoder().encode(fileId);
          const fileIdLengthBytes = new Uint8Array(new Uint32Array([fileIdBytes.length]).buffer);
          const chunkIndexBytes = new Uint8Array(new Uint32Array([i]).buffer); // 添加块索引
          
          // 添加特殊标记字符'$='(ASCII码36和61)，帮助接收端识别数据格式
          const markerBytes = new Uint8Array([36, 61]); // 36是'$'的ASCII码，61是'='的ASCII码
          
          // 新的组合块结构: [标记字符(2字节)][fileIdLength(4字节)][fileId][chunkIndex(4字节)][chunkData]
          const combinedChunk = new Uint8Array(
            markerBytes.length + fileIdLengthBytes.length + fileIdBytes.length + chunkIndexBytes.length + arrayBuffer.byteLength
          );
          
          let offset = 0;
          combinedChunk.set(markerBytes, offset);
          offset += markerBytes.length;
          
          combinedChunk.set(fileIdLengthBytes, offset);
          offset += fileIdLengthBytes.length;
          
          combinedChunk.set(fileIdBytes, offset);
          offset += fileIdBytes.length;
          
          combinedChunk.set(chunkIndexBytes, offset);
          offset += chunkIndexBytes.length;
          
          combinedChunk.set(new Uint8Array(arrayBuffer), offset);

          p2pService.sendFileChunk(targetId, combinedChunk.buffer);
        }

        this.updateTransferProgress(fileId, (i + 1) / totalChunks, undefined, 'sending');
      } catch (error) {
        console.error('发送文件块失败:', error);
        this.updateTransferState({ fileId, status: 'failed' });
        break;
      }
    }
    this.updateTransferState({ fileId, status: 'completed', progress: 1 });
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

  acceptTransfer(request: FileTransferRequest) {
    console.log(`接受来自 ${request.fromId} 的文件传输请求: ${request.fileName}`);
    
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

    // 创建 FileReceiver 实例来接收和处理文件块
    // 确保在发送响应前创建 FileReceiver 实例
    p2pService.fileReceivers.set(
      request.fileId,
      new FileReceiver(request.fileId, request.fileName, request.totalChunks)
    );
    
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
    p2pService.sendP2PMessage(request.fromId, 'file_transfer_response', response);
    
    console.log(`已准备好接收文件 ${request.fileName}，共 ${request.totalChunks} 块`);
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
  pauseTransfer(id: string) {
    console.log(`暂停功能暂未在P2P模式下实现: ${id}`);
    // To implement: send a 'pause' message via data channel
    // The other peer needs to handle this and stop sending/receiving chunks
  }

  resumeTransfer(id: string) {
    console.log(`恢复功能暂未在P2P模式下实现: ${id}`);
    // To implement: send a 'resume' message
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