import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';

// 确保SplitText插件已注册
gsap.registerPlugin(SplitText);

interface JelloStretchyFontProps {
  onAnimationEnd: () => void;
  text?: string;
}

export default function JelloStretchyFont({ onAnimationEnd, text = 'DUANG' }: JelloStretchyFontProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const splitText = new SplitText(container, { 
      type: 'chars',
      charsClass: 'jello-char'
    });
    
    const chars = splitText.chars;
    
    // 重置初始状态
    gsap.set(chars, {
      fontVariationSettings: "'wght' 100, 'wdth' 100",
      opacity: 0,
      scale: 0.5,
      y: 20
    });
    
    // 创建主时间线
    const tl = gsap.timeline({
      onComplete: () => {
        // 动画完成后，延迟一段时间再调用onAnimationEnd
        setTimeout(() => {
          onAnimationEnd();
        }, 1000);
      }
    });
    
    // 添加字符动画
    tl.to(chars, {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 0.6,
      stagger: 0.05,
      ease: "back.out(1.7)"
    })
    .to(chars, {
      fontVariationSettings: "'wght' 900, 'wdth' 120",
      scale: 1.2,
      duration: 0.6,
      stagger: 0.05,
      ease: "elastic.out(1, 0.3)"
    }, "-=0.3")
    .to(chars, {
      fontVariationSettings: "'wght' 400, 'wdth' 100",
      scale: 1,
      duration: 0.6,
      stagger: 0.05,
      ease: "elastic.out(1, 0.3)"
    }, "-=0.1")
    .to(chars, {
      opacity: 0,
      y: -20,
      scale: 1.5,
      duration: 0.4,
      stagger: 0.03,
      delay: 0.5,
      ease: "power2.in"
    });
    
    // 清理函数
    return () => {
      tl.kill();
      splitText.revert();
    };
  }, [onAnimationEnd]);
  
  return (
    <div className="jello-stretchy-container">
      <div ref={containerRef} className="jello-stretchy-text">
        {text}
      </div>
    </div>
  );
}