import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage } from '../components/MessageItem';

interface ChatStreaming {
  sendMessage: (content: string, setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>) => Promise<void>;
}

const useChatStreaming = (): ChatStreaming => {
  const sendMessage = useCallback(async (content: string, setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>) => {
    if (content.trim() === '') return;

    const newUserMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: content.trim(),
    };
    setMessages(prevMessages => [...prevMessages, newUserMessage]);

    const assistantMessageId = uuidv4();
    const requestId = uuidv4();
    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isLoading: true,
    };
    setMessages(prevMessages => [...prevMessages, assistantPlaceholder]);

    // Set up streaming listeners
    const cleanupChatChunk = window.conversationAPI.onChatChunk(({ requestId: resRequestId, chunk }) => {
      if (resRequestId === requestId) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId ? { ...msg, content: msg.content + (chunk?.delta?.content || ''), isLoading: true } : msg
          )
        );
      }
    });

    const cleanupChatStreamComplete = window.conversationAPI.onChatStreamComplete(({ 
      requestId: resRequestId, 
      // finalResponse
     }) => {
      if (resRequestId === requestId) {
        setMessages(prev =>
          prev.map(msg => {
            if (msg.id === assistantMessageId) {
              return { ...msg, content: msg.content, isLoading: false };
            }
            return msg;
          })
        );
        cleanupChatChunk();
        cleanupChatStreamComplete();
        cleanupChatError();
      }
    });

    const cleanupChatError = window.conversationAPI.onChatError(({ requestId: resRequestId, error }) => {
      if (resRequestId === requestId) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId ? { ...msg, content: `Error: ${error}`, isLoading: false } : msg
          )
        );
        cleanupChatChunk();
        cleanupChatStreamComplete();
        cleanupChatError();
      }
    });

    try {
      const response = await window.conversationAPI.sendMessage(content.trim(), requestId);

      if (!response.streamStarted) {
        if (response.message) {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: response.message.content || '', isLoading: false }
                : msg
            )
          );
        } else if (response.error) {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: `Error: ${response.error}`, isLoading: false }
                : msg
            )
          );
        }
        cleanupChatChunk();
        cleanupChatStreamComplete();
        cleanupChatError();
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: `Error: ${error.message || 'Unknown error'}`, isLoading: false }
            : msg
        )
      );
      cleanupChatChunk();
      cleanupChatStreamComplete();
      cleanupChatError();
    }
  }, []);

  return { sendMessage };
};

export default useChatStreaming;