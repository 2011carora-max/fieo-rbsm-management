import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';

type ToastType = 'success' | 'info' | 'warning' | 'error';
interface Toast { id: number; type: ToastType; message: string; }

interface ToastContextValue {
  notify: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
} as const;

const STYLES = {
  success: 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200',
  info: 'border-fieo-200 bg-fieo-50 text-fieo-800 dark:border-fieo-900 dark:bg-fieo-950 dark:text-fieo-200',
  warning: 'border-saffron-200 bg-saffron-50 text-saffron-800 dark:border-saffron-900 dark:bg-saffron-950 dark:text-saffron-200',
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,360px)] no-print" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div key={t.id} className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-soft-lg animate-scale-in ${STYLES[t.type]}`} role="alert">
              <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
              <p className="text-sm flex-1">{t.message}</p>
              <button onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100" aria-label="Dismiss notification">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
