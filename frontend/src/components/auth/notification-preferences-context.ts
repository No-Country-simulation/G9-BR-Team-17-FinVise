import { createContext } from 'react';

export interface NotificationPreferences {
  spendingAlerts: boolean;
  weeklyReport: boolean;
  productNews: boolean;
}

export interface NotificationPreferencesContextValue {
  preferences: NotificationPreferences;
  updatePreference: (key: keyof NotificationPreferences, value: boolean) => void;
}

export const NotificationPreferencesContext = createContext<NotificationPreferencesContextValue | null>(null);
