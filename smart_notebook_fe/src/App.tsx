import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { TranslationPanel } from "./components/TranslationPanel";
import { Menu } from "lucide-react";
import {
  projectId,
  publicAnonKey,
} from "./utils/supabase/info";
import { API_BASE_URL } from "./utils/api";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  originalLanguage?: "ko" | "en";
  translatedContent?: string;
}

export interface Thread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  threadId: string;
  text: string;
  translation: string;
  type: "word" | "sentence";
  createdAt: string;
}

function App() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThread, setCurrentThread] =
    useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showTranslationPanel, setShowTranslationPanel] =
    useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoTranslateResponses, setAutoTranslateResponses] =
    useState(true);
  const [bookmarkedThreads, setBookmarkedThreads] = useState<
    Thread[]
  >([]);
  const [translationPanelWidth, setTranslationPanelWidth] =
    useState(450);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  useEffect(() => {
    loadThreads();
    loadBookmarkedThreads();
  }, []);

  useEffect(() => {
    if (currentThread) {
      loadMessages(currentThread.id);
      loadBookmarks(currentThread.id);
    }
  }, [currentThread]);

  const loadThreads = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/threads`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );
      if (response.ok) {
        const data = await response.json();
        const validThreads = (data.threads || []).filter(
          (t: Thread | null) => t != null,
        );
        setThreads(validThreads);
      }
    } catch (error) {
      console.error("Error loading threads:", error);
    }
  };

  const loadBookmarkedThreads = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/bookmarked-threads`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );
      if (response.ok) {
        const data = await response.json();
        const validThreads = (data.threads || []).filter(
          (t: Thread | null) => t != null,
        );
        setBookmarkedThreads(validThreads);
      }
    } catch (error) {
      console.error("Error loading bookmarked threads:", error);
    }
  };

  const loadMessages = async (threadId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/threads/${threadId}/messages`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const loadBookmarks = async (threadId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/bookmarks/${threadId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );
      if (response.ok) {
        const data = await response.json();
        setBookmarks(data.bookmarks || []);
      }
    } catch (error) {
      console.error("Error loading bookmarks:", error);
    }
  };

  const stopMessageGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const createThread = async () => {
    stopMessageGeneration();
    try {
      const response = await fetch(
        `${API_BASE_URL}/threads`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "새로운 대화 / New conversation",
          }),
        },
      );
      if (response.ok) {
        const data = await response.json();
        const newThreads = [data.thread, ...threads].filter(
          (t) => t != null,
        );
        setThreads(newThreads);
        setCurrentThread(data.thread);
        setMessages([]);
      }
    } catch (error) {
      console.error("Error creating thread:", error);
    }
  };

  const sendMessage = async (
    content: string,
    translateToEnglish: boolean,
    model: string,
  ) => {
    let threadToUse = currentThread;

    // Create thread if none exists
    if (!threadToUse) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/threads`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title:
                content.slice(0, 50) +
                (content.length > 50 ? "..." : ""),
            }),
          },
        );
        if (response.ok) {
          const data = await response.json();
          threadToUse = data.thread;
          setCurrentThread(threadToUse);
          setThreads([data.thread, ...threads]);
        } else {
          console.error("Failed to create thread");
          return;
        }
      } catch (error) {
        console.error("Error creating thread:", error);
        return;
      }
    }

    stopMessageGeneration();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/chat`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            threadId: threadToUse.id,
            message: content,
            translateToEnglish,
            autoTranslateResponses,
            model,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error sending message:", errorText);
        alert(
          "Failed to send message. Check console for details.",
        );
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        console.error("No reader available");
        return;
      }

      let userMessageId = "";
      let assistantMessageId = "";
      let accumulatedUserTranslation = "";
      let accumulatedAssistantContent = "";
      let accumulatedAssistantTranslation = "";
      let phase = "init";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              continue;
            }

            if (data.startsWith("[USER_MESSAGE:")) {
              const messageData = JSON.parse(
                data.slice(14, -1),
              );
              userMessageId = messageData.id;
              // Add user message with all data
              setMessages((prev) => {
                // Check if already exists
                if (prev.some((m) => m.id === messageData.id)) {
                  return prev;
                }
                return [
                  ...prev,
                  {
                    id: messageData.id,
                    role: "user" as const,
                    content: messageData.content,
                    originalLanguage:
                      messageData.originalLanguage,
                    translatedContent:
                      messageData.translatedContent,
                  },
                ];
              });
              continue;
            }

            if (data === "[PHASE:TRANSLATING]") {
              phase = "translating";
              continue;
            }

            if (data.startsWith("[ASSISTANT_MESSAGE_ID:")) {
              const messageId = data.slice(22, -1);
              assistantMessageId = messageId;
              console.log(
                "Received assistant message ID:",
                messageId,
              );
              continue;
            }

            if (data === "[PHASE:RESPONDING]") {
              phase = "responding";
              continue;
            }

            if (data === "[PHASE:TRANSLATING_RESPONSE]") {
              phase = "translating-response";
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              if (phase === "translating") {
                accumulatedUserTranslation +=
                  parsed.content || "";
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === userMessageId
                      ? {
                        ...m,
                        translatedContent:
                          accumulatedUserTranslation,
                      }
                      : m,
                  ),
                );
              } else if (phase === "responding") {
                accumulatedAssistantContent +=
                  parsed.content || "";
                setMessages((prev) => {
                  const existing = prev.find(
                    (m) => m.id === assistantMessageId,
                  );
                  if (existing) {
                    return prev.map((m) =>
                      m.id === assistantMessageId
                        ? {
                          ...m,
                          content:
                            accumulatedAssistantContent,
                        }
                        : m,
                    );
                  } else {
                    // Only create if we have an assistantMessageId
                    if (!assistantMessageId) {
                      console.error(
                        "No assistant message ID available",
                      );
                      return prev;
                    }
                    return [
                      ...prev,
                      {
                        id: assistantMessageId,
                        role: "assistant" as const,
                        content: accumulatedAssistantContent,
                      },
                    ];
                  }
                });
              } else if (phase === "translating-response") {
                accumulatedAssistantTranslation +=
                  parsed.content || "";
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? {
                        ...m,
                        translatedContent:
                          accumulatedAssistantTranslation,
                      }
                      : m,
                  ),
                );
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      loadThreads(); // Refresh thread list to update titles
    } catch (error) {
      console.error("Error sending message:", error);
      alert(
        "Failed to send message. Check console for details.",
      );
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const requestTranslation = async (messageId: string) => {
    if (!currentThread) return;

    console.log(
      "Requesting translation for message:",
      messageId,
    );
    console.log("Current thread:", currentThread.id);
    console.log(
      "Current messages:",
      messages.map((m) => ({ id: m.id, role: m.role })),
    );

    setIsLoading(true);
    setShowTranslationPanel(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/translate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            threadId: currentThread.id,
            messageId,
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
      } else {
        const errorText = await response.text();
        console.error(
          "Error requesting translation:",
          errorText,
        );
        alert(
          "Failed to request translation. Check console for details.",
        );
      }
    } catch (error) {
      console.error("Error requesting translation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addBookmark = async (
    text: string,
    translation: string,
    type: "word" | "sentence",
  ) => {
    if (!currentThread) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/bookmarks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            threadId: currentThread.id,
            text,
            translation,
            type,
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        setBookmarks([data.bookmark, ...bookmarks]);
      }
    } catch (error) {
      console.error("Error adding bookmark:", error);
    }
  };

  const deleteThread = async (threadId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/threads/${threadId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      if (response.ok) {
        setThreads(threads.filter((t) => t.id !== threadId));
        if (currentThread?.id === threadId) {
          setCurrentThread(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error("Error deleting thread:", error);
    }
  };

  const toggleBookmarkThread = async (threadId: string) => {
    const thread = threads.find((t) => t.id === threadId);
    const isBookmarked = bookmarkedThreads.some(
      (t) => t.id === threadId,
    );

    try {
      const response = await fetch(
        `${API_BASE_URL}/bookmarked-threads/${isBookmarked ? "remove" : "add"}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ threadId }),
        },
      );

      if (response.ok) {
        if (isBookmarked) {
          setBookmarkedThreads(
            bookmarkedThreads.filter((t) => t.id !== threadId),
          );
        } else {
          if (thread) {
            setBookmarkedThreads([
              ...bookmarkedThreads,
              thread,
            ]);
          }
        }
      } else {
        console.error("Failed to toggle thread bookmark");
      }
    } catch (error) {
      console.error("Error toggling thread bookmark:", error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Hamburger menu when sidebar is closed */}
      {!sidebarOpen && (
        <div className="fixed top-4 left-4 z-40">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      )}

      {sidebarOpen && (
        <div className="w-72 flex-shrink-0">
          <Sidebar
            threads={threads}
            currentThread={currentThread}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
            onSelectThread={(thread) => {
              if (currentThread?.id !== thread.id) {
                stopMessageGeneration();
                setCurrentThread(thread);
              }
            }}
            onCreateThread={createThread}
            onDeleteThread={deleteThread}
            bookmarks={bookmarks}
            onToggleBookmarkThread={toggleBookmarkThread}
            bookmarkedThreads={bookmarkedThreads}
          />
        </div>
      )}

      <div className="flex-1 flex overflow-hidden min-w-0">
        <div className="flex-1 flex flex-col min-w-0">
          <ChatArea
            messages={messages}
            currentThread={currentThread}
            isLoading={isLoading}
            onSendMessage={sendMessage}
            onStop={stopMessageGeneration}
            onRequestTranslation={requestTranslation}
            onAddBookmark={addBookmark}
            showTranslationPanel={showTranslationPanel}
            onToggleTranslationPanel={() =>
              setShowTranslationPanel(!showTranslationPanel)
            }
            autoTranslateResponses={autoTranslateResponses}
            onToggleAutoTranslate={() =>
              setAutoTranslateResponses(!autoTranslateResponses)
            }
          />
        </div>

        {showTranslationPanel && (
          <div
            className="flex-shrink-0 border-l border-gray-200"
            style={{ width: `${translationPanelWidth}px` }}
          >
            <TranslationPanel
              messages={messages}
              onClose={() => setShowTranslationPanel(false)}
              onResize={setTranslationPanelWidth}
              width={translationPanelWidth}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
