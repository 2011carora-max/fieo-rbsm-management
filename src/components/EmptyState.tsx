import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({ title, message, action, icon }: { title: string; message?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4 text-gray-400">
        {icon ?? <Inbox size={28} />}
      </div>
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200">{title}</h3>
      {message && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
