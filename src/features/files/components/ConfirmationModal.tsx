import React from 'react';

import { Device } from '../../../types';

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
        <h2 className="text-2xl font-bold mb-6">Confirm File Transfer</h2>
        
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Files to send:</h3>
          <ul className="list-disc list-inside bg-gray-700 p-3 rounded-md max-h-32 overflow-y-auto">
            {files.map((file, index) => (
              <li key={index} className="truncate">{file.name} ({Math.round(file.size / 1024)} KB)</li>
            ))}
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold mb-2">To:</h3>
          {targetDevices.length > 0 ? (
            <ul className="list-disc list-inside bg-gray-700 p-3 rounded-md max-h-32 overflow-y-auto">
              {targetDevices.map((device) => (
                <li key={device.id} className="truncate">{device.username || device.id}</li>
              ))}
            </ul>
          ) : (
            <p className="text-yellow-400">No devices selected. Files will be broadcast to all online devices.</p>
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