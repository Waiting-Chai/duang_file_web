import { useState, useEffect } from 'react';
import { Transfer } from '../types';
import { transferService } from '../api/transfer';

export function useTransfers() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  useEffect(() => {
    const subscription = transferService.onTransfersUpdate$.subscribe(updatedTransfers => {
      setTransfers(updatedTransfers);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handlePause = (id: string | number) => {
    console.log(`[Hook] handlePause called for transfer: ${id}`);
    transferService.pauseTransfer(String(id));
  };

  const handleResume = (id: string | number) => {
    console.log(`[Hook] handleResume called for transfer: ${id}`);
    transferService.resumeTransfer(String(id));
  };

  const handleCancel = (id: string | number) => {
    transferService.cancelTransfer(String(id));
  };

  return { transfers, handlePause, handleResume, handleCancel };
}