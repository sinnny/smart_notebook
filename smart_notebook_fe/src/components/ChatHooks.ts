import { useEffect, useRef, RefObject } from 'react';
import { Message } from '../App';

/**
 * STRICT CHAT SCROLL IMPLEMENTATION
 * 
 * Rules:
 * 1. ONLY scroll when a new USER message is added.
 * 2. ONLY scroll if it is the 2nd message or later.
 * 3. Scroll the new USER message to the TOP of the viewport.
 * 4. NEVER auto-scroll during assistant streaming.
 */
export function useStrictChatScroll(
    scrollContainerRef: RefObject<HTMLDivElement | null>,
    messages: Message[]
) {
    const prevMessagesLengthRef = useRef(messages.length);

    useEffect(() => {
        const prevLength = prevMessagesLengthRef.current;
        const currentLength = messages.length;

        // Only trigger if a NEW message was added
        if (currentLength > prevLength) {
            const lastMessage = messages[currentLength - 1];

            // CRITICAL: Only scroll for USER messages, and only if it's not the very first one
            if (lastMessage.role === 'user' && currentLength > 1) {
                const messageId = lastMessage.id;

                // Use double requestAnimationFrame to ensure layout is fully finalized
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const container = scrollContainerRef.current;
                        if (!container) return;

                        // Use container scoped query selector
                        const element = container.querySelector(
                            `[data-message-id="${messageId}"]`
                        ) as HTMLElement;

                        if (element) {
                            // Check if there's actual overflow to scroll
                            const hasOverflow = container.scrollHeight > container.clientHeight;

                            // Only scroll if there's overflow (content exceeds viewport)
                            if (!hasOverflow) {
                                return; // Content fits in viewport, no need to scroll
                            }

                            // Use getBoundingClientRect for precise positioning
                            const containerRect = container.getBoundingClientRect();
                            const elementRect = element.getBoundingClientRect();

                            // Calculate how far the element is from the top of the container
                            const relativePosition = elementRect.top - containerRect.top;

                            // Current scroll position
                            const currentScroll = container.scrollTop;

                            // Target scroll position with comfortable top margin
                            const topMargin = 24; // px of breathing room at top
                            const targetScroll = currentScroll + relativePosition - topMargin;

                            // Scroll to position the element near the top with margin
                            container.scrollTo({
                                top: Math.max(0, targetScroll), // Don't scroll to negative
                                behavior: 'smooth'
                            });
                        }
                    });
                });
            }
        }

        // Update ref for next render
        prevMessagesLengthRef.current = currentLength;
    }, [messages, scrollContainerRef]);
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
