import { useEffect } from 'react';
import { motion } from 'framer-motion';

const WORD = 'Jeevani';
const STAGGER   = 0.065;  // 65ms between each letter
const LETTER_DUR = 0.48;  // each letter fade duration
// slow-in fast-out: hesitates, then commits — like choosing a word carefully
const LETTER_EASE = [0.22, 0, 0.08, 1];

export default function Preloader({ onComplete }) {
  useEffect(() => {
    // Hold for 2.2s before handing off; AnimatePresence exit adds 0.65s fade
    const t = setTimeout(onComplete, 2200);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: '#05060A' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
    >
      <div style={{ position: 'relative', display: 'inline-block' }}>

        {/* Word — each letter fades in with a left-to-right stagger */}
        <div style={{ whiteSpace: 'nowrap' }}>
          {WORD.split('').map((ch, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                delay: 0.3 + i * STAGGER,
                duration: LETTER_DUR,
                ease: LETTER_EASE,
              }}
              style={{
                display: 'inline',
                fontFamily: "'Playfair Display', Georgia, serif",
                fontWeight: 700,
                fontSize: 'min(130px, 16vw)',
                color: '#F0EDE8',
                letterSpacing: '0.03em',
                lineHeight: 1,
              }}
            >
              {ch}
            </motion.span>
          ))}
        </div>

        {/* Underline — a single amber stroke drawn left to right */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1.05, duration: 0.36, ease: 'linear' }}
          style={{
            position: 'absolute',
            bottom: -12,
            left: 0,
            right: 0,
            height: 1,
            background: '#F2C94C',
            transformOrigin: 'left center',
          }}
        />

      </div>
    </motion.div>
  );
}
