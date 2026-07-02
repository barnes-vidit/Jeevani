import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger, SplitText } from '../../lib/gsap';

export default function FeatureSection({
  id,
  reverse = false,
  tagline,
  heading,
  body,
  Visual,
  pinHeight = '200vh',
}) {
  const containerRef = useRef(null);
  const stickyRef = useRef(null);
  const headingRef = useRef(null);
  const taglineRef = useRef(null);
  const dividerRef = useRef(null);
  const bodyRef = useRef(null);
  const visualRef = useRef(null);
  // Use ref for scrollProgress — avoids re-rendering on every scroll frame
  const scrollProgressRef = useRef(0);
  const visualUpdateRef = useRef(null);

  const prefersReduced = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  useEffect(() => {
    const ctx = gsap.context(() => {
      // 1. Scroll progress for the Visual (ref-based, no React state)
      if (!prefersReduced && !isMobile) {
        ScrollTrigger.create({
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
          onUpdate(self) {
            scrollProgressRef.current = self.progress;
            // Notify the visual imperatively if it registered an update handler
            visualUpdateRef.current?.(self.progress);
          },
        });
      }

      // 2. Text reveal animations
      if (!prefersReduced) {
        // Heading character reveal
        document.fonts.load('300 40px "Cormorant Garamond"').then(() => {
          if (!headingRef.current) return;
          const split = new SplitText(headingRef.current, { type: 'chars' });
          gsap.set(split.chars, { opacity: 0, y: 20 });
          ScrollTrigger.create({
            trigger: containerRef.current,
            start: 'top 75%',
            once: true,
            onEnter() {
              gsap.to(split.chars, {
                opacity: 1,
                y: 0,
                stagger: 0.016,
                duration: 0.65,
                ease: 'power3.out',
              });
            },
          });
        });

        // Tagline, divider, body fade-in
        const textEls = [taglineRef.current, dividerRef.current, bodyRef.current].filter(Boolean);
        gsap.set(textEls, { opacity: 0, y: 14 });
        ScrollTrigger.create({
          trigger: containerRef.current,
          start: 'top 72%',
          once: true,
          onEnter() {
            gsap.to(textEls, {
              opacity: 1,
              y: 0,
              stagger: 0.1,
              duration: 0.6,
              ease: 'power2.out',
            });
          },
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, [prefersReduced, isMobile]);

  return (
    <div
      ref={containerRef}
      className="feature-section-container"
      id={id}
      style={{ height: isMobile || prefersReduced ? 'auto' : pinHeight }}
    >
      <div ref={stickyRef} className="feature-section-sticky">
        <div className={`feature-section-inner ${reverse ? 'reverse' : ''}`}>
          {/* Text */}
          <div className="feature-text-side">
            <div ref={taglineRef} className="feature-tagline">{tagline}</div>
            <div ref={dividerRef} className="feature-divider" />
            <h2 ref={headingRef} className="feature-heading">{heading}</h2>
            <p ref={bodyRef} className="feature-body">{body}</p>
          </div>

          {/* Visual — passes a ref callback so it can receive imperative updates */}
          <div ref={visualRef} className="feature-visual-side">
            <Visual
              scrollProgressRef={scrollProgressRef}
              onRegisterUpdate={(fn) => { visualUpdateRef.current = fn; }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
