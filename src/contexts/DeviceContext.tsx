import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { socketService } from '../api/socket';
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
    const currentId = socketService.getClientId();
    if (currentId) {
      setCurrentDeviceId(currentId);
    }

    const subscription = socketService.getClientList$().subscribe((newClients: Device[]) => {
      setDevices(newClients);
      const updatedCurrentId = socketService.getClientId();
      if (updatedCurrentId && updatedCurrentId !== currentDeviceId) {
        setCurrentDeviceId(updatedCurrentId);
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