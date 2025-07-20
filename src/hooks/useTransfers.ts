import { useState, useEffect } from 'react';
import { Transfer } from '../types';

export function useTransfers() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  // Mock data and transfer simulation
  useEffect(() => {
    const mockTransfers: Transfer[] = [
      {
        id: 1,
        name: 'document.pdf',
        size: '1.2 MB',
        status: 'sending',
        progress: 45,
        direction: 'sent',
        targetDevice: "shentw's macos",
        rate: 1500, // 1.5 MB/s
      },
      {
        id: 2,
        name: 'presentation.pptx',
        size: '15.8 MB',
        status: 'receiving',
        progress: 80,
        direction: 'received',
        sourceDevice: 'John Doe\'s iPhone',
        rate: 800, // 800 KB/s
      },
      {
        id: 3,
        name: 'archive.zip',
        size: '512 MB',
        status: 'paused',
        progress: 60,
        direction: 'sent',
        targetDevice: 'Jane\'s iPad',
      },
      {
        id: 4,
        name: 'project-files.zip',
        size: '2.3 GB',
        status: 'completed',
        progress: 100,
        direction: 'received',
        sourceDevice: 'Workstation-Linux',
      },
    ];
    setTransfers(mockTransfers);
  }, []);

  const addTransfers = (newTransfers: Transfer[]) => {
    setTransfers(prev => [...newTransfers, ...prev]);
  };

  const handlePause = (id: string | number) => {
    setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'paused' } : t));
  };

  const handleResume = (id: string | number) => {
    setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: t.direction === 'sent' ? 'sending' : 'receiving' } : t));
  };

  const handleCancel = (id: string | number) => {
    setTransfers(prev => prev.filter(t => t.id !== id));
  };

  return { transfers, addTransfers, handlePause, handleResume, handleCancel };
}