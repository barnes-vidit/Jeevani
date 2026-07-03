import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { gsap, ScrollTrigger, SplitText } from '../../lib/gsap';

const MEMORIES = [
  'the road trip, March 2023',
  "my best friend's laugh at 2am",
  'first time I felt really proud',
  'that conversation on the roof',
  "the summer I'll never forget",
  'the night everything changed',
  'when Dad said he was proud',
  'our last night before she moved',
  'dancing in the kitchen at 3am',
  'the city that felt like home',
  'the day I stopped being afraid',
  'every Sunday morning that summer',
  'when I cried for a good reason',
  'the moment I just knew',
  'staying up for no reason at all',
  'the goodbye that wasn\'t forever',
  'finding my people',
  'the year I grew up',
  'a promise I actually kept',
  'the song that still means everything',
  'when we were just kids',
  'driving home in the rain',
  'the semester I found myself',
  'a text I never sent',
  'the week everything was exactly right',
];

const FOCAL = 520;
const EXCERPT_TEXT = "My best friend and I stayed up until 4am that summer. We had nowhere to be, nothing to lose, everything to say. I remember the way the city sounded at that hour, quiet, but full of something we couldn't name yet.";
const BOTTOM_LINE1 = "Your life contains thousands of these moments.";
const BOTTOM_LINE2 = "Are you writing them down?";

function pickColor() {
  const r = Math.random();
  if (r < 0.58) return [240, 237, 232];
  if (r < 0.82) return [242, 201, 76];
  return [67, 97, 238];
}

function buildDots(W, H) {
  const dots = [];
  MEMORIES.forEach((text, i) => {
    const angle = (i / MEMORIES.length) * Math.PI * 2;
    const spread = W * (0.5 + Math.random() * 0.9);
    dots.push({
      x: Math.cos(angle) * spread * (0.5 + Math.random() * 0.5),
      y: Math.sin(angle) * spread * 0.28,
      z: 280 + Math.random() * 2100,
      baseSize: 2.2,
      color: [242, 201, 76],
      baseAlpha: 0.9,
      alpha: 0,
      tSpeed: 0.003 + Math.random() * 0.005,
      tDir: 1,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      isMemory: true,
      text,
    });
  });
  for (let i = 0; i < 900; i++) {
    const col = pickColor();
    dots.push({
      x: (Math.random() - 0.5) * W * 5,
      y: (Math.random() - 0.5) * H * 3.5,
      z: 40 + Math.random() * 3400,
      baseSize: Math.random() * 1.3 + 0.18,
      color: col,
      baseAlpha: Math.random() * 0.55 + 0.06,
      alpha: 0,
      tSpeed: Math.random() * 0.006 + 0.001,
      tDir: Math.random() > 0.5 ? 1 : -1,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      isMemory: false,
      text: null,
    });
  }
  return dots;
}

