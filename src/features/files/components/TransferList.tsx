import { FileText, X, Pause, Play, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

import { Transfer } from '../../../types';

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

export default function TransferList({ transfers, onPause, onResume, onCancel }: TransferListProps) {
  const sentTransfers = transfers.filter(t => t.direction === 'sent');
  const receivedTransfers = transfers.filter(t => t.direction === 'received');

  return (
    <div className="bg-gray-800 rounded-xl p-6 flex flex-col h-full">
      <h2 className="text-xl font-bold mb-4">Transfers</h2>
      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        
        <div>
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Sending</h3>
          {sentTransfers.length > 0 ? (
            sentTransfers.map(transfer => (
              <TransferItem key={transfer.id} transfer={transfer} onPause={onPause} onResume={onResume} onCancel={onCancel} />
            ))
          ) : (
            <p className="text-gray-500 text-sm">No outgoing transfers.</p>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Receiving</h3>
          {receivedTransfers.length > 0 ? (
            receivedTransfers.map(transfer => (
              <TransferItem key={transfer.id} transfer={transfer} onPause={onPause} onResume={onResume} onCancel={onCancel} />
            ))
          ) : (
            <p className="text-gray-500 text-sm">No incoming transfers.</p>
          )}
        </div>

      </div>
    </div>
  );
}

const TransferItem = ({ transfer, onPause, onResume, onCancel }: { transfer: Transfer } & Omit<TransferListProps, 'transfers'>) => {
  return (
    <div className="bg-gray-700 p-4 rounded-lg mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {transfer.direction === 'sent' ? <ArrowUpRight size={24} className="text-blue-400"/> : <ArrowDownLeft size={24} className="text-green-400"/>}
          <div>
            <p className="font-semibold">{transfer.name}</p>
            <p className="text-xs text-gray-400">
              {transfer.direction === 'sent' 
                ? `You -> ${transfer.targetDevice || 'Unknown'}` 
                : `${transfer.sourceDevice || 'Unknown'} -> You`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <p className={`text-sm font-medium text-right ${transfer.status === 'completed' ? 'text-green-400' : 'text-blue-400'}`}>
              {transfer.status === 'completed' ? 'Completed' : transfer.status === 'paused' ? 'Paused' : `${transfer.progress}%`}
            </p>
            { (transfer.status === 'sending' || transfer.status === 'receiving') && transfer.rate !== undefined &&
              <p className="text-xs text-gray-400 text-right">{formatRate(transfer.rate)}</p>
            }
          </div>
          {(transfer.status !== 'completed') ? (
            <>
              {transfer.status === 'paused' ? (
                <button onClick={() => onResume(transfer.id)} className="text-gray-400 hover:text-white">
                  <Play size={18} />
                </button>
              ) : (
                <button onClick={() => onPause(transfer.id)} className="text-gray-400 hover:text-white">
                  <Pause size={18} />
                </button>
              )}
              <button onClick={() => onCancel(transfer.id)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </>
          ) : (
            <button onClick={() => onCancel(transfer.id)} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          )}
        </div>
      </div>
      {transfer.status !== 'completed' && (
        <div className="mt-2 h-1.5 w-full bg-gray-600 rounded-full">
          <div className={`h-1.5 rounded-full ${transfer.status === 'paused' ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${transfer.progress}%` }}></div>
        </div>
      )}
    </div>
  );
};