import { useState, useEffect } from 'react';
import DeviceList from '../../components/device/DeviceList';
import Dropzone from './components/Dropzone';
import ConfirmationModal from './components/ConfirmationModal';
import { useDevices } from '../../contexts/DeviceContext';
import TransferList from './components/TransferList';
import { useTransfers } from '../../hooks/useTransfers';
import RocketAnimation from '../../components/ui/RocketAnimation';
import { transferService } from '../../api/transfer';
import { FileTransferRequest } from '../../types/transfer';
import ReceiveConfirmationModal from './components/ReceiveConfirmationModal'; // Assuming this component exists

export default function FileTransferPage() {
  const { transfers, handlePause, handleResume, handleCancel } = useTransfers();
  const { selectedDevices, devices } = useDevices();
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [filesToConfirm, setFilesToConfirm] = useState<File[]>([]);
  const [showRocket, setShowRocket] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState<FileTransferRequest | null>(null);

  useEffect(() => {
    const subscription = transferService.onFileTransferRequest$.subscribe(request => {
      console.log('[FileTransferPage] 接收到文件传输请求:', request);
      console.log('[FileTransferPage] 文件大小:', request.fileSize, '字节');
      console.log('[FileTransferPage] 总块数:', request.totalChunks);
      console.log('[FileTransferPage] 块大小:', request.chunkSize, '字节');
      
      // 确保弹窗显示，特别是对于小文件
      setIncomingRequest(request);
      
      // 添加额外的日志确认状态更新
      setTimeout(() => {
        console.log('[FileTransferPage] 弹窗状态检查 - incomingRequest:', !!request);
      }, 100);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleFilesSelected = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFilesToConfirm(acceptedFiles);
      setIsSendModalOpen(true);
    }
  };

  const handleConfirmSend = () => {
    if (selectedDevices.length === 0) {
      // Handle broadcast logic if needed, for now, we require a selection
      console.error("请至少选择一个设备来发送文件。");
      return;
    }

    // 获取所有选中设备的ID和名称
    const targetIds: string[] = [];
    const targetNames: string[] = [];
    
    selectedDevices.forEach(deviceId => {
      const device = devices.find(d => d.id === deviceId);
      if (device) {
        targetIds.push(device.id);
        targetNames.push(device.username);
      }
    });

    // 为每个文件创建一个传输任务，发送给所有选中的设备
    filesToConfirm.forEach(file => {
      transferService.sendFile(file, targetIds, targetNames);
    });

    setIsSendModalOpen(false);
    setFilesToConfirm([]);
    setShowRocket(true);
  };

  const handleCancelSend = () => {
    setIsSendModalOpen(false);
    setFilesToConfirm([]);
  };

  const handleAcceptReceive = async () => {
    if (incomingRequest) {
      console.log('[FileTransferPage] 用户接受文件传输:', incomingRequest);
      try {
        await transferService.acceptTransfer(incomingRequest);
        setIncomingRequest(null);
        console.log('[FileTransferPage] 文件传输已接受');
      } catch (error) {
        console.error('接受文件传输失败:', error);
        setIncomingRequest(null);
      }
    }
  };

  const handleRejectReceive = () => {
    if (incomingRequest) {
      transferService.rejectTransfer(incomingRequest);
      setIncomingRequest(null);
    }
  };

  const handleRocketAnimationEnd = () => {
    setShowRocket(false);
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DeviceList />
        </div>
        <Dropzone onFilesSelected={handleFilesSelected} />
      </div>

      <div className="flex-1 relative">
        <TransferList 
          transfers={transfers} 
          onPause={handlePause} 
          onResume={handleResume} 
          onCancel={handleCancel} 
        />
      </div>

      <ConfirmationModal 
        isOpen={isSendModalOpen}
        files={filesToConfirm}
        targetDevices={devices.filter(d => selectedDevices.includes(d.id))}
        onConfirm={handleConfirmSend}
        onCancel={handleCancelSend}
      />

      {incomingRequest && (
        <ReceiveConfirmationModal
          isOpen={!!incomingRequest}
          request={incomingRequest}
          onConfirm={handleAcceptReceive}
          onCancel={handleRejectReceive}
        />
      )}

      {showRocket && <RocketAnimation onAnimationEnd={handleRocketAnimationEnd} />}
    </div>
  );
}