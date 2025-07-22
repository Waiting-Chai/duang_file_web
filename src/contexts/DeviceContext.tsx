import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { socketService } from '../api/socket';
import { Subscription } from 'rxjs';
import { Device } from '../types';

interface DeviceContextType {
  devices: Device[];
  selectedDevices: string[];
  toggleDeviceSelection: (deviceId: string) => void;
  currentDeviceId: string;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider = ({ children }: { children: ReactNode }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');

  useEffect(() => {
    // 获取当前设备ID
    setCurrentDeviceId(socketService.getCurrentDeviceId());

    const subscription: Subscription = socketService.getClientList().subscribe((newClients: Device[]) => {
      setDevices(newClients);
      
      // 在客户端列表更新后，再次检查并更新当前设备ID
      // 这确保了在页面刷新后，当WebSocket重新连接并获取设备列表时，currentDeviceId会被正确更新
      const currentId = socketService.getCurrentDeviceId();
      if (currentId && currentId !== currentDeviceId) {
        setCurrentDeviceId(currentId);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [currentDeviceId]);

  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDevices(prevSelected => 
      prevSelected.includes(deviceId)
        ? prevSelected.filter(id => id !== deviceId)
        : [...prevSelected, deviceId]
    );
  };

  return (
    <DeviceContext.Provider value={{ devices, selectedDevices, toggleDeviceSelection, currentDeviceId }}>
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevices = () => {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error('useDevices must be used within a DeviceProvider');
  }
  return context;
};