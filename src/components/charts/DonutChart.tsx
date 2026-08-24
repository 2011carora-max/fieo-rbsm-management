import { useState } from 'react';
import type { SeriesPoint } from '@/data/analytics';
import { useChartTooltip, TooltipOverlay } from './Tooltip';
import { cn } from '@/lib/cn';

const PALETTE = ['#1f4a8a', '#df7620', '#2e62a8', '#e68f3a', '#4d80c4', '#c75e16', '#7ea6d8', '#a44714', '#b0c9e9', '#6c3117'];
const OTHER_COLOR = '#9ca3af';

// Donut chart with center label and legend — for share-of distributions.
// When `limit` is set and there are more categories than that, the ring
// itself folds anything past the top `limit - 1` into a single "Other"
// slice (so it stays visually readable regardless of how many categories
// exist), while the legend list gets a "Show all" toggle to reveal every
// category with its exact count.
export function DonutChart({ data, height = 260, valueFormat, limit }: { data: SeriesPoint[]; height?: number; valueFormat?: (v: number) => string; limit?: number }) {
  const { tip, show, hide } = useChartTooltip();
  const [expanded, setExpanded] = useState(false);

  const sorted = limit ? [...data].sort((a, b) => b.value - a.value) : data;
  const shouldCap = !!limit && sorted.length > limit;
  const colored = sorted.map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }));

  const ringSource = shouldCap
    ? [...colored.slice(0, limit - 1), { label: 'Other', value: colored.slice(limit - 1).reduce((s, d) => s + d.value, 0), color: OTHER_COLOR }]
    : colored;
  const listSource = shouldCap && !expanded ? colored.slice(0, limit) : colored;

  const total = ringSource.reduce((s, d) => s + d.value, 0) || 1;
  const size = Math.min(220, height);
  const cx = size / 2, cy = size / 2, r = size / 2 - 6, ir = r * 0.62;

  let acc = 0;
  const slices = ringSource.map((d) => {
    const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += d.value;
    const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const ix1 = cx + ir * Math.cos(start), iy1 = cy + ir * Math.sin(start);
    const ix2 = cx + ir * Math.cos(end), iy2 = cy + ir * Math.sin(end);
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1} Z`;
    return { path, color: d.color, label: d.label, value: d.value, pct: (d.value / total) * 100 };
  });

  return (
    <div className="flex flex-col sm:flex-row items-start gap-4">
      <div className="relative shrink-0 mx-auto sm:mx-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Donut chart">
          {slices.map((s, i) => (
            <path
              key={i}
              d={s.path}
              fill={s.color}
              className="transition-opacity hover:opacity-80"
              onMouseEnter={() => show(cx, cy, `${s.label}: ${valueFormat ? valueFormat(s.value) : s.value} (${s.pct.toFixed(0)}%)`)}
              onMouseLeave={hide}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">{data.reduce((s, d) => s + d.value, 0)}</span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</span>
        </div>
        <TooltipOverlay tip={tip} />
      </div>
      <div className="flex-1 w-full min-w-0">
        <ul className={cn('grid grid-cols-1 gap-1.5 text-xs w-full', expanded && 'max-h-[320px] overflow-y-auto pr-1')}>
          {listSource.map((d, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: d.color }} />
              <span className="text-gray-600 dark:text-gray-300 flex-1 truncate">{d.label}</span>
              <span className="text-gray-500 dark:text-gray-400 font-medium">{valueFormat ? valueFormat(d.value) : d.value}</span>
              <span className="text-gray-400 w-9 text-right">{((d.value / total) * 100).toFixed(0)}%</span>
            </li>
          ))}
        </ul>
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
    </div>
  );
}
