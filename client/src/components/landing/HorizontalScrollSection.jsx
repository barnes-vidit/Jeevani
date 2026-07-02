import { useEffect, useRef, useState } from 'react';
import { gsap, ScrollTrigger } from '../../lib/gsap';

const PANELS = [
  {
    number: '01',
    theme: 'Beginnings',
    label: 'one',
    bgClass: 'h-panel-bg-1',
    quote: 'The world was wide and full of wonder.',
    sub: 'Every story starts with a single breath. The first hello, the first morning light, the first wonder.',
  },
  {
    number: '02',
    theme: 'Discovery',
    label: 'two',
    bgClass: 'h-panel-bg-2',
    quote: 'Every question opened a new door.',
    sub: 'Curiosity carved the paths you took. The detours were the destination.',
  },
  {
    number: '03',
    theme: 'Building',
    label: 'three',
    bgClass: 'h-panel-bg-3',
    quote: 'Brick by brick, a life takes shape.',
    sub: 'The years of effort, of choosing, of becoming. Nothing was wasted.',
  },
  {
    number: '04',
    theme: 'Belonging',
    label: 'four',
    bgClass: 'h-panel-bg-4',
    quote: 'Home is whoever holds your hand.',
    sub: 'The people who remained are the chapters worth rereading most.',
  },
  {
    number: '05',
    theme: 'Legacy',
    label: 'five',
    bgClass: 'h-panel-bg-5',
    quote: "What you leave behind lives forever.",
    sub: "Your story doesn't end. It becomes part of the stories that come after.",
  },
];

export default function HorizontalScrollSection() {
  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const threadRef = useRef(null);
  const panelRefs = useRef([]);
  const dotsRef = useRef([]);
  const revealedRef = useRef(new Array(PANELS.length).fill(false));

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768;

    if (prefersReduced || isMobile) return;

    // Set all panel text elements to initial hidden state via GSAP (avoids CSS transform conflict)
    panelRefs.current.forEach((panel) => {
      if (!panel) return;
      const label = panel.querySelector('.h-panel-label');
      const quote = panel.querySelector('.h-panel-quote');
      const sub = panel.querySelector('.h-panel-sub');
      const card = panel.querySelector('.h-panel-memory-card');
      gsap.set([label, quote, sub], { opacity: 0, y: 18 });
      if (card) gsap.set(card, { opacity: 0, y: 30 });
    });

    // Reveal first panel immediately since it's already in view
    const revealPanel = (i) => {
      if (revealedRef.current[i]) return;
      revealedRef.current[i] = true;
      const panel = panelRefs.current[i];
      if (!panel) return;
      const label = panel.querySelector('.h-panel-label');
      const quote = panel.querySelector('.h-panel-quote');
      const sub = panel.querySelector('.h-panel-sub');
      const card = panel.querySelector('.h-panel-memory-card');
      gsap.to(label, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' });
      gsap.to(quote, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', delay: 0.08 });
      gsap.to(sub, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: 0.18 });
      if (card) gsap.to(card, { opacity: 1, y: 0, duration: 0.8, ease: 'back.out(1.4)', delay: 0.12 });

      // Update progress dots
      dotsRef.current.forEach((dot, di) => {
        if (!dot) return;
        dot.classList.toggle('active', di === i);
      });
    };

    // Reveal panel 0 immediately
    setTimeout(() => revealPanel(0), 100);

    const ctx = gsap.context(() => {
      // Use (PANELS.length - 1) × viewport width as total horizontal translation
      const totalTranslation = window.innerWidth * (PANELS.length - 1);

      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top top',
        // end: 'bottom bottom' correctly covers the full sticky scroll distance
        end: 'bottom bottom',
        scrub: 1,
        invalidateOnRefresh: true,
        onUpdate(self) {
          const p = self.progress;

          // Translate track
          gsap.set(trackRef.current, { x: -totalTranslation * p });

          // Golden thread
          if (threadRef.current) {
            const pathEl = threadRef.current.querySelector('.golden-thread-path');
            if (pathEl) {
              const total = pathEl.getTotalLength();
              pathEl.style.strokeDasharray = `${total}`;
              pathEl.style.strokeDashoffset = `${total * (1 - p)}`;
            }
          }

          // Determine active panel and trigger reveals
          // Each panel occupies 1/N of scroll progress
          const panelIdx = Math.min(PANELS.length - 1, Math.floor(p * PANELS.length));
          dotsRef.current.forEach((dot, i) => {
            if (dot) dot.classList.toggle('active', i === panelIdx);
          });

          // Reveal panels at evenly spaced thresholds
          PANELS.forEach((_, i) => {
            const threshold = i === 0 ? 0 : (i / PANELS.length) + 0.04;
            if (p >= threshold) revealPanel(i);
          });
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="h-scroll-container">
      <div className="h-scroll-pin-wrapper">
        {/* Track — GSAP translates this horizontally */}
        <div ref={trackRef} className="h-scroll-track">
          {PANELS.map((panel, i) => (
            <div
              key={panel.number}
              ref={(el) => (panelRefs.current[i] = el)}
              className={`h-scroll-panel ${panel.bgClass}`}
            >
              {/* Giant background number */}
              <div className="h-panel-number">{panel.number}</div>

              <div className="h-panel-content">
                <div className={`h-panel-label ${panel.label}`}>
                  {panel.theme}
                </div>
                <h2 className="h-panel-quote">
                  "{panel.quote}"
                </h2>
                <p className="h-panel-sub">
                  {panel.sub}
                </p>
              </div>

              {/* Floating memory card */}
              <div className="h-panel-memory-card">
                <div className="h-panel-card-bar a" />
                <div className="h-panel-card-bar b" />
                <div className="h-panel-card-bar c" />
                <div style={{ flex: 1, borderRadius: 6, background: 'rgba(240,237,232,0.04)' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Golden thread */}
        <svg ref={threadRef} className="golden-thread-svg" viewBox="0 0 500 20" preserveAspectRatio="none">
          <path
            className="golden-thread-path"
            d="M0,10 Q62.5,2 125,10 Q187.5,18 250,10 Q312.5,2 375,10 Q437.5,18 500,10"
          />
        </svg>

        {/* Progress dots */}
        <div className="h-scroll-progress">
          {PANELS.map((_, i) => (
            <div
              key={i}
              ref={(el) => (dotsRef.current[i] = el)}
              className={`h-scroll-dot ${i === 0 ? 'active' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