export default function HeroSection({ preloaderDone }) {
  const { isSignedIn } = useAuth();
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const introRef = useRef(null);
  const heroContentRef = useRef(null);
  const headlineRef = useRef(null);
  const subheadRef = useRef(null);
  const ctasRef = useRef(null);
  const excerptRef = useRef(null);
  const excerptTextRef = useRef(null);
  const excerptCursorRef = useRef(null);
  const bottomTextRef = useRef(null);
  const bottomLine1Ref = useRef(null);
  const bottomLine2Ref = useRef(null);
  const scrollHintRef = useRef(null);

  // New refs for the 3D Book & Parallax Memory Cards
  const bookRef = useRef(null);
  const coverRef = useRef(null);
  const page1Ref = useRef(null);
  const card1Ref = useRef(null);
  const card2Ref = useRef(null);
  const card3Ref = useRef(null);
  const card4Ref = useRef(null);

  const cameraZRef = useRef(0);
  const cameraXRef = useRef(0);
  const cameraYRef = useRef(0);
  const cursorRef = useRef({ x: -9999, y: -9999 });
  const revealRef = useRef(0);
  const velRef = useRef(0); // scroll velocity for hyperspace
  // Track convergence progress so onLeave can restore scroll-driven card positions
  const convergeProgressRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const cx = W / 2;
    const cy = H / 2;

    const dots = buildDots(W, H);
    let cancelled = false;

    function loop() {
      if (cancelled) return;

      // Motion blur: trails linger at 13% opacity per frame instead of hard clearRect
      ctx.fillStyle = 'rgba(5,6,10,0.13)';
      ctx.fillRect(0, 0, W, H);

      // Decay scroll velocity each frame
      velRef.current *= 0.88;
      const vel = velRef.current;
      const isHyperspace = vel > 6;

      const camZ = cameraZRef.current;
      const camX = cameraXRef.current;
      const camY = cameraYRef.current;
      const cur = cursorRef.current;
      const reveal = revealRef.current;

      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        d.alpha += d.tSpeed * d.tDir;
        if (d.alpha > d.baseAlpha || d.alpha < 0) {
          d.tDir *= -1;
          d.alpha = Math.max(0, Math.min(d.baseAlpha, d.alpha));
        }

        const dz = d.z - camZ;
        if (dz <= 8) continue;

        const scale = FOCAL / dz;
        const px = (d.x - camX) * scale + cx;
        const py = (d.y - camY) * scale + cy;
        const sz = d.baseSize * scale;

        if (px < -sz * 14 || px > W + sz * 14 || py < -sz * 14 || py > H + sz * 14) continue;

        const cdx = cur.x - px;
        const cdy = cur.y - py;
        const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
        const cursorBoost = cdist < 160 ? (1 - cdist / 160) * 0.55 : 0;

        const alpha = Math.min(1, (d.alpha + cursorBoost) * reveal);
        const [r, g, b] = d.color;

        // Hyperspace: stretch dots into light-speed lines toward the camera vanishing point
        if (isHyperspace && sz > 0.4) {
          const stretch = Math.min(vel * 0.12, 28);
          const scaleFar = FOCAL / (dz + stretch * 22);
          const pxFar = (d.x - camX) * scaleFar + cx;
          const pyFar = (d.y - camY) * scaleFar + cy;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(pxFar, pyFar);
          ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.55).toFixed(3)})`;
          ctx.lineWidth = Math.max(0.4, sz * 0.7);
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        // Additive compositing for bright/memory dots — light sources add, creating luminous clusters
        const useAdditive = d.isMemory || sz > 3.5;
        if (useAdditive) ctx.globalCompositeOperation = 'lighter';

        // Core dot
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.25, sz), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.fill();

        // DoF-informed glow: close dots bloom larger, far dots stay tight
        const glowMult = sz > 3 ? 4.5 : sz > 1.5 ? 2.8 : 2.0;
        const glowAlpha = sz > 3 ? alpha * 0.28 : alpha * 0.14;
        if (sz > 0.8 || d.isMemory) {
          ctx.beginPath();
          ctx.arc(px, py, Math.max(1, sz * glowMult), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${glowAlpha.toFixed(3)})`;
          ctx.fill();
        }

        if (useAdditive) ctx.globalCompositeOperation = 'source-over';

        // Memory text label
        if (d.isMemory && sz > 4) {
          const tAlpha = Math.min(1, (sz - 4) / 22) * alpha * 0.88;
          if (tAlpha > 0.015) {
            const fs = Math.min(13, Math.max(8, sz * 0.65));
            ctx.font = `300 ${fs}px Inter, system-ui, sans-serif`;
            ctx.fillStyle = `rgba(240,237,232,${tAlpha.toFixed(3)})`;
            ctx.fillText(d.text, px + sz * 1.6 + 5, py + sz * 0.35);
          }
        }
      }

      requestAnimationFrame(loop);
    }
    loop();

    const revealTween = gsap.to(revealRef, { current: 1, duration: 2.2, ease: 'power2.inOut', delay: 0.5 });

    const gsapCtx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: wrapperRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.3,
        onUpdate(self) {
          const p = self.progress;
          cameraZRef.current = p * 2650;
          cameraXRef.current = Math.sin(p * Math.PI) * W * 0.07;
          cameraYRef.current = Math.sin(p * Math.PI * 0.6 + 0.3) * H * 0.04;

          const heroFade = p > 0.08 ? Math.min(1, (p - 0.08) / 0.18) : 0;
          gsap.set(heroContentRef.current, { opacity: 1 - heroFade, y: -heroFade * 50 });
          gsap.set(scrollHintRef.current, { opacity: Math.max(0, 1 - heroFade * 4) });

          // 1. Converge memory cards towards the book (p: 0 -> 0.22)
          const convergeProgress = Math.max(0, Math.min(1, p / 0.22));
          const scaleVal = 1 - convergeProgress;
          const opacityVal = 1 - convergeProgress;
          // Store for onLeave to reference
          convergeProgressRef.current = convergeProgress;

          if (card1Ref.current) {
            const tx = convergeProgress * 120;
            const ty = convergeProgress * 60;
            card1Ref.current.style.transform = `translate3d(${tx}px, ${ty}px, 50px) scale(${scaleVal})`;
            card1Ref.current.style.opacity = opacityVal;
          }
          if (card2Ref.current) {
            const tx = -convergeProgress * 120;
            const ty = convergeProgress * 50;
            card2Ref.current.style.transform = `translate3d(${tx}px, ${ty}px, 80px) scale(${scaleVal})`;
            card2Ref.current.style.opacity = opacityVal;
          }
          if (card3Ref.current) {
            const tx = convergeProgress * 130;
            const ty = -convergeProgress * 80;
            card3Ref.current.style.transform = `translate3d(${tx}px, ${ty}px, 60px) scale(${scaleVal})`;
            card3Ref.current.style.opacity = opacityVal;
          }
          if (card4Ref.current) {
            const tx = -convergeProgress * 130;
            const ty = -convergeProgress * 60;
            card4Ref.current.style.transform = `translate3d(${tx}px, ${ty}px, 40px) scale(${scaleVal})`;
            card4Ref.current.style.opacity = opacityVal;
          }

          // NOTE: Book open/page-turn is driven by a continuous autonomous
          // GSAP loop (started in preloaderDone effect), NOT by scroll.

          if (excerptRef.current) {
            let exOp = 0;
            if (p >= 0.38 && p <= 0.82) {
              const inT = Math.min(1, (p - 0.38) / 0.08);
              const outT = p > 0.72 ? Math.min(1, (p - 0.72) / 0.10) : 0;
              exOp = Math.max(0, Math.min(inT, 1 - outT));
            }
            gsap.set(excerptRef.current, { opacity: exOp });

            if (excerptTextRef.current) {
              if (p >= 0.38 && p < 0.72) {
                const typeT = Math.min(1, (p - 0.38) / 0.34);
                const chars = Math.floor(typeT * EXCERPT_TEXT.length);
                excerptTextRef.current.textContent = EXCERPT_TEXT.slice(0, chars);
                if (excerptCursorRef.current) {
                  excerptCursorRef.current.style.display = typeT < 1 ? 'inline-block' : 'none';
                }
              } else if (p >= 0.72) {
                excerptTextRef.current.textContent = EXCERPT_TEXT;
                if (excerptCursorRef.current) excerptCursorRef.current.style.display = 'none';
              } else if (p < 0.38) {
                excerptTextRef.current.textContent = '';
                if (excerptCursorRef.current) excerptCursorRef.current.style.display = 'none';
              }
            }
          }

          // Bottom text: typewriter driven by scroll
          if (bottomTextRef.current) {
            const bT = p > 0.84 ? Math.min(1, (p - 0.84) / 0.14) : 0;
            gsap.set(bottomTextRef.current, { opacity: bT });

            if (bT > 0 && bottomLine1Ref.current) {
              const totalChars = BOTTOM_LINE1.length + BOTTOM_LINE2.length;
              const chars = Math.floor(bT * totalChars);
              if (chars <= BOTTOM_LINE1.length) {
                bottomLine1Ref.current.textContent = BOTTOM_LINE1.slice(0, chars);
                if (bottomLine2Ref.current) bottomLine2Ref.current.textContent = '';
              } else {
                bottomLine1Ref.current.textContent = BOTTOM_LINE1;
                if (bottomLine2Ref.current) {
                  bottomLine2Ref.current.textContent = BOTTOM_LINE2.slice(0, chars - BOTTOM_LINE1.length);
                }
              }
            }
          }
        },
      });
    }, wrapperRef);

    // Velocity tracking for hyperspace + 3D card tilt
    let lastScrollY = window.scrollY;
    function onScroll() {
      const delta = Math.abs(window.scrollY - lastScrollY);
      velRef.current = Math.max(velRef.current, delta * 1.8);
      lastScrollY = window.scrollY;
    }

    function onMove(e) {
      cursorRef.current = { x: e.clientX, y: e.clientY };

      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;

      // Interactive 3D tilt on Book Cover
      if (bookRef.current) {
        bookRef.current.style.transform = `rotateY(${-30 + dx * 16}deg) rotateX(${15 - dy * 12}deg)`;
      }

      // Parallax shifts on memory cards with depth.
      // Blend mouse parallax WITH the scroll-driven convergence offset so both effects coexist.
      const cp = convergeProgressRef.current;
      const scaleVal = 1 - cp;
      if (card1Ref.current) {
        const baseTx = cp * 120;
        const baseTy = cp * 60;
        card1Ref.current.style.transform = `translate3d(${baseTx + dx * -25 * (1 - cp)}px, ${baseTy + dy * -25 * (1 - cp)}px, 50px) scale(${scaleVal})`;
      }
      if (card2Ref.current) {
        const baseTx = -cp * 120;
        const baseTy = cp * 50;
        card2Ref.current.style.transform = `translate3d(${baseTx + dx * 30 * (1 - cp)}px, ${baseTy + dy * 30 * (1 - cp)}px, 80px) scale(${scaleVal})`;
      }
      if (card3Ref.current) {
        const baseTx = cp * 130;
        const baseTy = -cp * 80;
        card3Ref.current.style.transform = `translate3d(${baseTx + dx * -20 * (1 - cp)}px, ${baseTy + dy * -20 * (1 - cp)}px, 60px) scale(${scaleVal})`;
      }
      if (card4Ref.current) {
        const baseTx = -cp * 130;
        const baseTy = -cp * 60;
        card4Ref.current.style.transform = `translate3d(${baseTx + dx * 25 * (1 - cp)}px, ${baseTy + dy * 25 * (1 - cp)}px, 40px) scale(${scaleVal})`;
      }

      // 3D tilt on excerpt card when visible
      if (excerptRef.current) {
        const op = parseFloat(getComputedStyle(excerptRef.current).opacity);
        if (op > 0.08) {
          const card = excerptRef.current.querySelector('.hero-excerpt-card');
          if (card) {
            const rect = card.getBoundingClientRect();
            const cardCx = rect.left + rect.width / 2;
            const cardCy = rect.top + rect.height / 2;
            const cardDx = Math.max(-1, Math.min(1, (e.clientX - cardCx) / (rect.width / 2)));
            const cardDy = Math.max(-1, Math.min(1, (e.clientY - cardCy) / (rect.height / 2)));
            const tiltX = -cardDy * 9;
            const tiltY = cardDx * 9;
            card.style.transform = `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
            card.style.boxShadow = `${-cardDx * 22}px ${cardDy * 22}px 80px rgba(242,201,76,${(0.08 + Math.abs(cardDx) * 0.05).toFixed(3)}), 0 40px 80px rgba(0,0,0,0.4)`;
          }
        }
      }
    }

    function onLeave() {
      cursorRef.current = { x: -9999, y: -9999 };
      // Reset card tilt on mouse leave
      if (excerptRef.current) {
        const card = excerptRef.current.querySelector('.hero-excerpt-card');
        if (card) {
          card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
          card.style.transition = 'transform 0.6s ease, box-shadow 0.6s ease';
        }
      }

      // Reset book and floating cards.
      // Restore scroll-driven convergence offset rather than snapping to (0,0) —
      // writing (0,0) here would erase the convergence animation if the user is mid-scroll.
      if (bookRef.current) {
        bookRef.current.style.transform = `rotateY(-30deg) rotateX(15deg)`;
      }
      const cp = convergeProgressRef.current;
      const scaleVal = 1 - cp;
      if (card1Ref.current) card1Ref.current.style.transform = `translate3d(${cp * 120}px, ${cp * 60}px, 50px) scale(${scaleVal})`;
      if (card2Ref.current) card2Ref.current.style.transform = `translate3d(${-cp * 120}px, ${cp * 50}px, 80px) scale(${scaleVal})`;
      if (card3Ref.current) card3Ref.current.style.transform = `translate3d(${cp * 130}px, ${-cp * 80}px, 60px) scale(${scaleVal})`;
      if (card4Ref.current) card4Ref.current.style.transform = `translate3d(${-cp * 130}px, ${-cp * 60}px, 40px) scale(${scaleVal})`;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);

    return () => {
      cancelled = true;
      revealTween.kill();
      gsapCtx.revert();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  useEffect(() => {
    if (!preloaderDone) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let effectCancelled = false;

    const gsapCtx = gsap.context(() => {
      // Intro line then fade out — unchanged
      gsap.timeline()
        .from(introRef.current, { opacity: 0, y: 12, duration: 0.75, ease: 'power2.out', delay: 0.25 })
        .to(introRef.current, { opacity: 0, y: -8, duration: 0.5, ease: 'power2.in' }, '+=1.1');

      if (!prefersReduced) {
        document.fonts.load('700 80px "Playfair Display"').then(() => {
          if (effectCancelled || !headlineRef.current) return;

          // ─────────────────────────────────────────────────────────────────
          // SETUP: Make the grid visible but hide every child individually
          // so we can control each element's entrance independently.
          // ─────────────────────────────────────────────────────────────────
          gsap.set(heroContentRef.current, { opacity: 1 });

          // Start all children hidden — we'll reveal them in sequence
          gsap.set(headlineRef.current, { opacity: 0 });
          gsap.set(subheadRef.current, { opacity: 0 });
          gsap.set(ctasRef.current, { opacity: 0 });
          gsap.set(scrollHintRef.current, { opacity: 0 });

          // Cards are already opacity:0 from CSS — reinforce for GSAP ownership
          const cardEls = [
            card1Ref.current,
            card2Ref.current,
            card3Ref.current,
            card4Ref.current,
          ].filter(Boolean);
          gsap.set(cardEls, { scale: 0, opacity: 0, transformOrigin: 'center center' });

          // Book wrapper reference for fade-in (NOT book-3d — filter on preserve-3d
          // would flatten all 3D children, exposing inside pages during animation)
          const bookWrapper = bookRef.current?.parentElement;
          if (bookWrapper) gsap.set(bookWrapper, { opacity: 0 });

          // ─────────────────────────────────────────────────────────────────
          // PHASE 1 ─ HEADLINE CINEMATIC ENTRANCE  (t = 1.5s)
          //
          // 3 acts:
          //   A. Rises from below viewport center at 3.6× scale (opacity 0→1)
          //   B. Holds centered + large for 0.8s — viewer absorbs the message
          //   C. Scales down (3.6→1) while sweeping to its left-column position
          //
          // getBoundingClientRect works even at opacity:0 — layout is stable.
          // overflow:clip on hero-section creates a natural curtain at bottom.
          // ─────────────────────────────────────────────────────────────────
          const headlineRect = headlineRef.current.getBoundingClientRect();
          const headlineCenterX = headlineRect.left + headlineRect.width / 2;
          const headlineCenterY = headlineRect.top + headlineRect.height / 2;
          const vpCenterX = window.innerWidth / 2;
          const vpCenterY = window.innerHeight / 2;

          // dx/dy to shift the headline's center exactly onto the viewport center
          const centerDX = vpCenterX - headlineCenterX;
          const centerDY = vpCenterY - headlineCenterY;

          // Starting y: well below the centered position so it rises up from the bottom
          const SCALE = 2.5;
          const startY = centerDY + window.innerHeight * 0.58;

          gsap.timeline({ delay: 1.5 })

            // ACT A — rise from bottom, large, fading in
            .fromTo(
              headlineRef.current,
              {
                x: centerDX,
                y: startY,
                scale: SCALE,
                opacity: 0,
                transformOrigin: 'center center',
              },
              {
                x: centerDX,
                y: centerDY,
                scale: SCALE,
                opacity: 1,
                duration: 0.95,
                ease: 'power3.out',
              }
            )

            // ACT B — hold centered + large (the "wow" pause)
            .to(headlineRef.current, { duration: 0.5 })

            // ACT C — scale down while moving to grid position
            .to(headlineRef.current, {
              x: 0,
              y: 0,
              scale: 1,
              duration: 1.3,
              ease: 'power3.inOut',
              onComplete() {
                if (effectCancelled) return;

                // ─────────────────────────────────────────────────────────
                // PHASE 2-6: Cascade remaining elements once headline settles
                // ─────────────────────────────────────────────────────────
                const tl = gsap.timeline();

                // Phase 2 — Subhead breathes up
                tl.to(subheadRef.current, {
                  opacity: 1, y: 0, duration: 0.6, ease: 'power2.out',
                  onStart() { gsap.set(subheadRef.current, { y: 18 }); },
                });

                // Phase 3 — CTA buttons pop in
                tl.to(
                  ctasRef.current ? Array.from(ctasRef.current.children) : [],
                  {
                    opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(2.2)', stagger: 0.12,
                    onStart() {
                      gsap.set(ctasRef.current ? Array.from(ctasRef.current.children) : [],
                        { y: 12, scale: 0.9 });
                    },
                  },
                  '-=0.3'
                );

                // Phase 4 — Book wrapper fades in (NO filter/blur — preserve-3d stays intact)
                if (bookWrapper) {
                  tl.to(bookWrapper, { opacity: 1, duration: 1.0, ease: 'power2.out' }, '-=0.2');
                }

                // Phase 5 — Memory cards orbit outward with elastic overshoot
                tl.to(cardEls, {
                  scale: 1,
                  opacity: 1,
                  duration: 0.85,
                  ease: 'back.out(2.2)',
                  stagger: 0.13,
                  onComplete() {
                    gsap.set(cardEls, { clearProps: 'scale,opacity' });
                    if (card1Ref.current) { card1Ref.current.style.transform = 'translate3d(0,0,50px)'; card1Ref.current.style.opacity = '1'; }
                    if (card2Ref.current) { card2Ref.current.style.transform = 'translate3d(0,0,80px)'; card2Ref.current.style.opacity = '1'; }
                    if (card3Ref.current) { card3Ref.current.style.transform = 'translate3d(0,0,60px)'; card3Ref.current.style.opacity = '1'; }
                    if (card4Ref.current) { card4Ref.current.style.transform = 'translate3d(0,0,40px)'; card4Ref.current.style.opacity = '1'; }
                  },
                }, '-=0.6');

                // Phase 6 — Scroll hint
                tl.to(scrollHintRef.current, { opacity: 1, duration: 0.6 }, '-=0.1');

                // Phase 7 — Book loop starts
                tl.call(() => {
                  if (effectCancelled) return;

                  gsap.set(coverRef.current, {
                    transformOrigin: 'left center',
                    rotateY: 0,
                    z: 8,
                  });
                  gsap.set(page1Ref.current, {
                    transformOrigin: 'left center',
                    rotateY: 0,
                    z: 2,
                  });

                  const bookLoop = gsap.timeline({ repeat: -1, delay: 0.6 });
                  bookLoop
                    .to(coverRef.current, { rotateY: -162, duration: 1.8, ease: 'power3.inOut' })
                    .to(page1Ref.current, { rotateY: -162, duration: 1.55, ease: 'power3.inOut' }, '+=0.3')
                    .to(page1Ref.current, { rotateY: 0, duration: 1.45, ease: 'power3.inOut' }, '+=1.0')
                    .to(coverRef.current, { rotateY: 0, duration: 1.7, ease: 'power3.inOut' }, '+=0.2')
                    .to({}, { duration: 1.6 });
                });
              },
            });
        });
      } else {
        // Reduced motion: reveal everything immediately
        gsap.set(heroContentRef.current, { opacity: 1 });
        if (bookRef.current) bookRef.current.style.opacity = '1';
        const bookWrapper = bookRef.current?.parentElement;
        if (bookWrapper) bookWrapper.style.opacity = '1';
        const cardEls = [card1Ref.current, card2Ref.current, card3Ref.current, card4Ref.current].filter(Boolean);
        cardEls.forEach(el => { if (el) el.style.opacity = '1'; });
      }
    }, wrapperRef);

    return () => {
      effectCancelled = true;
      gsapCtx.revert();
    };
  }, [preloaderDone]);




  return (
    <div ref={wrapperRef} style={{ height: '300vh' }}>
      <section className="hero-section" style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'clip' }}>
        <canvas ref={canvasRef} className="hero-canvas" style={{ willChange: 'transform' }} />

        <div ref={introRef} className="hero-intro-text" style={{ opacity: 0 }}>
          You are a universe of moments.
        </div>

        <div ref={heroContentRef} className="hero-grid" style={{ opacity: 0, position: 'relative', zIndex: 10, width: '100%' }}>
          {/* Left Column: Text & Actions */}
          <div className="hero-text-side">
            <h1 ref={headlineRef} className="hero-headline">
              You are living<br />
              <em className="hero-headline-accent">your story</em><br />
              right now.
            </h1>
            <p ref={subheadRef} className="hero-subhead">
              Jeevani captures who you really are.
            </p>
            <div ref={ctasRef} className="hero-ctas">
              <Link to={isSignedIn ? '/dashboard' : '/auth/sign-up'} className="hero-cta-primary">
                {isSignedIn ? 'Go to Dashboard' : 'Start Recording'}
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <button
                className="hero-cta-secondary"
                onClick={() => {
                  const target = document.getElementById('story');
                  if (target) target.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                See how it works
              </button>
            </div>
          </div>

          {/* Right Column: 3D Memoir Book & Parallax Memories */}
          <div className="hero-visual-side">
            <div className="hero-3d-container">
              {/* Floating Memory Fragments (Inflow) */}

              {/* Card 1: Audio/Voice note – top-left. Tilted slightly to feel natural */}
              <div ref={card1Ref} className="memory-card card-audio" style={{ left: '-140px', top: '-10px', transform: 'translate3d(0,0,50px)', rotate: '-4deg' }}>
                <div className="card-icon audio-icon">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div className="card-waveform">
                  <span className="wave-bar"></span>
                  <span className="wave-bar"></span>
                  <span className="wave-bar"></span>
                  <span className="wave-bar"></span>
                </div>
                <span className="card-text">"the road trip, March 2023"</span>
              </div>

              {/* Card 2: Photo – top-right, slight positive tilt */}
              <div ref={card2Ref} className="memory-card card-photo" style={{ right: '-138px', top: '20px', transform: 'translate3d(0,0,80px)', rotate: '3deg' }}>
                <div className="card-icon photo-icon">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="card-text">"grandmother's kitchen in November"</span>
              </div>

              {/* Card 3: Journal – bottom-left, slight negative tilt */}
              <div ref={card3Ref} className="memory-card card-journal" style={{ left: '-150px', bottom: '55px', transform: 'translate3d(0,0,60px)', rotate: '-2deg' }}>
                <div className="card-icon journal-icon">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <span className="card-text">"roof conversation at 3am"</span>
              </div>

              {/* Card 4: Document – bottom-right, slight positive tilt */}
              <div ref={card4Ref} className="memory-card card-doc" style={{ right: '-148px', bottom: '90px', transform: 'translate3d(0,0,40px)', rotate: '4deg' }}>
                <div className="card-icon doc-icon">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="card-text">"letter from Dad, 1998"</span>
              </div>

              {/* The 3D Book */}
              {/* Flat cast shadow - separate div so filter doesn't break 3D */}
              <div className="book-cast-shadow"></div>
              <div className="book-wrapper">
                <div ref={bookRef} className="book-3d">
                  {/* Spine */}
                  <div className="book-spine"></div>

                  {/* Back Cover */}
                  <div className="book-cover back"></div>

                  {/* Front Cover + inside-cover backface (Moved before Inside Pages for correct DOM layer painting order) */}
                  <div ref={coverRef} className="book-cover front">
                    {/* Outside of cover (shown when closed) */}
                    <div className="book-cover-design">
                      <div className="book-cover-accent-frame"></div>
                      <div className="book-cover-logo">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F2C94C" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                      </div>
                      <h2 className="book-cover-title">JEEVANI</h2>
                      <p className="book-cover-subtitle">MEMOIR VOLUME I</p>
                      <div className="book-cover-accent-spine"></div>
                    </div>
                    {/* Inside of cover (backface — shown when open, plain warm-cream left page) */}
                    <div className="book-cover-inside" />
                  </div>

                  {/* Inside Pages (layered from back to front, translateZ in CSS) */}
                  <div className="book-page page-3">
                    <div className="page-face front">
                      <div className="page-content">
                        <div className="page-epilogue-heading">EPILOGUE</div>
                        <p className="page-text-line italic">"And so the stories remain, bound not by dust, but by the voices that dared to speak them."</p>
                      </div>
                    </div>
                  </div>

                  <div className="book-page page-2">
                    <div className="page-face front">
                      <div className="page-content">
                        <div className="page-chapter-heading">II. THE ROOF</div>
                        <p className="page-text-line">We stayed up until 4am that summer. The city sounded quiet, but full of something we couldn't name yet.</p>
                        <p className="page-text-line">I remember the cold air on the concrete, and the feeling that we had nothing to lose.</p>
                      </div>
                    </div>
                  </div>

                  <div ref={page1Ref} className="book-page page-1">
                    {/* Front Face (faces right when closed) */}
                    <div className="page-face front">
                      <div className="page-content">
                        <div className="page-chapter-heading">I. THE RAIN</div>
                        <p className="page-text-line">I was 7, and it was raining. The road trip was supposed to take four hours, but we got stuck behind a logging truck near the pass.</p>
                        <p className="page-text-line">My father turned down the radio. "Listen," he said. And we just listened to the drumming on the roof.</p>
                        <div className="page-number">1</div>
                      </div>
                    </div>
                    {/* Back Face (faces left when open). No content needed:
                        page-1 targets the same -162° as the cover, so the cover
                        (z=8) is always in front of this face (z=2). The cover-inside
                        shows through page-1's transparent container. */}
                    <div className="page-face back">
                      <div className="page-content">
                        <div className="page-number">2</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div ref={scrollHintRef} className="hero-scroll-indicator" style={{ opacity: 0 }}>
          <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
            <rect x="1" y="1" width="14" height="22" rx="7" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
            <circle cx="8" cy="7" r="2.5" fill="currentColor" opacity="0.5">
              <animate attributeName="cy" values="7;14;7" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0.1;0.5" dur="1.8s" repeatCount="indefinite" />
            </circle>
          </svg>
          <span>scroll</span>
        </div>

        <div ref={excerptRef} className="hero-excerpt-overlay" style={{ opacity: 0 }}>
          <div className="hero-excerpt-card">
            <div className="hero-excerpt-label">From a Jeevani memoir</div>
            <blockquote className="hero-excerpt-text">
              <span ref={excerptTextRef} />
              <span ref={excerptCursorRef} className="hero-excerpt-cursor" style={{ display: 'none' }} />
            </blockquote>
            <div className="hero-excerpt-author">- Written by Aanya, 23</div>
          </div>
        </div>

        {/* Bottom text — typewriter driven, after excerpt */}
        <div ref={bottomTextRef} className="hero-bottom-text" style={{ opacity: 0 }}>
          <span ref={bottomLine1Ref} />
          <span ref={bottomLine2Ref} className="hero-bottom-text-sub" />
        </div>
      </section>
    </div>
  );
}
