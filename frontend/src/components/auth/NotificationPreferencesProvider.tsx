import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export interface NotificationPreferences {
  spendingAlerts: boolean;
  weeklyReport: boolean;
  productNews: boolean;
}

interface NotificationPreferencesContextValue {
  preferences: NotificationPreferences;
  updatePreference: (key: keyof NotificationPreferences, value: boolean) => void;
}

const notificationPreferencesStorageKey = 'finvise-notification-preferences';

const defaultPreferences: NotificationPreferences = {
  spendingAlerts: true,
  weeklyReport: true,
  productNews: false,
};

const NotificationPreferencesContext = createContext<NotificationPreferencesContextValue | null>(null);

function parseStoredPreferences(rawValue: string | null): NotificationPreferences {
  if (!rawValue) return defaultPreferences;

  try {
    const parsed = JSON.parse(rawValue) as Partial<NotificationPreferences>;
    return {
      spendingAlerts: parsed.spendingAlerts ?? defaultPreferences.spendingAlerts,
      weeklyReport: parsed.weeklyReport ?? defaultPreferences.weeklyReport,
      productNews: parsed.productNews ?? defaultPreferences.productNews,
    };
  } catch {
    return defaultPreferences;
  }
}

export function NotificationPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);

  useEffect(() => {
    setPreferences(parseStoredPreferences(window.localStorage.getItem(notificationPreferencesStorageKey)));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(notificationPreferencesStorageKey, JSON.stringify(preferences));
  }, [preferences]);

  const value = useMemo(
    () => ({
      preferences,
      updatePreference: (key: keyof NotificationPreferences, value: boolean) => {
        setPreferences((current) => ({ ...current, [key]: value }));
      },
    }),
    [preferences]
  );

  return <NotificationPreferencesContext.Provider value={value}>{children}</NotificationPreferencesContext.Provider>;
}

export function useNotificationPreferences() {
  const context = useContext(NotificationPreferencesContext);
  if (context) return context;

  return {
    preferences: defaultPreferences,
    updatePreference: () => undefined,
  };
}