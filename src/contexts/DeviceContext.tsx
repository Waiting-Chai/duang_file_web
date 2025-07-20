import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { socketService } from '../api/socket';
import { Subscription } from 'rxjs';
import { Device } from '../types';

interface DeviceContextType {
  devices: Device[];
  selectedDevices: string[];
  toggleDeviceSelection: (deviceId: string) => void;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider = ({ children }: { children: ReactNode }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

  useEffect(() => {
    const subscription: Subscription = socketService.getClientList().subscribe((newClients: Device[]) => {
      setDevices(newClients);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDevices(prevSelected => 
      prevSelected.includes(deviceId)
        ? prevSelected.filter(id => id !== deviceId)
        : [...prevSelected, deviceId]
    );
  };

  return (
    <DeviceContext.Provider value={{ devices, selectedDevices, toggleDeviceSelection }}>
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