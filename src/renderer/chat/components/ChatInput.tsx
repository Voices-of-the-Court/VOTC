import React from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onKeyPress,
  placeholder = "Write a message..."
}) => {
  return (
    <textarea
      className="chat-input"
      placeholder={placeholder}
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyPress={onKeyPress}
    />
  );
};

export default ChatInput;