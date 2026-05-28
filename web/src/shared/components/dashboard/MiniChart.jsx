import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

// data: array of { date: 'YYYY-MM-DD', value: number }
export default function MiniChart({ title, data = [], color = '#0040E0', height = 140, dataKey = 'value', formatValue = (v) => v }) {
  const total = data.reduce((sum, d) => sum + (d[dataKey] || 0), 0);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-md">
      <div className="flex items-baseline justify-between">
        <p className="text-base font-bold uppercase tracking-wider text-on-surface-variant">{title}</p>
        <p className="font-heading text-xl font-extrabold text-on-surface tabular-nums">{formatValue(total)}</p>
      </div>

      <div className="mt-3" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="2 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(d) => (d || '').slice(5)} interval="preserveStartEnd" minTickGap={32} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={32} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(v) => [formatValue(v), title]}
              labelStyle={{ color: '#64748b' }}
            />
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#grad-${color.replace('#', '')})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
