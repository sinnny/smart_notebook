import React, { useState, useRef, useEffect } from "react";
import { Send, Square, ChevronDown, Sparkles } from "lucide-react";
import { Message, Thread } from "../App";
import { MessageBubble } from "./MessageBubble";

/** 🔑 ChatGPT-style baseline */
const TEXT_PADDING = 6;   // textarea 내부 padding (상하좌우)
const SIDE_PADDING = 8;  // 입력창 좌측 여백
const BUTTON_GAP = 8;     // 버튼과 텍스트 간 거리
const BUTTON_EDGE = 6;    // 버튼과 오른쪽 border 거리
const MAX_HEIGHT = 168;   // ~5 lines

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
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-5.2");
  const [showModelSelector, setShowModelSelector] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ---------------- Auto-resize textarea ---------------- */
  useEffect(() => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [input]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    onSendMessage(text, true, selectedModel);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if ((e.nativeEvent as any).isComposing) return;
      e.preventDefault();
      sendMessage();
    }
  };

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
      <div className="border-t border-gray-100 bg-white p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="max-w-3xl mx-auto"
        >
          {/* ===== Input Row ===== */}
          <div
            className="
              flex items-center
              rounded-2xl border border-gray-200
              p-2
              focus-within:ring-2 focus-within:ring-blue-500/20
              transition
            "
          >
            {/* Textarea */}
            <div
              className="relative flex-1"
              style={{
                // marginLeft: BUTTON_GAP,
                marginRight: BUTTON_GAP,
                display: "flex",
                alignItems: "center",
              }}
            >

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                rows={1}
                className="
                  w-full resize-none bg-transparent
                  text-[15px] leading-[1.4]
                  focus:outline-none overflow-y-auto
                "
                style={{
                  minHeight: "24px",
                  maxHeight: MAX_HEIGHT,
                  padding: TEXT_PADDING,
                }}
              />
            </div>

            {/* Send / Stop */}
            <div>
              <button
                type="button"
                onClick={isLoading ? onStop : sendMessage}
                disabled={!isLoading && !input.trim()}
                className={`
                  w-9 h-9
                  rounded-xl flex items-center justify-center
                  text-white transition
                  ${isLoading
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
                  }
                `}
              >
                {isLoading ? (
                  <Square className="w-4 h-4 fill-current" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* ===== Bottom Controls ===== */}
          <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoTranslateResponses}
                onChange={onToggleAutoTranslate}
                className="w-4 h-4"
              />
              <Sparkles className="w-3.5 h-3.5" />
              Auto Translate
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModelSelector((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg"
              >
                {selectedModel}
                <ChevronDown className="w-3 h-3" />
              </button>

              {showModelSelector && (
                <div className="absolute right-0 bottom-full mb-2 bg-white border rounded-xl shadow-lg">
                  {["gpt-5.2", "gpt-5.2-pro"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setSelectedModel(m);
                        setShowModelSelector(false);
                      }}
                      className="block w-full px-3 py-2 text-left hover:bg-gray-50"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
