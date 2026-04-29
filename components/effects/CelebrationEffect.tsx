'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type CelebrationEffectType = 'save' | 'read' | 'ai';

interface Particle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  w: number;
  h: number;
  color: string;
  delay: number;
  duration: number;
  rot: number;
  isRect: boolean;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function makeParticles(
  count: number,
  origin: { x: number; y: number },
  colors: string[],
  spread: number
): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = rand(0, Math.PI * 2);
    const dist = rand(spread * 0.35, spread);
    const size = rand(7, 18);
    const isRect = Math.random() > 0.55;
    return {
      id: i,
      x: origin.x,
      y: origin.y,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - rand(40, 100),
      w: size,
      h: isRect ? size * 0.45 : size,
      color: colors[i % colors.length],
      delay: rand(0, 0.12),
      duration: rand(0.55, 0.95),
      rot: rand(0, 360),
      isRect,
    };
  });
}

const COLORS: Record<CelebrationEffectType, string[]> = {
  save: ['#004ac6', '#6a1edb', '#8343f4', '#2563eb', '#60a5fa', '#1a7f37', '#d0e1fb'],
  read: ['#1a7f37', '#16a34a', '#4ade80', '#86efac', '#bbf7d0', '#34d399'],
  ai:   ['#6a1edb', '#8343f4', '#a78bfa', '#c4b5fd', '#004ac6', '#60a5fa', '#e879f9'],
};

const BADGE_TEXT: Record<CelebrationEffectType, string> = {
  save: 'Throw In! ✓',
  read: '既読 ✓',
  ai:   'AI処理完了 ✦',
};

const BADGE_STYLE: Record<CelebrationEffectType, React.CSSProperties> = {
  save: { background: 'linear-gradient(135deg, #004ac6, #6a1edb)', color: '#fff' },
  read: { background: 'linear-gradient(135deg, #1a7f37, #16a34a)', color: '#fff' },
  ai:   { background: 'linear-gradient(135deg, #6a1edb, #e879f9)', color: '#fff' },
};

const CONFIG: Record<CelebrationEffectType, { count: number; spread: number; duration: number }> = {
  save: { count: 70, spread: 420, duration: 2000 },
  read: { count: 70, spread: 420, duration: 2000 },
  ai:   { count: 70, spread: 420, duration: 2000 },
};

interface CelebrationEffectProps {
  type: CelebrationEffectType;
  origin?: { x: number; y: number };
  onDone?: () => void;
}

export function CelebrationEffect({ type, origin, onDone }: CelebrationEffectProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => onDone?.(), CONFIG[type].duration);
    return () => clearTimeout(t);
  }, [type, onDone]);

  if (!mounted) return null;

  const defaultOrigin = {
    x: window.innerWidth / 2,
    y: window.innerHeight * 0.7,
  };
  const pos = origin ?? defaultOrigin;
  const particles = makeParticles(CONFIG[type].count, pos, COLORS[type], CONFIG[type].spread);

  const content = (
    <div className="pointer-events-none fixed inset-0 z-[300] overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className={`absolute ${p.isRect ? 'rounded-sm' : 'rounded-full'}`}
          style={{
            left: p.x - p.w / 2,
            top: p.y - p.h / 2,
            width: p.w,
            height: p.h,
            backgroundColor: p.color,
            ['--pdx' as string]: `${p.dx}px`,
            ['--pdy' as string]: `${p.dy}px`,
            ['--prot' as string]: `${p.rot}deg`,
            animationName: 'particle-fly',
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationFillMode: 'both',
            animationTimingFunction: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
          }}
        />
      ))}
      <div
        className="absolute text-xs font-black px-4 py-2 rounded-full shadow-lg whitespace-nowrap"
        style={{
          left: pos.x,
          top: pos.y - 18,
          animationName: 'celebration-badge',
          animationDuration: `${CONFIG[type].duration / 1000}s`,
          animationFillMode: 'both',
          ...BADGE_STYLE[type],
        }}
      >
        {BADGE_TEXT[type]}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
