import { X, Pause, Play, ArrowUpRight, ArrowDownLeft, Download, Folder } from 'lucide-react';

import { Transfer, TransferStatus } from '../../../types';

interface TransferListProps {
  transfers: Transfer[];
  onPause: (id: string | number) => void;
  onResume: (id: string | number) => void;
  onCancel: (id: string | number) => void;
}

const formatRate = (rate: number) => {
  if (rate < 1024) return `${rate.toFixed(1)} KB/s`;
  return `${(rate / 1024).toFixed(1)} MB/s`;
};

// 根据传输状态返回对应的颜色类名
const getStatusColor = (status: TransferStatus): string => {
  switch (status) {
    case 'completed':
      return 'text-green-400';
    case 'failed':
      return 'text-red-400';
    case 'paused':
      return 'text-yellow-400';
    case 'cancelled':
      return 'text-gray-400';
    case 'waiting_for_approval':
      return 'text-purple-400';
    default:
      return 'text-blue-400';
  }
};

// 根据传输状态返回进度条颜色
const getProgressBarColor = (status: TransferStatus): string => {
  switch (status) {
    case 'paused':
      return 'bg-yellow-500';
    case 'waiting_for_approval':
      return 'bg-purple-500';
    case 'sending':
    case 'receiving':
      return 'bg-blue-500';
    case 'resuming':
      return 'bg-green-500 animate-pulse';
    default:
      return 'bg-gray-500';
  }
};

// 根据传输状态和进度返回显示文本
const getStatusText = (status: TransferStatus, progress?: number): string => {
  switch (status) {
    case 'waiting_for_approval':
      return 'Waiting for confirmation';
    case 'sending':
    case 'receiving':
      return progress !== undefined ? `${Math.round(progress * 100)}%` : 'Processing';
    case 'paused':
      return 'Paused';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return 'Failed';
    case 'resuming':
      return 'Resuming...';
    case 'starting':
      return 'Preparing...';
    case 'ready_to_receive_chunks':
      return 'Ready to receive...';
    default:
      return 'Unknown status';
  }
};

// 格式化文件大小，根据大小自动选择合适的单位（B、KB、MB、GB）
const formatFileSize = (size: string | number) => {
  // 如果已经是格式化后的字符串，直接返回
  if (typeof size === 'string' && size.includes(' ')) {
    return size;
  }
  
  // 处理数字或字符串类型的size
  let sizeNum: number;
  if (typeof size === 'number') {
    sizeNum = size;
  } else {
    // 尝试将字符串转换为数字
    sizeNum = parseFloat(size) || 0;
  }
  
  // 根据大小选择合适的单位
  if (sizeNum < 1024) {
    return `${sizeNum.toFixed(0)}b`;
  } else if (sizeNum < 1024 * 1024) {
    return `${(sizeNum / 1024).toFixed(1)}k`;
  } else if (sizeNum < 1024 * 1024 * 1024) {
    return `${(sizeNum / 1024 / 1024).toFixed(1)}m`;
  } else {
    return `${(sizeNum / 1024 / 1024 / 1024).toFixed(2)}g`;
  }
};

export default function TransferList({ transfers, onPause, onResume, onCancel }: TransferListProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-6 flex flex-col h-full">
      <h2 className="text-xl font-bold mb-4">Transfer List</h2>
      <div className="flex-1 overflow-y-auto pr-2">
        {transfers.length > 0 ? (
          <div className="space-y-3">
            {transfers.map(transfer => (
              <TransferItem key={transfer.id} transfer={transfer} onPause={onPause} onResume={onResume} onCancel={onCancel} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No transfer tasks</p>
        )}
      </div>
    </div>
  );
}

const TransferItem = ({ transfer, onPause, onResume, onCancel }: { transfer: Transfer, onPause: (id: string | number) => void, onResume: (id: string | number) => void, onCancel: (id: string | number) => void }) => {
  return (
    <div className="bg-gray-700 p-4 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {transfer.direction === 'sent' ? 
              <ArrowUpRight size={20} className="text-blue-400"/> : 
              <ArrowDownLeft size={20} className="text-green-400"/>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{transfer.name}</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-300">{formatFileSize(transfer.size)}</span>
              <span className="text-gray-400">
                {transfer.direction === 'sent' 
                  ? `sent to: ${transfer.targetDevice || 'Unknown Device'}` 
                  : `from: ${transfer.sourceDevice || 'Unknown Device'}`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={`text-sm font-medium ${getStatusColor(transfer.status)}`}>
              {getStatusText(transfer.status, transfer.progress)}
            </p>
            { (transfer.status === 'sending' || transfer.status === 'receiving') && transfer.rate !== undefined &&
              <p className="text-xs text-gray-400">{formatRate(transfer.rate)}</p>
            }
          </div>
          <div className="flex items-center gap-1.5">
            {(transfer.status === 'sending' || transfer.status === 'receiving') && (
              <button 
                onClick={() => onPause(transfer.id)} 
                className="p-1.5 rounded-full hover:bg-gray-600 transition-colors"
                title="Pause"
              >
                <Pause size={16} className="text-gray-300" />
              </button>
            )}
            {transfer.status === 'paused' && (
              <button 
                onClick={() => onResume(transfer.id)} 
                className="p-1.5 rounded-full hover:bg-gray-600 transition-colors"
                title="Resume"
              >
                <Play size={16} className="text-gray-300" />
              </button>
            )}
            {(transfer.status !== 'completed' && transfer.status !== 'cancelled' && transfer.status !== 'failed') && (
              <button 
                onClick={() => onCancel(transfer.id)} 
                className="p-1.5 rounded-full hover:bg-gray-600 transition-colors"
                title="Cancel"
              >
                <X size={16} className="text-gray-300" />
              </button>
            )}
            {transfer.status === 'completed' && transfer.direction === 'received' && (
              <>
                {transfer.filePath ? (
                  <div
                    className="p-1.5"
                    title={`Saved to: ${transfer.filePath}`}
                  >
                    <Folder size={16} className="text-green-400" />
                  </div>
                ) : transfer.blobUrl && (
                  <a 
                    href={transfer.blobUrl}
                    download={transfer.name}
                    className="p-1.5 rounded-full hover:bg-gray-600 transition-colors"
                    title="Download"
                  >
                    <Download size={16} className="text-gray-300" />
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {/* 只有特定状态才显示进度条 */}
      {!['completed', 'failed', 'cancelled'].includes(transfer.status) && transfer.progress !== undefined && (
        <div className="mt-2 h-1.5 w-full bg-gray-600 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${getProgressBarColor(transfer.status)}`} 
            style={{ width: `${Math.round(transfer.progress * 100)}%` }}
          ></div>
        </div>
      )}
    </div>
  );
};