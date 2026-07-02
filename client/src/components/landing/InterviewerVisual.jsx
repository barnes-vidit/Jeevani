import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gsap } from '../../lib/gsap';

const CONVERSATION = [
  { role: 'ai', text: 'Tell me about your earliest memory of your father.' },
  { role: 'user', text: 'He used to take me fishing every Sunday morning...' },
  { role: 'ai', text: 'What did those Sunday mornings smell like?' },
  { role: 'user', text: 'Old wood, coffee, and river mud. The best smell in the world.' },
  { role: 'ai', text: 'Is there a story from one of those mornings you\'ve never told anyone?' },
];

function TypedBubble({ text, role, onDone }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
        setTimeout(() => onDone?.(), 700);
      }
    }, 36);
    return () => clearInterval(interval);
  }, [text, onDone]);

  return (
    <motion.div
      className={`chat-bubble ${role}`}
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {displayed}
      {!done && <span className="chat-cursor" />}
    </motion.div>
  );
}

export default function InterviewerVisual({ scrollProgressRef, onRegisterUpdate }) {
  const [visibleMessages, setVisibleMessages] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const activeRef = useRef(false);
  const observerRef = useRef(null);
  const containerRef = useRef(null);
  const waveRef = useRef(null);
  const waveAnimRef = useRef(null);

  const addNextMessage = useCallback(() => {
    setCurrentIdx((idx) => {
      if (idx >= CONVERSATION.length) return idx;
      setIsTyping(true);
      // small delay before showing
      setTimeout(() => {
        setIsTyping(false);
        setVisibleMessages((msgs) => {
          if (msgs.length <= idx) {
            return [...msgs, CONVERSATION[idx]];
          }
          return msgs;
        });
      }, 400);
      return idx + 1;
    });
  }, []);

  // Start chat when section scrolls into view (IntersectionObserver)
  useEffect(() => {
    if (!containerRef.current) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !activeRef.current) {
          activeRef.current = true;
          // Kickstart first message
          setTimeout(() => addNextMessage(), 600);
        }
      },
      { threshold: 0.4 }
    );
    observerRef.current.observe(containerRef.current);
    return () => observerRef.current?.disconnect();
  }, [addNextMessage]);

  // Waveform animation
  useEffect(() => {
    if (!waveRef.current) return;
    const path = waveRef.current;
    let t = 0;
    let rafId;
    function animateWave() {
      t += 0.04;
      const points = [];
      for (let x = 0; x <= 200; x += 4) {
        const y = 12 + Math.sin(x / 18 + t) * 5 + Math.sin(x / 9 + t * 1.6) * 2.5;
        points.push(`${x},${y.toFixed(2)}`);
      }
      path.setAttribute('d', `M${points.join(' L')}`);
      rafId = requestAnimationFrame(animateWave);
    }
    animateWave();
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div ref={containerRef} className="chat-window" style={{ width: '100%', maxWidth: 420 }}>
      {/* Header */}
      <div className="chat-header">
        <div className="chat-avatar" />
        <div className="chat-avatar-label">
          Jeevani AI
          <span>Your personal biographer</span>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        <AnimatePresence>
          {visibleMessages.map((msg, i) => (
            <TypedBubble
              key={i}
              text={msg.text}
              role={msg.role}
              onDone={i === visibleMessages.length - 1 && i < CONVERSATION.length - 1 ? addNextMessage : undefined}
            />
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            className="chat-bubble ai"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '0.7rem 1rem' }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(67,97,238,0.6)' }}
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* Waveform */}
      <div className="waveform-container">
        <div className="waveform-dot" />
        <svg className="waveform-svg" viewBox="0 0 200 24" preserveAspectRatio="none">
          <path ref={waveRef} stroke="#4361EE" strokeWidth="1.5" fill="none" strokeOpacity="0.6" />
        </svg>
        <span style={{ fontFamily: 'Inter', fontSize: '0.65rem', color: 'rgba(240,237,232,0.3)', letterSpacing: '0.08em' }}>
          LIVE
        </span>
      </div>
    </div>
  );
}
