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
  private deviceId: string = '';
  private isManualDisconnect = false;
  private isReload = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

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
    const username = sessionStorage.getItem('username') || '未知用户';
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
      console.error('未找到用户名，请先登录');
      window.location.href = '/login';
      return;
    }

    this.deviceId = this.getDeviceInfo();

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('WebSocket 已连接');
      return;
    }

    this.isManualDisconnect = false;

    const url = `${config.wsUrl}?deviceId=${encodeURIComponent(this.deviceId)}&ip=127.0.0.1&username=${username}`;
    this.socket = new WebSocket(url);
    this.socket.binaryType = 'arraybuffer'; // 必须设置为 arraybuffer

    this.socket.onopen = () => {
      console.log('WebSocket 连接成功');
      toast.success('连接成功');
      this.isReload = false;
      this.reconnectAttempts = 0; // 重置重连计数
      this.sendMessage('get_client_list', {});
    };

    this.socket.onmessage = (event) => {
      // 后端目前只发送 JSON，所以我们只处理 text
      if (typeof event.data === 'string') {
        try {
          const message = JSON.parse(event.data);
          console.log('收到消息:', message);

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
      }
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket 连接关闭:', event.reason);
      if (!this.isManualDisconnect && !this.isReload) {
        toast.error('连接已断开，尝试重新连接...');
        this.tryReconnect();
      }
      clientListSubject.next([]);
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket 错误:', error);
    };
  }

  private tryReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`已达到最大重连次数 (${this.maxReconnectAttempts})，停止重连`);
      toast.error('无法连接到服务器，请检查网络或刷新页面');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // 指数退避，最大30秒
    console.log(`尝试第 ${this.reconnectAttempts} 次重连，延迟 ${delay}ms`);

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      console.log('正在重新连接...');
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.socket) {
      this.isManualDisconnect = true;
      this.socket.close();
      this.socket = null;
    }
  }

  sendMessage(type: string, payload: any) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket 未连接');
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

  getClientList() {
    return clientListSubject.asObservable();
  }

  getCurrentDeviceId() {
    return this.deviceId;
  }

  onMessage$<T>(type: string) {
    return messageSubject.asObservable().pipe(
      filter(msg => msg.type === type),
      map(msg => msg.payload as T)
    );
  }
}

export const socketService = new SocketService();