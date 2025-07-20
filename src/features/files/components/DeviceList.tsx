import { HardDrive, Wifi } from 'lucide-react';
import { useDevices } from '../../../contexts/DeviceContext';

import { Device } from '../../../types';

export default function DeviceList() {
  const { devices, selectedDevices, toggleDeviceSelection } = useDevices();

  return (
    <div className="bg-gray-800 rounded-xl p-6 h-full">
      <h2 className="text-xl font-bold mb-4 flex items-center"><Wifi className="mr-2" /> Nearby Devices</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(devices as Device[]).map(device => (
          <div 
            key={device.id} 
            className={`bg-gray-700 p-4 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-gray-600 transition-colors border-2 ${selectedDevices.includes(device.id) ? 'border-yellow-400' : 'border-transparent'}`}
            onClick={() => toggleDeviceSelection(device.id)}
          >
            <HardDrive size={24} />
            <div>
              <p className="font-semibold">{device.username}</p>
              <p className="text-xs text-gray-400">{device.type}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}