import { motion } from 'framer-motion';
import { useTheme } from './ThemeProvider';

export function AuthBackground() {
  const { resolvedTheme } = useTheme();

  return (
    <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div
        className={resolvedTheme === 'dark'
          ? 'absolute inset-0 bg-[linear-gradient(135deg,#071321_0%,#081a2d_52%,#0b2138_100%)]'
          : 'absolute inset-0 bg-[linear-gradient(135deg,#eef4f9_0%,#dfe8f0_52%,#cbd7e3_100%)]'
        }
      />
      <motion.div
        className={resolvedTheme === 'dark'
          ? 'absolute left-[-10%] top-[14%] h-[30rem] w-[30rem] rounded-full bg-teal-400/14 blur-3xl'
          : 'absolute left-[-10%] top-[14%] h-[30rem] w-[30rem] rounded-full bg-cyan-400/10 blur-3xl'
        }
        animate={{ opacity: [0.55, 0.8, 0.55], scale: [1, 1.06, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className={resolvedTheme === 'dark'
          ? 'absolute right-[-12%] top-[4%] h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-3xl'
          : 'absolute right-[-12%] top-[4%] h-[28rem] w-[28rem] rounded-full bg-sky-400/8 blur-3xl'
        }
        animate={{ opacity: [0.35, 0.65, 0.35], scale: [1, 1.05, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className={resolvedTheme === 'dark'
          ? 'absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(45,212,191,0.08),transparent_32%),radial-gradient(circle_at_20%_80%,rgba(14,165,233,0.05),transparent_30%),radial-gradient(circle_at_80%_70%,rgba(45,212,191,0.04),transparent_28%)]'
          : 'absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(14,165,233,0.06),transparent_32%),radial-gradient(circle_at_20%_80%,rgba(45,212,191,0.03),transparent_30%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,0.03),transparent_28%)]'
        }
      />
      <svg className="absolute inset-0 h-full w-full opacity-[0.16]" viewBox="0 0 1920 1080" fill="none" preserveAspectRatio="none">
        <path d="M-80 810C180 700 300 560 480 500C720 420 900 640 1120 570C1350 495 1530 280 2020 220" stroke="rgba(94,234,212,0.38)" strokeWidth="1.2" />
        <path d="M-100 900C140 770 320 660 510 640C730 615 920 760 1130 700C1330 640 1500 450 2020 360" stroke="rgba(103,232,249,0.24)" strokeWidth="1" />
        <path d="M-120 300C220 380 360 520 560 530C770 540 920 340 1140 355C1360 370 1520 510 2020 470" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      </svg>
      <div className={resolvedTheme === 'dark' ? 'absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.06),transparent_28%)]' : 'absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.28),transparent_28%)]'} />
      <motion.div
        className={resolvedTheme === 'dark'
          ? 'absolute left-[12%] top-[26%] h-1.5 w-1.5 rounded-full bg-teal-300/80 shadow-[0_0_14px_rgba(45,212,191,0.45)]'
          : 'absolute left-[12%] top-[26%] h-1.5 w-1.5 rounded-full bg-cyan-500/70 shadow-[0_0_14px_rgba(14,165,233,0.28)]'
        }
        animate={{ y: [0, -10, 0], opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className={resolvedTheme === 'dark'
          ? 'absolute right-[18%] top-[38%] h-1.5 w-1.5 rounded-full bg-cyan-300/80 shadow-[0_0_14px_rgba(103,232,249,0.45)]'
          : 'absolute right-[18%] top-[38%] h-1.5 w-1.5 rounded-full bg-sky-400/80 shadow-[0_0_14px_rgba(56,189,248,0.28)]'
        }
        animate={{ y: [0, -12, 0], opacity: [0.4, 0.95, 0.4] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <motion.div
        className={resolvedTheme === 'dark'
          ? 'absolute right-[28%] top-[64%] h-1.5 w-1.5 rounded-full bg-white/70 shadow-[0_0_12px_rgba(255,255,255,0.18)]'
          : 'absolute right-[28%] top-[64%] h-1.5 w-1.5 rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.4)]'
        }
        animate={{ y: [0, 8, 0], opacity: [0.22, 0.65, 0.22] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      />
    </div>
  );
}