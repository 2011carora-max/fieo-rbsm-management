import type { SeriesPoint } from '@/data/analytics';
import { useChartTooltip, TooltipOverlay } from './Tooltip';

const PALETTE = ['#1f4a8a', '#df7620', '#2e62a8', '#e68f3a', '#4d80c4', '#c75e16', '#7ea6d8', '#a44714', '#b0c9e9', '#6c3117'];

// Donut chart with center label and legend — for share-of distributions.
export function DonutChart({ data, height = 260, valueFormat }: { data: SeriesPoint[]; height?: number; valueFormat?: (v: number) => string }) {
  const { tip, show, hide } = useChartTooltip();
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const size = Math.min(220, height);
  const cx = size / 2, cy = size / 2, r = size / 2 - 6, ir = r * 0.62;

  let acc = 0;
  const slices = data.map((d, i) => {
    const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += d.value;
    const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const ix1 = cx + ir * Math.cos(start), iy1 = cy + ir * Math.sin(start);
    const ix2 = cx + ir * Math.cos(end), iy2 = cy + ir * Math.sin(end);
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1} Z`;
    return { path, color: PALETTE[i % PALETTE.length], label: d.label, value: d.value, pct: (d.value / total) * 100 };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
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
          <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">{total}</span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</span>
        </div>
        <TooltipOverlay tip={tip} />
      </div>
      <ul className="flex-1 grid grid-cols-1 gap-1.5 text-xs w-full">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-gray-600 dark:text-gray-300 flex-1 truncate">{s.label}</span>
            <span className="text-gray-500 dark:text-gray-400 font-medium">{valueFormat ? valueFormat(s.value) : s.value}</span>
            <span className="text-gray-400 w-9 text-right">{s.pct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
