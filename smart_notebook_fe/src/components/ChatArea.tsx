import { useRef, useState, useEffect } from "react";
import { Message, Thread } from "../App";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { useStrictChatScroll } from "./ChatHooks";

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Track if content naturally exceeds viewport (before spacer)
  const [hasNaturalOverflow, setHasNaturalOverflow] = useState(false);

  // Track when main assistant response completes (debounced content stability)
  const [isMainResponseComplete, setIsMainResponseComplete] = useState(false);
  const contentStabilityTimer = useRef<number | null>(null);

  // Use strict scroll hook
  useStrictChatScroll(scrollContainerRef, messages);

  // Calculate user message count for spacer logic
  const userMessageCount = messages.filter((m) => m.role === "user").length;

  const lastMessage = messages[messages.length - 1];

  // Detect when main assistant response completes
  // Main response is complete when assistant content stops changing
  useEffect(() => {
    // Clear existing timer
    if (contentStabilityTimer.current) {
      clearTimeout(contentStabilityTimer.current);
    }

    // Reset completion flag when loading starts or when new user message added
    if (isLoading && lastMessage?.role === "user") {
      setIsMainResponseComplete(false);
      return;
    }

    // If we have an assistant message with content
    if (lastMessage?.role === "assistant" && lastMessage.content) {
      // Set a short timer - if content doesn't change in 100ms, consider it complete

      contentStabilityTimer.current = setTimeout(() => {
        setIsMainResponseComplete(true);
      }, 100);
    }

    return () => {
      if (contentStabilityTimer.current) {
        clearTimeout(contentStabilityTimer.current);
      }
    };
  }, [lastMessage, isLoading]);

  // Measure natural overflow after each message update
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      // Check overflow BEFORE spacer is rendered
      const overflow = container.scrollHeight > container.clientHeight;
      setHasNaturalOverflow(overflow);
    }
  }, [messages]);

  // Spacer logic: Show ONLY while main response is streaming
  // Disappears when main response completes, NOT when translation finishes
  const shouldShowSpacer =
    userMessageCount >= 2 &&
    isLoading &&
    !isMainResponseComplete &&
    hasNaturalOverflow;

  return (
    <div className="flex flex-col h-full w-full">
      {/* ================= Messages ================= */}
      <div
        className="flex-1 overflow-y-auto p-6"
        ref={scrollContainerRef}
        style={{
          paddingBottom: "2rem", // Small breathing room at bottom
        }}
      >
        {!currentThread ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            Start a new conversation
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((m) => (
              <div key={m.id}>
                <MessageBubble
                  message={m}
                  onAddBookmark={onAddBookmark}
                  onRequestTranslation={onRequestTranslation}
                  onJumpToTranslation={onJumpToTranslation}
                />
              </div>
            ))}

            {/* Spacer ONLY during main response streaming */}
            {/* Decoupled from translation panel lifecycle */}
            {shouldShowSpacer && (
              <div
                aria-hidden
                style={{
                  height: "70vh",
                  minHeight: "70vh",
                  width: "100%",
                  flexShrink: 0,
                }}
              />
            )}
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
