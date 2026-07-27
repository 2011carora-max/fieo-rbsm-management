import { cn } from '@/lib/cn';

// FIEO logo mark — a stylized "F" badge in the official blue with a saffron accent bar.
// Used in the sidebar, top nav, login, and print headers.
export function FieoLogo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn('relative shrink-0 rounded-xl bg-fieo-600 flex items-center justify-center shadow-soft', className)}
      style={{ width: size, height: size }}
      aria-label="FIEO logo"
      role="img"
    >
      <span className="font-serif font-bold text-white" style={{ fontSize: size * 0.5 }}>
        F
      </span>
      <span className="absolute bottom-1 left-1 right-1 h-[3px] rounded-full bg-saffron-500" />
    </div>
  );
}

export function FieoWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="leading-tight">
      <p className="font-serif font-bold text-fieo-700 dark:text-white text-sm tracking-wide">FIEO</p>
      {!compact && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight max-w-[150px]">
          Federation of Indian Export Organisations
        </p>
      )}
    </div>
  );
}
