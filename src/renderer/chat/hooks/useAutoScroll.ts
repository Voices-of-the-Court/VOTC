import { useEffect, useRef, useCallback } from 'react';

const useAutoScroll = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null!);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return { messagesEndRef, scrollToBottom };
};

export default useAutoScroll;
