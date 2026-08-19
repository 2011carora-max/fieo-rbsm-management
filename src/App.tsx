import { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { LoginPage } from '@/pages/LoginPage';
import { Sidebar, type Route } from '@/components/Sidebar';
import { TopNav } from '@/components/TopNav';
import { DashboardPage } from '@/pages/DashboardPage';
import { ActivitiesPage } from '@/pages/ActivitiesPage';
import { ImportPage } from '@/pages/ImportPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { UsersPage } from '@/pages/UsersPage';
import { SettingsPage } from '@/pages/SettingsPage';

// App shell — handles auth gating, navigation state, and page routing.
function Shell() {
  const { user, loading, initError, retryInit } = useAuth();
  const [route, setRoute] = useState<Route>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-8 w-8 rounded-full border-2 border-fieo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="max-w-sm text-center space-y-3">
          <AlertTriangle className="mx-auto text-red-500" size={32} />
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Couldn't load the app</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{initError}</p>
          <button className="btn-primary mx-auto" onClick={retryInit}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  // Regional users can only ever see the Activities page — every other
  // route (including the default 'dashboard' landing state) is redirected.
  const effectiveRoute: Route = user.role !== 'admin' ? 'activities' : route;

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar route={effectiveRoute} onNavigate={setRoute} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav route={effectiveRoute} onMenu={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          {effectiveRoute === 'dashboard' && <DashboardPage />}
          {effectiveRoute === 'activities' && <ActivitiesPage />}
          {effectiveRoute === 'import' && <ImportPage />}
          {effectiveRoute === 'reports' && <ReportsPage />}
          {effectiveRoute === 'analytics' && <AnalyticsPage />}
          {effectiveRoute === 'documents' && <DocumentsPage />}
          {effectiveRoute === 'users' && <UsersPage />}
          {effectiveRoute === 'settings' && <SettingsPage />}
        </main>
        <footer className="px-4 lg:px-6 py-4 text-center text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800 no-print">
          FIEO RBSM Management System · Federation of Indian Export Organisations · Ministry of Commerce &amp; Industry, Government of India
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
