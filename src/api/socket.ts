import toast from 'react-hot-toast';
import { Subject } from 'rxjs';
import { Device } from '../types';
import { UAParser } from 'ua-parser-js';
import { config } from '../config';

const clientListSubject = new Subject<Device[]>();

class SocketService {
  private socket: WebSocket | null = null;
  private deviceId: string = '';
  private isManualDisconnect = false;
  private isReload = false;

  constructor() {
    const navigationEntries = performance.getEntriesByType("navigation");
    if (navigationEntries.length > 0 && (navigationEntries[0] as PerformanceNavigationTiming).type === 'reload') {
      this.isReload = true;
    }
  }

  private getDeviceInfo(): string {
    const username = sessionStorage.getItem('username') || '未知用户';
    const parser = new UAParser(navigator.userAgent);
    const result = parser.getResult();
    const deviceName = result.device.model ? `${result.device.vendor} ${result.device.model}` : result.os.name;
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `${username}'s ${deviceName || 'Unknown'}-${randomSuffix}`;
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

    this.socket.onopen = () => {
      console.log('WebSocket 连接成功');
      toast.success('连接成功');
      this.isReload = false; // 连接成功后，重置刷新标志
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('收到消息:', message);

        if (message.type === 'client_list') {
          clientListSubject.next(message.payload.clients || []);
        }
      } catch (error) {
        console.error('解析消息失败:', error);
      }
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket 连接关闭:', event.reason);
      // 如果是页面刷新导致的快速重连立即关闭，则不提示错误
      if (!this.isManualDisconnect && !this.isReload) {
        toast.error('连接已断开，请检查网络');
      }
      clientListSubject.next([]);
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket 错误:', error);
      // 通常 onerror 后会触发 onclose，将错误提示统一在 onclose 处理
    };
  }

  disconnect() {
    if (this.socket) {
      this.isManualDisconnect = true;
      this.socket.close();
      this.socket = null;
    }
  }

  getClientList() {
    return clientListSubject.asObservable();
  }
}

export const socketService = new SocketService();