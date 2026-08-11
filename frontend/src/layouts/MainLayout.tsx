import { useEffect, useLayoutEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Footer } from '@/components/layout/Footer';
import { MobileBottomNavigation } from '@/components/layout/MobileBottomNavigation';
import { AuthBackground } from '@/components/auth/Background';
import { useTheme } from '@/components/auth/useTheme';
import { cn } from '@/lib/utils';
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';

const sidebarCollapsedStorageKey = 'finvise-sidebar-collapsed';

export function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { pathname } = useLocation();
  const isAgentPage = pathname === '/agent';
  const { resolvedTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const userId = authService.getUserId();
  const { data: dashboardUser } = useQuery({
    queryKey: ['users', userId, 'dashboard'],
    queryFn: () => userService.getDashboard(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
  const userName = dashboardUser?.name || 'Usuário';

  useEffect(() => {
    const savedValue = window.localStorage.getItem(sidebarCollapsedStorageKey);
    setIsSidebarCollapsed(savedValue === 'true');
  }, []);

  useEffect(() => {
    window.localStorage.setItem(sidebarCollapsedStorageKey, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.getElementById('main-content')?.focus({ preventScroll: true });
    };
    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const closeMobileDrawerOnDesktop = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) setIsSidebarOpen(false);
    };

    closeMobileDrawerOnDesktop(desktopQuery);
    desktopQuery.addEventListener('change', closeMobileDrawerOnDesktop);
    return () => desktopQuery.removeEventListener('change', closeMobileDrawerOnDesktop);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    document.body.style.overflow = isSidebarOpen && !isDesktop ? 'hidden' : '';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isSidebarOpen]);

  return (
    <div
      data-theme={resolvedTheme}
      className={cn(
        'auth-shell relative flex min-h-dvh w-full max-w-full overflow-x-hidden transition-[padding] duration-300',
        isSidebarCollapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-60',
        resolvedTheme === 'dark' ? 'text-white' : 'text-slate-900'
      )}
    >
      <AuthBackground />
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[70] -translate-y-24 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-cyan-300"
      >
        Pular para o conteúdo principal
      </a>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div
          className={cn(
            'fixed left-0 right-0 top-0 z-30 transition-[left] duration-300',
            isSidebarCollapsed ? 'lg:left-[4.5rem]' : 'lg:left-60'
          )}
        >
          <Header
            userName={userName}
            isMenuOpen={isSidebarOpen}
            onMenuClick={() => setIsSidebarOpen(true)}
          />
        </div>

        <div className="mobile-safe-top h-16 shrink-0" aria-hidden="true" />

        <main
          id="main-content"
          tabIndex={-1}
          aria-label="Conteúdo principal"
          className={cn(
            'w-full min-w-0 max-w-full flex-1 overflow-x-hidden outline-none',
            isAgentPage
              ? 'p-0 pb-16 lg:p-6 xl:p-8'
              : 'px-3 pb-24 pt-4 sm:px-5 sm:pt-5 lg:p-6 xl:p-8'
          )}
        >
          <div className={cn('mx-auto w-full', isAgentPage ? 'max-w-none' : 'max-w-[100rem]')}>
            <motion.div
              key={pathname}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </div>
        </main>

        {!isAgentPage && <Footer />}
      </div>

      <MobileBottomNavigation
        isMoreOpen={isSidebarOpen}
        onMoreClick={() => setIsSidebarOpen(true)}
      />
    </div>
  );
}
