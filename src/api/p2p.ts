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
  private receivedChunks: Map<number, ArrayBuffer>;
  private receivedChunksCount: number = 0;

  constructor(fileId: string, fileName: string, totalChunks: number) {
    this.fileId = fileId;
    this.fileName = fileName;
    this.totalChunks = totalChunks;
    this.receivedChunks = new Map();
  }

  // 获取已接收的块数，用于生成块索引
  getReceivedChunksCount(): number {
    return this.receivedChunksCount;
  }

  addChunk(chunkIndex: number, chunk: ArrayBuffer) {
    try {
      console.log(`添加文件 ${this.fileName} 的块 ${chunkIndex}，大小: ${chunk.byteLength}字节`);
      
      // 验证块索引是否有效
      if (chunkIndex < 0 || chunkIndex >= this.totalChunks) {
        console.error(`无效的块索引: ${chunkIndex}，文件 ${this.fileName} 的总块数为 ${this.totalChunks}`);
        return;
      }
      
      // 验证块数据是否有效
      if (!chunk || chunk.byteLength === 0) {
        console.error(`文件 ${this.fileName} 的块 ${chunkIndex} 数据无效或为空`);
        return;
      }
      
      // 检查是否已经接收过该块
      if (!this.receivedChunks.has(chunkIndex)) {
        this.receivedChunks.set(chunkIndex, chunk);
        this.receivedChunksCount++;
        console.log(`成功添加文件 ${this.fileName} 的块 ${chunkIndex}，当前进度: ${this.receivedChunksCount}/${this.totalChunks}`);

        // 更新传输进度
        const progress = Math.floor((this.receivedChunksCount / this.totalChunks) * 100);
        // 导入 transferService 可能会导致循环依赖，所以这里使用 window 对象临时存储
        if (window.transferService) {
          window.transferService.updateTransferProgress(this.fileId, progress, undefined, progress === 100 ? 'completed' : 'receiving');
        }

        if (this.receivedChunksCount === this.totalChunks) {
          console.log(`文件 ${this.fileName} 所有块已接收，准备组装下载`);
          this.assembleAndDownload();
        }
      } else {
        console.log(`文件 ${this.fileName} 的块 ${chunkIndex} 已存在，跳过`);
      }
    } catch (error: unknown) {
      console.error(`处理文件 ${this.fileName} 的块 ${chunkIndex} 时出错:`, error);
    }
  }

  private assembleAndDownload() {
    console.log(`准备组装文件 ${this.fileName}，共 ${this.totalChunks} 块，已接收 ${this.receivedChunksCount} 块`);
    
    // 检查是否所有块都已接收
    if (this.receivedChunksCount < this.totalChunks) {
      console.error(`文件 ${this.fileName} 块数不足，需要 ${this.totalChunks} 块，但只收到 ${this.receivedChunksCount} 块`);
      
      // 输出缺失的块
      const missingChunks = [];
      for (let i = 0; i < this.totalChunks; i++) {
        if (!this.receivedChunks.has(i)) {
          missingChunks.push(i);
        }
      }
      console.error(`缺失的块索引: ${missingChunks.join(', ')}`);
      
      // 更新传输状态为失败
      if (window.transferService) {
        window.transferService.updateTransferProgress(this.fileId, this.receivedChunksCount / this.totalChunks * 100, undefined, 'failed');
      }
      return;
    }
    
    try {
      // 按顺序组装文件块
      console.log(`开始组装文件 ${this.fileName} 的 ${this.totalChunks} 个块`);
      const chunks: ArrayBuffer[] = [];
      let totalSize = 0;
      
      for (let i = 0; i < this.totalChunks; i++) {
        const chunk = this.receivedChunks.get(i);
        if (chunk) {
          // 验证块数据
          if (chunk.byteLength === 0) {
            console.error(`文件 ${this.fileName} 的块 ${i} 数据为空`);
            if (window.transferService) {
              window.transferService.updateTransferProgress(this.fileId, 100, undefined, 'failed');
            }
            return;
          }
          
          chunks.push(chunk);
          totalSize += chunk.byteLength;
          console.log(`添加块 ${i}，大小: ${chunk.byteLength}字节，累计大小: ${totalSize}字节`);
        } else {
          console.error(`文件 ${this.fileName} 缺少块 ${i}`);
          if (window.transferService) {
            window.transferService.updateTransferProgress(this.fileId, 100, undefined, 'failed');
          }
          return;
        }
      }

      console.log(`文件 ${this.fileName} 所有块已组装，总大小: ${totalSize}字节，开始创建Blob`);
      
      // 创建Blob对象
      const blob = new Blob(chunks, { type: this.getMimeType(this.fileName) });
      console.log(`Blob创建成功，大小: ${blob.size}字节`);
      
      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.fileName;
      
      // 触发下载
      console.log(`开始下载文件 ${this.fileName}`);
      a.click();
      
      // 释放URL对象
      setTimeout(() => {
        URL.revokeObjectURL(url);
        console.log(`文件 ${this.fileName} 下载完成，已释放URL对象`);
      }, 100);
    } catch (error: unknown) {
      console.error(`组装和下载文件 ${this.fileName} 时出错:`, error);
      if (window.transferService) {
        window.transferService.updateTransferProgress(this.fileId, 100, undefined, 'failed');
      }
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

  constructor() {
    this.listenForWebRTCSignals();
  }

  private listenForWebRTCSignals() {
    socketService.onMessage$<any>('webrtc_signal').subscribe(payload => {
      const { fromId, signal } = payload;
      const pc = this.getPeerConnection(fromId);

      if (signal.type === 'offer') {
        pc.setRemoteDescription(new RTCSessionDescription(signal));
        pc.createAnswer().then(answer => {
          pc.setLocalDescription(answer);
          this.sendSignal(fromId, answer);
        });
      } else if (signal.type === 'answer') {
        pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.candidate) {
        pc.addIceCandidate(new RTCIceCandidate(signal));
      }
    });
  }

  private getPeerConnection(targetId: string): RTCPeerConnection {
    if (!this.peerConnections.has(targetId)) {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      });

      pc.onicecandidate = event => {
        if (event.candidate) {
          this.sendSignal(targetId, event.candidate);
        }
      };

      pc.ondatachannel = event => {
        const dataChannel = event.channel;
        this.dataChannels.set(targetId, dataChannel);
        this.setupDataChannelEvents(targetId, dataChannel);
      };

      this.peerConnections.set(targetId, pc);
    }
    return this.peerConnections.get(targetId)!;
  }

  public createOffer(targetId: string) {
    const pc = this.getPeerConnection(targetId);
    const dataChannel = pc.createDataChannel('fileTransfer');
    this.dataChannels.set(targetId, dataChannel);
    this.setupDataChannelEvents(targetId, dataChannel);

    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      this.sendSignal(targetId, offer);
    });
  }

  public sendSignal(targetId: string, signal: any) {
    socketService.sendMessage('webrtc_signal', {
      toId: targetId,
      signal: signal,
    });
  }

  private setupDataChannelEvents(targetId: string, dataChannel: RTCDataChannel) {
    dataChannel.onopen = () => {
      console.log(`Data channel with ${targetId} is open.`);
      this.onDataChannelOpen.next(targetId);
    };

    dataChannel.onclose = () => {
      console.log(`Data channel with ${targetId} is closed.`);
    };

    dataChannel.onmessage = event => {
      if (typeof event.data === 'string') {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'file_transfer_request':
            this.onFileTransferRequest.next({ ...message.payload, fromId: targetId });
            break;
          case 'file_transfer_response':
            this.onFileTransferResponse.next(message.payload);
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
          // 详细记录接收到的二进制数据信息
          console.log(`接收到二进制数据，总长度: ${event.data.byteLength}字节`);
          
          // 检查数据是否为有效的二进制数据
          if (!event.data || event.data.byteLength < 8) { // 至少需要fileIdLength(4字节) + 最小fileId(1字节) + 一些数据
            console.error(`接收到无效的二进制数据：数据长度不足 (${event.data ? event.data.byteLength : 0}字节)`);
            // 打印接收到的数据的十六进制表示，帮助调试
            if (event.data && event.data.byteLength > 0) {
              const bytes = new Uint8Array(event.data);
              console.error('数据内容(十六进制):', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
            }
            return;
          }

          // 解析二进制数据 - 首先获取fileIdLength
          let fileIdLength;
          let headerOffset = 0; // 初始偏移量
          
          try {
            // 打印前20字节帮助调试
            const firstBytes = new Uint8Array(event.data.slice(0, Math.min(20, event.data.byteLength)));
            const hexData = Array.from(firstBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log('数据前20字节(HEX):', hexData);
            
            // 检查第一个字节是否为特殊标记字符'$'（ASCII码36）
            const firstByte = firstBytes[0];
            if (firstByte === 36) { // 36是'$'的ASCII码
              console.log('检测到特殊标记字符，尝试使用新的解析方式');
              
              // 检查第二个字节，看是否有额外的标记
              if (firstBytes.length > 1) {
                const secondByte = firstBytes[1];
                if (secondByte === 61) { // 61是'='的ASCII码
                  console.log('检测到第二个标记字符，调整偏移量');
                  headerOffset = 2; // 跳过两个标记字符
                } else {
                  headerOffset = 1; // 只跳过第一个标记字符
                }
              } else {
                headerOffset = 1; // 只有一个字节，跳过它
              }
              
              // 从偏移量位置读取fileIdLength
              fileIdLength = new DataView(event.data.slice(headerOffset, headerOffset + 4)).getUint32(0, true);
            } else {
              // 原始解析方式
              fileIdLength = new DataView(event.data.slice(0, 4)).getUint32(0, true);
            }
            
            console.log(`解析的fileIdLength: ${fileIdLength}，使用偏移量: ${headerOffset}`);
          } catch (e) {
            console.error(`解析fileIdLength失败:`, e);
            // 打印前20字节帮助调试
            const firstBytes = new Uint8Array(event.data.slice(0, Math.min(20, event.data.byteLength)));
            console.error('数据前20字节:', Array.from(firstBytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
            return;
          }
          
          // 验证fileIdLength是否合理
          if (fileIdLength <= 0 || fileIdLength > 1000) { // 设置一个合理的上限
            console.error(`接收到无效的fileIdLength: ${fileIdLength}，超出合理范围`);
            // 尝试解析十六进制数据
            const hexData = Array.from(new Uint8Array(event.data.slice(0, Math.min(20, event.data.byteLength))))
              .map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.error('数据前20字节:', hexData);
            
            // 尝试解析ASCII数据
            try {
              const asciiData = new TextDecoder().decode(event.data.slice(0, Math.min(20, event.data.byteLength)));
              console.error('数据前20字节(ASCII):', asciiData);
            } catch (e) {
              console.error('无法解析为ASCII:', e);
            }
            
            // 尝试使用固定偏移量解析
            if (event.data.byteLength > 8) {
              try {
                // 假设前8个字节是某种头信息，尝试从第9个字节开始解析
                const alternativeFileIdLength = new DataView(event.data.slice(8, 12)).getUint32(0, true);
                if (alternativeFileIdLength > 0 && alternativeFileIdLength < 1000) {
                  console.log(`尝试使用替代方法解析fileIdLength: ${alternativeFileIdLength}`);
                  fileIdLength = alternativeFileIdLength;
                } else {
                  // 尝试从第6个字节开始解析（可能有两个标记字符 + 额外偏移）
                  const altOffset = 6;
                  if (event.data.byteLength >= altOffset + 4) {
                    const altFileIdLength = new DataView(event.data.slice(altOffset, altOffset + 4)).getUint32(0, true);
                    console.log(`尝试从偏移量${altOffset}解析fileIdLength: ${altFileIdLength}`);
                    
                    // 如果这个值看起来合理，尝试使用它
                    if (altFileIdLength > 0 && altFileIdLength <= 1000) {
                      console.log(`使用从偏移量${altOffset}解析的fileIdLength: ${altFileIdLength}`);
                      headerOffset = altOffset;
                      fileIdLength = altFileIdLength;
                      // 继续处理
                    } else {
                      return; // 仍然无效，放弃处理
                    }
                  } else {
                    return; // 数据不够长，放弃处理
                  }
                }
              } catch (e) {
                console.error('替代解析方法失败:', e);
                return;
              }
            } else {
              return; // 数据太短，无法使用替代方法
            }
          }
          
          // 确定fileId的起始偏移量
          let fileIdOffset = headerOffset + 4; // headerOffset + fileIdLength(4字节)
          
          // 检查数据长度是否足够包含fileId
          if (event.data.byteLength < fileIdOffset + fileIdLength) {
            console.error(`接收到无效的二进制数据：数据长度不足以包含fileId (需要${fileIdOffset + fileIdLength}字节，实际${event.data.byteLength}字节)`);
            return;
          }
          
          // 解析fileId
          let fileId;
          try {
            fileId = new TextDecoder().decode(event.data.slice(fileIdOffset, fileIdOffset + fileIdLength));
            console.log(`解析的fileId: ${fileId}，从偏移量${fileIdOffset}开始，长度${fileIdLength}`);
          } catch (e) {
            console.error(`解析fileId失败:`, e);
            // 打印详细的错误信息和数据内容
            const dataSlice = new Uint8Array(event.data.slice(fileIdOffset, Math.min(fileIdOffset + fileIdLength, event.data.byteLength)));
            console.error(`尝试解析的数据片段(HEX):`, Array.from(dataSlice).map(b => b.toString(16).padStart(2, '0')).join(' '));
            return;
          }
          
          // 验证fileId是否为有效字符串
          if (!fileId || fileId.trim() === '') {
            console.error(`解析出的fileId无效`);
            return;
          }
          
          console.log(`接收到文件数据，fileId: ${fileId}, 总长度: ${event.data.byteLength}字节`);
          
          let chunkIndex = 0;
          let chunk;
          
          // 尝试检测数据格式版本
          // 检查数据长度是否足够包含块索引
          if (event.data.byteLength >= fileIdOffset + fileIdLength + 4) {
            try {
              // 尝试读取块索引 - 新格式: [可能的标记字节][fileIdLength(4字节)][fileId][chunkIndex(4字节)][chunkData]
              const chunkIndexOffset = fileIdOffset + fileIdLength;
              chunkIndex = new DataView(event.data.slice(chunkIndexOffset, chunkIndexOffset + 4)).getUint32(0, true);
              chunk = event.data.slice(chunkIndexOffset + 4);
              console.log(`接收到文件 ${fileId} 的块 ${chunkIndex} (新格式), 从偏移量${chunkIndexOffset}开始, 块大小: ${chunk.byteLength}字节`);
            } catch (indexError: unknown) {
              // 如果读取块索引失败，回退到旧格式
              console.warn(`无法读取块索引，回退到旧格式: ${indexError instanceof Error ? indexError.message : '未知错误'}`);
              // 打印详细的错误信息
              const chunkIndexOffset = fileIdOffset + fileIdLength;
              const dataSlice = new Uint8Array(event.data.slice(chunkIndexOffset, Math.min(chunkIndexOffset + 4, event.data.byteLength)));
              console.error(`尝试解析的chunkIndex数据(HEX):`, Array.from(dataSlice).map(b => b.toString(16).padStart(2, '0')).join(' '));
              
              chunk = event.data.slice(fileIdOffset + fileIdLength);
              const receiver = this.fileReceivers.get(fileId);
              if (receiver) {
                chunkIndex = receiver.getReceivedChunksCount();
              }
              console.log(`接收到文件 ${fileId} 的块 ${chunkIndex} (旧格式), 从偏移量${fileIdOffset + fileIdLength}开始, 块大小: ${chunk.byteLength}字节`);
            }
          } else {
            // 旧格式: [可能的标记字节][fileIdLength(4字节)][fileId][chunkData]
            chunk = event.data.slice(fileIdOffset + fileIdLength);
            const receiver = this.fileReceivers.get(fileId);
            if (receiver) {
              chunkIndex = receiver.getReceivedChunksCount();
            }
            console.log(`接收到文件 ${fileId} 的块 ${chunkIndex} (旧格式), 从偏移量${fileIdOffset + fileIdLength}开始, 块大小: ${chunk.byteLength}字节`);
          }
          
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
    const dataChannel = this.dataChannels.get(targetId);
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify({ type, payload }));
    } else {
      console.error(`Data channel with ${targetId} is not open. Cannot send message.`);
    }
  }

  public getDataChannel(targetId: string): RTCDataChannel | undefined {
    return this.dataChannels.get(targetId);
  }

  public sendFileChunk(targetId: string, chunk: ArrayBuffer) {
    const dataChannel = this.dataChannels.get(targetId);
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(chunk);
    } else {
      console.error(`Data channel with ${targetId} is not open.`);
    }
  }
}

export const p2pService = new P2PService();