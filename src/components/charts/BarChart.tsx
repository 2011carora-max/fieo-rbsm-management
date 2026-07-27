import { useId } from 'react';
import type { SeriesPoint } from '@/data/analytics';
import { useChartTooltip, TooltipOverlay } from './Tooltip';

// Vertical bar chart rendered as inline SVG — no chart library dependency.
export function BarChart({ data, height = 240, color = '#1f4a8a', valueFormat }: { data: SeriesPoint[]; height?: number; color?: string; valueFormat?: (v: number) => string }) {
  const uid = useId().replace(/:/g, '');
  const { tip, show, hide } = useChartTooltip();
  const width = 600;
  const pad = { top: 16, right: 12, bottom: 28, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = data.length ? (innerW / data.length) * 0.62 : 0;
  const gap = data.length ? innerW / data.length : 0;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Bar chart">
        <defs>
          <linearGradient id={`bar-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad.top + innerH * (1 - t);
          return (
            <g key={t}>
              <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeWidth="1" />
              <text x={pad.left - 6} y={y + 3} textAnchor="end" className="fill-gray-400 text-[9px]">
                {Math.round(max * t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.value / max) * innerH;
          const x = pad.left + i * gap + (gap - barW) / 2;
          const y = pad.top + innerH - h;
          return (
            <g key={d.label} onMouseEnter={() => show(x + barW / 2, y, `${d.label}: ${valueFormat ? valueFormat(d.value) : d.value}`)} onMouseLeave={hide}>
              <rect x={x} y={y} width={barW} height={h} rx="4" fill={`url(#bar-${uid})`} className="transition-opacity hover:opacity-80" />
              <text x={x + barW / 2} y={height - 10} textAnchor="middle" className="fill-gray-500 dark:fill-gray-400 text-[9px]">
                {d.label.length > 8 ? d.label.slice(0, 7) + '…' : d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <TooltipOverlay tip={tip} />
    </div>
  );
}
