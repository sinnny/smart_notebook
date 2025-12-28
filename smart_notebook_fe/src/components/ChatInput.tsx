import React, { useState, useRef, KeyboardEvent } from "react";
import { Send, Square, ChevronDown, Sparkles } from "lucide-react";
import { useAutoResizeTextArea } from "./ChatHooks";

/** 🔑 ChatGPT-style baseline constants */
const TEXT_PADDING = 6; // textarea 내부 padding (상하좌우)
const BUTTON_GAP = 8; // 버튼과 텍스트 간 거리
const MAX_HEIGHT = 168; // ~5 lines

interface ChatInputProps {
  isLoading: boolean;
  onSendMessage: (
    content: string,
    translateToEnglish: boolean,
    model: string
  ) => void;
  onStop: () => void;
  autoTranslateResponses: boolean;
  onToggleAutoTranslate: () => void;
  showTranslationPanel: boolean;
  onToggleTranslationPanel: () => void;
}

export function ChatInput({
  isLoading,
  onSendMessage,
  onStop,
  autoTranslateResponses,
  onToggleAutoTranslate,
  showTranslationPanel,
  onToggleTranslationPanel,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-5.2");
  const [showModelSelector, setShowModelSelector] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const models = [
    "gpt-5.2",
    "gpt-5.",
    "gpt-5-mini",
    "gpt-5.2-pro",
    "gpt-5-nano",
    "gpt-4o-mini",
  ];

  // Use extracted hook for auto-resize
  useAutoResizeTextArea(textareaRef, input, MAX_HEIGHT);

  const sendMessage = () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    // Always translate to English by default as per previous logic "autoTranslateToEnglish: true"
    onSendMessage(text, true, selectedModel);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if ((e.nativeEvent as any).isComposing) return;
      e.preventDefault();
      sendMessage();
    }
  };

  return (
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
                ${
                  isLoading
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
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 hover:bg-gray-100 rounded-2xl transition-colors">
              <input
                type="checkbox"
                checked={autoTranslateResponses}
                onChange={onToggleAutoTranslate}
                className="
                                    appearance-none w-4 h-4 
                                    border-2 border-gray-300 rounded-[5px]
                                    bg-white transition-all duration-200
                                    cursor-pointer relative
                                    hover:border-blue-400
                                    focus:outline-none focus:ring-2 focus:ring-blue-500/20
                                    checked:bg-blue-600 checked:border-blue-600
                                    after:content-[''] after:absolute after:left-[3.5px] after:top-[1px]
                                    after:w-[4px] after:h-[7.5px] after:border-white after:border-r-2 
                                    after:border-b-2 after:rotate-45 after:scale-0 checked:after:scale-100
                                    after:transition-transform after:duration-200
                                "
              />
              <div className="flex items-center gap-1.5 select-none">
                <Sparkles className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-700 font-medium whitespace-nowrap">
                  Auto Translate
                </span>
              </div>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTranslationPanel}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-xs ${
                showTranslationPanel
                  ? "bg-blue-50 text-blue-600"
                  : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Translation Panel
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModelSelector((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-xs"
              >
                {/* Stack all models in a grid to determine the widest width dynamically */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                  }}
                  className="text-left"
                >
                  {models.map((m) => (
                    <span
                      key={m}
                      style={{
                        gridColumn: "1 / -1",
                        gridRow: "1 / -1",
                        visibility: m === selectedModel ? "visible" : "hidden",
                        whiteSpace: "nowrap",
                      }}
                      aria-hidden={m !== selectedModel}
                    >
                      {m}
                    </span>
                  ))}
                </div>
                <ChevronDown className="w-3 h-3 flex-shrink-0 ml-1" />
              </button>

              {showModelSelector && (
                <div className="absolute right-0 bottom-full mb-2 bg-white border rounded-xl shadow-lg w-max min-w-[8rem] z-50">
                  {models.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setSelectedModel(m);
                        setShowModelSelector(false);
                      }}
                      className="block w-full px-3 py-2 text-left hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl whitespace-nowrap text-xs"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
