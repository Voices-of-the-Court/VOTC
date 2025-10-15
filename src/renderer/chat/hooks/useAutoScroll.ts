import { useEffect, useRef, useCallback } from 'react';

const useAutoScroll = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Check if user is at the bottom
  const isAtBottom = useCallback(() => {
    if (!containerRef.current) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // Add threshold of 100px to account for smooth scrolling
    const threshold = 100;
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, []);

  // Handle scroll events to detect manual scrolling
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    // If user scrolled to bottom, re-enable auto-scroll
    if (isAtBottom()) {
      shouldAutoScrollRef.current = true;
    } else {
      // User scrolled up, disable auto-scroll
      shouldAutoScrollRef.current = false;
    }
  }, [isAtBottom]);

  return { 
    messagesEndRef, 
    containerRef,
    scrollToBottom,
    handleScroll
  };
};

export default useAutoScroll;
