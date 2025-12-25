import React, { useState, useEffect } from 'react';
import { X, Loader2, BookmarkPlus, BookmarkCheck } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface WordPopoverProps {
  text: string;
  position: { x: number; y: number };
  onClose: () => void;
  onAddBookmark: (text: string, translation: string, type: 'word' | 'sentence') => void;
  placement?: 'top' | 'bottom';
}

export function WordPopover({ text, position, onClose, onAddBookmark, placement = 'top' }: WordPopoverProps) {
  const [translation, setTranslation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    translateText();
  }, [text]);

  const translateText = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/translate-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTranslation(data.translation);
      }
    } catch (error) {
      console.error('Error translating text:', error);
      setTranslation('Translation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookmark = () => {
    const type = text.split(' ').length === 1 ? 'word' : 'sentence';
    onAddBookmark(text, translation, type);
    setIsBookmarked(true);
  };

  const isWord = text.split(' ').length === 1;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div
        className="fixed z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 w-80"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: placement === 'top'
            ? 'translate(-50%, -100%) translateY(-10px)'
            : 'translate(-50%, 10px)',
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1.5">
              {isWord ? 'Word' : 'Sentence'}
            </div>
            <div className="text-blue-600 text-sm">{text}</div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <div className="text-xs text-gray-500 mb-1.5">Korean translation</div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Translating...
            </div>
          ) : (
            <div className="text-gray-900 text-sm leading-relaxed">{translation}</div>
          )}
        </div>

        {!isLoading && translation && (
          <button
            onClick={handleBookmark}
            disabled={isBookmarked}
            className={`mt-3 w-full py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-all ${isBookmarked
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              }`}
          >
            {isBookmarked ? (
              <>
                <BookmarkCheck className="w-4 h-4" />
                Bookmarked
              </>
            ) : (
              <>
                <BookmarkPlus className="w-4 h-4" />
                Add to bookmarks
              </>
            )}
          </button>
        )}
      </div>
    </>
  );
}