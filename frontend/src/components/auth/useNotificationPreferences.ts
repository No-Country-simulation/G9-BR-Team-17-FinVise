import { useContext } from 'react';
import { NotificationPreferencesContext } from './notification-preferences-context';

const fallbackPreferences = {
  spendingAlerts: true,
  weeklyReport: true,
  productNews: false,
};

export function useNotificationPreferences() {
  const context = useContext(NotificationPreferencesContext);
  if (context) {
    return context;
  }

  return {
    preferences: fallbackPreferences,
    updatePreference: () => undefined,
  };
}
