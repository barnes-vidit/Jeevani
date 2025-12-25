import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

export default function TypewriterText({ content, animate = false, onUpdate }) {
    const [displayedText, setDisplayedText] = useState(animate ? "" : content);
    const hasAnimated = useRef(!animate); // If not animating, mark as done

    useEffect(() => {
        // If already animated, show full content
        if (hasAnimated.current) {
            setDisplayedText(content);
            return;
        }

        // Only start if we are supposed to animate and haven't finished yet
        if (!animate) {
            setDisplayedText(content);
            hasAnimated.current = true;
            return;
        }

        let currentIndex = 0;
        const speed = 20; // ms per char

        const interval = setInterval(() => {
            if (currentIndex < content.length) {
                setDisplayedText(content.slice(0, currentIndex + 1));
                currentIndex++;
                if (onUpdate) onUpdate();
            } else {
                clearInterval(interval);
                hasAnimated.current = true;
            }
        }, speed);

        return () => clearInterval(interval);
        // Remove 'content' from dependency to avoid restart on content change (if minor)
        // If content changes significantly, we might WANT to restart, but for this chat, 
        // the content is usually static once set.
        // If streaming, this logic needs adjustment, but for now we are doing full-text receive.
    }, [animate, onUpdate]); // Removed 'content' from dependency to prevent re-triggering

    return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
                components={{
                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-2" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-2" {...props} />,
                    li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                    h1: ({ node, ...props }) => <h1 className="text-lg font-bold mb-2" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-base font-bold mb-2" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-sm font-bold mb-2" {...props} />,
                    blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-primary/30 pl-4 italic mb-2" {...props} />,
                }}
            >
                {displayedText}
            </ReactMarkdown>
        </div>
    );
}
