import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socketService } from '../../api/socket';
import StaggeredPhysicsGrid from '../../components/ui/StaggeredPhysicsGrid';
import JelloStretchyFont from '../../components/ui/JelloStretchyFont';

export default function LoginPage() {
  const navigate = useNavigate();
  const [showDuang, setShowDuang] = useState(false);

  useEffect(() => {
    //   只要加载到这个页面， 直接把所有的 websocket断联
    socketService.disconnect(true, true);
  }, []);

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const username = (e.currentTarget.elements.namedItem('username') as HTMLInputElement).value;
    // 将用户名存储到 sessionStorage
    sessionStorage.setItem('username', username);
    // 启动 WebSocket 连接
    socketService.connect();

    // 等待连接成功或失败
    const successSub = socketService.onConnect.subscribe(() => {
      setShowDuang(true); // 触发动画
      successSub.unsubscribe();
      errorSub.unsubscribe();
    });

    const errorSub = socketService.onConnectionFailed.subscribe(error => {
      console.error('Connection failed:', error);
      sessionStorage.removeItem('username'); // 连接失败，移除用户名
      // 在这里可以添加错误提示逻辑，例如 setErrorMessage(error)
      errorSub.unsubscribe();
      successSub.unsubscribe();
    });
  };

  const handleAnimationEnd = () => {
    setShowDuang(false);
    navigate('/app');
  };
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-200 relative overflow-hidden">
      <StaggeredPhysicsGrid />
      {showDuang && <JelloStretchyFont onAnimationEnd={handleAnimationEnd} text="DUANG" />}
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-xl shadow-lg z-10">
        <h1 className="text-3xl font-bold text-center">Duang File</h1>
        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label htmlFor="username" className="text-sm font-medium">Username</label>
            <input
              id="username"
              type="text"
              className="w-full px-4 py-2 mt-2 text-gray-200 bg-gray-700 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your username"
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}