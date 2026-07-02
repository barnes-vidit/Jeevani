import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { gsap, ScrollTrigger, SplitText } from '../../lib/gsap';

export default function CTASection() {
  const sectionRef = useRef(null);
  const headingRef = useRef(null);
  const btnRef = useRef(null);
  const wrapperRef = useRef(null);
  const burstCanvasRef = useRef(null);
  const ambientCanvasRef = useRef(null);
  const navigate = useNavigate();

  // Magnetic button
  useEffect(() => {
    const section = sectionRef.current;
    const btn = btnRef.current;
    if (!section || !btn) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    function onMouseMove(e) {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = Math.max(rect.width, rect.height) * 2;

      if (dist < maxDist) {
        const strength = Math.pow(1 - dist / maxDist, 2);
        gsap.to(btn, { x: dx * strength * 0.45, y: dy * strength * 0.45, duration: 0.3, ease: 'power2.out' });
      } else {
        gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
      }
    }

    function onMouseLeave() {
      gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
    }

    section.addEventListener('mousemove', onMouseMove);
    section.addEventListener('mouseleave', onMouseLeave);
    return () => {
      section.removeEventListener('mousemove', onMouseMove);
      section.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  // Ambient dot field — sparse echo of the hero universe, makes the CTA feel like arrival
  useEffect(() => {
    const canvas = ambientCanvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    let cancelled = false;
    let rafId;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const W = section.offsetWidth;
      const H = section.offsetHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      return { W, H, dpr };
    }

    const { W, H, dpr } = resize();
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const dots = Array.from({ length: 38 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      r: Math.random() * 1.1 + 0.25,
      baseA: Math.random() * 0.09 + 0.03,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.008 + 0.004,
    }));

    function draw() {
      if (cancelled) return;
      ctx.clearRect(0, 0, W, H);

      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        d.phase += d.speed;
        if (d.x < 0) d.x = W; if (d.x > W) d.x = 0;
        if (d.y < 0) d.y = H; if (d.y > H) d.y = 0;

        const a = d.baseA * (0.6 + 0.4 * Math.sin(d.phase));

        // Outer glow
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(242,201,76,${(a * 0.18).toFixed(3)})`;
        ctx.fill();
        // Core
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,230,130,${(a * 0.85).toFixed(3)})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    }
    draw();

    return () => { cancelled = true; cancelAnimationFrame(rafId); };
  }, []);

  // Heading SplitText + gradient shift on scroll
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      document.fonts.load('700 80px "Playfair Display"').then(() => {
        if (!headingRef.current) return;
        const split = new SplitText(headingRef.current, { type: 'chars,words' });

        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: 'top 70%',
          once: true,
          onEnter() {
            gsap.from(split.chars, {
              opacity: 0,
              y: 40,
              stagger: 0.045,
              duration: 0.8,
              ease: 'power3.out',
            });
          },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Particle burst on click, then navigate
  const handleClick = useCallback((e) => {
    const canvas = burstCanvasRef.current;
    if (!canvas) { navigate('/auth/sign-up'); return; }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const cx = e.clientX;
    const cy = e.clientY;

    const colors = ['#E8B84B', '#4361EE', '#E85D6B', '#F0EDE8'];
    const particles = Array.from({ length: 70 }, () => ({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10 - 5,
      alpha: 1,
      radius: Math.random() * 3 + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let cancelled = false;
    function burst() {
      if (cancelled) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18;
        p.alpha -= 0.022;
        if (p.alpha > 0) {
          alive = true;
          const hex = Math.floor(p.alpha * 255).toString(16).padStart(2, '0');
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color + hex;
          ctx.fill();
        }
      }
      if (alive) requestAnimationFrame(burst);
      else { cancelled = true; ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }
    requestAnimationFrame(burst);
    setTimeout(() => navigate('/auth/sign-up'), 320);
  }, [navigate]);

  return (
    <section ref={sectionRef} className="cta-section">
      {/* Ambient gradient blobs */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at 30% 60%, rgba(67,97,238,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 40%, rgba(232,184,75,0.06) 0%, transparent 55%)',
      }} />

      <div className="cta-content" style={{ position: 'relative', zIndex: 10 }}>
        <div className="cta-eyebrow">Begin with one sentence</div>

        <h2 ref={headingRef} className="cta-heading">
          Write your<br /><em>real</em> story.
        </h2>

        <p className="cta-sub">
          You're already living something worth reading. Jeevani helps you capture the depth of it, not just the highlights.
        </p>

        {/* Magnetic button wrapper */}
        <div ref={wrapperRef} className="cta-magnetic-wrapper">
          <button
            ref={btnRef}
            onClick={handleClick}
            className="cta-magnetic-btn"
            type="button"
          >
            Start Writing
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <p style={{ fontFamily: 'Inter', fontSize: '0.75rem', color: 'rgba(240,237,232,0.22)', letterSpacing: '0.05em' }}>
          Free to start · No credit card
        </p>
      </div>

      {/* Ambient dot field — sparse echo of the hero universe */}
      <canvas ref={ambientCanvasRef} className="cta-ambient-canvas" />
      {/* Particle burst canvas (fixed, over everything) */}
      <canvas ref={burstCanvasRef} className="cta-burst-canvas" />
    </section>
  );
}
