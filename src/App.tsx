import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LoginPage from './features/auth/LoginPage';
import AppLayout from './components/layout/AppLayout';
import { socketService } from './api/socket';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const isAuthenticated = sessionStorage.getItem('username');
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  useEffect(() => {
    const username = sessionStorage.getItem('username');
    if (username) {
      socketService.connect();
    }

    const handleBeforeUnload = () => {
      socketService.disconnect();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      socketService.disconnect();
    };
  }, []);

  return (
    <>
      <Toaster 
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 5000,
          style: {
            background: '#334155',
            color: '#fff',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route 
          path="/app/*" 
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  )
}

export default App