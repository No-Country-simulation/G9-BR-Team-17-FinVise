import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { NewAnalysisPage } from '@/pages/NewAnalysisPage';
import { AnalysisResultPage } from '@/pages/AnalysisResultPage';
import { ImportCsvPage } from '@/pages/ImportCsvPage';
import { OpenFinancePage } from '@/pages/OpenFinancePage';
import { ProfilePage } from '@/pages/ProfilePage';
import { RecommendationsPage } from '@/pages/RecommendationsPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { AgentPage } from '@/pages/AgentPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ImportSourcesPage } from '@/pages/ImportSourcesPage';
import { authService } from '@/services/authService';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return authService.isAuthenticated() ? children : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="analyses/new" element={<NewAnalysisPage />} />
          <Route path="analyses/:analysisId" element={<AnalysisResultPage />} />
          <Route path="import" element={<ImportCsvPage />} />
          <Route path="import/sources" element={<ImportSourcesPage />} />
          <Route path="open-finance" element={<OpenFinancePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="agent" element={<AgentPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
