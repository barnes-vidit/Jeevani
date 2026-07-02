import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const FULL_TEXT = `Chapter One

My grandmother's hands smelled of cardamom and old photographs.

Every Sunday she would sit by the window, the afternoon light catching the silver in her hair, and tell me about a place I had never seen but somehow already knew.

She called it home.`;

const TAGS = ['Childhood', 'Family', 'Career', 'Travels', 'Legacy'];

export default function MemoirVisual({ scrollProgressRef, onRegisterUpdate }) {
  const [displayedText, setDisplayedText] = useState('');
  const [pageTurned, setPageTurned] = useState(false);
  const containerRef = useRef(null);
  const typingRef = useRef(null);
  const pageTurnedRef = useRef(false);

  // Start typing when section enters viewport
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          let i = 0;
          typingRef.current = setInterval(() => {
            i++;
            setDisplayedText(FULL_TEXT.slice(0, i));
            if (i >= FULL_TEXT.length) clearInterval(typingRef.current);
          }, 26);
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      if (typingRef.current) clearInterval(typingRef.current);
    };
  }, []);

  // Register update handler to receive scroll progress imperatively
  useEffect(() => {
    onRegisterUpdate?.((p) => {
      if (p > 0.5 && !pageTurnedRef.current) {
        pageTurnedRef.current = true;
        setPageTurned(true);
      }
    });
    return () => onRegisterUpdate?.(null);
  }, [onRegisterUpdate]);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2.5rem', width: '100%' }}>
      {/* Book */}
      <div className="book-scene" style={{ width: '100%', height: 340 }}>
        <div className="book-wrapper">
          <div className="book-spine" />
          <div className="book-pages-container">
            {/* Left page */}
            <div className="book-page book-page-left">
              <div className="book-text-line title" />
              <div className="book-text-line long" />
              <div className="book-text-line med" />
              <div className="book-text-line long" />
              <div className="book-text-line short" />
              <div style={{ height: 16 }} />
              <div className="book-text-line long" />
              <div className="book-text-line med" />
              <div className="book-text-line long" />
              <div className="book-text-line accent" />
              <div style={{ flex: 1 }} />
              <div className="book-page-number left">i</div>
            </div>

            {/* Right page with page-turn */}
            <div className={`book-page-right ${pageTurned ? 'turned' : ''}`}>
              <div className="book-page">
                <p className="book-text-typed">{displayedText}</p>
                <div className="book-page-number right">1</div>
              </div>
              <div className="book-page-back">
                <div className="book-text-line title" />
                <div className="book-text-line long" />
                <div className="book-text-line med" />
                <div className="book-text-line long" />
                <div className="book-text-line short" />
                <div style={{ height: 12 }} />
                <div className="book-text-line accent" />
                <div className="book-text-line long" />
                <div className="book-text-line med" />
                <div className="book-page-number right">2</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating tags */}
      <div className="memoir-tags">
        {TAGS.map((tag, i) => (
          <motion.div
            key={tag}
            className="memoir-tag"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, delay: i * 0.08, ease: 'easeOut' }}
          >
            {tag}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
