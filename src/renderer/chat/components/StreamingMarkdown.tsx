import { useEffect, useRef } from 'react';
import * as smd from 'streaming-markdown';

interface StreamingMarkdownProps {
  content: string;
  isAnimating: boolean;
}

const StreamingMarkdown: React.FC<StreamingMarkdownProps> = ({ 
  content, 
  isAnimating 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const parserRef = useRef<any>(null);
  const lastContentRef = useRef<string>('');

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize parser on first render
    if (!parserRef.current) {
      const renderer = smd.default_renderer(containerRef.current);
      parserRef.current = smd.parser(renderer);
    }

    // Only write new content (incremental chunks)
    if (content !== lastContentRef.current) {
      const newContent = content.slice(lastContentRef.current.length);
      if (newContent) {
        smd.parser_write(parserRef.current, newContent);
        lastContentRef.current = content;
      }
    }

    // End parser when streaming stops
    if (!isAnimating && parserRef.current) {
      smd.parser_end(parserRef.current);
      // Reset parser for next use
      parserRef.current = null;
      lastContentRef.current = '';
    }
  }, [content, isAnimating]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (parserRef.current) {
        smd.parser_end(parserRef.current);
        parserRef.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} className="markdown-content" />;
};

export default StreamingMarkdown;
