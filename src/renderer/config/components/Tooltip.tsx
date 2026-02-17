import React, { useState, useRef, useEffect } from 'react';
import tooltipIcon from '../../assets/tooltip2.png';

interface TooltipProps {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({ text, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && containerRef.current && bubbleRef.current) {
      const iconRect = containerRef.current.getBoundingClientRect();
      const bubbleRect = bubbleRef.current.getBoundingClientRect();
      
      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = iconRect.top - bubbleRect.height - 8;
          left = iconRect.left - 2 + iconRect.width / 2 - bubbleRect.width / 2;
          break;
        case 'bottom':
          top = iconRect.bottom + 8;
          left = iconRect.left + 2 + iconRect.width / 2 - bubbleRect.width / 2;
          break;
        case 'left':
          top = iconRect.top + iconRect.height / 2 - bubbleRect.height / 2;
          left = iconRect.left - bubbleRect.width - 2;
          break;
        case 'right':
          top = iconRect.top + iconRect.height / 2 - bubbleRect.height / 2;
          left = iconRect.right + 6;
          break;
      }

      setTooltipStyle({
        top: `${top}px`,
        left: `${left}px`,
      });
    }
  }, [isVisible, position, text]);

  return (
    <div 
      ref={containerRef}
      className="tooltip-container"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <img src={tooltipIcon} alt="?" className="tooltip-icon" />
      {isVisible && (
        <div 
          ref={bubbleRef}
          className={`tooltip-bubble tooltip-${position}`}
          style={tooltipStyle}
        >
          {text}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
