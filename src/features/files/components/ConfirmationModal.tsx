import React from 'react';
import { Device } from '../../../types';
import { socketService } from '../../../api/socket';

interface ConfirmationModalProps {
  files: File[];
  targetDevices: Device[];
  onConfirm: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

export default function ConfirmationModal({ isOpen, files, targetDevices, onConfirm, onCancel }: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-8 max-w-lg w-full">
        <h2 className="text-2xl font-bold mb-3">Confirm File Transfer</h2>
        <div className="bg-yellow-800 text-yellow-200 p-3 rounded-md mb-6 border-l-4 border-yellow-500">
          <p className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Please verify the target devices carefully before sending files
          </p>
        </div>
        
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Files to send:</h3>
          <ul className="list-disc list-inside bg-gray-700 p-3 rounded-md max-h-32 overflow-y-auto">
            {files.map((file, index) => (
              <li key={index} className="truncate">{file.name} ({Math.round(file.size / 1024)} KB)</li>
            ))}
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold mb-2">Target Devices:</h3>
          {targetDevices.length > 0 ? (
            <ul className="bg-gray-700 p-3 rounded-md max-h-48 overflow-y-auto divide-y divide-gray-600">
              {targetDevices.map((device) => {
                const isCurrentDevice = device.id === socketService.getCurrentDeviceId();
                return (
                  <li key={device.id} className={`py-2 px-1 flex items-center justify-between ${isCurrentDevice ? 'bg-green-900 border-l-4 border-green-500' : ''}`}>
                    <div className="flex items-center">
                      <span className="text-xl mr-2">{isCurrentDevice ? '👤' : '💻'}</span>
                      <span className="font-medium">{device.username || device.id}</span>
                    </div>
                    {isCurrentDevice && (
                      <span className="bg-green-500 text-green-900 px-2 py-0.5 rounded-full text-xs font-bold">YOUR DEVICE</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="bg-red-900 text-red-200 p-3 rounded-md border-l-4 border-red-500">
              <p className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                No devices selected. Please select at least one device.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4">
          <button onClick={onCancel} className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 transition-colors">
            Confirm & Send
          </button>
        </div>
      </div>
    </div>
  );
}