import { Menu, Moon, Sun, Bell, Search } from 'lucide-react';
import { FieoLogo } from '@/components/FieoLogo';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import type { Route } from '@/components/Sidebar';
import { Breadcrumbs } from '@/components/Sidebar';

interface TopNavProps {
  route: Route;
  onMenu: () => void;
  onSearch?: (q: string) => void;
}

export function TopNav({ route, onMenu }: TopNavProps) {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-100 dark:border-gray-800 no-print">
      <div className="flex items-center gap-3 h-16 px-4 lg:px-6">
        <button className="btn-ghost p-2 rounded-lg lg:hidden" onClick={onMenu} aria-label="Open menu">
          <Menu size={20} />
        </button>

        <div className="lg:hidden">
          <FieoLogo size={32} />
        </div>

        <div className="hidden lg:block">
          <Breadcrumbs route={route} />
        </div>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 w-64">
          <Search size={16} />
          <input
            type="search"
            placeholder="Quick search…"
            className="bg-transparent border-0 outline-none text-sm w-full text-gray-700 dark:text-gray-200 placeholder-gray-400"
            aria-label="Quick search"
          />
        </div>

        <button onClick={toggle} className="btn-ghost p-2 rounded-lg" aria-label="Toggle dark mode" title="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button className="btn-ghost p-2 rounded-lg relative" aria-label="Notifications">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-saffron-500" />
        </button>

        <div className="hidden sm:flex items-center gap-2 pl-3 ml-1 border-l border-gray-100 dark:border-gray-800">
          <div className="w-8 h-8 rounded-full bg-fieo-600 text-white flex items-center justify-center text-xs font-semibold">
            {user?.name.charAt(0)}
          </div>
          <div className="leading-tight">
            <p className="text-xs font-medium text-gray-800 dark:text-gray-100">{user?.name}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{user?.role === 'admin' ? 'Administrator' : 'Regional User'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
