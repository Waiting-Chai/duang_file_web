import { Subject, BehaviorSubject } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { socketService } from './socket';
import { FileTransferRequest, TransferProgress } from '../types/transfer';
import { Transfer, TransferStatus } from '../types';

const CHUNK_SIZE = 1024 * 32; // 32KB

class TransferService {
  private fileTransferRequest = new Subject<FileTransferRequest>();
  private transfers = new BehaviorSubject<Transfer[]>([]);

  constructor() {
    this.listenForFileTransferRequests();
    this.listenForTransferProgress();
  }

  public onFileTransferRequest$ = this.fileTransferRequest.asObservable();
  public onTransfersUpdate$ = this.transfers.asObservable();

  private listenForFileTransferRequests() {
    socketService.onMessage$<FileTransferRequest>('file_transfer_request')
      .subscribe(payload => {
        this.fileTransferRequest.next(payload);
      });
  }

  private listenForTransferProgress() {
    // 使用distinctUntilChanged操作符来过滤掉重复的消息
    socketService.onMessage$<TransferProgress>('transfer_progress')
      .pipe(
        // 使用自定义比较函数来判断两个消息是否相同
        // 如果fileId和progress都相同，则认为是重复消息
        distinctUntilChanged((prev, curr) => {
          return prev.fileId === curr.fileId && 
                 prev.progress === curr.progress && 
                 prev.speed === curr.speed;
        })
      )
      .subscribe(payload => {
        this.updateTransferState(payload);
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

  private updateTransferState(progress: TransferProgress) {
    const currentTransfers = this.transfers.getValue();
    const existingTransferIndex = currentTransfers.findIndex(t => t.id === progress.fileId);

    if (existingTransferIndex > -1) {
      // 更新已有的传输
      const updatedTransfers = [...currentTransfers];
      const existingTransfer = updatedTransfers[existingTransferIndex];
      existingTransfer.progress = progress.progress;
      if (progress.status) {
        existingTransfer.status = progress.status;
      }
      // 将速度字符串转换为数字（如果需要）
      if (progress.speed) {
        const speedMatch = progress.speed.match(/(\d+(\.\d+)?)/); // 提取数字部分
        if (speedMatch) {
          existingTransfer.rate = parseFloat(speedMatch[1]);
        }
      }
      this.transfers.next(updatedTransfers);
    } else {
      // 添加新的传输 (当发送文件时)
      // 注意：接收文件的场景需要在 acceptTransfer 中手动添加
    }
  }

  async sendFile(file: File, targetClientId: string, targetDeviceName: string) {
    const fileId = `${Date.now()}-${file.name}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // 立即在UI上显示
    const newTransfer: Transfer = {
      id: fileId,
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      status: 'starting',
      progress: 0,
      direction: 'sent',
      targetDevice: targetDeviceName,
    };
    this.transfers.next([...this.transfers.getValue(), newTransfer]);

    // 1. 发送开始上传的请求
    socketService.sendMessage('start_upload', {
      fileId: fileId,
      fileName: file.name,
      fileSize: file.size,
      targetId: targetClientId,
      totalChunks: totalChunks
    });

    // 后端收到 start_upload 后会回复一个 'ready_to_receive_chunks' 的 progress
    // 此时 listenForTransferProgress 会捕获到并开始上传
    const subscription = socketService.onMessage$<TransferProgress>('transfer_progress')
      .subscribe(async payload => {
        if (payload.fileId === fileId && payload.status === 'ready_to_receive_chunks') {
          subscription.unsubscribe(); // 收到确认后即可取消订阅，避免重复处理
          // 3. 开始分片上传，使用延迟发送避免连接过载
          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);
            const arrayBuffer = await chunk.arrayBuffer();
            
            // 添加更长的延迟，避免一次性发送太多数据导致连接断开
            await new Promise(resolve => setTimeout(resolve, 200));
            
            try {
              socketService.sendMessage('upload_chunk', {
                fileId: fileId,
                chunkId: i,
                data: arrayBuffer,
              });
              
              // 更新传输进度
              this.updateTransferProgress(fileId, Math.floor((i + 1) * 100 / totalChunks), undefined, 'sending');
            } catch (error) {
              console.error('发送文件块失败:', error);
              // 如果发送失败，可以考虑重试或中断传输
              break;
            }
          }
        }
      });
  }

  acceptTransfer(request: FileTransferRequest) {
     // 在UI中添加一个接收中任务
     const newTransfer: Transfer = {
      id: request.fileId,
      name: request.fileName,
      size: `${(request.fileSize / 1024 / 1024).toFixed(2)} MB`,
      status: 'starting',
      progress: 0,
      direction: 'received',
      sourceDevice: request.fromId, // 这里最好能拿到设备名
    };
    this.transfers.next([...this.transfers.getValue(), newTransfer]);

    socketService.sendMessage('accept_transfer', { fileId: request.fileId });
  }

  rejectTransfer(fileId: string) {
    socketService.sendMessage('reject_transfer', { fileId: fileId });
    // 从列表中移除（如果之前有添加的话）
    this.transfers.next(this.transfers.getValue().filter(t => t.id !== fileId));
  }

  // 暂停、恢复、取消需要后端支持
  pauseTransfer(id: string) {
    console.warn(`Pausing transfer ${id} - not implemented on backend yet`);
    // socketService.sendMessage('pause_transfer', { file_id: id });
  }

  resumeTransfer(id: string) {
    console.warn(`Resuming transfer ${id} - not implemented on backend yet`);
    // socketService.sendMessage('resume_transfer', { file_id: id });
  }

  cancelTransfer(id: string) {
    console.warn(`Cancelling transfer ${id} - not implemented on backend yet`);
    // socketService.sendMessage('cancel_transfer', { file_id: id });
    this.transfers.next(this.transfers.getValue().filter(t => t.id !== id));
  }
}

export const transferService = new TransferService();