import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '../../lib/gsap';

const GRID_CELLS = [
  {
    bg: 'linear-gradient(150deg,#4a2c10,#7a4820)',
    caption: 'golden hour ✨',
    realCaption: 'the last evening before she moved away',
    likes: '847',
    phase: 0.0,
  },
  {
    bg: 'linear-gradient(150deg,#0d2044,#163468)',
    caption: 'good vibes only',
    realCaption: 'I didn\'t know it was the last time',
    likes: '1,203',
    phase: 1.1,
  },
  {
    bg: 'linear-gradient(150deg,#4a1010,#7a1c1c)',
    caption: 'living my best life',
    realCaption: 'I cried in the bathroom for twenty minutes',
    likes: '534',
    phase: 2.4,
  },
  {
    bg: 'linear-gradient(150deg,#0c3218,#165228)',
    caption: 'nature 🌿',
    realCaption: 'dad and I, not talking, just walking',
    likes: '692',
    phase: 0.7,
  },
  {
    bg: 'linear-gradient(150deg,#2e0c48,#4e1870)',
    caption: 'the vibe rn',
    realCaption: 'three weeks before the diagnosis',
    likes: '2,104',
    phase: 1.8,
  },
  {
    bg: 'linear-gradient(150deg,#4a3000,#7a5200)',
    caption: 'summer forever 🌅',
    realCaption: 'the night we almost said it',
    likes: '1,887',
    phase: 3.1,
  },
  {
    bg: 'linear-gradient(150deg,#0c1240,#161e66)',
    caption: 'nightout w the crew 🖤',
    realCaption: 'they didn\'t know I was falling apart',
    likes: '943',
    phase: 0.4,
  },
  {
    bg: 'linear-gradient(150deg,#3e2210,#68381c)',
    caption: 'brunch szn 🥞',
    realCaption: 'hiding everything behind a smile',
    likes: '421',
    phase: 2.0,
  },
  {
    bg: 'linear-gradient(150deg,#0c2828,#144040)',
    caption: 'chill day',
    realCaption: 'the loneliest Sunday of my life',
    likes: '318',
    phase: 1.4,
  },
];

