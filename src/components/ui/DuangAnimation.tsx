import React, { useEffect, useState, useRef } from 'react';

interface DuangAnimationProps {
  onAnimationEnd: () => void;
}

const DuangAnimation: React.FC<DuangAnimationProps> = ({ onAnimationEnd }) => {
  const [animationStage, setAnimationStage] = useState<'pipe' | 'duang'>('pipe');
  const [visible, setVisible] = useState(true);
  const ballRef = useRef<SVGCircleElement>(null);
  
  useEffect(() => {
    // 球体滚动动画完成后显示Duang文字
    const pipeTimer = setTimeout(() => {
      setAnimationStage('duang');
    }, 2500); // 水管动画持续时间
    
    // 整个动画完成后回调
    const completeTimer = setTimeout(() => {
      setVisible(false);
      onAnimationEnd();
    }, 4500); // 总动画持续时间

    return () => {
      clearTimeout(pipeTimer);
      clearTimeout(completeTimer);
    };
  }, [onAnimationEnd]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      {animationStage === 'pipe' ? (
        <div className="pipe-animation-container">
          <svg viewBox="0 0 400 400" className="w-full max-w-md">
            {/* 弯曲的水管路径 */}
            <path
              d="M100,50 C150,50 150,150 200,150 S250,250 300,250 L300,350"
              fill="none"
              stroke="url(#pipe-gradient)"
              strokeWidth="40"
              strokeLinecap="round"
              className="water-pipe"
            />
            {/* 水管渐变 */}
            <defs>
              <linearGradient id="pipe-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#61dafb', stopOpacity: 0.8 }} />
                <stop offset="100%" style={{ stopColor: '#a78bfa', stopOpacity: 0.8 }} />
              </linearGradient>
              <radialGradient id="ball-gradient" cx="40%" cy="40%" r="60%" fx="30%" fy="30%">
                <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 1 }} />
                <stop offset="50%" style={{ stopColor: '#61dafb', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#a78bfa', stopOpacity: 1 }} />
              </radialGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            {/* 滚动的球体 */}
            <g className="rolling-ball">
              <circle
                ref={ballRef}
                cx="0"
                cy="0"
                r="15"
                fill="url(#ball-gradient)"
                filter="url(#glow)"
              />
              {/* 球体纹理标记 */}
              <line x1="-15" y1="0" x2="15" y2="0" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <line x1="0" y1="-15" x2="0" y2="15" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            </g>
            {/* 球体内部光晕 */}
            <circle
              cx="0"
              cy="0"
              r="8"
              fill="white"
              opacity="0.7"
              className="rolling-ball-inner"
            />
          </svg>
        </div>
      ) : (
        <svg viewBox="0 0 800 400" className="w-full h-full">
          <defs>
            <linearGradient id="duang-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#ff00ff', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#00ffff', stopOpacity: 1 }} />
            </linearGradient>
            <filter id="duang-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#ff00ff" floodOpacity="0.5" />
            </filter>
          </defs>
          <text
            x="50%"
            y="50%"
            dy=".35em"
            textAnchor="middle"
            className="duang-text"
            filter="url(#duang-shadow)"
          >
            Duang
          </text>
        </svg>
      )}
    </div>
  );
};

export default DuangAnimation;