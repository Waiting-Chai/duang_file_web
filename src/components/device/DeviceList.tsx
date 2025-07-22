import React from 'react';
import { useDevices } from '../../contexts/DeviceContext';

export default function DeviceList() {
  // 添加Webkit浏览器的滚动条样式
  const scrollbarCSS = `
    .device-list-container::-webkit-scrollbar {
      height: 8px;
    }
    .device-list-container::-webkit-scrollbar-track {
      background: #1F2937;
      border-radius: 4px;
    }
    .device-list-container::-webkit-scrollbar-thumb {
      background-color: #4B5563;
      border-radius: 4px;
    }
  `;

  const { devices, selectedDevices, toggleDeviceSelection, currentDeviceId } = useDevices();

  return (
    <div className="bg-gray-800 rounded-lg p-6 h-full">
      <style>{scrollbarCSS}</style>
      <h2 className="text-xl font-bold mb-4 text-white">Online Devices</h2>
      <p className="text-sm text-gray-400 mb-4">Your device is highlighted in <span className="text-green-400 font-bold">green</span> with a <span className="text-green-400 font-bold">ME</span> tag</p>
        <div className="flex flex-nowrap overflow-x-auto gap-4 p-4 pb-6 device-list-container" style={{msScrollbarFaceColor: '#4B5563', msScrollbarTrackColor: '#1F2937', WebkitOverflowScrolling: 'touch'} as React.CSSProperties}>
        {devices.map((device) => {
          const isCurrentDevice = device.id === currentDeviceId;
          return (
            <div 
              key={device.id} 
              className={`
                relative bg-gray-700 rounded-lg p-3 flex flex-col items-center justify-center text-center w-[180px] flex-shrink-0 h-[120px] cursor-pointer transition-all duration-200 
                ${selectedDevices.includes(device.id) ? 'ring-2 ring-yellow-400' : 'ring-2 ring-transparent'}
                ${isCurrentDevice ? 'bg-green-600 border-4 border-green-400 shadow-xl shadow-green-500/50 z-10 animate-pulse-border' : 'bg-gray-700'}
                group
              `}
              onClick={() => toggleDeviceSelection(device.id)}
            >
              {isCurrentDevice && <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-green-400 text-green-900 px-1.5 py-0.5 rounded-full text-[10px] font-bold">CURRENT</div>}
              <div className="text-3xl mb-1">{isCurrentDevice ? '👤' : '💻'}</div>
              <div className={`font-semibold text-sm truncate w-full ${isCurrentDevice ? 'text-white' : 'text-white'}`}>
                {device.username}
                {isCurrentDevice && <span className="ml-1 text-xs bg-green-300 text-green-900 px-1 py-0.5 rounded-full font-bold animate-pulse">ME</span>}
              </div>
              <div className="text-xs text-gray-400 truncate w-full">{device.ip}</div>
              
              {/* 悬浮提示框 */}
              <div className="absolute opacity-0 group-hover:opacity-100 invisible group-hover:visible bg-gray-800 text-white p-3 rounded-lg shadow-lg z-20 w-48 text-left left-1/2 transform -translate-x-1/2 top-full mt-2 border border-gray-600 overflow-hidden transition-all duration-200 ease-in-out">
                <p className="font-bold mb-1">{device.username} {isCurrentDevice && "(Current Device)"}</p>
<p className="text-sm mb-1">Device ID: <span className="text-gray-300">{device.id.substring(0, 15)}...</span></p>
<p className="text-sm">IP Address: <span className="text-gray-300">{device.ip}</span></p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}