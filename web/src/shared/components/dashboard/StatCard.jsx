import Icon from '../Icon.jsx';

export default function StatCard({ label, value, delta, icon, tone = 'primary' }) {
  const toneClass = {
    primary: 'bg-primary-container text-on-primary-container',
    secondary: 'bg-secondary-container text-on-secondary-container',
    tertiary: 'bg-tertiary-container text-on-tertiary-container',
    neutral: 'bg-surface-container-high text-on-surface',
  }[tone] || 'bg-surface-container-high text-on-surface';

  const deltaSign = delta != null ? (delta > 0 ? '↑' : delta < 0 ? '↓' : '·') : null;
  const deltaTone = delta == null ? '' : delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-on-surface-variant';

  return (
    <div className="rounded-2xl bg-white p-5 shadow-md">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-base font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
          <p className="mt-2 font-heading text-3xl font-extrabold text-on-surface tabular-nums">{value}</p>
          {delta != null && (
            <p className={`mt-1 text-base font-semibold tabular-nums ${deltaTone}`}>
              {deltaSign} {Math.abs(delta)}{typeof delta === 'number' && Number.isFinite(delta) && Math.abs(delta) < 1 ? '%' : ''}
              <span className="ml-1 text-on-surface-variant font-normal">vs last period</span>
            </p>
          )}
        </div>
        {icon && (
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
            <Icon name={icon} size={24} />
          </div>
        )}
      </div>
    </div>
  );
}
