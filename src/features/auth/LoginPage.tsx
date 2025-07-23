import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socketService } from '../../api/socket';
import StaggeredPhysicsGrid from '../../components/ui/StaggeredPhysicsGrid';
import JelloStretchyFont from '../../components/ui/JelloStretchyFont';

export default function LoginPage() {
  const navigate = useNavigate();
  const [showDuang, setShowDuang] = useState(false);

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const username = (e.currentTarget.elements.namedItem('username') as HTMLInputElement).value;
    sessionStorage.setItem('username', username);
    console.log(`用户 '${username}' 登录，信息已缓存`);
    socketService.connect();
    setShowDuang(true);
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
            Login
          </button>
        </form>
      </div>
    </div>
  );
}