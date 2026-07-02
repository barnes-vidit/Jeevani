import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '../../lib/gsap';

const STATS = [
  { value: 12000, label: 'Memories Preserved', suffix: '+', display: '12,000+' },
  { value: 850, label: 'Life Stories Written', suffix: '+', display: '850+' },
  { value: 4.9, label: 'Stars from Families', suffix: '/5', display: '4.9/5', isDecimal: true },
];

export default function StatsSection() {
  const sectionRef = useRef(null);
  const numRefs = useRef([]);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      STATS.forEach((stat, i) => {
        const el = numRefs.current[i];
        if (!el) return;

        if (prefersReduced) {
          el.textContent = stat.display;
          return;
        }

        const obj = { val: 0 };
        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: 'top 75%',
          once: true,
          onEnter() {
            gsap.to(obj, {
              val: stat.value,
              duration: 2.2,
              ease: 'power2.out',
              onUpdate() {
                if (!el) return;
                const v = stat.isDecimal
                  ? obj.val.toFixed(1)
                  : Math.round(obj.val).toLocaleString();
                el.textContent = v + stat.suffix;
              },
            });
          },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="stats-section">
      <div className="stats-grid">
        {STATS.map((stat, i) => (
          <div key={stat.label} className="stat-item">
            <div className="stat-icon">✦</div>
            <div
              className="stat-number"
              ref={(el) => (numRefs.current[i] = el)}
            >
              0{stat.suffix}
            </div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
