import { motion, useReducedMotion } from 'framer-motion';
import loginBackgroundImage from '@/assets/branding/new-logo.jpg';
import { cn } from '@/lib/utils';
import { useTheme } from './useTheme';
import { useMediaQuery } from './useMediaQuery';

export function AuthBackground() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const prefersReducedMotion = useReducedMotion();
  const isMotionViewport = useMediaQuery('(min-width: 768px)');
  const shouldAnimate = !prefersReducedMotion && isMotionViewport;

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
      <motion.div
        className="absolute left-[12%] top-[26%] h-1.5 w-1.5 rounded-full bg-teal-300/80 shadow-[0_0_14px_rgba(45,212,191,0.45)]"
        animate={shouldAnimate ? { y: [0, -10, 0], opacity: [0.45, 1, 0.45] } : undefined}
        transition={shouldAnimate ? { duration: 5, repeat: Infinity, ease: 'easeInOut' } : undefined}
      />
      <motion.div
        className="absolute right-[18%] top-[38%] h-1.5 w-1.5 rounded-full bg-cyan-300/80 shadow-[0_0_14px_rgba(103,232,249,0.45)]"
        animate={shouldAnimate ? { y: [0, -12, 0], opacity: [0.4, 0.95, 0.4] } : undefined}
        transition={shouldAnimate ? { duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 1 } : undefined}
      />
      <motion.div
        className="absolute right-[28%] top-[64%] h-1.5 w-1.5 rounded-full bg-white/70 shadow-[0_0_12px_rgba(255,255,255,0.18)]"
        animate={shouldAnimate ? { y: [0, 8, 0], opacity: [0.22, 0.65, 0.22] } : undefined}
        transition={shouldAnimate ? { duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.5 } : undefined}
      />
    </div>
  );
}
