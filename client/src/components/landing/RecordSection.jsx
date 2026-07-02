import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '../../lib/gsap';

const VOICES = [
  {
    text: 'I was 7, and it was raining.\nMy dad had-',
    attr: 'Priya, 24',
  },
  {
    text: 'My grandmother’s hands\nsmelled like turmeric-',
    attr: 'Arjun, 31',
  },
  {
    text: 'The kitchen in November.\nThat sound she made-',
    attr: 'Nadia, 28',
  },
];

export default function RecordSection() {
  const wrapperRef = useRef(null);
  const questionRef = useRef(null);
  const voiceWrapRefs = useRef([null, null, null]);
  const voiceFog1Refs = useRef([null, null, null]);
  const voiceFog2Refs = useRef([null, null, null]);
  const captionRef = useRef(null);
  const yourTurnRef = useRef(null);
  const recDotRef = useRef(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      if (questionRef.current) questionRef.current.style.opacity = '1';
      voiceWrapRefs.current.forEach(el => { if (el) el.style.opacity = '0'; });
      if (voiceWrapRefs.current[0]) voiceWrapRefs.current[0].style.opacity = '1';
      if (captionRef.current) captionRef.current.style.opacity = '1';
      if (yourTurnRef.current) yourTurnRef.current.style.opacity = '1';
      return;
    }

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: wrapperRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.9,
        onUpdate(self) {
          const p = self.progress;

          // Question: p 0 → 0.10
          const qT = Math.min(1, p / 0.10);
          gsap.set(questionRef.current, { opacity: qT, y: (1 - qT) * 24 });
          if (recDotRef.current) gsap.set(recDotRef.current, { opacity: qT });

          // Voice 1: in 0.12→0.30, fog 0.36→0.48
          const v1In = p > 0.12 ? Math.min(1, (p - 0.12) / 0.18) : 0;
          const v1Fog = p > 0.36 ? Math.min(1, (p - 0.36) / 0.12) : 0;
          const v1Wrap = voiceWrapRefs.current[0];
          if (v1Wrap) gsap.set(v1Wrap, { opacity: v1In * (1 - v1Fog), y: (1 - Math.min(1, v1In)) * 22 });
          if (voiceFog1Refs.current[0]) gsap.set(voiceFog1Refs.current[0], { opacity: v1Fog });
          if (voiceFog2Refs.current[0]) gsap.set(voiceFog2Refs.current[0], { opacity: v1Fog * 0.55 });

          // Voice 2: in 0.48→0.62, fog 0.63→0.73
          const v2In = p > 0.44 ? Math.min(1, (p - 0.44) / 0.14) : 0;
          const v2Fog = p > 0.68 ? Math.min(1, (p - 0.68) / 0.10) : 0;
          const v2Wrap = voiceWrapRefs.current[1];
          if (v2Wrap) gsap.set(v2Wrap, { opacity: v2In * (1 - v2Fog), y: (1 - Math.min(1, v2In)) * 22 });
          if (voiceFog1Refs.current[1]) gsap.set(voiceFog1Refs.current[1], { opacity: v2Fog });
          if (voiceFog2Refs.current[1]) gsap.set(voiceFog2Refs.current[1], { opacity: v2Fog * 0.55 });

          // Voice 3: in 0.73→0.83, fog 0.82→0.90
          const v3In = p > 0.70 ? Math.min(1, (p - 0.70) / 0.12) : 0;
          const v3Fog = p > 0.90 ? Math.min(1, (p - 0.90) / 0.06) : 0;
          const v3Wrap = voiceWrapRefs.current[2];
          if (v3Wrap) gsap.set(v3Wrap, { opacity: v3In * (1 - v3Fog), y: (1 - Math.min(1, v3In)) * 22 });
          if (voiceFog1Refs.current[2]) gsap.set(voiceFog1Refs.current[2], { opacity: v3Fog });
          if (voiceFog2Refs.current[2]) gsap.set(voiceFog2Refs.current[2], { opacity: v3Fog * 0.55 });

          // Caption: 0.78 → 0.90
          const cT = p > 0.88 ? Math.min(1, (p - 0.88) / 0.07) : 0;
          if (captionRef.current) gsap.set(captionRef.current, { opacity: cT, y: (1 - cT) * 20 });

          // "Your turn": 0.88 → 1.0
          const ytT = p > 0.94 ? Math.min(1, (p - 0.94) / 0.06) : 0;
          if (yourTurnRef.current) gsap.set(yourTurnRef.current, { opacity: ytT, y: (1 - ytT) * 16 });
        },
      });
    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={wrapperRef} id="record" style={{ height: '320vh' }}>
      <section style={{ position: 'sticky', top: 0, height: '100vh' }} className="record-section">

        {/* Recording indicator */}
        <div className="record-indicator">
          <div ref={recDotRef} className="record-dot" style={{ opacity: 0 }} />
          <span>Jeevani</span>
        </div>

        <div className="record-center">
          {/* Question */}
          <div ref={questionRef} className="record-question" style={{ opacity: 0, transform: 'translateY(24px)' }}>
            What's your earliest memory?
            <span className="record-cursor" />
          </div>

          {/* Overlapping voice stack */}
          <div className="record-voices-stack">
            {VOICES.map((voice, i) => (
              <div
                key={i}
                ref={el => { voiceWrapRefs.current[i] = el; }}
                className="record-voice-wrap"
                style={{ opacity: 0, transform: 'translateY(22px)' }}
              >
                <div className="record-answer" style={{ whiteSpace: 'pre-line' }}>{voice.text}</div>
                <div className="record-voice-attr">{voice.attr}</div>
                {/* Parallax fog — bottom layer (heavy) */}
                <div
                  ref={el => { voiceFog1Refs.current[i] = el; }}
                  className="record-fog-bottom"
                  style={{ opacity: 0 }}
                />
                {/* Parallax fog — top layer (atmospheric) */}
                <div
                  ref={el => { voiceFog2Refs.current[i] = el; }}
                  className="record-fog-top"
                  style={{ opacity: 0 }}
                />
              </div>
            ))}
          </div>

          {/* Caption — appears after voices fade */}
          <div ref={captionRef} className="record-caption" style={{ opacity: 0, transform: 'translateY(20px)' }}>
            <div className="record-caption-main">Your real story deserves more than a draft.</div>
            <div className="record-caption-sub">10 minutes a week. A memoir for generations.</div>
          </div>

          {/* "Your turn" prompt */}
          <div ref={yourTurnRef} className="record-yourturn" style={{ opacity: 0, transform: 'translateY(16px)' }}>
            What's yours?<span className="record-cursor" />
          </div>
        </div>
      </section>
    </div>
  );
}
