import { useState } from 'react';
import DeviceList from '../../components/device/DeviceList';
import Dropzone from './components/Dropzone';
import ConfirmationModal from './components/ConfirmationModal';
import { useDevices } from '../../contexts/DeviceContext';
import { Transfer } from '../../types';
import TransferList from './components/TransferList';
import { useTransfers } from '../../hooks/useTransfers';
import RocketAnimation from '../../components/ui/RocketAnimation';

export default function FileTransferPage() {
  const { transfers, addTransfers, handlePause, handleResume, handleCancel } = useTransfers();
  const { selectedDevices, devices } = useDevices();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filesToConfirm, setFilesToConfirm] = useState<File[]>([]);
  const [showRocket, setShowRocket] = useState(false);

  const handleFilesSelected = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFilesToConfirm(acceptedFiles);
      setIsModalOpen(true);
    }
  };

  const handleConfirmSend = () => {
    console.log('Sending files:', filesToConfirm, 'to devices:', selectedDevices);
    // Here you would implement the actual file sending logic
    // For now, let's just add them to the transfer list as a mock
    const newTransfers = selectedDevices.flatMap(deviceId => 
      filesToConfirm.map((file, index) => {
        const device = devices.find(d => d.id === deviceId);
        return {
          id: `${Date.now()}-${deviceId}-${index}`,
          name: file.name,
          size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          status: 'sending',
          progress: 0,
          direction: 'sent',
          rate: 0,
          targetDevice: device?.username || deviceId,
        } as Transfer;
      })
    );

    if (selectedDevices.length === 0) {
      // Broadcast logic
      const broadcastTransfers = filesToConfirm.map((file, index) => ({
        id: `${Date.now()}-broadcast-${index}`,
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        status: 'sending',
        progress: 0,
        direction: 'sent',
        rate: 0,
        targetDevice: 'Broadcast',
      } as Transfer));
      addTransfers(broadcastTransfers);
    } else {
      addTransfers(newTransfers);
    }
    setIsModalOpen(false);
    setFilesToConfirm([]);
    setShowRocket(true);
  };

  const handleCancelSend = () => {
    setIsModalOpen(false);
    setFilesToConfirm([]);
  };



  const handleRocketAnimationEnd = () => {
    setShowRocket(false);
  };

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Top Section: Device Discovery and Dropzone */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DeviceList />
        </div>
        <Dropzone onFilesSelected={handleFilesSelected} />
      </div>

      {/* Bottom Section: Transfer List */}
      <div className="flex-1 relative">
        <TransferList 
          transfers={transfers} 
          onPause={handlePause} 
          onResume={handleResume} 
          onCancel={handleCancel} 
        />
      </div>

      <ConfirmationModal 
        isOpen={isModalOpen}
        files={filesToConfirm}
        targetDevices={devices.filter(d => selectedDevices.includes(d.id))}
        onConfirm={handleConfirmSend}
        onCancel={handleCancelSend}
      />

      {showRocket && <RocketAnimation onAnimationEnd={handleRocketAnimationEnd} />}
    </div>
  );
}