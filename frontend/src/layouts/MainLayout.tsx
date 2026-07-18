import { useEffect, useLayoutEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Footer } from '@/components/layout/Footer';
import { MobileBottomNavigation } from '@/components/layout/MobileBottomNavigation';

export function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    const resetScroll = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
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
    <div className="flex min-h-dvh w-full max-w-full overflow-x-hidden bg-slate-50 lg:pl-64">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header userName="Demo User" onMenuClick={() => setIsSidebarOpen(true)} />

        <main className="w-full min-w-0 max-w-full flex-1 overflow-x-hidden px-3 pb-24 pt-4 sm:px-5 sm:pt-5 lg:p-6 xl:p-8">
          <div className="mx-auto w-full max-w-[100rem]">
            <Outlet />
          </div>
        </main>

        <Footer />
      </div>

      <MobileBottomNavigation
        isMoreOpen={isSidebarOpen}
        onMoreClick={() => setIsSidebarOpen(true)}
      />
    </div>
  );
}
