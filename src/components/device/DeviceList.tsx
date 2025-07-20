import { useDevices } from '../../contexts/DeviceContext';

export default function DeviceList() {
  const { devices, selectedDevices, toggleDeviceSelection } = useDevices();

  return (
    <div className="bg-gray-800 rounded-lg p-6 h-full">
      <h2 className="text-xl font-bold mb-4">Online Devices</h2>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {devices.map((device) => (
                    <div 
            key={device.id} 
            className={`bg-gray-700 rounded-lg p-4 flex flex-col items-center justify-center text-center min-w-[150px] cursor-pointer transition-all duration-200 ${selectedDevices.includes(device.id) ? 'ring-2 ring-yellow-400' : 'ring-2 ring-transparent'}`}
            onClick={() => toggleDeviceSelection(device.id)}
          >
            <div className="text-4xl mb-2">💻</div>
            <div className="font-semibold">{device.username}</div>
            <div className="text-sm text-gray-400">{device.ip}</div>
          </div>
        ))}
      </div>
    </div>
  );
}