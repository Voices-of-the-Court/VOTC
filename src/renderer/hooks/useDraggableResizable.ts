import { useState, useCallback, useRef, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface DraggableResizableState {
  position: Position;
  size: Size;
  isDragging: boolean;
  isResizing: boolean;
}

interface UseDraggableResizableOptions {
  initialPosition?: Position;
  initialSize?: Size;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  storageKey?: string; // For persisting position/size
}

export function useDraggableResizable(options: UseDraggableResizableOptions = {}) {
  const {
    initialPosition = { x: 30, y: 30 },
    initialSize = { width: 600, height: 800 },
    minWidth = 300,
    minHeight = 400,
    maxWidth = window.innerWidth - 60,
    maxHeight = window.innerHeight - 60,
    storageKey,
  } = options;

  // Load from localStorage if storageKey is provided
  const loadFromStorage = useCallback(() => {
    if (!storageKey) return { position: initialPosition, size: initialSize };
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          position: parsed.position || initialPosition,
          size: parsed.size || initialSize,
        };
      }
    } catch (error) {
      console.error('Failed to load panel state from storage:', error);
    }
    
    return { position: initialPosition, size: initialSize };
  }, [storageKey, initialPosition, initialSize]);

  const { position: storedPosition, size: storedSize } = loadFromStorage();

  const [state, setState] = useState<DraggableResizableState>({
    position: storedPosition,
    size: storedSize,
    isDragging: false,
    isResizing: false,
  });

  const dragStartPos = useRef<Position>({ x: 0, y: 0 });
  const resizeStartPos = useRef<Position>({ x: 0, y: 0 });
  const resizeStartSize = useRef<Size>({ width: 0, height: 0 });
  const resizeStartPanelPos = useRef<Position>({ x: 0, y: 0 });
  const resizeDirection = useRef<string>('');

  // Save to localStorage when position or size changes
  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            position: state.position,
            size: state.size,
          })
        );
      } catch (error) {
        console.error('Failed to save panel state to storage:', error);
      }
    }
  }, [state.position, state.size, storageKey]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartPos.current = {
      x: e.clientX - state.position.x,
      y: e.clientY - state.position.y,
    };
    setState(prev => ({ ...prev, isDragging: true }));
  }, [state.position]);

  const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
    resizeStartSize.current = { ...state.size };
    resizeStartPanelPos.current = { ...state.position };
    resizeDirection.current = direction;
    setState(prev => ({ ...prev, isResizing: true }));
  }, [state.size, state.position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (state.isDragging) {
      const newX = Math.max(0, Math.min(e.clientX - dragStartPos.current.x, window.innerWidth - state.size.width));
      const newY = Math.max(0, Math.min(e.clientY - dragStartPos.current.y, window.innerHeight - state.size.height));
      
      setState(prev => ({
        ...prev,
        position: { x: newX, y: newY },
      }));
    } else if (state.isResizing) {
      const deltaX = e.clientX - resizeStartPos.current.x;
      const deltaY = e.clientY - resizeStartPos.current.y;
      const direction = resizeDirection.current;

      let newWidth = resizeStartSize.current.width;
      let newHeight = resizeStartSize.current.height;
      let newX = resizeStartPanelPos.current.x;
      let newY = resizeStartPanelPos.current.y;

      if (direction.includes('e')) {
        newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartSize.current.width + deltaX));
      }
      if (direction.includes('w')) {
        const potentialWidth = resizeStartSize.current.width - deltaX;
        if (potentialWidth >= minWidth && potentialWidth <= maxWidth) {
          newWidth = potentialWidth;
          newX = resizeStartPanelPos.current.x + deltaX;
        }
      }
      if (direction.includes('s')) {
        newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStartSize.current.height + deltaY));
      }
      if (direction.includes('n')) {
        const potentialHeight = resizeStartSize.current.height - deltaY;
        if (potentialHeight >= minHeight && potentialHeight <= maxHeight) {
          newHeight = potentialHeight;
          newY = resizeStartPanelPos.current.y + deltaY;
        }
      }

      // Ensure panel doesn't go off-screen
      newX = Math.max(0, Math.min(newX, window.innerWidth - newWidth));
      newY = Math.max(0, Math.min(newY, window.innerHeight - newHeight));

      setState(prev => ({
        ...prev,
        position: { x: newX, y: newY },
        size: { width: newWidth, height: newHeight },
      }));
    }
  }, [state.isDragging, state.isResizing, state.size, minWidth, minHeight, maxWidth, maxHeight]);

  const handleMouseUp = useCallback(() => {
    setState(prev => ({
      ...prev,
      isDragging: false,
      isResizing: false,
    }));
  }, []);

  useEffect(() => {
    if (state.isDragging || state.isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    
    return undefined;
  }, [state.isDragging, state.isResizing, handleMouseMove, handleMouseUp]);

  return {
    position: state.position,
    size: state.size,
    isDragging: state.isDragging,
    isResizing: state.isResizing,
    handleDragStart,
    handleResizeStart,
  };
}