export default function ContrastSection() {
  const wrapperRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const centerTextRef = useRef(null);
  const highlight1Ref = useRef(null);
  const highlight2Ref = useRef(null);
  const dividerRef = useRef(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      if (leftRef.current) leftRef.current.style.filter = 'grayscale(80%) brightness(0.5)';
      if (rightRef.current) rightRef.current.style.opacity = '1';
      if (centerTextRef.current) centerTextRef.current.style.opacity = '1';
      if (highlight1Ref.current) highlight1Ref.current.style.color = 'rgba(242,201,76,1)';
      if (highlight2Ref.current) highlight2Ref.current.style.color = 'rgba(242,201,76,1)';
      return;
    }

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: wrapperRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.0,
        onUpdate(self) {
          const p = self.progress;

          if (leftRef.current) {
            // Captions degrade first — text loses meaning before the image does
            const captionT = Math.min(1, p * 2.0);
            const captionEls = leftRef.current.querySelectorAll('.contrast-cell-caption');
            captionEls.forEach((cap, i) => {
              cap.style.opacity = Math.max(0, 1 - captionT * 1.3).toFixed(3);
              cap.style.filter = `blur(${(captionT * 3.5).toFixed(1)}px)`;

              // Glitch flicker: real memory text briefly surfaces as caption degrades
              const inFlickerWindow = captionT > 0.06 && captionT < 0.60;
              if (inFlickerWindow) {
                const wave = Math.sin(captionT * 20 + GRID_CELLS[i].phase);
                cap.textContent = wave > 0.78 ? GRID_CELLS[i].realCaption : GRID_CELLS[i].caption;
              } else if (!inFlickerWindow && captionT <= 0.06) {
                cap.textContent = GRID_CELLS[i].caption;
              }
            });

            // Images degrade after captions start disappearing
            const imageT = Math.min(1, Math.max(0, (p - 0.15) / 0.85));
            const cells = leftRef.current.querySelectorAll('.contrast-grid-cell');
            cells.forEach(cell => {
              cell.style.filter = `grayscale(${imageT * 100}%) brightness(${1 - imageT * 0.62}) blur(${(imageT * 4).toFixed(1)}px)`;
            });
            leftRef.current.style.opacity = (1 - imageT * 0.45).toFixed(3);
          }

          // Right panel glows in as left degrades
          const gT = Math.min(1, p * 1.1);
          if (rightRef.current) {
            rightRef.current.style.opacity = (0.35 + gT * 0.65).toFixed(3);
            rightRef.current.style.boxShadow = `0 0 ${gT * 100}px rgba(242,201,76,${(gT * 0.12).toFixed(3)})`;
          }

          // Divider pulses amber at the midpoint — the pivot moment between the two worlds
          const divT = Math.max(0, Math.sin(Math.min(1, (p - 0.28) / 0.44) * Math.PI));
          if (dividerRef.current) {
            dividerRef.current.style.width = `${1 + divT * 2}px`;
            dividerRef.current.style.background = divT > 0.08
              ? `linear-gradient(to bottom, transparent, rgba(242,201,76,${(0.18 + divT * 0.65).toFixed(2)}), rgba(242,201,76,${(0.18 + divT * 0.65).toFixed(2)}), transparent)`
              : '';
            dividerRef.current.style.boxShadow = divT > 0.08
              ? `0 0 ${(divT * 20).toFixed(0)}px rgba(242,201,76,${(divT * 0.5).toFixed(2)})`
              : '';
          }

          // Key phrases illuminate amber — memoir text literally lights up
          if (highlight1Ref.current) {
            const hT = p > 0.56 ? Math.min(1, (p - 0.56) / 0.22) : 0;
            highlight1Ref.current.style.color = hT > 0.02
              ? `rgba(242,201,76,${(0.55 + hT * 0.45).toFixed(2)})`
              : '';
            highlight1Ref.current.style.textShadow = hT > 0.08
              ? `0 0 ${(hT * 22).toFixed(0)}px rgba(242,201,76,${(hT * 0.32).toFixed(2)})`
              : '';
          }
          if (highlight2Ref.current) {
            const hT = p > 0.72 ? Math.min(1, (p - 0.72) / 0.22) : 0;
            highlight2Ref.current.style.color = hT > 0.02
              ? `rgba(242,201,76,${(0.55 + hT * 0.45).toFixed(2)})`
              : '';
            highlight2Ref.current.style.textShadow = hT > 0.08
              ? `0 0 ${(hT * 22).toFixed(0)}px rgba(242,201,76,${(hT * 0.32).toFixed(2)})`
              : '';
          }

          // Central verdict
          if (centerTextRef.current) {
            const cT = p > 0.58 ? Math.min(1, (p - 0.58) / 0.18) : 0;
            gsap.set(centerTextRef.current, { opacity: cT, y: (1 - cT) * 28 });
          }
        },
      });
    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={wrapperRef} id="story" style={{ height: '250vh' }}>
      <section style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }} className="contrast-section">

        {/* Split layout */}
        <div className="contrast-split">
          {/* LEFT — Social media grid */}
          <div ref={leftRef} className="contrast-left">
            <div className="contrast-left-header">
              <div className="contrast-avatar" />
              <div className="contrast-header-text">
                <div className="contrast-username">your_life_highlights</div>
                <div className="contrast-followers">2,847 followers · 214 posts</div>
              </div>
              <div className="contrast-follow-btn">Follow</div>
            </div>
            <div className="contrast-grid">
              {GRID_CELLS.map((cell, i) => (
                <div key={i} className="contrast-grid-cell" style={{ background: cell.bg }}>
                  <div className="contrast-cell-noise" />
                  <div className="contrast-cell-footer">
                    <span className="contrast-cell-caption">{cell.caption}</span>
                    <span className="contrast-cell-likes">♥ {cell.likes}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vertical divider — pulses amber at the pivot moment */}
          <div ref={dividerRef} className="contrast-divider" />

          {/* RIGHT — Memoir page */}
          <div ref={rightRef} className="contrast-right" style={{ opacity: 0.35 }}>
            <div className="contrast-memoir-chip">Jeevani - Chapter 7</div>
            <h3 className="contrast-memoir-title">The Week Everything Was Exactly Right</h3>
            <div className="contrast-memoir-body">
              <p>
                There was a week in August when everything aligned in a way I've never been able to fully explain.
                Not perfect, but <em>right</em>. The kind of right you only recognise in retrospect, when you're
                lying awake months later trying to hold onto every detail before it fades.
              </p>
              <p>
                Meera had just gotten back from Edinburgh. We spent three days barely sleeping,
                talking about everything we'd missed. The city felt smaller, warmer, ours.
                I kept thinking: <span ref={highlight1Ref} className="contrast-highlight">I need to write this down. Not the photos, but the feeling.</span>
              </p>
              <p ref={highlight2Ref} className="contrast-highlight">
                Jeevani asked me one question that unlocked four hours of stories I'd never told anyone.
              </p>
            </div>
            <div className="contrast-memoir-meta">
              Written by Priya, 24 &nbsp;·&nbsp; August 2024
              <span className="contrast-memoir-words">1,240 words · 4 min read</span>
            </div>
          </div>
        </div>

        {/* Central verdict */}
        <div ref={centerTextRef} className="contrast-center-text" style={{ opacity: 0 }}>
          The difference between a caption
          <span className="contrast-center-accent"> and a chapter.</span>
        </div>
      </section>
    </div>
  );
}
