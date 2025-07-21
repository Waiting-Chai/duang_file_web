import React, { useEffect, useState } from 'react';

interface DuangAnimationProps {
  onAnimationEnd: () => void;
}

const DuangAnimation: React.FC<DuangAnimationProps> = ({ onAnimationEnd }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onAnimationEnd();
    }, 2000); // Animation duration

    return () => clearTimeout(timer);
  }, [onAnimationEnd]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <svg viewBox="0 0 800 400" className="w-full h-full">
        <defs>
          <linearGradient id="duang-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#ff00ff', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#00ffff', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <text
          x="50%"
          y="50%"
          dy=".35em"
          textAnchor="middle"
          className="duang-text"
        >
          Duang
        </text>
      </svg>
    </div>
  );
};

export default DuangAnimation;