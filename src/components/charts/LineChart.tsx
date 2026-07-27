import { useId } from 'react';
import type { SeriesPoint } from '@/data/analytics';
import { useChartTooltip, TooltipOverlay } from './Tooltip';

// Smooth area+line chart for time series (monthly activities).
export function LineChart({ data, height = 240, color = '#1f4a8a' }: { data: SeriesPoint[]; height?: number; color?: string }) {
  const uid = useId().replace(/:/g, '');
  const { tip, show, hide } = useChartTooltip();
  const width = 600;
  const pad = { top: 16, right: 14, bottom: 28, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;

  const x = (i: number) => pad.left + i * step;
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.value)}`).join(' ');
  const areaPath = `${linePath} L ${x(data.length - 1)} ${pad.top + innerH} L ${x(0)} ${pad.top + innerH} Z`;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Line chart">
        <defs>
          <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yy = pad.top + innerH * (1 - t);
          return (
            <g key={t}>
              <line x1={pad.left} y1={yy} x2={width - pad.right} y2={yy} stroke="currentColor" className="text-gray-100 dark:text-gray-800" />
              <text x={pad.left - 6} y={yy + 3} textAnchor="end" className="fill-gray-400 text-[9px]">{Math.round(max * t)}</text>
            </g>
          );
        })}
        <path d={areaPath} fill={`url(#area-${uid})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={d.label} onMouseEnter={() => show(x(i), y(d.value), `${d.label}: ${d.value}`)} onMouseLeave={hide}>
            <circle cx={x(i)} cy={y(d.value)} r="3.5" fill="white" stroke={color} strokeWidth="2" className="transition-r hover:r-[5]" />
            <text x={x(i)} y={height - 10} textAnchor="middle" className="fill-gray-500 dark:fill-gray-400 text-[9px]">{d.label}</text>
          </g>
        ))}
      </svg>
      <TooltipOverlay tip={tip} />
    </div>
  );
}
