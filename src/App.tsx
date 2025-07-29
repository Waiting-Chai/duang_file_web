import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import LoginPage from './features/auth/LoginPage';
import AppLayout from './components/layout/AppLayout';
import { socketService } from './api/socket';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const username = sessionStorage.getItem('username');
      if (!username) {
        setIsAuth(false);
        return;
      }

      const connected = await socketService.waitForConnect(5000);
      if (connected) {
        setIsAuth(true);
      } else {
        toast.error('连接服务器失败，请重新登录');
        sessionStorage.removeItem('username');
        setIsAuth(false);
      }
    };

    checkAuth();
  }, []);

  if (isAuth === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-200">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return isAuth ? children : <Navigate to="/login" />;
};

const Logout = () => {
  useEffect(() => {
    socketService.disconnect();
  }, []);
  return <Navigate to="/login" />;
};

function App() {
  useEffect(() => {
    const username = sessionStorage.getItem('username');
    console.log('App组件加载, username:', username);
    if (username && !socketService.isConnected.getValue()) {
      console.log("App组件调用effect进行重连")
      socketService.connect();
    }

    const handleBeforeUnload = () => {
      socketService.disconnect(false); // 非手动断开，不清除session
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
        <Route path="/logout" element={<Logout />} />
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