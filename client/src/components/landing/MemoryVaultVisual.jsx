import { useEffect, useRef } from 'react';
import { gsap } from '../../lib/gsap';

const ICONS = [
  { emoji: '📷', label: 'Photo' },
  { emoji: '🎙️', label: 'Voice' },
  { emoji: '📔', label: 'Journal' },
  { emoji: '📄', label: 'Document' },
  { emoji: '🎵', label: 'Audio' },
  { emoji: '📁', label: 'Archive' },
];

export default function MemoryVaultVisual({ scrollProgressRef, onRegisterUpdate }) {
  const containerRef = useRef(null);
  const orbRef = useRef(null);
  const iconRefs = useRef([]);
  const ring1Ref = useRef(null);
  const ring2Ref = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const icons = iconRefs.current;
    const orb = orbRef.current;
    const ring1 = ring1Ref.current;
    const ring2 = ring2Ref.current;

    // Set initial states
    icons.forEach((icon, i) => {
      if (!icon) return;
      const angle = (i / ICONS.length) * Math.PI * 2;
      gsap.set(icon, {
        opacity: 0,
        x: Math.cos(angle) * 220,
        y: Math.sin(angle) * 100,
        xPercent: -50,
        yPercent: -50,
      });
    });
    gsap.set(orb, { scale: 0.3, opacity: 0 });
    if (ring1) gsap.set(ring1, { opacity: 0, scale: 0.8 });
    if (ring2) gsap.set(ring2, { opacity: 0, scale: 0.8 });

    // Start pulsing ring animations
    if (ring1) {
      gsap.to(ring1, { scale: 1.1, opacity: 0.4, duration: 2.5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    }
    if (ring2) {
      gsap.to(ring2, { scale: 1.06, opacity: 0.2, duration: 3.5, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1 });
    }

    let lastProgress = -1;

    function update(p) {
      if (Math.abs(p - lastProgress) < 0.001) return;
      lastProgress = p;

      icons.forEach((icon, i) => {
        if (!icon) return;
        const baseAngle = (i / ICONS.length) * Math.PI * 2;
        const orbitAngle = baseAngle + p * Math.PI * 1.5;

        let radius, opacity, scale;

        if (p < 0.15) {
          // drift in
          const t = p / 0.15;
          radius = 220;
          opacity = t * 0.85;
          scale = 0.7 + 0.3 * t;
        } else if (p < 0.75) {
          // orbit
          const t = (p - 0.15) / 0.6;
          radius = 220 - t * 100; // shrinks from 220 to 120
          opacity = 0.85;
          scale = 1;
        } else {
          // converge to orb
          const t = (p - 0.75) / 0.25;
          const ease = t * t;
          radius = 120 * (1 - ease);
          opacity = 0.85 * (1 - ease);
          scale = 1 - ease * 0.4;
        }

        gsap.set(icon, {
          x: Math.cos(orbitAngle) * radius,
          y: Math.sin(orbitAngle) * radius * 0.5,
          xPercent: -50,
          yPercent: -50,
          opacity,
          scale,
          rotation: orbitAngle * (180 / Math.PI) * 0.15,
        });
      });

      // Orb grows as icons converge
      const orbScale = p < 0.5 ? 0.3 + p * 0.6 : 0.3 + 0.3 + (p - 0.5) * 1.4;
      const orbOpacity = Math.min(1, p * 2.5);
      const glowSize = 40 + p * 100;
      gsap.set(orb, {
        scale: Math.min(1.4, orbScale),
        opacity: orbOpacity,
        boxShadow: `0 0 ${glowSize}px rgba(232,184,75,${0.3 + p * 0.5}), 0 0 ${glowSize * 2}px rgba(232,184,75,${0.1 + p * 0.2})`,
      });

      // Rings appear mid-scroll
      if (ring1) gsap.set(ring1, { opacity: p > 0.2 ? Math.min(0.4, p * 0.8) : 0 });
      if (ring2) gsap.set(ring2, { opacity: p > 0.4 ? Math.min(0.2, (p - 0.4) * 0.5) : 0 });
    }

    // Register update callback with FeatureSection
    onRegisterUpdate?.(update);

    return () => {
      onRegisterUpdate?.(null);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onRegisterUpdate]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Pulse rings */}
      <div
        ref={ring1Ref}
        style={{
          position: 'absolute',
          width: 280,
          height: 280,
          borderRadius: '50%',
          border: '1px solid rgba(232,184,75,0.2)',
          pointerEvents: 'none',
        }}
      />
      <div
        ref={ring2Ref}
        style={{
          position: 'absolute',
          width: 380,
          height: 380,
          borderRadius: '50%',
          border: '1px solid rgba(232,184,75,0.1)',
          pointerEvents: 'none',
        }}
      />

      {/* Orbiting icons */}
      {ICONS.map((icon, i) => (
        <div
          key={icon.label}
          ref={(el) => (iconRefs.current[i] = el)}
          className="vault-icon"
          style={{ position: 'absolute', top: '50%', left: '50%' }}
          title={icon.label}
        >
          <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{icon.emoji}</span>
        </div>
      ))}

      {/* Central orb */}
      <div
        ref={orbRef}
        className="vault-orb"
        style={{ position: 'relative', zIndex: 10 }}
      />
    </div>
  );
}
