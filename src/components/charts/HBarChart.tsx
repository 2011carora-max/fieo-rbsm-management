import { useId, useState } from 'react';
import type { SeriesPoint } from '@/data/analytics';
import { useChartTooltip, TooltipOverlay } from './Tooltip';

// Horizontal bar chart — useful for ranked lists (offices, countries, products).
// When `limit` is set and the data has more entries than that, only the top
// `limit` (by value) render initially, with a "Show all" toggle below to
// expand to the full list — keeps long-tail category lists (e.g. 40+ product
// types) readable by default without losing access to the rest.
export function HBarChart({ data, height = 260, color = '#1f4a8a', valueFormat, limit }: { data: SeriesPoint[]; height?: number; color?: string; valueFormat?: (v: number) => string; limit?: number }) {
  const uid = useId().replace(/:/g, '');
  const { tip, show, hide } = useChartTooltip();
  const [expanded, setExpanded] = useState(false);

  const sorted = limit ? [...data].sort((a, b) => b.value - a.value) : data;
  const shouldCap = !!limit && sorted.length > limit;
  const visible = shouldCap && !expanded ? sorted.slice(0, limit) : sorted;

  const width = 600;
  const pad = { top: 8, right: 48, bottom: 8, left: 110 };
  const innerW = width - pad.left - pad.right;
  const chartHeight = expanded && shouldCap ? Math.max(height, visible.length * 26 + pad.top + pad.bottom) : height;
  const rowH = visible.length ? Math.min(28, (chartHeight - pad.top - pad.bottom) / visible.length) : 0;
  const max = Math.max(1, ...visible.map((d) => d.value));

  return (
    <div className="relative w-full">
      <div className={expanded && shouldCap ? 'max-h-[420px] overflow-y-auto' : ''}>
        <svg viewBox={`0 0 ${width} ${chartHeight}`} className="w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Horizontal bar chart">
          <defs>
            <linearGradient id={`hbar-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity="0.95" />
              <stop offset="100%" stopColor={color} stopOpacity="0.6" />
            </linearGradient>
          </defs>
          {visible.map((d, i) => {
            const y = pad.top + i * rowH;
            const w = (d.value / max) * innerW;
            return (
              <g key={d.label} onMouseEnter={() => show(pad.left + w / 2, y + rowH / 2, `${d.label}: ${valueFormat ? valueFormat(d.value) : d.value}`)} onMouseLeave={hide}>
                <text x={pad.left - 8} y={y + rowH / 2 + 3} textAnchor="end" className="fill-gray-500 dark:fill-gray-400 text-[10px]">
                  {d.label.length > 16 ? d.label.slice(0, 15) + '…' : d.label}
                </text>
                <rect x={pad.left} y={y + 2} width={w} height={rowH - 6} rx="4" fill={`url(#hbar-${uid})`} className="transition-opacity hover:opacity-80" />
                <text x={pad.left + w + 6} y={y + rowH / 2 + 3} className="fill-gray-600 dark:fill-gray-300 text-[10px] font-medium">
                  {valueFormat ? valueFormat(d.value) : d.value}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <TooltipOverlay tip={tip} />
      {shouldCap && (
        <button
          type="button"
          className="mt-2 text-xs font-medium text-fieo-600 hover:text-fieo-700 dark:text-fieo-400 dark:hover:text-fieo-300"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? `Show top ${limit} only` : `Show all ${sorted.length} →`}
        </button>
      )}
    </div>
  );
}
