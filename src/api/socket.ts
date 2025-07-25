import toast from 'react-hot-toast';
import { BehaviorSubject, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { Device } from '../types';
import { UAParser } from 'ua-parser-js';
import { config } from '../config';
import { WebSocketMessage } from '../types/transfer';

const clientListSubject = new BehaviorSubject<Device[]>([]);
const messageSubject = new Subject<WebSocketMessage>();

class SocketService {
  private socket: WebSocket | null = null;
  public onConnect = new Subject<void>();
  public onConnectionFailed = new Subject<string>();
  private deviceId: string = '';
  private isManualDisconnect = false;
  private isReload = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  public isConnected = new BehaviorSubject<boolean>(false);

  constructor() {
    const navigationEntries = performance.getEntriesByType("navigation");
    if (navigationEntries.length > 0 && (navigationEntries[0] as PerformanceNavigationTiming).type === 'reload') {
      this.isReload = true;
    }
  }

  private getDeviceInfo(): string {
    // 尝试从sessionStorage获取已保存的设备ID
    const savedDeviceId = sessionStorage.getItem('deviceId');
    if (savedDeviceId) {
      return savedDeviceId;
    }
    
    // 如果没有保存的设备ID，则生成一个新的
    const username = sessionStorage.getItem('username') || 'Unknown User';
    const parser = new UAParser(navigator.userAgent);
    const result = parser.getResult();
    const deviceName = result.device.model ? `${result.device.vendor} ${result.device.model}` : result.os.name;
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const newDeviceId = `${username}'s ${deviceName || 'Unknown'}-${randomSuffix}`;
    
    // 保存到sessionStorage以便在当前会话中使用
    sessionStorage.setItem('deviceId', newDeviceId);
    return newDeviceId;
  }

  connect() {
    const username = sessionStorage.getItem('username');
    if (!username) {
      console.error('Username not found, please log in first');
      window.location.href = '/login';
      return;
    }

    this.deviceId = this.getDeviceInfo();

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('WebSocket connected');
      return;
    }

    this.isManualDisconnect = false;

    const url = `${config.wsUrl}?deviceId=${encodeURIComponent(this.deviceId)}&username=${username}`;
    this.socket = new WebSocket(url);
    this.socket.binaryType = 'arraybuffer'; // 必须设置为 arraybuffer

    this.socket.onopen = () => {
      console.log('WebSocket connection successful');
      toast.success('Connection successful');
      this.isConnected.next(true);
      this.isReload = false;
      this.reconnectAttempts = 0; // 重置重连计数
      this.onConnect.next(); // 触发连接成功事件
      this.sendMessage('get_client_list', {});
    };

    this.socket.onmessage = (event) => {
      // 处理文本消息
      if (typeof event.data === 'string') {
        try {
          const message = JSON.parse(event.data);
          console.log('收到文本消息:', message);

          // 专门处理设备列表
          if (message.type === 'client_list') {
            const clients = message.payload.clients || [];
            const formattedClients = clients.map((client: any) => ({
              id: client.id,
              ip: client.deviceInfo?.ip || '',
              username: client.id,
              deviceInfo: client.deviceInfo || {}
            }));
            clientListSubject.next(formattedClients);
          }

          // 将所有消息推送到 subject
          messageSubject.next(message);
        } catch (error) {
          console.error('解析消息失败:', error);
        }
      } else if (event.data instanceof ArrayBuffer) {
        // 处理二进制消息
        try {
          // 二进制消息格式: [json_len (4 bytes)] + [json_data] + [binary_data]
          const dataView = new DataView(event.data);
          const jsonLength = dataView.getUint32(0, true); // true for little-endian
          
          // 安全检查：确保jsonLength在合理范围内
          if (jsonLength <= 0 || jsonLength > 1024 * 1024) { // 限制最大1MB的JSON数据
            console.error('无效的JSON长度:', jsonLength);
            return;
          }
          
          // 确保消息长度足够
          if (event.data.byteLength < 4 + jsonLength) {
            console.error('消息长度不足，期望:', 4 + jsonLength, '实际:', event.data.byteLength);
            return;
          }
          
          // 提取JSON元数据
          const jsonBytes = new Uint8Array(event.data, 4, jsonLength);
          const jsonString = new TextDecoder().decode(jsonBytes);
          const jsonData = JSON.parse(jsonString);
          
          // 提取二进制数据
          const binaryData = event.data.slice(4 + jsonLength);
          
          console.log('收到二进制消息:', jsonData, '二进制数据长度:', binaryData.byteLength);
          
          // 处理upload_chunk消息
          if (jsonData.type === 'upload_chunk') {
            const payload = {
              ...jsonData.payload,
              data: binaryData
            };
            messageSubject.next({
              type: jsonData.type,
              payload: payload
            });
          }
        } catch (error) {
          console.error('解析二进制消息失败:', error);
        }
      }
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket connection closed:', event.reason);
      this.isConnected.next(false);
      if (!this.isManualDisconnect && !this.isReload) {
        toast.error('Connection disconnected, trying to reconnect...');
        this.tryReconnect();
      } else if (!(event as CloseEvent).wasClean) {
        this.onConnectionFailed.next('WebSocket connection closed unexpectedly');
      }
      clientListSubject.next([]);
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.isConnected.next(false);
      this.onConnectionFailed.next('WebSocket connection error');
    };
  }

  private tryReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`Maximum reconnection attempts reached (${this.maxReconnectAttempts}), stopping reconnection`);
      toast.error('Unable to connect to the server, please check the network or refresh the page');
      socketService.disconnect(true);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // 指数退避，最大30秒
    console.log(`Attempting to reconnect for the ${this.reconnectAttempts} time, delay ${delay}ms`);

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      console.log('Reconnecting...');
      this.connect();
    }, delay);
  }

  disconnect(isManual = true, isToLoginManual = false) {
    if (this.socket) {
      this.isManualDisconnect = isManual;
      this.socket.close();
      this.socket = null;
      this.isConnected.next(false);
      if (isManual) {
        sessionStorage.removeItem('username');
      }
      if (isManual && !isToLoginManual) {
        window.location.href = '/login';
      }
    }
  }

  sendMessage(type: string, payload: any) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    // 处理二进制数据
    if (payload.data instanceof ArrayBuffer) {
        try {
            const metadata = { ...payload };
            delete metadata.data; // 从元数据中移除二进制数据
            const metadataStr = JSON.stringify({ type, payload: metadata });
            const metadataBytes = new TextEncoder().encode(metadataStr);

            // 创建一个 ArrayBuffer 来拼接 JSON 和 ArrayBuffer
            // [json_len (4 bytes)] + [json_data] + [binary_data]
            const buffer = new ArrayBuffer(4 + metadataBytes.length + payload.data.byteLength);
            const view = new DataView(buffer);
            view.setUint32(0, metadataBytes.length, true); // true for little-endian
            
            // 复制元数据和二进制数据到新的缓冲区
            new Uint8Array(buffer, 4).set(metadataBytes);
            new Uint8Array(buffer, 4 + metadataBytes.length).set(new Uint8Array(payload.data));

            console.log(`发送二进制消息: 类型=${type}, 元数据长度=${metadataBytes.length}, 数据长度=${payload.data.byteLength}`);
            this.socket.send(buffer);
        } catch (error) {
            console.error('发送二进制消息失败:', error);
        }
    } else {
        const message = JSON.stringify({ type, payload });
        this.socket.send(message);
    }
  }

  getClientList$() {
    return clientListSubject.asObservable();
  }

  getClientId(): string {
    return this.deviceId;
  }

  onMessage$<T>(type: string) {
    return messageSubject.asObservable().pipe(
      filter(msg => msg.type === type),
      map(msg => msg.payload as T)
    );
  }

  waitForConnect(timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnected.getValue()) {
        resolve(true);
        return;
      }

      const subscription = this.isConnected.subscribe(isConnected => {
        if (isConnected) {
          clearTimeout(timer);
          subscription.unsubscribe();
          resolve(true);
        }
      });

      const timer = setTimeout(() => {
        subscription.unsubscribe();
        resolve(false);
      }, timeout);
    });
  }
}

export const socketService = new SocketService();