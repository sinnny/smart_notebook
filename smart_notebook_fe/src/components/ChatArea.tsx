import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, ChevronDown, Sparkles, Square } from 'lucide-react';
import { Message, Thread } from '../App';
import { MessageBubble } from './MessageBubble';

interface ChatAreaProps {
  messages: Message[];
  currentThread: Thread | null;
  isLoading: boolean;
  onSendMessage: (content: string, translateToEnglish: boolean, model: string) => void;
  onStop: () => void;
  onRequestTranslation: (messageId: string) => void;
  onAddBookmark: (text: string, translation: string, type: 'word' | 'sentence') => void;
  showTranslationPanel: boolean;
  onToggleTranslationPanel: () => void;
  autoTranslateResponses: boolean;
  onToggleAutoTranslate: () => void;
  onJumpToTranslation: (messageId: string) => void;
}

export function ChatArea({
  messages,
  currentThread,
  isLoading,
  onSendMessage,
  onStop,
  onRequestTranslation,
  onAddBookmark,
  showTranslationPanel,
  onToggleTranslationPanel,
  autoTranslateResponses,
  onToggleAutoTranslate,
  onJumpToTranslation,
}: ChatAreaProps) {
  const [input, setInput] = useState('');
  const [autoTranslateToEnglish, setAutoTranslateToEnglish] = useState(true);
  const [selectedModel, setSelectedModel] = useState('gpt-5.2');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const lastScrollTop = useRef(0);

  const models = [
    { id: 'gpt-5.2', name: 'GPT-5.2' },
    { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro' },
    { id: 'gpt-5.1', name: 'GPT-5.1' },
    { id: 'gpt-5', name: 'GPT-5' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ];

  useEffect(() => {
    if (!isUserScrolling) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isUserScrolling]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;

    // User is scrolling up if scrollTop decreased
    if (scrollTop < lastScrollTop.current) {
      setIsUserScrolling(true);
    }

    // If user scrolled to near bottom, re-enable auto scroll
    if (scrollHeight - scrollTop - clientHeight < 100) {
      setIsUserScrolling(false);
    }

    lastScrollTop.current = scrollTop;
  };

  // Reset scroll state when loading starts
  useEffect(() => {
    if (isLoading) {
      setIsUserScrolling(false);
    }
  }, [isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const sendMessage = () => {
    if (!input.trim() || isLoading) return;

    const messageToSend = input.trim();
    setInput('');
    onSendMessage(messageToSend, autoTranslateToEnglish, selectedModel);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Only prevent default for Enter key (without Shift)
    // All other keys including Cmd+A, Cmd+Z work with default browser behavior
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.nativeEvent.isComposing) {
        return;
      }
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6" onScroll={handleScroll} ref={messagesContainerRef}>
        {!currentThread ? (
          <div className="h-full flex items-center justify-center text-gray-400 px-4">
            <div className="text-center max-w-md">
              <div className="w-14 h-14 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
                <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="text-base text-gray-900">Start a new conversation</p>
              <p className="text-sm mt-1.5 text-gray-500">Ask questions and learn together</p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onAddBookmark={onAddBookmark}
                onRequestTranslation={onRequestTranslation}
                onJumpToTranslation={onJumpToTranslation}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 p-6 bg-white flex-shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="w-full p-3 pr-14 border border-gray-200 rounded-2xl resize-y min-h-[48px] max-h-[144px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-[15px] leading-relaxed scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
              rows={1}
              style={{ resize: 'vertical' }}
            />
            <button
              type={isLoading ? "button" : "submit"}
              onClick={isLoading ? (e) => { e.preventDefault(); onStop(); } : undefined}
              disabled={!isLoading && !input.trim()}
              className={`absolute right-3 bottom-3 w-9 h-9 text-white rounded-xl flex items-center justify-center transition-all shadow-sm hover:shadow-md ${isLoading
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
            >
              {isLoading ? (
                <Square className="w-4 h-4 fill-current" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-gray-50 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={autoTranslateResponses}
                  onChange={() => onToggleAutoTranslate()}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div className="flex items-center gap-1.5 select-none">
                  <Sparkles className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs text-gray-700 font-medium">Auto Translate</span>
                </div>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleTranslationPanel}
                disabled={messages.filter(m => m.role === 'assistant' && m.translatedContent).length === 0}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${showTranslationPanel
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Translation Panel
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModelSelector(!showModelSelector)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{models.find(m => m.id === selectedModel)?.name}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showModelSelector && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModelSelector(false)} />
                    <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-50 min-w-[140px]">
                      {models.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(model.id);
                            setShowModelSelector(false);
                          }}
                          className={`w-full px-3 py-2 text-xs text-left hover:bg-gray-50 transition-colors font-medium ${selectedModel === model.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                            }`}
                        >
                          {model.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}