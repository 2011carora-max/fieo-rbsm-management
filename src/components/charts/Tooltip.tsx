import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface TooltipState { x: number; y: number; content: ReactNode; }

// Lightweight hover tooltip used by the charts. Positioned with absolute coords
// relative to the chart's container.
export function useChartTooltip() {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const show = (x: number, y: number, content: ReactNode) => setTip({ x, y, content });
  const hide = () => setTip(null);
  return { tip, show, hide };
}

export function TooltipOverlay({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null;
  return (
    <div
      className={cn('absolute pointer-events-none z-10 px-2.5 py-1.5 rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium shadow-soft-lg whitespace-nowrap transition-opacity')}
      style={{ left: tip.x, top: tip.y, transform: 'translate(-50%, -120%)' }}
    >
      {tip.content}
    </div>
  );
}
