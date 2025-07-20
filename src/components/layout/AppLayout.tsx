import { useEffect } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import FileTransferPage from '../../features/files/FileTransferPage';
import BroadcastPage from '../../features/broadcast/BroadcastPage';
import DeviceList from '../device/DeviceList';
import { DeviceProvider } from '../../contexts/DeviceContext';

const activeLinkStyle = { backgroundColor: '#374151' };

export default function AppLayout() {
  const navigate = useNavigate();
  useEffect(() => {
    const username = sessionStorage.getItem('username');
    if (!username) {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div className="flex h-screen bg-gray-900 text-gray-200">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-gray-800 p-4">
        <div className="text-2xl font-bold mb-8">Duang</div>
        <nav className="space-y-2">
          <NavLink to="/app/files" className="block px-4 py-2 rounded-lg hover:bg-gray-700" style={({ isActive }) => isActive ? activeLinkStyle : undefined}>Files</NavLink>
          <NavLink to="/app/broadcast" className="block px-4 py-2 rounded-lg hover:bg-gray-700" style={({ isActive }) => isActive ? activeLinkStyle : undefined}>Broadcast</NavLink>
          <NavLink to="/app/devices" className="block px-4 py-2 rounded-lg hover:bg-gray-700" style={({ isActive }) => isActive ? activeLinkStyle : undefined}>Device List</NavLink>
          <NavLink to="/app/settings" className="block px-4 py-2 rounded-lg hover:bg-gray-700" style={({ isActive }) => isActive ? activeLinkStyle : undefined}>Settings</NavLink>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <DeviceProvider>
          <Routes>
            <Route path="/" element={<Navigate to="files" />} />
            <Route path="files" element={<FileTransferPage />} />
            <Route path="broadcast" element={<BroadcastPage />} />
            <Route path="devices" element={<DeviceList />} />
            <Route path="settings" element={<div>Settings Page</div>} />
          </Routes>
        </DeviceProvider>
      </main>
    </div>
  );
}