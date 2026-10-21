import { cn } from '@/lib/cn';

// FIEO logo — the official multicolour FIEO mark (public/fieo-logo.png).
// Shown on a white tile so it stays clear on the blue login panel and in dark mode.
// Used in the sidebar, top nav, login, and workflow selection screens.
export function FieoLogo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn('relative shrink-0 rounded-xl bg-white flex items-center justify-center shadow-soft overflow-hidden', className)}
      style={{ width: size, height: size, padding: Math.max(2, Math.round(size * 0.06)) }}
    >
      <img src="/fieo-logo.png" alt="FIEO logo" className="w-full h-full object-contain" draggable={false} />
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
