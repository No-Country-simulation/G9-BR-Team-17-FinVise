import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties } from 'react';
import loginBackgroundImage from '@/assets/branding/new-logo.jpg';
import { cn } from '@/lib/utils';
import { useTheme } from './useTheme';
import { useMediaQuery } from './useMediaQuery';

const backgroundParticles = [
  { left: 6, size: 2, duration: 17, delay: 2, drift: 18, opacity: 0.44 },
  { left: 13, size: 3, duration: 22, delay: 14, drift: -12, opacity: 0.34 },
  { left: 21, size: 2, duration: 15, delay: 9, drift: 22, opacity: 0.52 },
  { left: 29, size: 4, duration: 24, delay: 18, drift: -18, opacity: 0.3 },
  { left: 36, size: 2, duration: 19, delay: 5, drift: 14, opacity: 0.48 },
  { left: 43, size: 3, duration: 21, delay: 16, drift: -24, opacity: 0.38 },
  { left: 51, size: 2, duration: 16, delay: 12, drift: 10, opacity: 0.5 },
  { left: 58, size: 3, duration: 23, delay: 7, drift: 24, opacity: 0.32 },
  { left: 64, size: 2, duration: 18, delay: 15, drift: -16, opacity: 0.46 },
  { left: 71, size: 4, duration: 25, delay: 21, drift: 18, opacity: 0.28 },
  { left: 78, size: 2, duration: 17, delay: 11, drift: -10, opacity: 0.5 },
  { left: 84, size: 3, duration: 20, delay: 4, drift: 16, opacity: 0.36 },
  { left: 90, size: 2, duration: 15, delay: 13, drift: -20, opacity: 0.54 },
  { left: 96, size: 3, duration: 22, delay: 19, drift: 12, opacity: 0.34 },
] as const;

interface AuthBackgroundProps {
  showParticles?: boolean;
}

export function AuthBackground({ showParticles = false }: AuthBackgroundProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const prefersReducedMotion = useReducedMotion();
  const isMotionViewport = useMediaQuery('(min-width: 768px)');
  const shouldAnimate = !prefersReducedMotion && isMotionViewport;
  const shouldAnimateParticles = !prefersReducedMotion;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden [contain:paint]">
      <div className="absolute inset-0">
        <img
          src={loginBackgroundImage}
          alt=""
          className={cn('h-full w-full object-cover', isDark ? 'opacity-24' : 'opacity-[0.06]')}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          draggable={false}
        />
      </div>
      <div
        className={cn(
          'absolute inset-0',
          isDark
            ? 'bg-[linear-gradient(135deg,#071321_0%,#081a2d_52%,#0b2138_100%)]'
            : 'bg-[linear-gradient(135deg,rgba(238,244,249,0.96)_0%,rgba(223,232,240,0.94)_55%,rgba(203,215,227,0.92)_100%)]'
        )}
      />
      <motion.div
        className={cn('absolute left-[-10%] top-[14%] h-[30rem] w-[30rem] transform-gpu rounded-full bg-teal-400/14 blur-3xl', shouldAnimate && 'will-change-[transform,opacity]')}
        animate={shouldAnimate ? { opacity: [0.55, 0.8, 0.55], scale: [1, 1.06, 1] } : undefined}
        transition={shouldAnimate ? { duration: 12, repeat: Infinity, ease: 'easeInOut' } : undefined}
      />
      <motion.div
        className={cn('absolute right-[-12%] top-[4%] h-[28rem] w-[28rem] transform-gpu rounded-full bg-cyan-400/10 blur-3xl', shouldAnimate && 'will-change-[transform,opacity]')}
        animate={shouldAnimate ? { opacity: [0.35, 0.65, 0.35], scale: [1, 1.05, 1] } : undefined}
        transition={shouldAnimate ? { duration: 14, repeat: Infinity, ease: 'easeInOut' } : undefined}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(45,212,191,0.08),transparent_32%),radial-gradient(circle_at_20%_80%,rgba(14,165,233,0.05),transparent_30%),radial-gradient(circle_at_80%_70%,rgba(45,212,191,0.04),transparent_28%)]" />
      {showParticles ? (
        <div className="absolute inset-0 overflow-hidden [contain:strict]">
          {backgroundParticles.map((particle, index) => (
            <span
              key={`${particle.left}-${particle.duration}`}
              className={cn(
                'finvise-particle absolute top-full rounded-full',
                isDark
                  ? 'bg-cyan-300 shadow-[0_0_9px_rgba(103,232,249,0.4)]'
                  : 'bg-[#00a8be] shadow-[0_0_8px_rgba(0,168,190,0.26)]',
                shouldAnimateParticles ? 'will-change-transform' : 'finvise-particle-static'
              )}
              style={{
                left: `${particle.left}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                '--particle-duration': `${particle.duration}s`,
                '--particle-delay': `-${particle.delay}s`,
                '--particle-drift': `${particle.drift}px`,
                '--particle-opacity': Math.min(particle.opacity + (isDark ? 0.08 : 0.12), 0.66),
                '--particle-static-y': `-${10 + ((index * 37) % 82)}vh`,
              } as CSSProperties}
            />
          ))}
        </div>
      ) : null}
      <svg className="absolute inset-0 h-full w-full opacity-[0.16]" viewBox="0 0 1920 1080" fill="none" preserveAspectRatio="none">
        <path d="M-80 810C180 700 300 560 480 500C720 420 900 640 1120 570C1350 495 1530 280 2020 220" stroke="rgba(94,234,212,0.38)" strokeWidth="1.2" />
        <path d="M-100 900C140 770 320 660 510 640C730 615 920 760 1130 700C1330 640 1500 450 2020 360" stroke="rgba(103,232,249,0.24)" strokeWidth="1" />
        <path d="M-120 300C220 380 360 520 560 530C770 540 920 340 1140 355C1360 370 1520 510 2020 470" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      </svg>
      <div
        className={cn(
          'absolute inset-0',
          isDark
            ? 'bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.06),transparent_28%)]'
            : 'bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.5),transparent_34%)]'
        )}
      />
    </div>
  );
}
