import React, { useEffect, useState } from 'react';

interface RocketAnimationProps {
  onAnimationEnd: () => void;
}

const RocketAnimation: React.FC<RocketAnimationProps> = ({ onAnimationEnd }) => {
  const [animationStep, setAnimationStep] = useState('idle');

  useEffect(() => {
    const timer1 = setTimeout(() => setAnimationStep('firing'), 500);
    const timer2 = setTimeout(() => setAnimationStep('launching'), 1500);
    const timer3 = setTimeout(() => {
      onAnimationEnd();
    }, 3500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onAnimationEnd]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <svg width="200" height="400" viewBox="0 0 100 200" className={`rocket-container ${animationStep}`}>
        {/* Rocket Body */}
        <defs>
            <linearGradient id="rocket-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{stopColor: '#d1d5db', stopOpacity: 1}} />
                <stop offset="100%" style={{stopColor: '#4b5563', stopOpacity: 1}} />
            </linearGradient>
        </defs>
        <path d="M50 10 L70 50 L70 150 L30 150 L30 50 Z" fill="url(#rocket-gradient)" />
        <path d="M50 10 L40 30 L60 30 Z" fill="#ef4444" />
        {/* Fins */}
        <path d="M30 150 L10 170 L30 140 Z" fill="#ef4444" />
        <path d="M70 150 L90 170 L70 140 Z" fill="#ef4444" />

        {/* Fire */}
        <g className="rocket-fire">
            <path d="M40 150 Q50 180 60 150" fill="#f97316" />
            <path d="M45 150 Q50 170 55 150" fill="#facc15" />
        </g>
      </svg>
    </div>
  );
};

export default RocketAnimation;