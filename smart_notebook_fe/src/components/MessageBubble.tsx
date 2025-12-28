import { useState } from 'react';
import { Message } from '../App';
import { BookOpen, User, Bot, Sparkles } from 'lucide-react';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { WordPopover } from './WordPopover';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

interface MessageBubbleProps {
  message: Message;
  onRequestTranslation: (messageId: string) => void;
  onAddBookmark: (text: string, translation: string, type: 'word' | 'sentence') => void;
  onJumpToTranslation: (messageId: string) => void;
}

export function MessageBubble({
  message,
  onRequestTranslation,
  onAddBookmark,
  onJumpToTranslation,
}: MessageBubbleProps) {
  const [selectedText, setSelectedText] = useState('');
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const [popoverPlacement, setPopoverPlacement] = useState<'top' | 'bottom'>('top');
  const [showPopover, setShowPopover] = useState(false);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 0 && message.role === 'assistant') {
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();

      if (rect) {
        setSelectedText(text);

        // Calculate available space above
        // Assuming popover height is around 200px
        const spaceAbove = rect.top;
        const fitsAbove = spaceAbove > 220;

        setPopoverPlacement(fitsAbove ? 'top' : 'bottom');
        setPopoverPosition({
          x: rect.left + rect.width / 2,
          y: fitsAbove ? rect.top : rect.bottom,
        });
        setShowPopover(true);
      }
    } else {
      setShowPopover(false);
    }
  };

  const isUser = message.role === 'user';
  const showTranslateButton = message.role === 'assistant' && !message.translatedContent;
  const showJumpButton = message.role === 'assistant' && !!message.translatedContent;

  // For user messages, always show original
  const displayContent = message.content;
  const hasTranslation = message.translatedContent;

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
      data-message-id={message.id}
      data-role={message.role}
    >
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${isUser ? 'bg-gradient-to-br from-blue-600 to-blue-500' : 'bg-gradient-to-br from-gray-700 to-gray-600'
          }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
        <div
          className={`inline-block text-sm ${isUser
            ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl px-4 py-3'
            : 'w-full max-w-[85%]'
            }`}
          onMouseUp={handleTextSelection}
        >
          {isUser ? (
            <div>
              <p className="whitespace-pre-wrap leading-relaxed break-words">{displayContent}</p>
              {hasTranslation && (
                <div className="mt-2.5 pt-2.5 border-t border-white/20">
                  <p className="text-xs opacity-70 mb-1.5">→ English</p>
                  <p className="whitespace-pre-wrap leading-relaxed opacity-90 break-words">{message.translatedContent}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="px-1 py-1 overflow-hidden w-full max-w-full">
              <div className="prose prose-sm max-w-full break-words overflow-x-hidden 
                [&>*]:text-[15px] [&>*]:text-gray-800 [&>*]:leading-[1.8] [&>*]:tracking-[0.01em]
                [&>p]:my-4 [&>p]:first:mt-0 [&>p]:last:mb-0
                [&>h1]:text-xl [&>h1]:font-semibold [&>h1]:text-gray-900 [&>h1]:mt-6 [&>h1]:mb-3 [&>h1]:first:mt-0 [&>h1]:leading-[1.4]
                [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:text-gray-900 [&>h2]:mt-6 [&>h2]:mb-3 [&>h2]:first:mt-0 [&>h2]:leading-[1.4]
                [&>h3]:text-base [&>h3]:font-semibold [&>h3]:text-gray-900 [&>h3]:mt-5 [&>h3]:mb-2.5 [&>h3]:first:mt-0 [&>h3]:leading-[1.4]
                [&>ul]:my-4 [&>ul]:space-y-2 [&>ul]:pl-5 [&>ul]:first:mt-0 [&>ul]:last:mb-0
                [&>ol]:my-4 [&>ol]:space-y-2 [&>ol]:pl-5 [&>ol]:first:mt-0 [&>ol]:last:mb-0
                [&>ul>li]:text-[15px] [&>ul>li]:text-gray-800 [&>ul>li]:leading-[1.8]
                [&>ol>li]:text-[15px] [&>ol>li]:text-gray-800 [&>ol>li]:leading-[1.8]
                [&>strong]:font-semibold [&>strong]:text-gray-900
                [&>a]:text-blue-600 [&>a]:underline [&>a]:font-medium hover:[&>a]:text-blue-700
                [&>blockquote]:border-l-4 [&>blockquote]:border-blue-500 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-gray-700 [&>blockquote]:my-4 [&>blockquote]:first:mt-0 [&>blockquote]:last:mb-0
                [&>hr]:my-5 [&>hr]:border-gray-200
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
                            margin: '16px 0',
                            borderRadius: '12px',
                            fontSize: '14px',
                            padding: '16px',
                            lineHeight: '1.6',
                          }}
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className="text-[13px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono before:content-[''] after:content-['']" {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {displayContent}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {showTranslateButton && (
          <button
            onClick={() => onRequestTranslation(message.id)}
            className="mt-2 px-2.5 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Translate to Korean
          </button>
        )}

        {showJumpButton && (
          <button
            onClick={() => onJumpToTranslation(message.id)}
            className="mt-2 px-2.5 py-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1.5 transition-all font-medium"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Show Translation
          </button>
        )}
      </div>

      {showPopover && (
        <WordPopover
          text={selectedText}
          position={popoverPosition}
          placement={popoverPlacement}
          onClose={() => setShowPopover(false)}
          onAddBookmark={onAddBookmark}
        />
      )}
    </div>
  );
}