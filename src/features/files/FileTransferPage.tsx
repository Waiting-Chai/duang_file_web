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
      setIncomingRequest(request);
    });
    return () => subscription.unsubscribe();
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
      console.error("Please select at least one device to send files to.");
      return;
    }

    selectedDevices.forEach(deviceId => {
      const device = devices.find(d => d.id === deviceId);
      if (device) {
        filesToConfirm.forEach(file => {
          transferService.sendFile(file, device.id, device.username);
        });
      }
    });

    setIsSendModalOpen(false);
    setFilesToConfirm([]);
    setShowRocket(true);
  };

  const handleCancelSend = () => {
    setIsSendModalOpen(false);
    setFilesToConfirm([]);
  };

  const handleAcceptReceive = () => {
    if (incomingRequest) {
      transferService.acceptTransfer(incomingRequest);
      setIncomingRequest(null);
    }
  };

  const handleRejectReceive = () => {
    if (incomingRequest) {
      transferService.rejectTransfer(incomingRequest.fileId);
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