import type { ReactNode } from 'react';
import { Home, LayoutDashboard, ClipboardList, FileBarChart, BarChart3, FolderOpen, Users, Settings, LogOut, ChevronRight } from 'lucide-react';
import { FieoLogo, FieoWordmark } from '@/components/FieoLogo';
import { cn } from '@/lib/cn';
import { useAuth } from '@/context/AuthContext';
import { officeName } from '@/types';

export type Route = 'dashboard' | 'activities' | 'reports' | 'analytics' | 'documents' | 'users' | 'settings';

interface NavItem { id: Route; label: string; icon: ReactNode; adminOnly?: boolean; }

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, adminOnly: true },
  { id: 'activities', label: 'Activities', icon: <ClipboardList size={18} /> },
  { id: 'reports', label: 'Reports', icon: <FileBarChart size={18} />, adminOnly: true },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} />, adminOnly: true },
  { id: 'documents', label: 'Documents', icon: <FolderOpen size={18} />, adminOnly: true },
  { id: 'users', label: 'Users', icon: <Users size={18} />, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} />, adminOnly: true },
];

const BREADCRUMB_LABELS: Record<Route, string> = {
  dashboard: 'Dashboard',
  activities: 'Activities',
  reports: 'Reports',
  analytics: 'Analytics',
  documents: 'Documents',
  users: 'Users',
  settings: 'Settings',
};

interface SidebarProps {
  route: Route;
  onNavigate: (r: Route) => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ route, onNavigate, open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const items = NAV.filter((n) => !n.adminOnly || user?.role === 'admin');

  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-gray-950/40 z-30 lg:hidden no-print" onClick={onClose} aria-hidden />}

      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-40 h-screen w-64 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col transition-transform duration-200 no-print',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        aria-label="Primary navigation"
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <FieoLogo size={40} />
          <FieoWordmark />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Menu</p>
          {items.map((item) => (
            <button
              key={item.id}
              className={cn('nav-link w-full', route === item.id && 'nav-link-active')}
              onClick={() => { onNavigate(item.id); onClose(); }}
              aria-current={route === item.id ? 'page' : undefined}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {route === item.id && <ChevronRight size={14} className="text-fieo-500" />}
            </button>
          ))}
        </nav>

        {/* User + logout */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className="w-9 h-9 rounded-full bg-fieo-600 text-white flex items-center justify-center text-sm font-semibold shrink-0">
              {user?.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{user?.name}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {user?.role === 'admin' ? 'Head Office Admin' : officeName(user?.regionalOffice)}
              </p>
            </div>
            <button onClick={logout} className="btn-ghost p-1.5 rounded-md" aria-label="Logout" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export function Breadcrumbs({ route }: { route: Route }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      <Home size={14} className="text-gray-400" />
      <ChevronRight size={14} className="text-gray-300" />
      <span className="text-gray-500 dark:text-gray-400">FIEO RBSM</span>
      <ChevronRight size={14} className="text-gray-300" />
      <span className="font-medium text-gray-800 dark:text-gray-100">{BREADCRUMB_LABELS[route]}</span>
    </nav>
  );
}
