import React, { useRef, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Message } from '../App';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface TranslationPanelProps {
  messages: Message[];
  onClose: () => void;
  onResize?: (width: number) => void;
  width?: number;
  highlightedMessageId?: string | null;
}

export function TranslationPanel({ messages, onClose, onResize, width = 400, highlightedMessageId }: TranslationPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(width);

  const assistantMessages = messages.filter(
    (m) => m.role === 'assistant' && m.translatedContent
  );

  // Scroll to bottom on initial mount to show latest messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Handle jump to specific message
  useEffect(() => {
    if (highlightedMessageId && scrollRef.current) {
      const element = document.getElementById(`translation-${highlightedMessageId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Optional: Add a temporary highlight effect
        element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
        }, 2000);
      }
    }
  }, [highlightedMessageId]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(width);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const diff = startX - e.clientX;
      const newWidth = Math.min(Math.max(350, startWidth + diff), 800);
      onResize?.(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, startX, startWidth, onResize]);

  return (
    <div
      className="h-full flex flex-col bg-white relative"
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 transition-colors z-10"
        style={{ marginLeft: '-2px' }}
      />

      <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-900">한국어 번역</h2>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5">
        {assistantMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 px-4">
            <div className="text-center">
              <p className="text-sm">번역된 메시지가 없습니다</p>
            </div>
          </div>
        ) : (
          assistantMessages.map((message, index) => (
            <div
              key={message.id}
              id={`translation-${message.id}`}
              className="bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm transition-all duration-300"
            >
              <div className="px-5 py-4 prose prose-sm max-w-none
                [&>*]:text-[14px] [&>*]:text-gray-800 [&>*]:leading-[1.85] [&>*]:tracking-[0.02em]
                [&>p]:my-3.5 [&>p]:first:mt-0 [&>p]:last:mb-0
                [&>h1]:text-lg [&>h1]:font-semibold [&>h1]:text-gray-900 [&>h1]:mt-5 [&>h1]:mb-2.5 [&>h1]:first:mt-0 [&>h1]:leading-[1.45]
                [&>h2]:text-base [&>h2]:font-semibold [&>h2]:text-gray-900 [&>h2]:mt-5 [&>h2]:mb-2.5 [&>h2]:first:mt-0 [&>h2]:leading-[1.45]
                [&>h3]:text-[14px] [&>h3]:font-semibold [&>h3]:text-gray-900 [&>h3]:mt-4 [&>h3]:mb-2 [&>h3]:first:mt-0 [&>h3]:leading-[1.45]
                [&>ul]:my-3.5 [&>ul]:space-y-1.5 [&>ul]:pl-5 [&>ul]:first:mt-0 [&>ul]:last:mb-0
                [&>ol]:my-3.5 [&>ol]:space-y-1.5 [&>ol]:pl-5 [&>ol]:first:mt-0 [&>ol]:last:mb-0
                [&>ul>li]:text-[14px] [&>ul>li]:text-gray-800 [&>ul>li]:leading-[1.85]
                [&>ol>li]:text-[14px] [&>ol>li]:text-gray-800 [&>ol>li]:leading-[1.85]
                [&>strong]:font-semibold [&>strong]:text-gray-900
                [&>a]:text-blue-600 [&>a]:underline [&>a]:font-medium hover:[&>a]:text-blue-700
                [&>blockquote]:border-l-4 [&>blockquote]:border-blue-500 [&>blockquote]:pl-3.5 [&>blockquote]:italic [&>blockquote]:text-gray-700 [&>blockquote]:my-3.5 [&>blockquote]:first:mt-0 [&>blockquote]:last:mb-0
                [&>hr]:my-4 [&>hr]:border-gray-200
              ">
                <ReactMarkdown
                  components={{
                    a: ({ node, ...props }) => (
                      <a {...props} target="_blank" rel="noopener noreferrer" />
                    ),
                    code({ node, inline, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{
                            margin: '14px 0',
                            borderRadius: '10px',
                            fontSize: '13px',
                            padding: '14px',
                            lineHeight: '1.6',
                          }}
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className="text-[12px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono before:content-[''] after:content-['']" {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {message.translatedContent}
                </ReactMarkdown>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}