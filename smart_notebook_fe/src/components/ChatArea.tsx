import { useRef, useState, useEffect, useLayoutEffect } from "react";
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
  const messagesContentRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);

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

    // If we have an assistant message, ensure we mark as incomplete while streaming
    if (lastMessage?.role === "assistant") {
      // Always mark as incomplete during active streaming/updates
      setIsMainResponseComplete(false);

      if (lastMessage.content) {
        // Set a timer - if content doesn't change for 500ms, consider it complete
        // Increased from 100ms to 500ms to prevent flickering on slow streams
        contentStabilityTimer.current = setTimeout(() => {
          setIsMainResponseComplete(true);
        }, 500);
      }
    }

    return () => {
      if (contentStabilityTimer.current) {
        clearTimeout(contentStabilityTimer.current);
      }
    };
  }, [lastMessage, isLoading]);

  // Measure natural overflow using the isolated content ref
  // This ensures we measure height WITHOUT the spacer, preventing flickering
  useEffect(() => {
    const container = scrollContainerRef.current;
    const content = messagesContentRef.current;

    if (container && content) {
      // Check if the CONTENT (wrapper) is taller than the CONTAINER
      const overflow = content.scrollHeight > container.clientHeight;
      setHasNaturalOverflow(overflow);
    }
  }, [messages]);

  // Spacer logic: Show ONLY while main response is streaming
  // Disappears when main response completes, NOT when translation finishes
  const shouldShowSpacer =
    userMessageCount >= 2 &&
    !isMainResponseComplete &&
    hasNaturalOverflow;

  // Dynamic spacer sizing
  // As the assistant response grows, we reduce the spacer height
  // This keeps the total scroll height stable and prevents "huge margin" issues
  useLayoutEffect(() => {
    if (shouldShowSpacer && spacerRef.current && scrollContainerRef.current && messagesContentRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === "assistant") {
        // Find the assistant message element
        const lastMsgEl = messagesContentRef.current.querySelector(
          `[data-message-id="${lastMsg.id}"]`
        );

        if (lastMsgEl) {
          const assistantHeight = lastMsgEl.getBoundingClientRect().height;
          const viewportHeight = scrollContainerRef.current.clientHeight;

          // Base spacer is 70% of viewport
          const baseSpacerHeight = viewportHeight * 0.7;

          // Reduce spacer as content grows
          // Math.max(0) ensures it disappears completely when content is long enough
          const newHeight = Math.max(0, baseSpacerHeight - assistantHeight);

          spacerRef.current.style.height = `${newHeight}px`;
        }
      } else {
        // If last message is not assistant (e.g. initial state before AI replies), reset to full
        const viewportHeight = scrollContainerRef.current.clientHeight;
        spacerRef.current.style.height = `${viewportHeight * 0.7}px`;
      }
    }
  }, [messages, shouldShowSpacer]);

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
          <div className="max-w-3xl mx-auto">
            {/* Wrapper for messages to measure natural height */}
            <div ref={messagesContentRef} className="space-y-6">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  onAddBookmark={onAddBookmark}
                  onRequestTranslation={onRequestTranslation}
                  onJumpToTranslation={onJumpToTranslation}
                />
              ))}
            </div>

            {/* Spacer: Dynamically sized via ref */}
            {shouldShowSpacer && (
              <div
                ref={spacerRef}
                aria-hidden
                style={{
                  width: "100%",
                  flexShrink: 0,
                  // Initial height will be set by layout effect, but start with something to avoid jump
                  height: "70vh",
                  transition: "height 0.1s ease-out" // Add subtle transition for smoothness
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
