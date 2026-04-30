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
  save: ['#111111', '#4d4d49', '#7a7972', '#d3d1c8', '#fafaf8'],
  read: ['#111111', '#4d4d49', '#7a7972', '#d3d1c8', '#fafaf8'],
  ai:   ['#111111', '#4d4d49', '#766f62', '#d3d1c8', '#fafaf8'],
};

const BADGE_TEXT: Record<CelebrationEffectType, string> = {
  save: '保存しました',
  read: '既読にしました',
  ai:   '整理しました',
};

const BADGE_STYLE: Record<CelebrationEffectType, React.CSSProperties> = {
  save: { background: '#111111', color: '#fafaf8', border: '1px solid #111111' },
  read: { background: '#ffffff', color: '#111111', border: '1px solid #d3d1c8' },
  ai:   { background: '#efeee8', color: '#111111', border: '1px solid #d3d1c8' },
};

const CONFIG: Record<CelebrationEffectType, { count: number; spread: number; duration: number }> = {
  save: { count: 34, spread: 260, duration: 1500 },
  read: { count: 26, spread: 220, duration: 1300 },
  ai:   { count: 30, spread: 240, duration: 1500 },
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
        className="absolute text-xs font-semibold px-4 py-2 rounded-full shadow-ambient whitespace-nowrap"
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
