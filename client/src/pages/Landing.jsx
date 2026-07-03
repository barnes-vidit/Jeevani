import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import Logo from '../components/Logo';
import Preloader from '../components/landing/Preloader';
import HeroSection from '../components/landing/HeroSection';
import ContrastSection from '../components/landing/ContrastSection';
import RecordSection from '../components/landing/RecordSection';
import CTASection from '../components/landing/CTASection';
import { useLenis } from '../hooks/useLenis';
import '../styles/landing.css';

// Time-aware warmth: the landing page shifts subtly based on time of day
function getWarmthColor() {
  const h = new Date().getHours();
  if (h >= 17 && h <= 20) return 'rgba(242,140,40,0.032)'; // golden hour / dusk
  if (h >= 5 && h <= 8) return 'rgba(242,190,90,0.022)'; // dawn
  if (h < 5 || h > 20) return 'rgba(20,15,60,0.038)';   // deep night
  return null; // neutral daytime
}

export default function Landing() {
  const [preloaderDone, setPreloaderDone] = useState(false);
  const navRef = useRef(null);
  const progressRef = useRef(null);
  const warmthColor = getWarmthColor();
  const { isSignedIn } = useAuth();
  useLenis();

  // Force dark mode on landing page
  useEffect(() => {
    const html = document.documentElement;
    const hadDark = html.classList.contains('dark');
    html.classList.add('dark');
    return () => { if (!hadDark) html.classList.remove('dark'); };
  }, []);

  // Nav scroll effect
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onScroll = () => {
      if (window.scrollY > 60) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll progress thread — 1px amber line on right edge
  useEffect(() => {
    const el = progressRef.current;
    if (!el) return;
    const onScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll <= 0) return;
      const pct = Math.min(100, (window.scrollY / maxScroll) * 100);
      el.style.height = pct + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="landing-page-root">
      <div className="grain-overlay" aria-hidden="true" />

      {/* Time-aware warmth tint — barely perceptible, like ambient light changing */}
      {warmthColor && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: warmthColor,
            pointerEvents: 'none',
            zIndex: 9997,
          }}
          aria-hidden="true"
        />
      )}

      {/* Scroll progress thread */}
      <div ref={progressRef} className="progress-thread" aria-hidden="true" />

      <AnimatePresence>
        {!preloaderDone && (
          <Preloader onComplete={() => setPreloaderDone(true)} />
        )}
      </AnimatePresence>

      <header ref={navRef} className="landing-nav">
        <Logo withText={true} />
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {isSignedIn ? (
            <Link to="/dashboard" className="landing-nav-cta">Go to Dashboard</Link>
          ) : (
            <>
              <Link to="/auth/sign-in" className="landing-nav-login">Log in</Link>
              <Link to="/auth/sign-up" className="landing-nav-cta">Get Started</Link>
            </>
          )}
        </nav>
      </header>

      <main>
        {/* 1 — Hero: universe canvas + 3D zoom (300vh) */}
        <HeroSection preloaderDone={preloaderDone} />

        {/* 2 — The Contrast: real life vs captions (250vh) */}
        <ContrastSection />

        {/* 3 — The Record: three voices, three incomplete memories (280vh) */}
        <RecordSection />

        {/* 4 — CTA: begin with one sentence */}
        <CTASection />
      </main>

      <footer className="landing-footer">
        <Logo withText={true} />
        <div className="landing-footer-links">
          {isSignedIn ? (
            <Link to="/dashboard">Dashboard</Link>
          ) : (
            <>
              <Link to="/auth/sign-in">Log in</Link>
              <Link to="/auth/sign-up">Get Started</Link>
            </>
          )}
          <a href="mailto:hello@jeevani.app">Contact</a>
        </div>
        <p className="landing-footer-copy">
          &copy; {new Date().getFullYear()} Jeevani. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
