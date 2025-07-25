import { BehaviorSubject } from 'rxjs';
import { p2pService, FileReceiver } from './p2p';
import { socketService } from './socket';
import { FileTransferRequest, FileTransferResponse } from '../types/transfer';
import { Transfer, TransferStatus } from '../types';

const CHUNK_SIZE = 1024 * 32; // 32KB

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
      if (accept) {
        const currentTransfers = this.transfers.getValue();
        const transfer = currentTransfers.find(t => t.id === fileId);
        if (transfer && transfer.file) {
          this.updateTransferState({ id: fileId, status: 'sending', targetId: fromId });
          this.startChunking(transfer, [fromId]);
        }
      } else {
        // Handle rejection: remove transfer from UI
        this.transfers.next(this.transfers.getValue().filter(t => t.id !== fileId));
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
      targetId: targetClientIds.join(','), // Store targetId immediately
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
          this.updateTransferState({ id: fileId, status: 'waiting_for_approval' });
        }
      }
    });
  }

  private async startChunking(transfer: Transfer, targetClientIds: string[]) {
    const { file, id: fileId } = transfer;
    if (!file) return;

    this.updateTransferState({ id: fileId, isPaused: false });
    let lastTimestamp = Date.now();
    let lastSentBytes = 0;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let i = transfer.sentChunks || 0;

    while (i < totalChunks) {
      const currentTransferState = this.transfers.getValue().find(t => t.id === fileId);
      if (currentTransferState?.isPaused) {
        this.updateTransferState({ id: fileId, status: 'paused' });
        return; // Stop chunking
      }
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const arrayBuffer = await chunk.arrayBuffer();

      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay

      try {
        for (const targetId of targetClientIds) {
          // 添加块索引信息到文件块中
          const fileIdBytes = new TextEncoder().encode(String(fileId));
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

        const now = Date.now();
        const timeDiff = (now - lastTimestamp) / 1000;
        const sentBytes = (i + 1) * CHUNK_SIZE;
        const bytesDiff = sentBytes - lastSentBytes;
        let rate = 0;
        if (timeDiff > 0) {
          rate = bytesDiff / timeDiff / 1024; // KB/s
        }
        lastTimestamp = now;
        lastSentBytes = sentBytes;

        this.updateTransferProgress(String(fileId), (i + 1) / totalChunks, rate, 'sending');
        this.updateTransferState({ id: fileId, sentChunks: i + 1 });

        i++;
      } catch (error) {
        console.error('发送文件块失败:', error);
        this.updateTransferState({ id: fileId, status: 'failed' });
        return;
      }
    }

    if (!this.transfers.getValue().find(t => t.id === fileId)?.isPaused) {
      this.updateTransferState({ id: fileId, status: 'completed', progress: 1 });
    }
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