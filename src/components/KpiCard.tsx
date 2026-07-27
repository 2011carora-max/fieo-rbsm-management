import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent?: 'blue' | 'saffron' | 'green' | 'red' | 'gray';
  hint?: string;
}

const ACCENTS = {
  blue: 'bg-fieo-50 dark:bg-fieo-900/40 text-fieo-600 dark:text-fieo-300',
  saffron: 'bg-saffron-50 dark:bg-saffron-900/40 text-saffron-600 dark:text-saffron-300',
  green: 'bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-300',
  red: 'bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-300',
  gray: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
} as const;

export function KpiCard({ label, value, icon, accent = 'blue', hint }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {hint && <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500 truncate">{hint}</p>}
        </div>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', ACCENTS[accent])} aria-hidden>
          {icon}
        </div>
      </div>
    </div>
  );
}
