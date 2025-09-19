import React from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onKeyPress,
  placeholder = "Write a message...",
  disabled = false
}) => {
  return (
    <textarea
      className={`chat-input ${disabled ? 'disabled' : ''}`}
      placeholder={placeholder}
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyPress={onKeyPress}
      disabled={disabled}
    />
  );
};

export default ChatInput;