import React from 'react';
import { FileTransferRequest } from '../../../types/transfer';

interface ReceiveConfirmationModalProps {
  isOpen: boolean;
  request: FileTransferRequest;
  onConfirm: () => void;
  onCancel: () => void;
}

const ReceiveConfirmationModal: React.FC<ReceiveConfirmationModalProps> = ({ isOpen, request, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  // 格式化文件大小
  const fileSize = request.fileSize > 1024 * 1024 * 1024
    ? `${(request.fileSize / 1024 / 1024 / 1024).toFixed(2)} GB`
    : request.fileSize > 1024 * 1024
      ? `${(request.fileSize / 1024 / 1024).toFixed(2)} MB`
      : `${(request.fileSize / 1024).toFixed(2)} KB`;
      
  // 格式化分片大小
  const chunkSize = request.chunkSize > 1024 * 1024
    ? `${(request.chunkSize / 1024 / 1024).toFixed(2)} MB`
    : `${(request.chunkSize / 1024).toFixed(2)} KB`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700 shadow-xl">
        <h2 className="text-xl font-bold mb-3 text-yellow-400">File Transfer Request</h2>
        <div className="bg-blue-900 text-blue-200 p-3 rounded-md mb-4 border-l-4 border-blue-500">
          <p className="flex items-center">
            <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Receiving file from: <span className="font-bold text-white ml-1">{request.fromId}</span></span>
          </p>
        </div>
        <div className="bg-gray-700 p-4 rounded-md mb-4 border-l-4 border-yellow-400">
          <div className="flex items-center mb-2">
            <svg className="w-6 h-6 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-mono break-all text-gray-200">{request.fileName}</p>
          </div>
          <div className="ml-8 space-y-1">
            <p className="text-sm text-gray-300">File Size: <span className="text-gray-200 font-medium">{fileSize}</span></p>
<p className="text-sm text-gray-300">Chunk Count: <span className="text-gray-200 font-medium">{request.totalChunks}</span></p>
<p className="text-sm text-gray-300">Chunk Size: <span className="text-gray-200 font-medium">{chunkSize}</span></p>
          </div>
        </div>
        <div className="flex justify-end gap-4">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded-md bg-gray-600 text-gray-200 hover:bg-gray-500 transition-colors"
          >
            Decline
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-500 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiveConfirmationModal;