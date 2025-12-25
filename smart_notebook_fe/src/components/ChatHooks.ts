import { useEffect, RefObject } from 'react';

/**
 * Automatically scrolls to the bottom of the messages container
 * whenever the messages array changes.
 */
export function useChatScroll(
    messagesEndRef: RefObject<HTMLDivElement | null>,
    dependencies: any[]
) {
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, dependencies);
}

/**
 * Automatically resizes the textarea based on its content,
 * up to a specified maximum height.
 */
export function useAutoResizeTextArea(
    textareaRef: RefObject<HTMLTextAreaElement | null>,
    value: string,
    maxHeight: number
) {
    useEffect(() => {
        if (!textareaRef.current) return;
        const el = textareaRef.current;

        // Reset height to auto to correctly calculate scrollHeight for shrinking
        el.style.height = 'auto';

        // Set new height based on scrollHeight, capped at maxHeight
        el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    }, [value, maxHeight]);
}
