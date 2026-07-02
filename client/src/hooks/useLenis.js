import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from '../lib/gsap';

export function useLenis() {
  const lenisRef = useRef(null);

  useEffect(() => {
    // Scroll to top on mount so ScrollTrigger positions are fresh
    window.scrollTo(0, 0);

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    // Bridge Lenis RAF into GSAP ticker — critical for ScrollTrigger sync
    const gsapTicker = (time) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(gsapTicker);
    gsap.ticker.lagSmoothing(0);

    // Keep ScrollTrigger positions in sync with Lenis scroll
    lenis.on('scroll', ScrollTrigger.update);

    // Refresh ScrollTrigger after layout settles
    const refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 200);

    return () => {
      clearTimeout(refreshTimer);
      gsap.ticker.remove(gsapTicker);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return lenisRef;
}
