import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => (
  <ReactMarkdown>
    {content}
  </ReactMarkdown>
);

export default MarkdownRenderer;
