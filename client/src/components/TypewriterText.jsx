import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

export default function TypewriterText({ content, animate = false, onUpdate }) {
    const [displayedText, setDisplayedText] = useState(animate ? "" : content);
    const hasAnimated = useRef(!animate); // If not animating, mark as done

    useEffect(() => {
        if (hasAnimated.current) {
            setDisplayedText(content);
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
    }, [content, animate, onUpdate]);

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
