// Lightweight, dependency-free chart primitives for the owner analytics
// dashboard. Bars and the heatmap are plain CSS (flex / grid) so they stay
// crisp and responsive without measuring the container; the trend line is SVG
// with a non-scaling stroke. All colours come from the design tokens
// (var(--primary)/--lime/--coral) — pass token strings via the `color` props.

import { useId } from 'react';

const numberFmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1));

function EmptyChart({ height, label }: { height: number; label: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-[12px] bg-[var(--surface-2)] t-sm"
      style={{ height }}
    >
      {label}
    </div>
  );
}

/* ─── Bar chart (single or stacked) ───────────────────────────────── */

export interface BarSegment {
  value: number;
  /** Any CSS colour — usually a token, e.g. "var(--primary)". */
  color: string;
}
export interface BarDatum {
  label: string;
  segments: BarSegment[];
}

interface BarChartProps {
  data: BarDatum[];
  height?: number;
  formatValue?: (n: number) => string;
  /** Show at most this many x-axis labels (evenly spaced) for long series. */
  maxLabels?: number;
  emptyLabel?: string;
}

export function BarChart({
  data,
  height = 140,
  formatValue = numberFmt,
  maxLabels = 7,
  emptyLabel = 'No data yet',
}: BarChartProps) {
  const totals = data.map((d) => d.segments.reduce((t, s) => t + s.value, 0));
  const max = Math.max(1, ...totals);
  if (!data.length || max <= 1 && totals.every((t) => t === 0)) {
    return <EmptyChart height={height} label={emptyLabel} />;
  }
  const labelStep = Math.max(1, Math.ceil(data.length / maxLabels));

  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((d, i) => {
          const total = totals[i];
          return (
            <div key={`${d.label}-${i}`} className="flex-1 flex flex-col justify-end h-full min-w-0" title={`${d.label}: ${formatValue(total)}`}>
              <div className="flex flex-col-reverse w-full rounded-t-[6px] overflow-hidden" style={{ height: `${(total / max) * 100}%`, minHeight: total > 0 ? 2 : 0 }}>
                {d.segments.map((s, j) => (
                  s.value > 0 ? (
                    <div key={j} style={{ height: `${(s.value / total) * 100}%`, background: s.color }} />
                  ) : null
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-[3px] mt-2">
        {data.map((d, i) => (
          <div key={`l-${i}`} className="flex-1 text-center text-[10px] text-[var(--muted)] truncate">
            {i % labelStep === 0 ? d.label : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Line / trend chart (SVG) ────────────────────────────────────── */

interface LineChartProps {
  points: number[];
  height?: number;
  color?: string;
  fill?: boolean;
  emptyLabel?: string;
}

export function LineChart({
  points,
  height = 140,
  color = 'var(--primary)',
  fill = true,
  emptyLabel = 'No data yet',
}: LineChartProps) {
  const gradId = useId();
  if (!points.length || points.every((p) => p === 0)) {
    return <EmptyChart height={height} label={emptyLabel} />;
  }
  const W = 300;
  const H = 100;
  const max = Math.max(1, ...points);
  const stepX = points.length > 1 ? W / (points.length - 1) : 0;
  const coords = points.map((p, i) => [i * stepX, H - (p / max) * (H - 6) - 3]);
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={height} role="img">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gradId})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Compact axis-less trend line for KPI tiles. */
export function Sparkline({ points, color = 'var(--primary)' }: { points: number[]; color?: string }) {
  if (points.length < 2 || points.every((p) => p === 0)) return null;
  const W = 100;
  const H = 28;
  const max = Math.max(1, ...points);
  const stepX = W / (points.length - 1);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${(H - (p / max) * (H - 4) - 2).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} aria-hidden="true">
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ─── Heatmap (CSS grid) ──────────────────────────────────────────── */

interface HeatmapProps {
  cells: { row: number; col: number; value: number }[];
  rows: number;
  cols: number;
  rowLabel?: (r: number) => string;
  colLabel?: (c: number) => string;
  emptyLabel?: string;
}

export function Heatmap({ cells, rows, cols, rowLabel, colLabel, emptyLabel = 'No data yet' }: HeatmapProps) {
  if (!cells.length) return <EmptyChart height={120} label={emptyLabel} />;
  const max = Math.max(1, ...cells.map((c) => c.value));
  const grid = new Map(cells.map((c) => [`${c.row}-${c.col}`, c.value]));
  const fmtCol = (c: number) => (colLabel ? colLabel(c) : String(c));
  const fmtRow = (r: number) => (rowLabel ? rowLabel(r) : String(r));
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `auto repeat(${cols}, minmax(10px, 1fr))` }}>
        {/* header row */}
        <div />
        {Array.from({ length: cols }, (_, c) => (
          <div key={`c-${c}`} className="text-center text-[9px] text-[var(--muted)]">{fmtCol(c)}</div>
        ))}
        {/* body */}
        {Array.from({ length: rows }, (_, r) => (
          <Row key={`r-${r}`} r={r} cols={cols} grid={grid} max={max} fmtRow={fmtRow} fmtCol={fmtCol} />
        ))}
      </div>
    </div>
  );
}

function Row({ r, cols, grid, max, fmtRow, fmtCol }: { r: number; cols: number; grid: Map<string, number>; max: number; fmtRow: (r: number) => string; fmtCol: (c: number) => string }) {
  return (
    <>
      <div className="pr-1.5 text-[10px] text-[var(--muted)] flex items-center">{fmtRow(r)}</div>
      {Array.from({ length: cols }, (_, c) => {
        const v = grid.get(`${r}-${c}`) ?? 0;
        const o = v === 0 ? 0 : 0.15 + (v / max) * 0.85;
        return (
          <div
            key={`${r}-${c}`}
            className="aspect-square rounded-[3px]"
            style={{ background: v === 0 ? 'var(--surface-2)' : `color-mix(in srgb, var(--primary) ${Math.round(o * 100)}%, transparent)` }}
            title={`${fmtRow(r)} ${fmtCol(c)}: ${v}`}
          />
        );
      })}
    </>
  );
}

/* ─── Donut / ring chart (SVG) ────────────────────────────────────── */

export interface DonutSegment {
  label: string;
  value: number;
  /** Any CSS colour — usually a token, e.g. "var(--primary)". */
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  /** Big number shown in the middle (defaults to the summed total). */
  centerValue?: string;
  centerLabel?: string;
}

// A dependency-free ring chart for the status breakdown. Arcs are drawn with
// stroke-dasharray on stacked circles (the SVG is rotated -90° so the first arc
// starts at 12 o'clock); the hollow centre carries a total.
export function DonutChart({ segments, size = 168, thickness = 20, centerValue, centerLabel }: DonutChartProps) {
  const total = segments.reduce((t, s) => t + s.value, 0);
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label="Breakdown">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        {total > 0 && segments.map((s, i) => {
          if (s.value <= 0) return null;
          const len = (s.value / total) * circ;
          const node = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${len.toFixed(2)} ${(circ - len).toFixed(2)}`}
              strokeDashoffset={(-acc).toFixed(2)}
            />
          );
          acc += len;
          return node;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-heading font-bold text-[26px] leading-none text-[var(--ink)] tabular-nums">
          {total > 0 ? (centerValue ?? String(total)) : '—'}
        </div>
        {centerLabel && <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] mt-1">{centerLabel}</div>}
      </div>
    </div>
  );
}

/* ─── Legend ──────────────────────────────────────────────────────── */

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
          <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
