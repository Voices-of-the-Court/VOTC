import { useCallback } from 'react';

interface UseWindowEventsReturn {
  handleChatBoxMouseEnter: () => void;
  handleChatBoxMouseLeave: () => void;
  handleLeave: (resetChat: () => void) => void;
}

const useWindowEvents = (): UseWindowEventsReturn => {
  const handleChatBoxMouseEnter = useCallback(() => {
    window.electronAPI?.setIgnoreMouseEvents(false);
  }, []);

  const handleChatBoxMouseLeave = useCallback(() => {
    window.electronAPI?.setIgnoreMouseEvents(true);
  }, []);

  const handleLeave = useCallback((resetChat: () => void) => {
    window.electronAPI.hideWindow();
    window.electronAPI?.setIgnoreMouseEvents(true);
    window.conversationAPI.reset();
    resetChat();
  }, []);

  return {
    handleChatBoxMouseEnter,
    handleChatBoxMouseLeave,
    handleLeave
  };
};

export default useWindowEvents;