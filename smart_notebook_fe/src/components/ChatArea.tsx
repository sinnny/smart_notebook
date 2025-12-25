import { useRef } from "react";
import { Message, Thread } from "../App";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { useChatScroll } from "./ChatHooks";

interface ChatAreaProps {
  messages: Message[];
  currentThread: Thread | null;
  isLoading: boolean;
  onSendMessage: (
    content: string,
    translateToEnglish: boolean,
    model: string
  ) => void;
  onStop: () => void;
  onRequestTranslation: (messageId: string) => void;
  onAddBookmark: (
    text: string,
    translation: string,
    type: "word" | "sentence"
  ) => void;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use extracted hook for scrolling
  useChatScroll(messagesEndRef, [messages]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* ================= Messages ================= */}
      <div className="flex-1 overflow-y-auto p-6">
        {!currentThread ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            Start a new conversation
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onAddBookmark={onAddBookmark}
                onRequestTranslation={onRequestTranslation}
                onJumpToTranslation={onJumpToTranslation}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ================= Input + Controls ================= */}
      <ChatInput
        isLoading={isLoading}
        onSendMessage={onSendMessage}
        onStop={onStop}
        autoTranslateResponses={autoTranslateResponses}
        onToggleAutoTranslate={onToggleAutoTranslate}
        showTranslationPanel={showTranslationPanel}
        onToggleTranslationPanel={onToggleTranslationPanel}
      />
    </div>
  );
}
