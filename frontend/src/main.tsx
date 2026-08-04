import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { App } from '@/app/App';
import { NotificationPreferencesProvider } from '@/components/auth/NotificationPreferencesProvider';
import { ThemeProvider } from '@/components/auth/ThemeProvider';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NotificationPreferencesProvider>
          <App />
        </NotificationPreferencesProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
