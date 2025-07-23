import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

const StaggeredPhysicsGrid: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const cells: HTMLDivElement[] = [];
    const numCells = 50;

    for (let i = 0; i < numCells; i++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      container.appendChild(cell);
      cells.push(cell);
    }

    const tl = gsap.timeline({ repeat: -1, yoyo: true });

    tl.to(cells, {
      duration: 1,
      scale: 0.1,
      y: 60,
      ease: 'power1.inOut',
      stagger: {
        grid: [5, 10],
        from: 'center',
        amount: 1.5,
      },
    });

    return () => {
      tl.kill();
      cells.forEach(cell => cell.remove());
    };
  }, []);

  return (
    <div ref={containerRef} className="staggered-grid-container"></div>
  );
};

export default StaggeredPhysicsGrid;