import { BookmarkIcon, Menu, MessageSquare, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Bookmark, Thread } from "../App";

interface SidebarProps {
  threads: Thread[];
  currentThread: Thread | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelectThread: (thread: Thread) => void;
  onCreateThread: () => void;
  onDeleteThread: (threadId: string) => void;
  bookmarks: Bookmark[];
  onToggleBookmarkThread?: (threadId: string) => void;
  bookmarkedThreads?: Thread[];
}

export function Sidebar({
  threads,
  currentThread,
  isOpen,
  onToggle,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  bookmarks,
}: SidebarProps) {
  const [viewMode, setViewMode] = useState<"threads" | "bookmarks">("threads");

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 p-2.5 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100"
      >
        <Menu className="w-5 h-5 text-gray-700" />
      </button>
    );
  }

  return (
    <>
      <div className="h-full bg-white border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h1 className="text-lg text-gray-900">Learning Notebook</h1>
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <button
            onClick={onCreateThread}
            className="w-full px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New conversation
          </button>
        </div>

        <div className="flex gap-1 p-4 pb-2">
          <button
            onClick={() => setViewMode("threads")}
            className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-all ${
              viewMode === "threads"
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Threads
          </button>
          <button
            onClick={() => setViewMode("bookmarks")}
            className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-all ${
              viewMode === "bookmarks"
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Bookmarks ({bookmarks.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {viewMode === "threads" ? (
            <div className="px-3 py-2">
              <div className="space-y-1">
                {threads
                  .filter((t) => t != null)
                  .map((thread) => (
                    <div
                      key={thread.id}
                      className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                        currentThread?.id === thread.id
                          ? "bg-gray-100"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() => onSelectThread(thread)}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                        <span className="text-sm truncate text-gray-700">
                          {thread.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteThread(thread.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-gray-200 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="px-3 py-2">
              {bookmarks.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <BookmarkIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No bookmarks yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {bookmarks.map((bookmark) => (
                    <div
                      key={bookmark.id}
                      className="p-3 bg-blue-50 border border-blue-100 rounded-xl"
                    >
                      <div className="text-sm text-blue-700 mb-1">
                        {bookmark.text}
                      </div>
                      <div className="text-xs text-gray-600">
                        {bookmark.translation}
                      </div>
                      <div className="text-xs text-gray-400 mt-1.5">
                        {bookmark.type === "word" ? "📝 Word" : "📄 Sentence"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
