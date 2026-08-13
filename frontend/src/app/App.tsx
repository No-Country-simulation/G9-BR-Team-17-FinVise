import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { Spinner } from '@/components/ui/Spinner';
import { authService } from '@/services/authService';
import { DashboardSkeleton } from '@/components/skeletons/PageSkeletons';

const LoginPage = lazy(() =>
  import('@/pages/LoginPage').then((module) => ({ default: module.LoginPage }))
);
const RegisterPage = lazy(() =>
  import('@/pages/RegisterPage').then((module) => ({ default: module.RegisterPage }))
);
const ForgotPasswordPage = lazy(() =>
  import('@/pages/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage }))
);
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage }))
);
const TransactionsPage = lazy(() =>
  import('@/pages/TransactionsPage').then((module) => ({ default: module.TransactionsPage }))
);
const NewAnalysisPage = lazy(() =>
  import('@/pages/NewAnalysisPage').then((module) => ({ default: module.NewAnalysisPage }))
);
const AnalysisResultPage = lazy(() =>
  import('@/pages/AnalysisResultPage').then((module) => ({ default: module.AnalysisResultPage }))
);
const AnalysisHistoryPage = lazy(() =>
  import('@/pages/AnalysisHistoryPage').then((module) => ({ default: module.AnalysisHistoryPage }))
);
const ImportCsvPage = lazy(() =>
  import('@/pages/ImportCsvPage').then((module) => ({ default: module.ImportCsvPage }))
);
const ImportSourcesPage = lazy(() =>
  import('@/pages/ImportSourcesPage').then((module) => ({ default: module.ImportSourcesPage }))
);
const OpenFinancePage = lazy(() =>
  import('@/pages/OpenFinancePage').then((module) => ({ default: module.OpenFinancePage }))
);
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((module) => ({ default: module.ProfilePage }))
);
const RecommendationsPage = lazy(() =>
  import('@/pages/RecommendationsPage').then((module) => ({ default: module.RecommendationsPage }))
);
const HistoryPage = lazy(() =>
  import('@/pages/HistoryPage').then((module) => ({ default: module.HistoryPage }))
);
const AgentPage = lazy(() =>
  import('@/pages/AgentPage').then((module) => ({ default: module.AgentPage }))
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((module) => ({ default: module.SettingsPage }))
);

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return authService.isAuthenticated() ? children : <Navigate to="/login" replace />;
}

function RouteFallback() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-label="Carregando página"
    >
      <Spinner size="lg" />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
          <Route
            index
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="analyses" element={<AnalysisHistoryPage />} />
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
    </Suspense>
  );
}

export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </BrowserRouter>
  );
}
